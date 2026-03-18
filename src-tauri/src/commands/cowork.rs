use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

use crate::providers::types::*;
use crate::state::AppState;

const COWORK_SYSTEM: &str = include_str!("../../prompts/cowork.md");

// Track active cowork session abort channel
static COWORK_ABORT: std::sync::LazyLock<Mutex<Option<tokio::sync::watch::Sender<bool>>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

// Track cowork messages for follow-up
static COWORK_MESSAGES: std::sync::LazyLock<Mutex<Vec<ChatMessage>>> =
    std::sync::LazyLock::new(|| Mutex::new(Vec::new()));

#[tauri::command]
pub async fn cowork_start(
    task: String,
    provider: String,
    model: Option<String>,
    reasoning_effort: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let access_token = state
        .auth
        .get_access_token(&provider, &state.db, &app)
        .await
        .ok_or(format!("Not connected to {provider}"))?;

    let llm_provider = state
        .router
        .get_provider(&provider)
        .ok_or(format!("Unknown provider: {provider}"))?;

    // Abort any existing session
    if let Some(tx) = COWORK_ABORT.lock().unwrap().take() {
        let _ = tx.send(true);
    }
    let (abort_tx, abort_rx) = tokio::sync::watch::channel(false);
    *COWORK_ABORT.lock().unwrap() = Some(abort_tx);

    // Get MCP tools
    let mcp_tools = state.mcp.list_tools().await.unwrap_or_default();
    let tools: Vec<ToolDefinition> = mcp_tools
        .iter()
        .map(|t| ToolDefinition {
            name: t.name.clone(),
            description: t.description.clone(),
            input_schema: t.input_schema.clone(),
        })
        .collect();

    let tool_names: Vec<String> = tools.iter().map(|t| t.name.clone()).collect();
    let system = format!(
        "{COWORK_SYSTEM}\n\nAvailable tools: {}",
        tool_names.join(", ")
    );

    let mut messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system,
            tool_call_id: None,
            tool_use_id: None,
            images: None,
            tool_calls: None,
        },
        ChatMessage {
            role: "user".to_string(),
            content: task,
            tool_call_id: None,
            tool_use_id: None,
            images: None,
            tool_calls: None,
        },
    ];

    let result = run_cowork_loop(
        &mut messages,
        &tools,
        &access_token,
        llm_provider,
        model.as_deref(),
        reasoning_effort.as_deref(),
        &state,
        &app,
        abort_rx,
    )
    .await;

    // Store messages for follow-up
    *COWORK_MESSAGES.lock().unwrap() = messages;

    match result {
        Ok(_) => Ok(()),
        Err(e) if e == "AbortError" => {
            let _ = app.emit(
                "cowork:complete",
                serde_json::json!({ "summary": "Task stopped by user." }),
            );
            Ok(())
        }
        Err(e) => {
            let _ = app.emit("cowork:error", serde_json::json!({ "error": e }));
            Err(e)
        }
    }
}

#[tauri::command]
pub fn cowork_stop(_state: State<'_, AppState>) {
    if let Some(tx) = COWORK_ABORT.lock().unwrap().take() {
        let _ = tx.send(true);
    }
}

#[tauri::command]
pub fn cowork_follow_up(instruction: String) -> Result<(), String> {
    let mut msgs = COWORK_MESSAGES.lock().unwrap();
    msgs.push(ChatMessage {
        role: "user".to_string(),
        content: instruction,
        tool_call_id: None,
        tool_use_id: None,
        images: None,
        tool_calls: None,
    });
    Ok(())
}

