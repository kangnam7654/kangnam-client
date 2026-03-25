use tauri::{AppHandle, Emitter, State};

use crate::db::agents::{self, Agent};
use crate::db::conversations;
use crate::providers::types::*;
use crate::state::AppState;

#[tauri::command]
pub fn agents_list(state: State<'_, AppState>) -> Result<Vec<Agent>, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    agents::list_agents(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn agents_get(id: String, state: State<'_, AppState>) -> Result<Option<Agent>, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    Ok(agents::get_agent(&conn, &id))
}

#[tauri::command]
pub fn agents_create(
    name: String,
    description: String,
    instructions: String,
    model: Option<String>,
    allowed_tools: Option<Vec<String>>,
    max_turns: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Agent, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    agents::create_agent(
        &conn,
        &name,
        &description,
        &instructions,
        model.as_deref(),
        allowed_tools,
        max_turns.unwrap_or(10),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn agents_update(
    id: String,
    name: String,
    description: String,
    instructions: String,
    model: Option<String>,
    allowed_tools: Option<Vec<String>>,
    max_turns: Option<i64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    agents::update_agent(
        &conn,
        &id,
        &name,
        &description,
        &instructions,
        model.as_deref(),
        allowed_tools,
        max_turns.unwrap_or(10),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn agents_delete(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    agents::delete_agent(&conn, &id);
    Ok(())
}

#[tauri::command]
pub async fn agents_execute(
    agent_id: String,
    conversation_id: String,
    task: String,
    provider: String,
    model: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String> {
    // 1. Get agent definition
    let agent = {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        agents::get_agent(&conn, &agent_id)
            .ok_or(format!("Agent not found: {agent_id}"))?
    };

    // 2. Create agent run record
    let run = {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        agents::create_agent_run(&conn, &agent_id, &conversation_id, &task)
            .map_err(|e| e.to_string())?
    };

    // 3. Emit start event
    let _ = app.emit("agent:run-start", serde_json::json!({
        "runId": run.id,
        "agentName": agent.name,
        "conversationId": conversation_id,
    }));

    // 4. Resolve model: agent.model > caller model > default
    let effective_model = agent.model.as_deref().or(model.as_deref());

    // 5. Get access token
    let access_token = state
        .auth
        .get_access_token(&provider, &state.db, &app)
        .await
        .ok_or(format!("Not connected to {provider}"))?;

    let llm_provider = state
        .router
        .get_provider(&provider)
        .ok_or(format!("Unknown provider: {provider}"))?;

    // 6. Build isolated messages (agent instructions + task)
    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: agent.instructions.clone(),
            tool_call_id: None,
            tool_use_id: None,
            images: None,
            tool_calls: None,
        },
        ChatMessage {
            role: "user".to_string(),
            content: task.clone(),
            tool_call_id: None,
            tool_use_id: None,
            images: None,
            tool_calls: None,
        },
    ];

    // 7. Get MCP tools (filtered by allowed_tools if set)
    let mcp_tools = state.mcp.list_tools().await.unwrap_or_default();
    let tools: Vec<ToolDefinition> = mcp_tools
        .iter()
        .filter(|t| {
            match &agent.allowed_tools {
                Some(allowed) => allowed.iter().any(|a| a == &t.name),
                None => true,
            }
        })
        .map(|t| ToolDefinition {
            name: t.name.clone(),
            description: t.description.clone(),
            input_schema: t.input_schema.clone(),
        })
        .collect();

    // 8. Run isolated agent loop (no DB message saving, just collect result)
    let result = run_isolated_agent_loop(
        messages,
        tools,
        &access_token,
        llm_provider,
        effective_model,
        agent.max_turns,
        &state,
        &app,
        &run.id,
    )
    .await;

    match result {
        Ok(response) => {
            // 9. Record completion
            {
                let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
                agents::complete_agent_run(&conn, &run.id, &response, effective_model).ok();
            }

            // 10. Insert result into main conversation
            {
                let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
                let content = format!("[Agent: {}]\n\n{}", agent.name, response);
                conversations::add_message(
                    &conn, &conversation_id, "assistant", &content,
                    None, None, None, None, None,
                ).ok();
            }

            // 11. Emit completion
            let _ = app.emit("agent:run-complete", serde_json::json!({
                "runId": run.id,
                "conversationId": conversation_id,
                "result": response,
            }));

            Ok(response)
        }
        Err(e) => {
            let conn = state.db.lock().unwrap_or_else(|e2| e2.into_inner());
            agents::fail_agent_run(&conn, &run.id, &e).ok();

            let _ = app.emit("agent:run-error", serde_json::json!({
                "runId": run.id,
                "conversationId": conversation_id,
                "error": e,
            }));

            Err(e)
        }
    }
}

/// Run LLM in isolated context (no conversation DB writes).
/// Returns the final text response.
async fn run_isolated_agent_loop(
    mut messages: Vec<ChatMessage>,
    tools: Vec<ToolDefinition>,
    access_token: &str,
    provider: std::sync::Arc<dyn LLMProvider>,
    model: Option<&str>,
    max_turns: i64,
    state: &AppState,
    app: &AppHandle,
    run_id: &str,
) -> Result<String, String> {
    let mut full_response = String::new();
    let mut turns = 0i64;

    loop {
        if turns >= max_turns {
            if full_response.is_empty() {
                return Err(format!("Agent reached max turns ({max_turns}) without response"));
            }
            return Ok(full_response);
        }
        turns += 1;

        let (tx, mut rx) = tokio::sync::mpsc::channel::<StreamEvent>(64);

        let provider_clone = provider.clone();
        let messages_clone = messages.clone();
        let tools_clone = tools.clone();
        let token = access_token.to_string();
        let mdl = model.map(|s| s.to_string());

        let send_handle = tokio::spawn(async move {
            provider_clone
                .send_message(&messages_clone, &tools_clone, &token, tx, mdl.as_deref(), None)
                .await
        });

        while let Some(event) = rx.recv().await {
            match event {
                StreamEvent::Token(text) => {
                    full_response.push_str(&text);
                    let _ = app.emit("agent:stream", serde_json::json!({
                        "runId": run_id, "chunk": text
                    }));
                }
                StreamEvent::ToolCall(tc) => {
                    let _ = app.emit("agent:tool-call", serde_json::json!({
                        "runId": run_id, "tool": tc.name, "args": tc.arguments
                    }));
                }
                _ => {}
            }
        }

        let result = send_handle.await.map_err(|e| e.to_string())??;

        if result.stop_reason == StopReason::ToolUse && !result.tool_calls.is_empty() {
            // Execute tools
            let mut tool_result_msgs = Vec::new();
            for tc in &result.tool_calls {
                let content = match state.mcp.call_tool(&tc.name, tc.arguments.clone()).await {
                    Ok(r) => {
                        let text: String = r.content.iter()
                            .filter_map(|c| c.get("text").and_then(|v| v.as_str()))
                            .collect::<Vec<_>>().join("\n");
                        if r.is_error { format!("Error: {text}") } else { text }
                    }
                    Err(e) => format!("Error executing tool {}: {e}", tc.name),
                };
                tool_result_msgs.push(ChatMessage {
                    role: "tool".to_string(),
                    content,
                    tool_call_id: Some(tc.id.clone()),
                    tool_use_id: None,
                    images: None,
                    tool_calls: None,
                });
            }

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

        return Ok(full_response);
    }
}
