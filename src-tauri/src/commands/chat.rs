use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

use crate::db::conversations;
use crate::providers::types::*;
use crate::state::AppState;

// Track active requests per conversation
static ACTIVE_REQUESTS: std::sync::LazyLock<Mutex<HashMap<String, String>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub async fn chat_send(
    conversation_id: String,
    message: String,
    provider: String,
    attachments: Option<String>,
    model: Option<String>,
    reasoning_effort: Option<String>,
    prompt_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    // Get access token
    let access_token = state
        .auth
        .get_access_token(&provider, &state.db, &app)
        .await
        .ok_or(format!("Not connected to {provider}"))?;

    // Inject skill instructions if prompt_id provided
    if let Some(ref pid) = prompt_id {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(instructions) = crate::db::skills::get_skill_instructions(&conn, pid) {
            conversations::add_message(&conn, &conversation_id, "system", &instructions, None, None, None, None, None)
                .map_err(|e| e.to_string())?;
        }
    }

    // Save user message
    {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        conversations::add_message(
            &conn,
            &conversation_id,
            "user",
            &message,
            None,
            None,
            attachments.as_deref(),
            None,
            None,
        )
        .map_err(|e| e.to_string())?;
        conversations::auto_title_if_needed(&conn, &conversation_id, &message)
            .map_err(|e| e.to_string())?;
    }

    // Get LLM provider
    let llm_provider = state
        .router
        .get_provider(&provider)
        .ok_or(format!("Unknown provider: {provider}"))?;

    ACTIVE_REQUESTS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(conversation_id.clone(), provider.clone());

    // Build message history
    let chat_messages = {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        let db_msgs = conversations::get_messages(&conn, &conversation_id)
            .map_err(|e| e.to_string())?;
        db_msgs
            .iter()
            .map(|m| {
                let mut cm = ChatMessage {
                    role: m.role.clone(),
                    content: m.content.clone(),
                    tool_use_id: m.tool_use_id.clone(),
                    tool_call_id: m.tool_use_id.clone(),
                    images: None,
                    tool_calls: None,
                };
                if let Some(ref att) = m.attachments {
                    if let Ok(atts) = serde_json::from_str::<Vec<serde_json::Value>>(att) {
                        let imgs: Vec<String> = atts
                            .iter()
                            .filter(|a| a.get("type").and_then(|v| v.as_str()) == Some("image"))
                            .filter_map(|a| a.get("dataUrl").and_then(|v| v.as_str()).map(|s| s.to_string()))
                            .collect();
                        if !imgs.is_empty() {
                            cm.images = Some(imgs);
                        }
                    }
                }
                cm
            })
            .collect::<Vec<_>>()
    };

    // Send context usage
    let total_tokens = chat_messages.iter().map(|m| estimate_token_count(&m.content)).sum::<usize>();
    let context_window = get_context_window(model.as_deref());
    let _ = app.emit(
        "chat:context-usage",
        serde_json::json!({ "conversationId": conversation_id, "used": total_tokens, "max": context_window }),
    );

    // Get MCP tools from sidecar
    let mcp_tools = state.mcp.list_tools().await.unwrap_or_default();
    let tools: Vec<ToolDefinition> = mcp_tools
        .iter()
        .map(|t| ToolDefinition {
            name: t.name.clone(),
            description: t.description.clone(),
            input_schema: t.input_schema.clone(),
        })
        .collect();

    // Agent loop
    let result = run_agent_loop(
        &conversation_id,
        chat_messages,
        tools,
        &access_token,
        llm_provider,
        model.as_deref(),
        reasoning_effort.as_deref(),
        &state,
        &app,
    )
    .await;

    ACTIVE_REQUESTS.lock().unwrap_or_else(|e| e.into_inner()).remove(&conversation_id);

    match result {
        Ok(_) => {
            // Fire-and-forget: smart title generation
            let conv_id = conversation_id.clone();
            let msg = message.clone();
            let prov = provider.clone();
            let token = access_token.clone();
            let mdl = model.clone();
            let app2 = app.clone();
            // Use create_fresh for isolated provider instance (avoids abort conflicts)
            let router = state.router.create_fresh(&prov);
            tokio::spawn(async move {
                if let Some(provider) = router {
                    if let Ok(title) = generate_smart_title(&provider, &token, &msg, mdl.as_deref()).await {
                        // Save title to DB — need a new connection
                        // We'll emit the event and let the frontend know
                        let _ = app2.emit("conv:title-updated", serde_json::json!({ "conversationId": conv_id, "title": title }));
                    }
                }
            });
            Ok(())
        }
        Err(e) if e == "AbortError" => {
            let _ = app.emit("chat:complete", serde_json::json!({ "conversationId": conversation_id }));
            Ok(())
        }
        Err(e) => {
            let _ = app.emit("chat:error", serde_json::json!({ "conversationId": conversation_id, "error": e }));
            Err(e)
        }
    }
}

