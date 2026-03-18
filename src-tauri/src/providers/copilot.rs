use reqwest::Client;
use std::sync::Mutex;
use tokio::sync::mpsc;

use super::sse;
use super::types::*;

const API_URL: &str = "https://api.githubcopilot.com/chat/completions";

pub struct CopilotProvider {
    http: Client,
    abort: Mutex<Option<tokio::sync::watch::Sender<bool>>>,
}

impl CopilotProvider {
    pub fn new() -> Self {
        Self { http: Client::new(), abort: Mutex::new(None) }
    }
}

#[async_trait::async_trait]
impl LLMProvider for CopilotProvider {
    fn name(&self) -> &str { "copilot" }

    async fn send_message(
        &self,
        messages: &[ChatMessage],
        tools: &[ToolDefinition],
        access_token: &str,
        tx: mpsc::Sender<StreamEvent>,
        _model: Option<&str>,
        _reasoning_effort: Option<&str>,
    ) -> Result<SendResult, String> {
        let (abort_tx, mut abort_rx) = tokio::sync::watch::channel(false);
        *self.abort.lock().unwrap() = Some(abort_tx);

        let formatted: Vec<serde_json::Value> = messages.iter().map(|m| {
            let mut msg = serde_json::json!({
                "role": if m.role == "tool" { "tool" } else { &m.role },
                "content": m.content
            });
            if let Some(ref tc_id) = m.tool_call_id {
                msg["tool_call_id"] = serde_json::json!(tc_id);
            }
            if m.role == "assistant" {
                if let Some(ref tcs) = m.tool_calls {
                    let tc_arr: Vec<serde_json::Value> = tcs.iter().map(|tc| {
                        serde_json::json!({
                            "id": tc.id, "type": "function",
                            "function": { "name": tc.name, "arguments": serde_json::to_string(&tc.arguments).unwrap_or_default() }
                        })
                    }).collect();
                    msg["tool_calls"] = serde_json::json!(tc_arr);
                }
            }
            msg
        }).collect();

        let mut body = serde_json::json!({
            "model": "gpt-4o",
            "messages": formatted,
            "stream": true
        });

        if !tools.is_empty() {
            let tool_defs: Vec<serde_json::Value> = tools.iter().map(|t| {
                serde_json::json!({ "type": "function", "function": { "name": t.name, "description": t.description, "parameters": t.input_schema } })
            }).collect();
            body["tools"] = serde_json::json!(tool_defs);
        }

        let resp = self.http.post(API_URL)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {access_token}"))
            .header("Editor-Version", "vscode/1.85.1")
            .header("Editor-Plugin-Version", "copilot/1.155.0")
            .header("Copilot-Integration-Id", "vscode-chat")
            .header("X-Request-Id", uuid::Uuid::new_v4().to_string())
            .json(&body).send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Copilot API error: {text}"));
        }

        let mut stream = resp.bytes_stream();
        use futures::StreamExt;

        let mut buffer = String::new();
        let mut tool_calls = Vec::new();
        let mut partial_tcs: std::collections::HashMap<i64, (String, String, String)> = std::collections::HashMap::new();
        let mut stop_reason = StopReason::EndTurn;

        loop {
            tokio::select! {
                _ = abort_rx.changed() => {
                    if *abort_rx.borrow() { return Err("AbortError".to_string()); }
                }
                chunk = stream.next() => {
                    match chunk {
                        None => break,
                        Some(Err(e)) => return Err(e.to_string()),
                        Some(Ok(bytes)) => {
                            buffer.push_str(&String::from_utf8_lossy(&bytes));
                            let (lines, remaining) = sse::split_lines(&buffer);
                            buffer = remaining;

                            for line in lines {
                                let data = match line.strip_prefix("data: ") {
                                    Some(d) => d.trim(),
                                    None => continue,
                                };
                                if data == "[DONE]" { continue; }

                                let parsed: serde_json::Value = match serde_json::from_str(data) {
                                    Ok(v) => v,
                                    Err(_) => continue,
                                };

                                if let Some(choices) = parsed.get("choices").and_then(|v| v.as_array()) {
                                    if let Some(choice) = choices.first() {
                                        if let Some(content) = choice.pointer("/delta/content").and_then(|v| v.as_str()) {
                                            let _ = tx.send(StreamEvent::Token(content.to_string())).await;
                                        }
                                        if let Some(tcs) = choice.pointer("/delta/tool_calls").and_then(|v| v.as_array()) {
                                            for tc in tcs {
                                                let idx = tc.get("index").and_then(|v| v.as_i64()).unwrap_or(0);
                                                let entry = partial_tcs.entry(idx).or_insert_with(|| ("".to_string(), "".to_string(), "".to_string()));
                                                if let Some(id) = tc.get("id").and_then(|v| v.as_str()) { entry.0 = id.to_string(); }
                                                if let Some(name) = tc.pointer("/function/name").and_then(|v| v.as_str()) { entry.1 = name.to_string(); }
                                                if let Some(args) = tc.pointer("/function/arguments").and_then(|v| v.as_str()) { entry.2.push_str(args); }
                                            }
                                        }
                                        if choice.get("finish_reason").and_then(|v| v.as_str()) == Some("tool_calls") {
                                            stop_reason = StopReason::ToolUse;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        for (_, (id, name, args_str)) in partial_tcs {
            let arguments: serde_json::Value = serde_json::from_str(&args_str).unwrap_or(serde_json::json!({}));
            let tc = ToolCall { id, name, arguments };
            let _ = tx.send(StreamEvent::ToolCall(tc.clone())).await;
            tool_calls.push(tc);
        }

        if !tool_calls.is_empty() { stop_reason = StopReason::ToolUse; }
        let _ = tx.send(StreamEvent::Complete).await;
        Ok(SendResult { stop_reason, tool_calls })
    }

    fn abort(&self) {
        if let Some(tx) = self.abort.lock().unwrap().take() { let _ = tx.send(true); }
    }
}
