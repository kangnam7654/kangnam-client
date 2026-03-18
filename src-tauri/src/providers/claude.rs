use reqwest::Client;
use std::sync::Mutex;
use tokio::sync::mpsc;

use super::sse;
use super::types::*;

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";
const INTERLEAVED_THINKING_BETA: &str = "interleaved-thinking-2025-05-14";
const DEFAULT_MODEL: &str = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS: u32 = 16384;

pub struct ClaudeProvider {
    http: Client,
    abort: Mutex<Option<tokio::sync::watch::Sender<bool>>>,
}

impl ClaudeProvider {
    pub fn new() -> Self {
        Self {
            http: Client::new(),
            abort: Mutex::new(None),
        }
    }

    fn build_messages(messages: &[ChatMessage]) -> Vec<serde_json::Value> {
        let mut result = Vec::new();
        let conv_messages: Vec<&ChatMessage> = messages.iter().filter(|m| m.role != "system").collect();
        let mut pending_tool_results: Vec<serde_json::Value> = Vec::new();
        let mut awaiting_tool_results = false;

        for msg in conv_messages {
            match msg.role.as_str() {
                "assistant" => {
                    if !pending_tool_results.is_empty() {
                        result.push(serde_json::json!({ "role": "user", "content": pending_tool_results }));
                        pending_tool_results = Vec::new();
                        awaiting_tool_results = false;
                    }

                    let mut blocks = Vec::new();
                    if !msg.content.is_empty() && msg.content != "[tool call]" {
                        blocks.push(serde_json::json!({ "type": "text", "text": msg.content }));
                    }
                    if let Some(ref tcs) = msg.tool_calls {
                        for tc in tcs {
                            blocks.push(serde_json::json!({
                                "type": "tool_use",
                                "id": tc.id,
                                "name": tc.name,
                                "input": tc.arguments
                            }));
                        }
                        awaiting_tool_results = true;
                    }
                    if !blocks.is_empty() {
                        result.push(serde_json::json!({ "role": "assistant", "content": blocks }));
                    }
                }
                "tool" => {
                    if !awaiting_tool_results {
                        continue;
                    }
                    let tool_id = msg.tool_call_id.as_deref().or(msg.tool_use_id.as_deref()).unwrap_or("");
                    if tool_id.is_empty() {
                        continue;
                    }
                    let is_error = msg.content.trim().to_lowercase().starts_with("error:");
                    let mut tr = serde_json::json!({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": msg.content
                    });
                    if is_error {
                        tr["is_error"] = serde_json::json!(true);
                    }
                    pending_tool_results.push(tr);
                }
                "user" => {
                    let mut user_blocks = pending_tool_results.drain(..).collect::<Vec<_>>();
                    awaiting_tool_results = false;

                    if let Some(ref images) = msg.images {
                        for img in images {
                            if let Some((media_type, data)) = parse_data_url(img) {
                                user_blocks.push(serde_json::json!({
                                    "type": "image",
                                    "source": { "type": "base64", "media_type": media_type, "data": data }
                                }));
                            }
                        }
                    }

                    if !msg.content.is_empty() {
                        user_blocks.push(serde_json::json!({ "type": "text", "text": msg.content }));
                    }

                    if !user_blocks.is_empty() {
                        result.push(serde_json::json!({ "role": "user", "content": user_blocks }));
                    }
                }
                _ => {}
            }
        }

        if !pending_tool_results.is_empty() {
            result.push(serde_json::json!({ "role": "user", "content": pending_tool_results }));
        }

        result
    }
}

fn parse_data_url(url: &str) -> Option<(String, String)> {
    let rest = url.strip_prefix("data:")?;
    let (meta, data) = rest.split_once(";base64,")?;
    Some((meta.to_string(), data.to_string()))
}

fn thinking_budget(effort: Option<&str>) -> Option<u32> {
    match effort {
        Some("low") => Some(2048),
        Some("medium") => Some(5000),
        Some("high") => Some(10000),
        _ => None,
    }
}