#[tauri::command]
pub fn chat_stop(conversation_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let provider = ACTIVE_REQUESTS.lock().unwrap_or_else(|e| e.into_inner()).get(&conversation_id).cloned();
    if let Some(provider) = provider {
        state.router.abort(&provider);
        ACTIVE_REQUESTS.lock().unwrap_or_else(|e| e.into_inner()).remove(&conversation_id);
    }
    Ok(())
}

async fn run_agent_loop(
    conversation_id: &str,
    mut messages: Vec<ChatMessage>,
    tools: Vec<ToolDefinition>,
    access_token: &str,
    provider: std::sync::Arc<dyn LLMProvider>,
    model: Option<&str>,
    reasoning_effort: Option<&str>,
    state: &AppState,
    app: &AppHandle,
) -> Result<(), String> {
    let mut full_response = String::new();

    loop {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<StreamEvent>(64);

        let provider_clone = provider.clone();
        let messages_clone = messages.clone();
        let tools_clone = tools.clone();
        let token = access_token.to_string();
        let mdl = model.map(|s| s.to_string());
        let effort = reasoning_effort.map(|s| s.to_string());

        let send_handle = tokio::spawn(async move {
            provider_clone
                .send_message(
                    &messages_clone,
                    &tools_clone,
                    &token,
                    tx,
                    mdl.as_deref(),
                    effort.as_deref(),
                )
                .await
        });

        // Consume stream events
        while let Some(event) = rx.recv().await {
            match event {
                StreamEvent::Token(text) => {
                    full_response.push_str(&text);
                    let _ = app.emit("chat:stream", serde_json::json!({ "conversationId": conversation_id, "chunk": text }));
                }
                StreamEvent::Thinking(text) => {
                    let _ = app.emit("chat:thinking", serde_json::json!({ "conversationId": conversation_id, "chunk": text }));
                }
                StreamEvent::ToolCall(tc) => {
                    let _ = app.emit("chat:tool-call", serde_json::json!({
                        "conversationId": conversation_id, "tool": tc.name, "args": tc.arguments
                    }));
                }
                StreamEvent::Complete => {}
                StreamEvent::Error(e) => {
                    let _ = app.emit("chat:error", serde_json::json!({ "conversationId": conversation_id, "error": e }));
                }
            }
        }

        let result = send_handle.await.map_err(|e| e.to_string())??;

        if result.stop_reason == StopReason::ToolUse && !result.tool_calls.is_empty() {
            // Save assistant message
            {
                let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
                let content = if full_response.is_empty() { "[tool call]" } else { &full_response };
                conversations::add_message(&conn, conversation_id, "assistant", content, None, None, None, None, None)
                    .map_err(|e| e.to_string())?;
            }

            // Execute tool calls via MCP bridge
            let mut tool_result_msgs = Vec::new();
            for tc in &result.tool_calls {
                let content = match state.mcp.call_tool(&tc.name, tc.arguments.clone()).await {
                    Ok(result) => {
                        let text: String = result.content.iter()
                            .filter_map(|c| c.get("text").and_then(|v| v.as_str()))
                            .collect::<Vec<_>>().join("\n");
                        if result.is_error { format!("Error: {text}") } else { text }
                    }
                    Err(e) => format!("Error executing tool {}: {e}", tc.name),
                };
                {
                    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
                    conversations::add_message(
                        &conn,
                        conversation_id,
                        "tool",
                        &content,
                        Some(&tc.id),
                        None,
                        None,
                        Some(&tc.name),
                        Some(&serde_json::to_string(&tc.arguments).unwrap_or_default()),
                    )
                    .map_err(|e| e.to_string())?;
                }
                tool_result_msgs.push(ChatMessage {
                    role: "tool".to_string(),
                    content,
                    tool_call_id: Some(tc.id.clone()),
                    tool_use_id: None,
                    images: None,
                    tool_calls: None,
                });
            }

            // Update messages for next loop iteration
            messages.push(ChatMessage {
                role: "assistant".to_string(),
                content: if full_response.is_empty() { "[tool call]".to_string() } else { full_response.clone() },
                tool_calls: Some(result.tool_calls),
                tool_call_id: None,
                tool_use_id: None,
                images: None,
            });
            messages.extend(tool_result_msgs);

            full_response.clear();
            continue;
        }

        // End turn — save final response
        if !full_response.is_empty() {
            let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
            conversations::add_message(&conn, conversation_id, "assistant", &full_response, None, None, None, None, None)
                .map_err(|e| e.to_string())?;
        }
        let _ = app.emit("chat:complete", serde_json::json!({ "conversationId": conversation_id }));
        return Ok(());
    }
}

