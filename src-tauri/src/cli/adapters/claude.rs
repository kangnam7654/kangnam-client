use std::path::Path;
use tokio::process::Command;
use std::process::Stdio;

use crate::cli::adapter::CliAdapter;
use crate::cli::types::UnifiedMessage;

pub struct ClaudeAdapter;

impl ClaudeAdapter {
    pub fn new() -> Self {
        Self
    }

    /// Parse a stream_event from Claude Code's NDJSON output
    fn parse_stream_event(&self, value: &serde_json::Value) -> Result<Option<UnifiedMessage>, String> {
        let event = value.get("event").ok_or("missing event field")?;
        let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
        let parent_tool_use_id = value.get("parent_tool_use_id").and_then(|v| v.as_str());

        match event_type {
            "content_block_delta" => {
                let delta = event.get("delta").ok_or("missing delta")?;
                let delta_type = delta.get("type").and_then(|t| t.as_str()).unwrap_or("");
                match delta_type {
                    "text_delta" => {
                        let text = delta.get("text").and_then(|t| t.as_str()).unwrap_or("");
                        if parent_tool_use_id.is_some() {
                            // Text from a subagent — emit as agent progress
                            Ok(Some(UnifiedMessage::AgentProgress {
                                id: parent_tool_use_id.unwrap_or("").to_string(),
                                message: text.to_string(),
                            }))
                        } else {
                            Ok(Some(UnifiedMessage::TextDelta {
                                text: text.to_string(),
                            }))
                        }
                    }
                    // input_json_delta is partial tool input — skip
                    _ => Ok(None),
                }
            }
            "content_block_start" => {
                let block = event.get("content_block").ok_or("missing content_block")?;
                let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                match block_type {
                    "tool_use" => {
                        let id = block.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

                        if name == "Agent" {
                            Ok(Some(UnifiedMessage::AgentStart {
                                id: id.clone(),
                                name: name.clone(),
                                description: String::new(),
                            }))
                        } else {
                            Ok(Some(UnifiedMessage::ToolUseStart {
                                id,
                                name,
                                input: serde_json::Value::Object(serde_json::Map::new()),
                            }))
                        }
                    }
                    _ => Ok(None),
                }
            }
            _ => Ok(None),
        }
    }

    /// Parse an assistant turn message with content blocks
    fn parse_assistant(&self, value: &serde_json::Value) -> Result<Option<UnifiedMessage>, String> {
        let message = match value.get("message") {
            Some(m) => m,
            None => return Ok(None),
        };
        let content = match message.get("content").and_then(|c| c.as_array()) {
            Some(c) => c,
            None => return Ok(None),
        };

        let mut text_parts = Vec::new();

        for block in content {
            let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if block_type == "text" {
                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                    text_parts.push(text);
                }
            }
            // tool_use blocks are handled via stream_event content_block_start
        }

        if !text_parts.is_empty() {
            let combined: String = text_parts.join("");
            if !combined.trim().is_empty() {
                return Ok(Some(UnifiedMessage::TextDelta { text: combined }));
            }
        }

        Ok(None)
    }

    /// Parse a result message (session end)
    fn parse_result(&self, value: &serde_json::Value) -> Result<Option<UnifiedMessage>, String> {
        let is_error = value.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
        if is_error {
            let message = value.get("result").and_then(|v| v.as_str()).unwrap_or("Unknown error").to_string();
            Ok(Some(UnifiedMessage::Error { message }))
        } else {
            Ok(Some(UnifiedMessage::TurnEnd {
                usage: None, // Claude Code reports cost_usd, not raw tokens in result
            }))
        }
    }

    /// Parse a control_request (permission prompt)
    fn parse_control_request(&self, value: &serde_json::Value) -> Result<Option<UnifiedMessage>, String> {
        let id = value.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let tool = value.get("tool_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let description = value.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let diff = value.get("diff").and_then(|v| v.as_str()).map(|s| s.to_string());

        Ok(Some(UnifiedMessage::PermissionRequest {
            id,
            tool,
            description,
            diff,
        }))
    }
}

impl CliAdapter for ClaudeAdapter {
    fn name(&self) -> &str {
        "claude"
    }

    fn command(&self) -> &str {
        "claude"
    }

    fn build_command(&self, working_dir: &Path) -> Command {
        let mut cmd = Command::new("claude");
        cmd.args([
            "-p",
            "--output-format", "stream-json",
            "--input-format", "stream-json",
            "--verbose",
        ]);
        cmd.current_dir(working_dir);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd
    }

    fn parse_line(&self, line: &str) -> Result<Option<UnifiedMessage>, String> {
        let line = line.trim();
        if line.is_empty() {
            return Ok(None);
        }

        let value: serde_json::Value = serde_json::from_str(line)
            .map_err(|e| format!("JSON parse error: {}", e))?;

        let msg_type = value.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match msg_type {
            "system" => {
                let subtype = value.get("subtype").and_then(|s| s.as_str()).unwrap_or("");
                if subtype == "init" {
                    let session_id = value.get("session_id").and_then(|s| s.as_str()).unwrap_or("").to_string();
                    Ok(Some(UnifiedMessage::SessionInit { session_id }))
                } else {
                    Ok(None)
                }
            }
            "stream_event" => self.parse_stream_event(&value),
            "assistant" => self.parse_assistant(&value),
            "result" => self.parse_result(&value),
            "control_request" => self.parse_control_request(&value),
            _ => Ok(None),
        }
    }

    fn format_user_message(&self, message: &str, session_id: &str) -> Option<String> {
        let msg = serde_json::json!({
            "type": "user",
            "message": {
                "role": "user",
                "content": message
            },
            "session_id": session_id
        });
        Some(format!("{}\n", msg))
    }

    fn format_permission_response(&self, request_id: &str, allowed: bool) -> Option<String> {
        let msg = serde_json::json!({
            "type": "control_response",
            "id": request_id,
            "allowed": allowed
        });
        Some(format!("{}\n", msg))
    }

    fn supports_persistent_session(&self) -> bool {
        true
    }

    fn version_command(&self) -> Vec<String> {
        vec!["claude".to_string(), "--version".to_string()]
    }

    fn install_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "npm".to_string(),
            "install".to_string(),
            "-g".to_string(),
            "@anthropic-ai/claude-code".to_string(),
        ])
    }

    fn list_skills_command(&self) -> Option<Vec<String>> {
        None
    }

    fn list_agents_command(&self) -> Option<Vec<String>> {
        None
    }
}