#[async_trait::async_trait]
impl LLMProvider for ClaudeProvider {
    fn name(&self) -> &str {
        "claude"
    }

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
        *self.abort.lock().unwrap() = Some(abort_tx);

        let system_prompt: String = messages
            .iter()
            .filter(|m| m.role == "system")
            .map(|m| m.content.as_str())
            .collect::<Vec<_>>()
            .join("\n\n");

        let anthropic_messages = Self::build_messages(messages);

        let mut body = serde_json::json!({
            "model": model.unwrap_or(DEFAULT_MODEL),
            "max_tokens": MAX_OUTPUT_TOKENS,
            "messages": anthropic_messages,
            "stream": true
        });

        if !system_prompt.trim().is_empty() {
            body["system"] = serde_json::json!(system_prompt);
        }

        if !tools.is_empty() {
            let formatted: Vec<serde_json::Value> = tools.iter().map(|t| {
                serde_json::json!({ "name": t.name, "description": t.description, "input_schema": t.input_schema })
            }).collect();
            body["tools"] = serde_json::json!(formatted);
        }

        let budget = thinking_budget(reasoning_effort);
        let enable_thinking = budget.is_some();
        if let Some(b) = budget {
            body["thinking"] = serde_json::json!({ "type": "enabled", "budget_tokens": b });
        }

        let is_oat = access_token.starts_with("sk-ant-oat");
        let mut req = self.http.post(API_URL)
            .header("content-type", "application/json")
            .header("anthropic-version", API_VERSION);

        if is_oat {
            req = req.header("Authorization", format!("Bearer {access_token}"))
                .header("user-agent", "claude-cli/2.1.77")
                .header("x-app", "cli");
        } else {
            req = req.header("x-api-key", access_token);
        }

        let mut betas = Vec::new();
        if is_oat {
            betas.push("claude-code-20250219");
            betas.push("oauth-2025-04-20");
        }
        betas.push("fine-grained-tool-streaming-2025-05-14");
        if enable_thinking && !tools.is_empty() {
            betas.push(INTERLEAVED_THINKING_BETA);
        }
        req = req.header("anthropic-beta", betas.join(","));

        let resp = req.json(&body).send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let error_text = resp.text().await.unwrap_or_default();

            // Haiku fallback for OAT usage limits
            if status == 400 && is_oat && model.unwrap_or(DEFAULT_MODEL) != "claude-haiku-4-5" {
                let _ = tx.send(StreamEvent::Token(format!(
                    "[Switched to Haiku — usage limit reached for {}]\n\n",
                    model.unwrap_or(DEFAULT_MODEL)
                ))).await;

                body["model"] = serde_json::json!("claude-haiku-4-5");
                body.as_object_mut().unwrap().remove("thinking");

                let mut retry_req = self.http.post(API_URL)
                    .header("content-type", "application/json")
                    .header("anthropic-version", API_VERSION)
                    .header("anthropic-beta", betas.join(","));
                if is_oat {
                    retry_req = retry_req.header("Authorization", format!("Bearer {access_token}"))
                        .header("user-agent", "claude-cli/2.1.77")
                        .header("x-app", "cli");
                } else {
                    retry_req = retry_req.header("x-api-key", access_token);
                }

                let retry_resp = retry_req.json(&body).send().await.map_err(|e| e.to_string())?;
                if retry_resp.status().is_success() {
                    return parse_claude_sse(retry_resp, tx, &mut abort_rx).await;
                }
            }

            return Err(format!("Claude API error {status}: {error_text}"));
        }

        parse_claude_sse(resp, tx, &mut abort_rx).await
    }

    fn abort(&self) {
        if let Some(tx) = self.abort.lock().unwrap().take() {
            let _ = tx.send(true);
        }
    }
}