async fn run_cowork_loop(
    messages: &mut Vec<ChatMessage>,
    tools: &[ToolDefinition],
    access_token: &str,
    provider: std::sync::Arc<dyn LLMProvider>,
    model: Option<&str>,
    reasoning_effort: Option<&str>,
    state: &AppState,
    app: &AppHandle,
    abort_rx: tokio::sync::watch::Receiver<bool>,
) -> Result<(), String> {
    let mut full_response = String::new();
    let mut plan_parsed = false;

    let (tx, mut rx) = tokio::sync::mpsc::channel::<StreamEvent>(64);
    let provider_clone = provider.clone();
    let msgs = messages.clone();
    let tools_clone = tools.to_vec();
    let token = access_token.to_string();
    let mdl = model.map(|s| s.to_string());
    let effort = reasoning_effort.map(|s| s.to_string());

    let send_handle = tokio::spawn(async move {
        provider_clone
            .send_message(
                &msgs,
                &tools_clone,
                &token,
                tx,
                mdl.as_deref(),
                effort.as_deref(),
            )
            .await
    });

    while let Some(event) = rx.recv().await {
        if *abort_rx.borrow() {
            return Err("AbortError".to_string());
        }
        match event {
            StreamEvent::Token(text) => {
                full_response.push_str(&text);

                // Parse plan lines
                if !plan_parsed {
                    let plan_lines: Vec<String> = full_response
                        .lines()
                        .filter(|l| l.trim().starts_with("PLAN:"))
                        .map(|l| {
                            l.trim()
                                .strip_prefix("PLAN:")
                                .unwrap_or("")
                                .trim()
                                .to_string()
                        })
                        .collect();
                    if plan_lines.len() >= 2 {
                        let _ =
                            app.emit("cowork:plan", serde_json::json!({ "steps": plan_lines }));
                        plan_parsed = true;
                    }
                }

                // Parse step markers
                for line in text.lines() {
                    let trimmed = line.trim();
                    if let Some(rest) = trimmed.strip_prefix("STEP_START:") {
                        if let Ok(n) = rest.trim().parse::<i64>() {
                            let _ = app
                                .emit("cowork:step-start", serde_json::json!({ "step": n }));
                        }
                    }
                    if let Some(rest) = trimmed.strip_prefix("STEP_COMPLETE:") {
                        if let Ok(n) = rest.trim().parse::<i64>() {
                            let _ = app
                                .emit("cowork:step-complete", serde_json::json!({ "step": n }));
                        }
                    }
                }

                let _ = app.emit("cowork:stream", serde_json::json!({ "chunk": text }));
            }
            StreamEvent::ToolCall(tc) => {
                let _ = app.emit(
                    "cowork:tool-call",
                    serde_json::json!({ "id": tc.id, "name": tc.name, "input": tc.arguments }),
                );
            }
            StreamEvent::Thinking(text) => {
                let _ = app.emit("cowork:stream", serde_json::json!({ "chunk": text }));
            }
            StreamEvent::Error(e) => {
                let _ = app.emit("cowork:error", serde_json::json!({ "error": e }));
            }
            StreamEvent::Complete => {}
        }
    }

    let result = send_handle.await.map_err(|e| e.to_string())??;

    if result.stop_reason == StopReason::ToolUse && !result.tool_calls.is_empty() {
        // Save assistant message
        messages.push(ChatMessage {
            role: "assistant".to_string(),
            content: if full_response.is_empty() {
                "[tool call]".to_string()
            } else {
                full_response
            },
            tool_calls: Some(result.tool_calls.clone()),
            tool_call_id: None,
            tool_use_id: None,
            images: None,
        });

        // Execute tool calls via MCP bridge
        for tc in &result.tool_calls {
            let content =
                match state.mcp.call_tool(&tc.name, tc.arguments.clone()).await {
                    Ok(res) => {
                        let text: String = res
                            .content
                            .iter()
                            .filter_map(|c| c.get("text").and_then(|v| v.as_str()))
                            .collect::<Vec<_>>()
                            .join("\n");
                        let content = if res.is_error {
                            format!("Error: {text}")
                        } else {
                            text
                        };
                        let _ = app.emit(
                            "cowork:tool-result",
                            serde_json::json!({
                                "id": tc.id, "result": content,
                                "status": if res.is_error { "error" } else { "success" }
                            }),
                        );
                        content
                    }
                    Err(e) => {
                        let err = format!("Error executing tool {}: {e}", tc.name);
                        let _ = app.emit(
                            "cowork:tool-result",
                            serde_json::json!({ "id": tc.id, "result": err, "status": "error" }),
                        );
                        err
                    }
                };
            messages.push(ChatMessage {
                role: "tool".to_string(),
                content,
                tool_call_id: Some(tc.id.clone()),
                tool_use_id: None,
                images: None,
                tool_calls: None,
            });
        }

        // Continue the agent loop
        return Box::pin(run_cowork_loop(
            messages,
            tools,
            access_token,
            provider,
            model,
            reasoning_effort,
            state,
            app,
            abort_rx,
        ))
        .await;
    }

    // Task complete
    messages.push(ChatMessage {
        role: "assistant".to_string(),
        content: full_response.clone(),
        tool_call_id: None,
        tool_use_id: None,
        images: None,
        tool_calls: None,
    });
    let _ = app.emit(
        "cowork:complete",
        serde_json::json!({ "summary": full_response }),
    );
    Ok(())
}
