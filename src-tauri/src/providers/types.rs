use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(rename = "toolUseId", skip_serializing_if = "Option::is_none")]
    pub tool_use_id: Option<String>,
    #[serde(rename = "toolCallId", skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    #[serde(rename = "toolCalls", skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StreamEvent {
    Token(String),
    Thinking(String),
    ToolCall(ToolCall),
    Complete,
    Error(String),
}

#[derive(Debug, Clone)]
pub struct SendResult {
    pub stop_reason: StopReason,
    pub tool_calls: Vec<ToolCall>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StopReason {
    EndTurn,
    ToolUse,
}

#[async_trait::async_trait]
pub trait LLMProvider: Send + Sync {
    fn name(&self) -> &str;

    async fn send_message(
        &self,
        messages: &[ChatMessage],
        tools: &[ToolDefinition],
        access_token: &str,
        tx: tokio::sync::mpsc::Sender<StreamEvent>,
        model: Option<&str>,
        reasoning_effort: Option<&str>,
    ) -> Result<SendResult, String>;

    fn abort(&self);
}
