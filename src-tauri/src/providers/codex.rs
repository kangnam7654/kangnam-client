use reqwest::Client;
use std::sync::Mutex;
use tokio::sync::mpsc;

use super::sse;
use super::types::*;

const API_URL: &str = "https://chatgpt.com/backend-api/codex/responses";
const DEFAULT_MODEL: &str = "gpt-5.4";

pub struct CodexProvider {
    http: Client,
    abort: Mutex<Option<tokio::sync::watch::Sender<bool>>>,
}

impl CodexProvider {
    pub fn new() -> Self {
        Self {
            http: Client::new(),
            abort: Mutex::new(None),
        }
    }
}

#[async_trait::async_trait]
impl LLMProvider for CodexProvider {
    fn name(&self) -> &str { "codex" }

    async fn send_message(
        &self,
        messages: &[ChatMessage],
        tools: &[ToolDefinition],
        access_token: &str,
        tx: mpsc::Sender<StreamEvent>,
        model: Option<&str>,
        reasoning_effort: Option<&str>,
    ) -> Result<SendResult, String> {
        let (abort_tx, mut abort_rx) = tokio::sync::watch::channel(false);
        *self.abort.lock().unwrap_or_else(|e| e.into_inner()) = Some(abort_tx);

        let system_msgs: Vec<&ChatMessage> = messages.iter().filter(|m| m.role == "system").collect();
        let conv_msgs: Vec<&ChatMessage> = messages.iter().filter(|m| m.role != "system").collect();

        // Build Responses API input
        let mut input: Vec<serde_json::Value> = Vec::new();
        for m in &conv_msgs {
            match m.role.as_str() {
                "tool" => {
                    let call_id = m.tool_call_id.as_deref().or(m.tool_use_id.as_deref()).unwrap_or("");
                    if !call_id.is_empty() {
                        input.push(serde_json::json!({
                            "type": "function_call_output",
                            "call_id": call_id,
                            "output": m.content
                        }));
                    }
                }
                "assistant" if m.content == "[tool call]" && m.tool_calls.is_none() => continue,
                "assistant" if m.tool_calls.is_some() => {
                    if !m.content.is_empty() && m.content != "[tool call]" {
                        input.push(serde_json::json!({ "role": "assistant", "content": m.content }));
                    }
                    for tc in m.tool_calls.as_ref().unwrap() {
                        input.push(serde_json::json!({
                            "type": "function_call",
                            "call_id": tc.id,
                            "name": tc.name,
                            "arguments": serde_json::to_string(&tc.arguments).unwrap_or_default()
                        }));
                    }
                }
                _ => {
                    input.push(serde_json::json!({ "role": m.role, "content": m.content }));
                }
            }
        }

        // Remove orphaned function_call_output
        let fc_ids: std::collections::HashSet<String> = input.iter()
            .filter(|i| i.get("type").and_then(|v| v.as_str()) == Some("function_call"))
            .filter_map(|i| i.get("call_id").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();
        input.retain(|i| {
            if i.get("type").and_then(|v| v.as_str()) == Some("function_call_output") {
                fc_ids.contains(i.get("call_id").and_then(|v| v.as_str()).unwrap_or(""))
            } else {
                true
            }
        });

        let mut body = serde_json::json!({
            "model": model.unwrap_or(DEFAULT_MODEL),
            "instructions": if !system_msgs.is_empty() {
                system_msgs.iter().map(|m| m.content.as_str()).collect::<Vec<_>>().join("\n")
            } else {
                "You are a helpful assistant.".to_string()
            },
            "input": input,
            "stream": true,
            "store": false
        });

        if !tools.is_empty() {
            let formatted: Vec<serde_json::Value> = tools.iter().map(|t| {
                serde_json::json!({ "type": "function", "name": t.name, "description": t.description, "parameters": t.input_schema })
            }).collect();
            body["tools"] = serde_json::json!(formatted);
        }

        if let Some(effort) = reasoning_effort {
            body["reasoning"] = serde_json::json!({ "effort": effort });
        }

        let resp = self.http.post(API_URL)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {access_token}"))
            .json(&body)
            .send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Codex API error: {text}"));
        }

        let mut stream = resp.bytes_stream();
        use futures::StreamExt;

        let mut buffer = String::new();
        let mut tool_calls = Vec::new();
        let mut partial_tcs: std::collections::HashMap<String, (String, String, String)> = std::collections::HashMap::new();
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

                                let event_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                match event_type {
                                    "response.output_text.delta" => {
                                        if let Some(delta) = parsed.get("delta").and_then(|v| v.as_str()) {
                                            let _ = tx.send(StreamEvent::Token(delta.to_string())).await;
                                        }
                                    }
                                    "response.output_item.added" => {
                                        if let Some(item) = parsed.get("item") {
                                            if item.get("type").and_then(|v| v.as_str()) == Some("function_call") {
                                                let item_id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                                let call_id = item.get("call_id").and_then(|v| v.as_str()).unwrap_or(&item_id).to_string();
                                                let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                                partial_tcs.insert(item_id, (call_id, name, String::new()));
                                            }
                                        }
                                    }
                                    "response.function_call_arguments.delta" => {
                                        let item_id = parsed.get("item_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                        if let Some(entry) = partial_tcs.get_mut(&item_id) {
                                            if let Some(delta) = parsed.get("delta").and_then(|v| v.as_str()) {
                                                entry.2.push_str(delta);
                                            }
                                        }
                                    }
                                    "response.function_call_arguments.done" => {
                                        let item_id = parsed.get("item_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                        if let Some(entry) = partial_tcs.get_mut(&item_id) {
                                            if let Some(args) = parsed.get("arguments").and_then(|v| v.as_str()) {
                                                entry.2 = args.to_string();
                                            }
                                        }
                                    }
                                    "response.completed" | "response.done" => {
                                        let resp_val = parsed.get("response").unwrap_or(&parsed);
                                        if resp_val.get("status").and_then(|v| v.as_str()) == Some("incomplete") {
                                            stop_reason = StopReason::ToolUse;
                                        }
                                    }
                                    _ => {
                                        // OpenAI Chat Completions fallback
                                        if let Some(choices) = parsed.get("choices").and_then(|v| v.as_array()) {
                                            if let Some(choice) = choices.first() {
                                                if let Some(content) = choice.pointer("/delta/content").and_then(|v| v.as_str()) {
                                                    let _ = tx.send(StreamEvent::Token(content.to_string())).await;
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
        if let Some(tx) = self.abort.lock().unwrap_or_else(|e| e.into_inner()).take() { let _ = tx.send(true); }
    }
}
