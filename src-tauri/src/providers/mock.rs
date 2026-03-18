use tokio::sync::mpsc;

use super::types::*;

pub struct MockProvider;

impl MockProvider {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait::async_trait]
impl LLMProvider for MockProvider {
    fn name(&self) -> &str {
        "mock"
    }

    async fn send_message(
        &self,
        messages: &[ChatMessage],
        _tools: &[ToolDefinition],
        _access_token: &str,
        tx: mpsc::Sender<StreamEvent>,
        _model: Option<&str>,
        _reasoning_effort: Option<&str>,
    ) -> Result<SendResult, String> {
        let user_msg = messages
            .iter()
            .rev()
            .find(|m| m.role == "user")
            .map(|m| m.content.as_str())
            .unwrap_or("Hello");

        let response = format!("[Mock] Echo: {user_msg}");
        for chunk in response.chars().collect::<Vec<_>>().chunks(10) {
            let text: String = chunk.iter().collect();
            let _ = tx.send(StreamEvent::Token(text)).await;
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        }

        let _ = tx.send(StreamEvent::Complete).await;
        Ok(SendResult {
            stop_reason: StopReason::EndTurn,
            tool_calls: vec![],
        })
    }

    fn abort(&self) {}
}