async fn generate_smart_title(
    provider: &std::sync::Arc<dyn LLMProvider>,
    access_token: &str,
    user_message: &str,
    model: Option<&str>,
) -> Result<String, String> {
    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: "Generate a concise conversation title (3-8 words) based on the user's message. No quotes, no period, no prefix. Reply with ONLY the title, nothing else.".to_string(),
            tool_call_id: None, tool_use_id: None, images: None, tool_calls: None,
        },
        ChatMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
            tool_call_id: None, tool_use_id: None, images: None, tool_calls: None,
        },
    ];

    let (tx, mut rx) = tokio::sync::mpsc::channel::<StreamEvent>(32);
    let provider_clone = provider.clone();
    let token = access_token.to_string();
    let mdl = model.map(|s| s.to_string());

    tokio::spawn(async move {
        let _ = provider_clone.send_message(&messages, &[], &token, tx, mdl.as_deref(), None).await;
    });

    let mut title = String::new();
    while let Some(event) = rx.recv().await {
        if let StreamEvent::Token(text) = event {
            title.push_str(&text);
        }
    }

    let cleaned = title.trim().trim_matches(|c| c == '"' || c == '\'').trim_end_matches(|c| c == '.' || c == '!').trim().to_string();
    if cleaned.is_empty() || cleaned.len() > 80 {
        Err("Invalid title".to_string())
    } else {
        Ok(cleaned)
    }
}

fn estimate_token_count(text: &str) -> usize {
    if text.is_empty() { return 0; }
    let korean_chars = text.chars().filter(|c| ('\u{AC00}'..='\u{D7AF}').contains(c)).count();
    let total = text.len();
    let ratio = if total > 0 { korean_chars as f64 / total as f64 } else { 0.0 };
    let chars_per_token = 4.0 - (ratio * 2.5);
    (total as f64 / chars_per_token).ceil() as usize
}

fn get_context_window(model: Option<&str>) -> usize {
    match model {
        Some(m) if m.contains("claude") => 200_000,
        Some(m) if m.contains("gemini") => 1_000_000,
        Some(m) if m.contains("gpt-5") => 128_000,
        _ => 128_000,
    }
}
