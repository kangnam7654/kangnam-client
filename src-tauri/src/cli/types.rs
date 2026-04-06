#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum UnifiedMessage {
    /// Streaming text chunk from the assistant
    TextDelta { text: String },

    /// Tool call started (file read, edit, bash, etc.)
    ToolUseStart {
        id: String,
        name: String,
        input: serde_json::Value,
    },

    /// Tool execution result
    ToolResult {
        id: String,
        output: String,
        is_error: bool,
    },

    /// CLI requests permission for a dangerous action
    PermissionRequest {
        id: String,
        tool: String,
        description: String,
        diff: Option<String>,
    },

    /// Subagent spawned
    AgentStart {
        id: String,
        name: String,
        description: String,
    },

    /// Subagent progress update
    AgentProgress { id: String, message: String },

    /// Subagent completed
    AgentEnd { id: String, result: String },

    /// Skill invoked via slash command
    SkillInvoked {
        name: String,
        args: Option<String>,
    },

    /// Assistant turn completed
    TurnEnd { usage: Option<TokenUsage> },

    /// Error from CLI process
    Error { message: String },

    /// Session initialized
    SessionInit { session_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliStatus {
    pub provider: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub authenticated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliConfig {
    pub provider: String,
    pub command: String,
    pub working_dir: String,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub name: String,
    pub description: String,
}
