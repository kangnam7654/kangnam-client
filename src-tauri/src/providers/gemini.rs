use reqwest::Client;
use std::sync::Mutex;
use tokio::sync::mpsc;

use super::sse;
use super::types::*;

const API_URL: &str = "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";
const DEFAULT_MODEL: &str = "gemini-3.1-pro-preview";

pub struct GeminiProvider {
    http: Client,
    abort: Mutex<Option<tokio::sync::watch::Sender<bool>>>,
}

impl GeminiProvider {
    pub fn new() -> Self {
        Self { http: Client::new(), abort: Mutex::new(None) }
    }
}

#[async_trait::async_trait]
impl LLMProvider for GeminiProvider {
    fn name(&self) -> &str { "gemini" }

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

        let contents: Vec<serde_json::Value> = messages.iter()
            .filter(|m| m.role != "system")
            .map(|m| {
                let role = if m.role == "assistant" { "model" } else { "user" };
                serde_json::json!({ "role": role, "parts": [{ "text": m.content }] })
            }).collect();

        let system = messages.iter().find(|m| m.role == "system");

        let mut inner_request = serde_json::json!({ "contents": contents });
        if let Some(sys) = system {
            inner_request["systemInstruction"] = serde_json::json!({ "parts": [{ "text": sys.content }] });
        }
        if !tools.is_empty() {
            let decls: Vec<serde_json::Value> = tools.iter().map(|t| {
                serde_json::json!({ "name": t.name, "description": t.description, "parameters": t.input_schema })
            }).collect();
            inner_request["tools"] = serde_json::json!([{ "functionDeclarations": decls }]);
        }
        if let Some(effort) = reasoning_effort {
            inner_request["generationConfig"] = serde_json::json!({ "thinkingConfig": { "thinkingLevel": effort } });
        }

        let body = serde_json::json!({
            "model": model.unwrap_or(DEFAULT_MODEL),
            "request": inner_request
        });

        let resp = self.http.post(API_URL)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {access_token}"))
            .json(&body).send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Gemini API error: {text}"));
        }

        parse_gemini_sse(resp, tx, &mut abort_rx).await
    }

    fn abort(&self) {
        if let Some(tx) = self.abort.lock().unwrap_or_else(|e| e.into_inner()).take() { let _ = tx.send(true); }
    }
}

pub async fn parse_gemini_sse(
    resp: reqwest::Response,
    tx: mpsc::Sender<StreamEvent>,
    abort_rx: &mut tokio::sync::watch::Receiver<bool>,
) -> Result<SendResult, String> {
    let mut stream = resp.bytes_stream();
    use futures::StreamExt;

    let mut buffer = String::new();
    let mut tool_calls = Vec::new();
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
                            if data.is_empty() { continue; }

                            let parsed: serde_json::Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            if let Some(candidates) = parsed.get("candidates").and_then(|v| v.as_array()) {
                                if let Some(candidate) = candidates.first() {
                                    if let Some(parts) = candidate.pointer("/content/parts").and_then(|v| v.as_array()) {
                                        for part in parts {
                                            if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                                                let _ = tx.send(StreamEvent::Token(text.to_string())).await;
                                            }
                                            if let Some(fc) = part.get("functionCall") {
                                                stop_reason = StopReason::ToolUse;
                                                let name = fc.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                                let args = fc.get("args").cloned().unwrap_or(serde_json::json!({}));
                                                let id = format!("gemini_{}_{}", chrono::Utc::now().timestamp_millis(), uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
                                                let tc = ToolCall { id, name, arguments: args };
                                                let _ = tx.send(StreamEvent::ToolCall(tc.clone())).await;
                                                tool_calls.push(tc);
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

    let _ = tx.send(StreamEvent::Complete).await;
    Ok(SendResult { stop_reason, tool_calls })
}