async fn parse_claude_sse(
    resp: reqwest::Response,
    tx: mpsc::Sender<StreamEvent>,
    abort_rx: &mut tokio::sync::watch::Receiver<bool>,
) -> Result<SendResult, String> {
    let mut stream = resp.bytes_stream();
    use futures::StreamExt;

    let mut buffer = String::new();
    let mut tool_calls = Vec::new();
    let mut partial_tool_calls: std::collections::HashMap<i64, (String, String, String)> = std::collections::HashMap::new(); // index -> (id, name, input_json)
    let mut stop_reason = StopReason::EndTurn;

    loop {
        tokio::select! {
            _ = abort_rx.changed() => {
                if *abort_rx.borrow() {
                    return Err("AbortError".to_string());
                }
            }
            chunk = stream.next() => {
                match chunk {
                    None => break,
                    Some(Err(e)) => return Err(e.to_string()),
                    Some(Ok(bytes)) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));
                        let (events, remaining) = sse::split_sse_events(&buffer);
                        buffer = remaining;

                        for raw_event in events {
                            let (event, data) = sse::parse_sse_event(&raw_event);
                            if data.is_empty() || data == "[DONE]" { continue; }

                            let parsed: serde_json::Value = match serde_json::from_str(&data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            let event_type = event.as_deref()
                                .unwrap_or(parsed.get("type").and_then(|v| v.as_str()).unwrap_or(""));

                            match event_type {
                                "ping" | "message_start" => {}
                                "error" => {
                                    let msg = parsed.pointer("/error/message")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Claude streaming error");
                                    return Err(msg.to_string());
                                }
                                "content_block_start" => {
                                    let index = parsed.get("index").and_then(|v| v.as_i64()).unwrap_or(-1);
                                    let block = parsed.get("content_block");
                                    if let (Some(block), true) = (block, index >= 0) {
                                        let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                        if block_type == "tool_use" {
                                            let id = block.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                            let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                            partial_tool_calls.insert(index, (id, name, String::new()));
                                        }
                                    }
                                }
                                "content_block_delta" => {
                                    let index = parsed.get("index").and_then(|v| v.as_i64()).unwrap_or(-1);
                                    if let Some(delta) = parsed.get("delta") {
                                        let delta_type = delta.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                        match delta_type {
                                            "text_delta" => {
                                                if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                                                    let _ = tx.send(StreamEvent::Token(text.to_string())).await;
                                                }
                                            }
                                            "thinking_delta" => {
                                                if let Some(text) = delta.get("thinking").and_then(|v| v.as_str()) {
                                                    let _ = tx.send(StreamEvent::Thinking(text.to_string())).await;
                                                }
                                            }
                                            "input_json_delta" => {
                                                if let Some(partial) = partial_tool_calls.get_mut(&index) {
                                                    if let Some(json_str) = delta.get("partial_json").and_then(|v| v.as_str()) {
                                                        partial.2.push_str(json_str);
                                                    }
                                                }
                                            }
                                            _ => {}
                                        }
                                    }
                                }
                                "content_block_stop" => {
                                    let index = parsed.get("index").and_then(|v| v.as_i64()).unwrap_or(-1);
                                    if let Some((id, name, input_json)) = partial_tool_calls.remove(&index) {
                                        let arguments: serde_json::Value = serde_json::from_str(&input_json).unwrap_or(serde_json::json!({}));
                                        let tc = ToolCall { id, name, arguments };
                                        let _ = tx.send(StreamEvent::ToolCall(tc.clone())).await;
                                        tool_calls.push(tc);
                                    }
                                }
                                "message_delta" => {
                                    if let Some(sr) = parsed.pointer("/delta/stop_reason").and_then(|v| v.as_str()) {
                                        if sr == "tool_use" {
                                            stop_reason = StopReason::ToolUse;
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }

    // Finalize remaining partial tool calls
    for (_, (id, name, input_json)) in partial_tool_calls {
        let arguments: serde_json::Value = serde_json::from_str(&input_json).unwrap_or(serde_json::json!({}));
        let tc = ToolCall { id, name, arguments };
        let _ = tx.send(StreamEvent::ToolCall(tc.clone())).await;
        tool_calls.push(tc);
    }

    if !tool_calls.is_empty() {
        stop_reason = StopReason::ToolUse;
    }

    let _ = tx.send(StreamEvent::Complete).await;
    Ok(SendResult { stop_reason, tool_calls })
}
