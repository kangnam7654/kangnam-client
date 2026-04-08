# CLI Agent GUI Wrapper Implementation Plan

> **Status: All 21 tasks COMPLETE (2026-04-08)**
> Tasks 1-21 구현 완료. 아래 체크박스는 모두 완료 상태.

**Goal:** kangnam-client를 Claude Code + Codex CLI의 GUI 래퍼로 피벗. CLI subprocess의 JSON 스트림을 파싱하여 비개발자용 채팅 UI로 렌더링한다.

**Architecture:** Rust backend에서 CLI를 subprocess로 spawn하고 stdin/stdout NDJSON 파이프로 양방향 통신. CliAdapter trait으로 CLI별 파서를 분리하고, UnifiedMessage enum으로 통일된 프론트엔드 이벤트를 emit. **Axum WebSocket 서버 (port 3001) + JSON-RPC 2.0 프로토콜**로 프론트엔드와 통신. (원래 계획의 Tauri IPC 대신 transport-agnostic WebSocket으로 전환됨)

**Tech Stack:** Tauri 2 (Rust), React 19, Tailwind CSS 4, Zustand, tokio (subprocess async I/O), Axum (WebSocket), JSON-RPC 2.0

**Post-Plan Changes (계획 이후 추가 구현):**
- Tauri IPC → Axum WebSocket + JSON-RPC 2.0 전환 (`src-tauri/src/rpc/`, `src-tauri/src/server/`)
- 실시간 스트리밍: `--verbose --include-partial-messages` 플래그 추가
- 대화 DB 저장: `saver.rs` 백그라운드 태스크 (TextDelta 누적 → TurnEnd시 저장)
- Codex 멀티턴: CliSession에 history 저장, 프롬프트에 prepend
- 프론트엔드 RPC 클라이언트: `src/renderer/lib/rpc/` (transport-ws.ts, client.ts, types.ts)

**CLI JSON Formats (Phase 0 Research Results):**

Claude Code: `claude -p --input-format stream-json --output-format stream-json --include-partial-messages`
- Output types: `system` (init/api_retry), `stream_event` (content_block_start/delta/stop), `assistant` (full turn), `result` (success/error)
- Stdin: `{"type":"user","message":{"role":"user","content":"..."},"session_id":"..."}`
- Permission: `control_request` (subtype: can_use_tool) → `control_response` on stdin
- Subagent: `parent_tool_use_id` non-null on stream_event

Codex CLI: `codex exec --json "<prompt>"`
- Output types: `thread.started`, `turn.started`, `item.*` (messages, commands, file changes), `turn.completed`, `turn.failed`, `error`
- Non-interactive only (codex exec), no persistent stdin pipe
- Each prompt = new process invocation

---

## File Structure

### New Files (Rust)

| File | Responsibility |
|------|---------------|
| `src-tauri/src/cli/mod.rs` | Module root, re-exports |
| `src-tauri/src/cli/types.rs` | UnifiedMessage, CliConfig, CliStatus, TokenUsage, SkillInfo, AgentInfo |
| `src-tauri/src/cli/adapter.rs` | CliAdapter trait definition |
| `src-tauri/src/cli/adapters/mod.rs` | Adapter module root |
| `src-tauri/src/cli/adapters/claude.rs` | Claude Code NDJSON parser |
| `src-tauri/src/cli/adapters/codex.rs` | Codex CLI JSONL parser |
| `src-tauri/src/cli/manager.rs` | Subprocess lifecycle, stdin/stdout piping, event emit |
| `src-tauri/src/cli/registry.rs` | CLI install detection, version check, install command execution |
| `src-tauri/src/commands/cli.rs` | Tauri IPC commands for CLI operations |

### New Files (React)

| File | Responsibility |
|------|---------------|
| `src/renderer/lib/cli-api.ts` | Tauri IPC wrapper + event listener |
| `src/renderer/components/chat/MessageRenderer.tsx` | UnifiedMessage type-based renderer |
| `src/renderer/components/chat/SafetyDialog.tsx` | Permission request confirm dialog |
| `src/renderer/components/chat/CommandPalette.tsx` | Slash command search/select popup |
| `src/renderer/components/chat/WorkdirSelector.tsx` | Working directory picker |
| `src/renderer/components/setup/SetupWizard.tsx` | 3-step CLI setup wizard |
| `src/renderer/components/setup/CliCard.tsx` | CLI install status card |
| `src/renderer/components/setup/LoginStep.tsx` | CLI login status/button |
| `src/renderer/components/sidebar/AgentPanel.tsx` | Agent list and status |

### Delete Files

| Path | Reason |
|------|--------|
| `src-tauri/src/providers/` (entire dir) | Replaced by CLI subprocess |
| `src-tauri/src/auth/` (entire dir) | CLI handles own auth |
| `src-tauri/src/skills/ai.rs` | Delegated to CLI |
| `src-tauri/src/commands/auth.rs` | No longer needed |
| `src-tauri/src/commands/chat.rs` | Replaced by cli commands |
| `src-tauri/src/commands/cowork.rs` | Removed feature |
| `src/renderer/components/cowork/` (entire dir) | Removed feature |
| `src/renderer/components/eval/` (entire dir) | Removed feature |
| `src/renderer/hooks/use-assistant-runtime.ts` | Replaced by Tauri events |
| `src/renderer/lib/providers.ts` | Replaced by cli-api.ts |

### Modify Files

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Remove provider/auth init, add CliManager init |
| `src-tauri/src/state.rs` | Remove provider state, add CliManager |
| `src-tauri/src/commands/mod.rs` | Remove old modules, add cli module |
| `src-tauri/src/db/schema.rs` | Add message_type column |
| `src-tauri/src/db/conversations.rs` | provider → cli_provider |
| `src/renderer/App.tsx` | Remove cowork/eval, add SetupWizard |
| `src/renderer/stores/app-store.ts` | New types, remove AuthStatus |
| `src/renderer/components/chat/ChatView.tsx` | Tauri event listening |
| `src/renderer/components/sidebar/Sidebar.tsx` | Add AgentPanel |
| `src/renderer/components/InputControls.tsx` | Add `/` detection |
| `src/renderer/components/settings/tabs/ProvidersTab.tsx` | CLI management |

---

## Task 1: Define Core Types

**Files:**
- Create: `src-tauri/src/cli/types.rs`
- Create: `src-tauri/src/cli/mod.rs`

- [x] **Step 1: Create cli module root**

```rust
// src-tauri/src/cli/mod.rs
pub mod types;
```

- [x] **Step 2: Define UnifiedMessage and supporting types**

```rust
// src-tauri/src/cli/types.rs
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
```

- [x] **Step 3: Verify it compiles**

Run: `cd /Users/kangnam/projects/kangnam-client/src-tauri && cargo check 2>&1 | head -20`

Note: This will fail because `mod cli` is not yet registered in `lib.rs`. That is expected — just verify `types.rs` has no syntax errors by checking the error is about the missing module, not about the types file.

- [x] **Step 4: Commit**

```bash
git add src-tauri/src/cli/
git commit -m "feat: add CLI types module with UnifiedMessage enum"
```

---

## Task 2: Define CliAdapter Trait

**Files:**
- Create: `src-tauri/src/cli/adapter.rs`
- Create: `src-tauri/src/cli/adapters/mod.rs`
- Modify: `src-tauri/src/cli/mod.rs`

- [x] **Step 1: Create adapter trait**

```rust
// src-tauri/src/cli/adapter.rs
use std::path::Path;
use std::process::Stdio;
use tokio::process::Command;

use crate::cli::types::{UnifiedMessage, SkillInfo, AgentInfo};

/// Each CLI provider implements this trait to handle its specific JSON format
/// and subprocess configuration.
pub trait CliAdapter: Send + Sync {
    /// Provider name (e.g., "claude", "codex")
    fn name(&self) -> &str;

    /// The CLI binary name to invoke (e.g., "claude", "codex")
    fn command(&self) -> &str;

    /// Build the Command for spawning the CLI process.
    /// For Claude Code: long-running with stdin/stdout pipes.
    /// For Codex CLI: one-shot per prompt via `codex exec`.
    fn build_command(&self, working_dir: &Path) -> Command;

    /// Parse one line of stdout JSON into a UnifiedMessage.
    /// Returns None if the line should be skipped (e.g., empty or non-JSON).
    fn parse_line(&self, line: &str) -> Result<Option<UnifiedMessage>, String>;

    /// Format a user message for writing to stdin.
    /// Returns None if the CLI does not support stdin messaging (e.g., Codex).
    fn format_user_message(&self, message: &str, session_id: &str) -> Option<String>;

    /// Format a permission response for writing to stdin.
    /// Returns None if not supported.
    fn format_permission_response(&self, request_id: &str, allowed: bool) -> Option<String>;

    /// Whether the CLI supports persistent stdin (multi-turn in one process).
    /// Claude Code: true. Codex CLI: false (one process per prompt).
    fn supports_persistent_session(&self) -> bool;

    /// Command to check if CLI is installed (e.g., "claude --version")
    fn version_command(&self) -> Vec<String>;

    /// Command to install the CLI (e.g., ["npm", "install", "-g", "@anthropic-ai/claude-code"])
    fn install_command(&self) -> Option<Vec<String>>;

    /// Command args to list available skills. None if not supported.
    fn list_skills_command(&self) -> Option<Vec<String>>;

    /// Command args to list available agents. None if not supported.
    fn list_agents_command(&self) -> Option<Vec<String>>;
}
```

- [x] **Step 2: Create adapters module root**

```rust
// src-tauri/src/cli/adapters/mod.rs
pub mod claude;
pub mod codex;
```

- [x] **Step 3: Update cli/mod.rs**

```rust
// src-tauri/src/cli/mod.rs
pub mod adapter;
pub mod adapters;
pub mod types;
```

- [x] **Step 4: Commit**

```bash
git add src-tauri/src/cli/
git commit -m "feat: add CliAdapter trait and adapters module"
```

---

## Task 3: Implement Claude Code Adapter

**Files:**
- Create: `src-tauri/src/cli/adapters/claude.rs`

- [x] **Step 1: Implement Claude Code adapter**

```rust
// src-tauri/src/cli/adapters/claude.rs
use std::path::Path;
use tokio::process::Command;
use std::process::Stdio;

use crate::cli::adapter::CliAdapter;
use crate::cli::types::{UnifiedMessage, TokenUsage, SkillInfo, AgentInfo};

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
                    // input_json_delta is partial tool input — skip, we get the full input in content_block_start
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

                        // Check if this is an Agent tool call
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

    /// Parse an assistant turn message (complete turn with all content blocks)
    fn parse_assistant(&self, value: &serde_json::Value) -> Result<Option<UnifiedMessage>, String> {
        // The assistant message contains the full turn — we already streamed the content
        // via stream_events, so we skip this to avoid duplication.
        // However, if we ever need the complete tool_use input, we can extract it here.
        Ok(None)
    }

    /// Parse a result message (session end)
    fn parse_result(&self, value: &serde_json::Value) -> Result<Option<UnifiedMessage>, String> {
        let is_error = value.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
        if is_error {
            let message = value.get("result").and_then(|v| v.as_str()).unwrap_or("Unknown error").to_string();
            Ok(Some(UnifiedMessage::Error { message }))
        } else {
            let cost = value.get("cost_usd").and_then(|v| v.as_f64());
            let num_turns = value.get("num_turns").and_then(|v| v.as_u64());
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
            "--include-partial-messages",
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
        Some(vec!["npm".to_string(), "install".to_string(), "-g".to_string(), "@anthropic-ai/claude-code".to_string()])
    }

    fn list_skills_command(&self) -> Option<Vec<String>> {
        // Claude Code does not have a --list-skills flag.
        // Skills are discovered at runtime within a session.
        None
    }

    fn list_agents_command(&self) -> Option<Vec<String>> {
        None
    }
}
```

- [x] **Step 2: Verify it compiles (syntax only)**

Run: `cd /Users/kangnam/projects/kangnam-client/src-tauri && cargo check 2>&1 | head -20`

Expected: Module registration errors (cli not in lib.rs yet), not syntax errors in claude.rs.

- [x] **Step 3: Commit**

```bash
git add src-tauri/src/cli/adapters/claude.rs
git commit -m "feat: implement Claude Code CLI adapter"
```

---

## Task 4: Implement Codex CLI Adapter

**Files:**
- Create: `src-tauri/src/cli/adapters/codex.rs`

- [x] **Step 1: Implement Codex CLI adapter**

```rust
// src-tauri/src/cli/adapters/codex.rs
use std::path::Path;
use tokio::process::Command;
use std::process::Stdio;

use crate::cli::adapter::CliAdapter;
use crate::cli::types::{UnifiedMessage, SkillInfo, AgentInfo};

pub struct CodexAdapter;

impl CodexAdapter {
    pub fn new() -> Self {
        Self
    }

    fn parse_item_event(&self, value: &serde_json::Value) -> Result<Option<UnifiedMessage>, String> {
        let event_type = value.get("type").and_then(|t| t.as_str()).unwrap_or("");

        // item.* events carry the actual content
        if !event_type.starts_with("item.") {
            return Ok(None);
        }

        // Extract the item payload
        let item = value.get("item").unwrap_or(value);
        let item_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match item_type {
            "message" => {
                let content = item.get("content").and_then(|c| c.as_str()).unwrap_or("");
                if !content.is_empty() {
                    Ok(Some(UnifiedMessage::TextDelta {
                        text: content.to_string(),
                    }))
                } else {
                    Ok(None)
                }
            }
            "function_call" | "command" => {
                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("command").to_string();
                let args = item.get("arguments")
                    .or_else(|| item.get("command"))
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);
                Ok(Some(UnifiedMessage::ToolUseStart {
                    id,
                    name,
                    input: args,
                }))
            }
            "function_call_output" | "command_output" => {
                let id = item.get("call_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let output = item.get("output").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(Some(UnifiedMessage::ToolResult {
                    id,
                    output,
                    is_error: false,
                }))
            }
            "file_change" => {
                let file_path = item.get("path").and_then(|v| v.as_str()).unwrap_or("");
                let diff = item.get("diff").and_then(|v| v.as_str()).map(|s| s.to_string());
                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(Some(UnifiedMessage::PermissionRequest {
                    id,
                    tool: "file_edit".to_string(),
                    description: format!("Edit file: {}", file_path),
                    diff,
                }))
            }
            _ => Ok(None),
        }
    }
}

impl CliAdapter for CodexAdapter {
    fn name(&self) -> &str {
        "codex"
    }

    fn command(&self) -> &str {
        "codex"
    }

    fn build_command(&self, working_dir: &Path) -> Command {
        // Codex CLI is one-shot: `codex exec --json "<prompt>"`
        // The actual prompt is appended in manager.rs when sending a message.
        let mut cmd = Command::new("codex");
        cmd.arg("exec");
        cmd.arg("--json");
        cmd.current_dir(working_dir);
        cmd.stdin(Stdio::null());
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

        let event_type = value.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match event_type {
            "thread.started" => {
                let id = value.get("thread_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(Some(UnifiedMessage::SessionInit { session_id: id }))
            }
            "turn.completed" => {
                Ok(Some(UnifiedMessage::TurnEnd { usage: None }))
            }
            "turn.failed" | "error" => {
                let message = value.get("error")
                    .or_else(|| value.get("message"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();
                Ok(Some(UnifiedMessage::Error { message }))
            }
            t if t.starts_with("item.") => self.parse_item_event(&value),
            _ => Ok(None),
        }
    }

    fn format_user_message(&self, _message: &str, _session_id: &str) -> Option<String> {
        // Codex does not support stdin messaging — each prompt is a new process
        None
    }

    fn format_permission_response(&self, _request_id: &str, _allowed: bool) -> Option<String> {
        // Codex handles permissions internally
        None
    }

    fn supports_persistent_session(&self) -> bool {
        false
    }

    fn version_command(&self) -> Vec<String> {
        vec!["codex".to_string(), "--version".to_string()]
    }

    fn install_command(&self) -> Option<Vec<String>> {
        Some(vec!["npm".to_string(), "install".to_string(), "-g".to_string(), "@openai/codex".to_string()])
    }

    fn list_skills_command(&self) -> Option<Vec<String>> {
        None
    }

    fn list_agents_command(&self) -> Option<Vec<String>> {
        None
    }
}
```

- [x] **Step 2: Commit**

```bash
git add src-tauri/src/cli/adapters/codex.rs
git commit -m "feat: implement Codex CLI adapter"
```

---

## Task 5: Implement CLI Manager

**Files:**
- Create: `src-tauri/src/cli/manager.rs`
- Modify: `src-tauri/src/cli/mod.rs`

- [x] **Step 1: Implement CliManager**

```rust
// src-tauri/src/cli/manager.rs
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

use crate::cli::adapter::CliAdapter;
use crate::cli::types::{CliStatus, UnifiedMessage};

struct CliSession {
    child: Child,
    provider: String,
    working_dir: PathBuf,
    session_id: String,
}

pub struct CliManager {
    adapters: HashMap<String, Box<dyn CliAdapter>>,
    sessions: Arc<Mutex<HashMap<String, CliSession>>>,
}

impl CliManager {
    pub fn new() -> Self {
        Self {
            adapters: HashMap::new(),
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn register_adapter(&mut self, adapter: Box<dyn CliAdapter>) {
        let name = adapter.name().to_string();
        self.adapters.insert(name, adapter);
    }

    fn get_adapter(&self, provider: &str) -> Result<&dyn CliAdapter, String> {
        self.adapters
            .get(provider)
            .map(|a| a.as_ref())
            .ok_or_else(|| format!("Unknown provider: {}", provider))
    }

    /// Start a new CLI session. Spawns the subprocess and begins reading stdout.
    pub async fn start_session(
        &self,
        provider: &str,
        working_dir: &Path,
        session_id: &str,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let adapter = self.get_adapter(provider)?;
        let mut cmd = adapter.build_command(working_dir);
        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn {}: {}", provider, e))?;

        // Take stdout for reading
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let sessions = self.sessions.clone();
        let sid = session_id.to_string();
        let prov = provider.to_string();

        // Store session
        {
            let mut sessions_lock = sessions.lock().await;
            sessions_lock.insert(
                session_id.to_string(),
                CliSession {
                    child,
                    provider: provider.to_string(),
                    working_dir: working_dir.to_path_buf(),
                    session_id: session_id.to_string(),
                },
            );
        }

        // Spawn stdout reader task
        let adapter_name = provider.to_string();
        let adapters_ref = &self.adapters;
        // We need to parse lines using the adapter. Since adapter is behind &self,
        // we clone the provider name and look up each time (adapters are static after init).
        // Instead, we create a dedicated parsing closure.
        let parse_provider = adapter_name.clone();

        // Since CliAdapter is not Clone, we need to handle parsing differently.
        // We'll store the adapter name and use a standalone parse function approach.
        // For now, we serialize/deserialize through the known adapter types.
        let is_claude = parse_provider == "claude";

        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                // Parse using inline logic based on provider
                let parsed = if is_claude {
                    crate::cli::adapters::claude::ClaudeAdapter::new().parse_line(&line)
                } else {
                    crate::cli::adapters::codex::CodexAdapter::new().parse_line(&line)
                };

                match parsed {
                    Ok(Some(msg)) => {
                        let _ = app_handle.emit("cli-stream", &msg);
                    }
                    Ok(None) => {} // Skip non-content lines
                    Err(e) => {
                        let _ = app_handle.emit(
                            "cli-stream",
                            &UnifiedMessage::Error {
                                message: format!("Parse error: {}", e),
                            },
                        );
                    }
                }
            }

            // Process ended — emit turn end
            let _ = app_handle.emit(
                "cli-stream",
                &UnifiedMessage::TurnEnd { usage: None },
            );

            // Clean up session
            let mut sessions_lock = sessions.lock().await;
            sessions_lock.remove(&sid);
        });

        Ok(())
    }

    /// Send a message to a running CLI session (via stdin).
    /// For Codex (non-persistent), this spawns a new process.
    pub async fn send_message(
        &self,
        session_id: &str,
        message: &str,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let mut sessions_lock = self.sessions.lock().await;

        if let Some(session) = sessions_lock.get_mut(session_id) {
            let adapter = self.get_adapter(&session.provider)?;

            if adapter.supports_persistent_session() {
                // Write to stdin (Claude Code)
                if let Some(formatted) = adapter.format_user_message(message, &session.session_id) {
                    if let Some(stdin) = session.child.stdin.as_mut() {
                        stdin
                            .write_all(formatted.as_bytes())
                            .await
                            .map_err(|e| format!("stdin write error: {}", e))?;
                        stdin.flush().await.map_err(|e| format!("stdin flush error: {}", e))?;
                    }
                }
                Ok(())
            } else {
                // Non-persistent (Codex) — need to spawn a new process
                let provider = session.provider.clone();
                let working_dir = session.working_dir.clone();
                drop(sessions_lock);

                // Spawn new codex exec process with the message as prompt
                self.start_codex_exec(&provider, &working_dir, session_id, message, app_handle)
                    .await
            }
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Spawn a one-shot codex exec process for a single prompt.
    async fn start_codex_exec(
        &self,
        provider: &str,
        working_dir: &Path,
        session_id: &str,
        prompt: &str,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let adapter = self.get_adapter(provider)?;
        let mut cmd = adapter.build_command(working_dir);
        cmd.arg(prompt); // codex exec --json "<prompt>"

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn codex: {}", e))?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let sessions = self.sessions.clone();
        let sid = session_id.to_string();

        // Store session for tracking
        {
            let mut sessions_lock = sessions.lock().await;
            sessions_lock.insert(
                session_id.to_string(),
                CliSession {
                    child,
                    provider: provider.to_string(),
                    working_dir: working_dir.to_path_buf(),
                    session_id: session_id.to_string(),
                },
            );
        }

        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let parsed = crate::cli::adapters::codex::CodexAdapter::new().parse_line(&line);
                match parsed {
                    Ok(Some(msg)) => {
                        let _ = app_handle.emit("cli-stream", &msg);
                    }
                    Ok(None) => {}
                    Err(e) => {
                        let _ = app_handle.emit(
                            "cli-stream",
                            &UnifiedMessage::Error {
                                message: format!("Parse error: {}", e),
                            },
                        );
                    }
                }
            }

            let _ = app_handle.emit(
                "cli-stream",
                &UnifiedMessage::TurnEnd { usage: None },
            );

            let mut sessions_lock = sessions.lock().await;
            sessions_lock.remove(&sid);
        });

        Ok(())
    }

    /// Send a permission response to a running CLI session.
    pub async fn send_permission_response(
        &self,
        session_id: &str,
        request_id: &str,
        allowed: bool,
    ) -> Result<(), String> {
        let mut sessions_lock = self.sessions.lock().await;
        let session = sessions_lock
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        let adapter = self.get_adapter(&session.provider)?;
        if let Some(formatted) = adapter.format_permission_response(request_id, allowed) {
            if let Some(stdin) = session.child.stdin.as_mut() {
                stdin
                    .write_all(formatted.as_bytes())
                    .await
                    .map_err(|e| format!("stdin write error: {}", e))?;
                stdin.flush().await.map_err(|e| format!("stdin flush error: {}", e))?;
            }
        }
        Ok(())
    }

    /// Stop a running CLI session.
    pub async fn stop_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions_lock = self.sessions.lock().await;
        if let Some(mut session) = sessions_lock.remove(session_id) {
            let _ = session.child.kill().await;
        }
        Ok(())
    }

    /// Check if a CLI is installed and get version.
    pub async fn check_installed(&self, provider: &str) -> Result<CliStatus, String> {
        let adapter = self.get_adapter(provider)?;
        let version_cmd = adapter.version_command();

        if version_cmd.is_empty() {
            return Ok(CliStatus {
                provider: provider.to_string(),
                installed: false,
                version: None,
                path: None,
                authenticated: false,
            });
        }

        let output = tokio::process::Command::new(&version_cmd[0])
            .args(&version_cmd[1..])
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
                // Try to find the binary path
                let which_output = tokio::process::Command::new("which")
                    .arg(adapter.command())
                    .output()
                    .await;
                let path = which_output
                    .ok()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

                Ok(CliStatus {
                    provider: provider.to_string(),
                    installed: true,
                    version: Some(version),
                    path,
                    authenticated: false, // Auth check is CLI-specific, left for future
                })
            }
            _ => Ok(CliStatus {
                provider: provider.to_string(),
                installed: false,
                version: None,
                path: None,
                authenticated: false,
            }),
        }
    }

    /// Install a CLI tool.
    pub async fn install_cli(&self, provider: &str) -> Result<(), String> {
        let adapter = self.get_adapter(provider)?;
        let install_cmd = adapter
            .install_command()
            .ok_or_else(|| format!("No install command for {}", provider))?;

        if install_cmd.is_empty() {
            return Err("Empty install command".to_string());
        }

        let output = tokio::process::Command::new(&install_cmd[0])
            .args(&install_cmd[1..])
            .output()
            .await
            .map_err(|e| format!("Install failed: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Install failed: {}", stderr))
        }
    }
}
```

- [x] **Step 2: Update cli/mod.rs**

```rust
// src-tauri/src/cli/mod.rs
pub mod adapter;
pub mod adapters;
pub mod manager;
pub mod types;
```

- [x] **Step 3: Commit**

```bash
git add src-tauri/src/cli/
git commit -m "feat: implement CLI Manager with subprocess lifecycle"
```

---

## Task 6: Implement CLI Registry

**Files:**
- Create: `src-tauri/src/cli/registry.rs`
- Modify: `src-tauri/src/cli/mod.rs`

- [x] **Step 1: Implement registry**

```rust
// src-tauri/src/cli/registry.rs
use crate::cli::types::CliStatus;

/// Supported CLI providers and their metadata.
pub struct CliRegistry;

impl CliRegistry {
    /// Returns list of all known CLI providers.
    pub fn known_providers() -> Vec<ProviderMeta> {
        vec![
            ProviderMeta {
                name: "claude".to_string(),
                display_name: "Claude Code".to_string(),
                description: "Anthropic's coding agent CLI".to_string(),
                install_hint: "npm install -g @anthropic-ai/claude-code".to_string(),
            },
            ProviderMeta {
                name: "codex".to_string(),
                display_name: "Codex CLI".to_string(),
                description: "OpenAI's coding agent CLI".to_string(),
                install_hint: "npm install -g @openai/codex".to_string(),
            },
        ]
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProviderMeta {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub install_hint: String,
}
```

- [x] **Step 2: Update cli/mod.rs**

```rust
// src-tauri/src/cli/mod.rs
pub mod adapter;
pub mod adapters;
pub mod manager;
pub mod registry;
pub mod types;
```

- [x] **Step 3: Commit**

```bash
git add src-tauri/src/cli/
git commit -m "feat: add CLI registry with provider metadata"
```

---

## Task 7: Tauri IPC Commands

**Files:**
- Create: `src-tauri/src/commands/cli.rs`

- [x] **Step 1: Implement Tauri commands**

```rust
// src-tauri/src/commands/cli.rs
use tauri::{AppHandle, State};

use crate::cli::manager::CliManager;
use crate::cli::registry::{CliRegistry, ProviderMeta};
use crate::cli::types::CliStatus;
use crate::state::AppState;

#[tauri::command]
pub async fn cli_list_providers() -> Result<Vec<ProviderMeta>, String> {
    Ok(CliRegistry::known_providers())
}

#[tauri::command]
pub async fn cli_check_installed(
    state: State<'_, AppState>,
    provider: String,
) -> Result<CliStatus, String> {
    let manager = state.cli_manager.lock().await;
    manager.check_installed(&provider).await
}

#[tauri::command]
pub async fn cli_install(
    state: State<'_, AppState>,
    provider: String,
) -> Result<(), String> {
    let manager = state.cli_manager.lock().await;
    manager.install_cli(&provider).await
}

#[tauri::command]
pub async fn cli_start_session(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    provider: String,
    working_dir: String,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let working_dir = std::path::PathBuf::from(&working_dir);

    if !working_dir.is_dir() {
        return Err(format!("Directory does not exist: {}", working_dir.display()));
    }

    let manager = state.cli_manager.lock().await;
    manager
        .start_session(&provider, &working_dir, &session_id, app_handle)
        .await?;

    Ok(session_id)
}

#[tauri::command]
pub async fn cli_send_message(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    session_id: String,
    message: String,
) -> Result<(), String> {
    let manager = state.cli_manager.lock().await;
    manager.send_message(&session_id, &message, app_handle).await
}

#[tauri::command]
pub async fn cli_send_permission(
    state: State<'_, AppState>,
    session_id: String,
    request_id: String,
    allowed: bool,
) -> Result<(), String> {
    let manager = state.cli_manager.lock().await;
    manager
        .send_permission_response(&session_id, &request_id, allowed)
        .await
}

#[tauri::command]
pub async fn cli_stop_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let manager = state.cli_manager.lock().await;
    manager.stop_session(&session_id).await
}
```

- [x] **Step 2: Commit**

```bash
git add src-tauri/src/commands/cli.rs
git commit -m "feat: add Tauri IPC commands for CLI operations"
```

---

## Task 8: Delete Old Provider/Auth Code

**Files:**
- Delete: `src-tauri/src/providers/` (entire directory)
- Delete: `src-tauri/src/auth/` (entire directory)
- Delete: `src-tauri/src/skills/ai.rs`
- Delete: `src-tauri/src/commands/auth.rs`
- Delete: `src-tauri/src/commands/chat.rs`
- Delete: `src-tauri/src/commands/cowork.rs`
- Delete: `src/renderer/components/cowork/` (entire directory)
- Delete: `src/renderer/components/eval/` (entire directory)
- Delete: `src/renderer/hooks/use-assistant-runtime.ts`
- Delete: `src/renderer/lib/providers.ts`

- [x] **Step 1: Delete Rust backend files**

```bash
rm -rf src-tauri/src/providers/
rm -rf src-tauri/src/auth/
rm -f src-tauri/src/skills/ai.rs
rm -f src-tauri/src/commands/auth.rs
rm -f src-tauri/src/commands/chat.rs
rm -f src-tauri/src/commands/cowork.rs
```

- [x] **Step 2: Delete frontend files**

```bash
rm -rf src/renderer/components/cowork/
rm -rf src/renderer/components/eval/
rm -f src/renderer/hooks/use-assistant-runtime.ts
rm -f src/renderer/lib/providers.ts
```

- [x] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove old provider/auth/cowork/eval code"
```

---

## Task 9: Wire Up Backend — lib.rs, state.rs, commands/mod.rs

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/skills/mod.rs`

This task requires reading the current content of each file and surgically editing. Steps below describe the changes; the implementing agent must read each file first.

- [x] **Step 1: Update state.rs**

Remove all provider/auth state fields. Add CliManager. The new `AppState` should look like:

```rust
use tokio::sync::Mutex;
use crate::cli::manager::CliManager;
use crate::db::connection::DbConnection;

pub struct AppState {
    pub db: Mutex<DbConnection>,
    pub cli_manager: Mutex<CliManager>,
}
```

Remove any imports referencing `providers`, `auth`, or `AuthManager`.

- [x] **Step 2: Update commands/mod.rs**

Remove `pub mod auth;`, `pub mod chat;`, `pub mod cowork;`. Add `pub mod cli;`. Keep `pub mod conv;`, `pub mod settings;`, `pub mod mcp;`, `pub mod skills;`, `pub mod agents;`, `pub mod eval;` (eval will be cleaned up later if it has DB-only operations; if it references deleted code, remove it too).

- [x] **Step 3: Update skills/mod.rs**

Remove `pub mod ai;` if it exists. Keep remaining skill DB operations.

- [x] **Step 4: Update lib.rs**

Read the current lib.rs. Remove:
- `mod providers;`
- `mod auth;`
- Any provider/auth initialization in the Tauri builder
- Old command registrations (auth::*, chat::*, cowork::*)

Add:
- `mod cli;`
- CliManager initialization with Claude and Codex adapters registered
- New command registrations (cli::*)

The builder setup should be:

```rust
use cli::adapters::claude::ClaudeAdapter;
use cli::adapters::codex::CodexAdapter;
use cli::manager::CliManager;

// In the setup closure:
let mut cli_manager = CliManager::new();
cli_manager.register_adapter(Box::new(ClaudeAdapter::new()));
cli_manager.register_adapter(Box::new(CodexAdapter::new()));

let state = AppState {
    db: Mutex::new(db),
    cli_manager: Mutex::new(cli_manager),
};
```

Register commands:
```rust
.invoke_handler(tauri::generate_handler![
    commands::cli::cli_list_providers,
    commands::cli::cli_check_installed,
    commands::cli::cli_install,
    commands::cli::cli_start_session,
    commands::cli::cli_send_message,
    commands::cli::cli_send_permission,
    commands::cli::cli_stop_session,
    commands::conv::list_conversations,
    // ... keep existing conv, settings, mcp, skills, agents commands
])
```

- [x] **Step 5: Verify Rust backend compiles**

Run: `cd /Users/kangnam/projects/kangnam-client/src-tauri && cargo check 2>&1`

Fix any compilation errors. There will likely be remaining references to deleted modules in various files — find and remove them.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: wire up CLI Manager in Tauri backend, remove old provider init"
```

---

## Task 10: DB Schema Update

**Files:**
- Modify: `src-tauri/src/db/schema.rs`
- Modify: `src-tauri/src/db/conversations.rs`

- [x] **Step 1: Read current schema and conversations files**

Read `src-tauri/src/db/schema.rs` and `src-tauri/src/db/conversations.rs` to understand current structure.

- [x] **Step 2: Update schema**

Add `message_type TEXT NOT NULL DEFAULT 'text'` to the messages table CREATE statement. Change `provider` to `cli_provider` in conversations table. Add migration logic that runs on startup to ALTER existing tables if they exist.

- [x] **Step 3: Update conversations.rs**

Change any references from `provider` to `cli_provider` in query strings and struct fields.

- [x] **Step 4: Verify Rust compiles**

Run: `cd /Users/kangnam/projects/kangnam-client/src-tauri && cargo check`

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/db/
git commit -m "refactor: update DB schema for CLI wrapper (message_type, cli_provider)"
```

---

## Task 11: Frontend — Update Store and CLI API

**Files:**
- Modify: `src/renderer/stores/app-store.ts`
- Create: `src/renderer/lib/cli-api.ts`

- [x] **Step 1: Read current app-store.ts**

Read the full file to understand all existing state.

- [x] **Step 2: Update app-store.ts**

Remove `AuthStatus` type and `authStatuses`/`setAuthStatuses` state. Add:

```typescript
export interface CliStatus {
  provider: string
  installed: boolean
  version: string | null
  path: string | null
  authenticated: boolean
}

export type UnifiedMessage =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: string; is_error: boolean }
  | { type: 'permission_request'; id: string; tool: string; description: string; diff?: string }
  | { type: 'agent_start'; id: string; name: string; description: string }
  | { type: 'agent_progress'; id: string; message: string }
  | { type: 'agent_end'; id: string; result: string }
  | { type: 'skill_invoked'; name: string; args?: string }
  | { type: 'turn_end'; usage?: { input_tokens: number; output_tokens: number } }
  | { type: 'error'; message: string }
  | { type: 'session_init'; session_id: string }
```

Add state fields:

```typescript
// In the store
cliStatuses: [] as CliStatus[],
setCliStatuses: (statuses: CliStatus[]) => set({ cliStatuses: statuses }),
currentSessionId: null as string | null,
setCurrentSessionId: (id: string | null) => set({ currentSessionId: id }),
currentProvider: null as string | null,
setCurrentProvider: (provider: string | null) => set({ currentProvider: provider }),
setupComplete: false,
setSetupComplete: (complete: boolean) => set({ setupComplete: complete }),
messages: [] as UnifiedMessage[],
addMessage: (msg: UnifiedMessage) => set((state) => ({ messages: [...state.messages, msg] })),
clearMessages: () => set({ messages: [] }),
pendingPermission: null as UnifiedMessage | null,
setPendingPermission: (msg: UnifiedMessage | null) => set({ pendingPermission: msg }),
```

Remove: `showEval`, `authStatuses`, `setAuthStatuses`, and any cowork-related state.

- [x] **Step 3: Create cli-api.ts**

```typescript
// src/renderer/lib/cli-api.ts
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { CliStatus, UnifiedMessage } from '../stores/app-store'

export interface ProviderMeta {
  name: string
  display_name: string
  description: string
  install_hint: string
}

export const cliApi = {
  listProviders: () =>
    invoke<ProviderMeta[]>('cli_list_providers'),

  checkInstalled: (provider: string) =>
    invoke<CliStatus>('cli_check_installed', { provider }),

  install: (provider: string) =>
    invoke<void>('cli_install', { provider }),

  startSession: (provider: string, workingDir: string) =>
    invoke<string>('cli_start_session', { provider, workingDir }),

  sendMessage: (sessionId: string, message: string) =>
    invoke<void>('cli_send_message', { sessionId, message }),

  sendPermission: (sessionId: string, requestId: string, allowed: boolean) =>
    invoke<void>('cli_send_permission', { sessionId, requestId, allowed }),

  stopSession: (sessionId: string) =>
    invoke<void>('cli_stop_session', { sessionId }),

  onMessage: (callback: (msg: UnifiedMessage) => void): Promise<UnlistenFn> =>
    listen<UnifiedMessage>('cli-stream', (event) => callback(event.payload)),
}
```

- [x] **Step 4: Commit**

```bash
git add src/renderer/stores/app-store.ts src/renderer/lib/cli-api.ts
git commit -m "feat: update store types and add CLI API wrapper"
```

---

## Task 12: Frontend — MessageRenderer

**Files:**
- Create: `src/renderer/components/chat/MessageRenderer.tsx`

- [x] **Step 1: Create MessageRenderer**

```tsx
// src/renderer/components/chat/MessageRenderer.tsx
import type { UnifiedMessage } from '../../stores/app-store'

interface MessageRendererProps {
  message: UnifiedMessage
}

export function MessageRenderer({ message }: MessageRendererProps) {
  switch (message.type) {
    case 'text_delta':
      return <TextMessage text={message.text} />
    case 'tool_use_start':
      return <ToolUseCard id={message.id} name={message.name} input={message.input} />
    case 'tool_result':
      return <ToolResultCard id={message.id} output={message.output} isError={message.is_error} />
    case 'agent_start':
      return <AgentStartCard id={message.id} name={message.name} description={message.description} />
    case 'agent_progress':
      return <AgentProgressCard id={message.id} message={message.message} />
    case 'agent_end':
      return <AgentEndCard id={message.id} result={message.result} />
    case 'error':
      return <ErrorMessage message={message.message} />
    case 'turn_end':
      return <TurnEndIndicator usage={message.usage} />
    default:
      return null
  }
}

function TextMessage({ text }: { text: string }) {
  return <span className="whitespace-pre-wrap">{text}</span>
}

function ToolUseCard({ id, name, input }: { id: string; name: string; input: unknown }) {
  return (
    <div className="my-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
        {name}
      </div>
      <pre className="mt-2 overflow-x-auto text-xs text-[var(--text-tertiary)]">
        {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
      </pre>
    </div>
  )
}

function ToolResultCard({ id, output, isError }: { id: string; output: string; isError: boolean }) {
  return (
    <div className={`my-2 rounded-lg border p-3 text-xs font-mono ${
      isError
        ? 'border-red-500/30 bg-red-500/5 text-red-400'
        : 'border-green-500/30 bg-green-500/5 text-green-400'
    }`}>
      <pre className="overflow-x-auto whitespace-pre-wrap">{output}</pre>
    </div>
  )
}

function AgentStartCard({ id, name, description }: { id: string; name: string; description: string }) {
  return (
    <div className="my-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
        Agent: {name}
      </div>
      {description && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{description}</p>}
    </div>
  )
}

function AgentProgressCard({ id, message }: { id: string; message: string }) {
  return (
    <div className="ml-4 border-l-2 border-blue-500/30 pl-3 text-sm text-[var(--text-secondary)]">
      {message}
    </div>
  )
}

function AgentEndCard({ id, result }: { id: string; result: string }) {
  return (
    <div className="my-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="text-xs font-medium text-blue-400">Agent completed</div>
      <p className="mt-1 text-sm text-[var(--text-primary)]">{result}</p>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="my-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
      {message}
    </div>
  )
}

function TurnEndIndicator({ usage }: { usage?: { input_tokens: number; output_tokens: number } }) {
  if (!usage) return <div className="my-2 h-px bg-[var(--border-subtle)]" />
  return (
    <div className="my-2 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      <span>{usage.input_tokens + usage.output_tokens} tokens</span>
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add src/renderer/components/chat/MessageRenderer.tsx
git commit -m "feat: add MessageRenderer for UnifiedMessage types"
```

---

## Task 13: Frontend — SafetyDialog

**Files:**
- Create: `src/renderer/components/chat/SafetyDialog.tsx`

- [x] **Step 1: Create SafetyDialog**

```tsx
// src/renderer/components/chat/SafetyDialog.tsx
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

export function SafetyDialog() {
  const { pendingPermission, setPendingPermission, currentSessionId } = useAppStore()

  if (!pendingPermission || pendingPermission.type !== 'permission_request') return null

  const { id, tool, description, diff } = pendingPermission
  const isDangerous = tool === 'Bash' || tool === 'command'

  const handleResponse = async (allowed: boolean) => {
    if (currentSessionId) {
      await cliApi.sendPermission(currentSessionId, id, allowed)
    }
    setPendingPermission(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xl">{isDangerous ? '\u26A0\uFE0F' : '\u26A0\uFE0F'}</span>
          <h3 className={`text-base font-bold ${isDangerous ? 'text-red-400' : 'text-yellow-400'}`}>
            {isDangerous ? '명령 실행 요청' : '파일 수정 요청'}
          </h3>
        </div>

        <p className="mb-4 text-sm text-[var(--text-primary)]">{description}</p>

        {diff && (
          <pre className="mb-4 max-h-48 overflow-auto rounded-lg bg-[var(--bg-main)] p-3 font-mono text-xs leading-relaxed">
            {diff.split('\n').map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith('+') ? 'text-green-400' :
                  line.startsWith('-') ? 'text-red-400' :
                  'text-[var(--text-tertiary)]'
                }
              >
                {line}
              </div>
            ))}
          </pre>
        )}

        {isDangerous && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
            이 명령은 시스템에 변경을 가합니다.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleResponse(false)}
            className="rounded-lg bg-[var(--bg-main)] px-5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            거부
          </button>
          <button
            onClick={() => handleResponse(true)}
            className={`rounded-lg px-5 py-2 text-sm font-bold text-[var(--bg-main)] ${
              isDangerous ? 'bg-yellow-400 hover:bg-yellow-300' : 'bg-green-400 hover:bg-green-300'
            }`}
          >
            허용
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add src/renderer/components/chat/SafetyDialog.tsx
git commit -m "feat: add SafetyDialog for CLI permission requests"
```

---

## Task 14: Frontend — Update ChatView and App

**Files:**
- Modify: `src/renderer/components/chat/ChatView.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/InputControls.tsx`

This task requires reading the current files and adapting. Key changes:

- [x] **Step 1: Read current ChatView.tsx, App.tsx, InputControls.tsx**

- [x] **Step 2: Update ChatView.tsx**

Replace the SSE/assistant-ui streaming logic with Tauri event listening:

```tsx
// Key changes in ChatView.tsx:
import { useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'
import { MessageRenderer } from './MessageRenderer'
import { SafetyDialog } from './SafetyDialog'

// In the component:
const { messages, addMessage, setPendingPermission, currentSessionId } = useAppStore()
const messagesEndRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const unlisten = cliApi.onMessage((msg) => {
    if (msg.type === 'permission_request') {
      setPendingPermission(msg)
    } else {
      addMessage(msg)
    }
  })
  return () => { unlisten.then(fn => fn()) }
}, [addMessage, setPendingPermission])

// Auto-scroll
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])

// Render messages:
// {messages.map((msg, i) => <MessageRenderer key={i} message={msg} />)}
// <div ref={messagesEndRef} />
// <SafetyDialog />
```

- [x] **Step 3: Update App.tsx**

Remove cowork/eval imports and rendering. Remove auth status loading. Add setup check:

```tsx
// Key changes:
import { SetupWizard } from './components/setup/SetupWizard'  // will be created in Task 15

// Remove: import { EvalWorkbench }
// Remove: import { useAssistantRuntime } or similar
// Remove: showEval, authStatuses logic

// In the return:
// if (!setupComplete) return <SetupWizard />
// else render the main app layout
```

- [x] **Step 4: Update InputControls.tsx**

Read the current file. Modify the submit handler to use `cliApi.sendMessage` instead of the old provider-based send. The input should:
- Call `cliApi.sendMessage(currentSessionId, message)` on submit
- Detect `/` prefix for future CommandPalette integration (just a comment for now)

- [x] **Step 5: Verify frontend compiles**

Run: `cd /Users/kangnam/projects/kangnam-client && npm run typecheck`

Fix any TypeScript errors from removed imports or changed types.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire up ChatView with Tauri event streaming, update App layout"
```

---

## Task 15: Frontend — SetupWizard

**Files:**
- Create: `src/renderer/components/setup/SetupWizard.tsx`
- Create: `src/renderer/components/setup/CliCard.tsx`

- [x] **Step 1: Create CliCard**

```tsx
// src/renderer/components/setup/CliCard.tsx
import type { CliStatus } from '../../stores/app-store'
import type { ProviderMeta } from '../../lib/cli-api'

interface CliCardProps {
  meta: ProviderMeta
  status: CliStatus | null
  selected: boolean
  onToggle: () => void
  onInstall: () => void
  installing: boolean
}

export function CliCard({ meta, status, selected, onToggle, onInstall, installing }: CliCardProps) {
  const installed = status?.installed ?? false

  return (
    <button
      onClick={installed ? onToggle : onInstall}
      disabled={installing}
      className={`flex-1 rounded-xl border-2 p-5 text-center transition-colors ${
        selected
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'
      } ${installing ? 'opacity-50' : 'hover:border-[var(--text-tertiary)]'}`}
    >
      <div className="mb-2 text-lg font-bold text-[var(--text-primary)]">{meta.display_name}</div>
      <div className="mb-3 text-xs text-[var(--text-tertiary)]">{meta.description}</div>

      {installed ? (
        <>
          <div className="mb-2 text-xs text-green-400">v{status?.version} 설치됨</div>
          {selected && (
            <span className="inline-block rounded-md bg-green-400 px-3 py-1 text-xs font-bold text-[var(--bg-main)]">
              선택됨
            </span>
          )}
        </>
      ) : installing ? (
        <div className="text-xs text-yellow-400">설치 중...</div>
      ) : (
        <span className="inline-block rounded-md bg-[var(--bg-main)] px-3 py-1 text-xs text-[var(--text-primary)]">
          설치하기
        </span>
      )}
    </button>
  )
}
```

- [x] **Step 2: Create SetupWizard**

```tsx
// src/renderer/components/setup/SetupWizard.tsx
import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { cliApi, type ProviderMeta } from '../../lib/cli-api'
import type { CliStatus } from '../../stores/app-store'
import { CliCard } from './CliCard'

type Step = 'select' | 'login' | 'ready'

export function SetupWizard() {
  const { setSetupComplete } = useAppStore()
  const [step, setStep] = useState<Step>('select')
  const [providers, setProviders] = useState<ProviderMeta[]>([])
  const [statuses, setStatuses] = useState<Record<string, CliStatus>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState<string | null>(null)

  // Load providers and check install status
  useEffect(() => {
    cliApi.listProviders().then(async (metas) => {
      setProviders(metas)
      const statusMap: Record<string, CliStatus> = {}
      for (const meta of metas) {
        statusMap[meta.name] = await cliApi.checkInstalled(meta.name)
      }
      setStatuses(statusMap)

      // Auto-select installed providers
      const installedSet = new Set<string>()
      for (const [name, status] of Object.entries(statusMap)) {
        if (status.installed) installedSet.add(name)
      }
      setSelected(installedSet)
    })
  }, [])

  const handleInstall = async (provider: string) => {
    setInstalling(provider)
    try {
      await cliApi.install(provider)
      const status = await cliApi.checkInstalled(provider)
      setStatuses((prev) => ({ ...prev, [provider]: status }))
      if (status.installed) {
        setSelected((prev) => new Set([...prev, provider]))
      }
    } catch (e) {
      console.error('Install failed:', e)
    }
    setInstalling(null)
  }

  const handleToggle = (provider: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  if (step === 'select') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-main)]">
        <div className="w-full max-w-lg px-6">
          <h1 className="mb-2 text-center text-xl font-bold text-[var(--text-primary)]">
            사용할 AI 도구를 선택하세요
          </h1>
          <p className="mb-8 text-center text-sm text-[var(--text-tertiary)]">
            설치되지 않은 도구는 설치를 도와드립니다
          </p>

          <div className="mb-8 flex gap-4">
            {providers.map((meta) => (
              <CliCard
                key={meta.name}
                meta={meta}
                status={statuses[meta.name] ?? null}
                selected={selected.has(meta.name)}
                onToggle={() => handleToggle(meta.name)}
                onInstall={() => handleInstall(meta.name)}
                installing={installing === meta.name}
              />
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={() => {
                if (selected.size > 0) {
                  setSetupComplete(true)
                }
              }}
              disabled={selected.size === 0}
              className="rounded-lg bg-[var(--accent-primary)] px-8 py-3 font-bold text-[var(--bg-main)] disabled:opacity-40"
            >
              시작하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
```

- [x] **Step 3: Commit**

```bash
git add src/renderer/components/setup/
git commit -m "feat: add SetupWizard with CLI detection and install"
```

---

## Task 16: Frontend — WorkdirSelector

**Files:**
- Create: `src/renderer/components/chat/WorkdirSelector.tsx`

- [x] **Step 1: Create WorkdirSelector**

```tsx
// src/renderer/components/chat/WorkdirSelector.tsx
import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

interface WorkdirSelectorProps {
  onSessionStarted: () => void
}

export function WorkdirSelector({ onSessionStarted }: WorkdirSelectorProps) {
  const { currentProvider, setCurrentSessionId, clearMessages } = useAppStore()
  const [recentDirs] = useState<string[]>(() => {
    const stored = localStorage.getItem('recentWorkdirs')
    return stored ? JSON.parse(stored) : []
  })

  const startSession = async (dir: string) => {
    if (!currentProvider) return
    clearMessages()

    // Save to recent dirs
    const updated = [dir, ...recentDirs.filter((d) => d !== dir)].slice(0, 5)
    localStorage.setItem('recentWorkdirs', JSON.stringify(updated))

    const sessionId = await cliApi.startSession(currentProvider, dir)
    setCurrentSessionId(sessionId)
    onSessionStarted()
  }

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false })
    if (selected && typeof selected === 'string') {
      await startSession(selected)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">작업할 폴더를 선택하세요</h2>
      <p className="text-sm text-[var(--text-tertiary)]">AI가 이 폴더 안에서 파일을 읽고 수정합니다</p>

      <div className="flex w-full max-w-md flex-col gap-2">
        {recentDirs.map((dir) => {
          const name = dir.split('/').pop() || dir
          return (
            <button
              key={dir}
              onClick={() => startSession(dir)}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-left hover:border-[var(--text-tertiary)]"
            >
              <span className="text-lg">{'\uD83D\uDCC1'}</span>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{name}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{dir}</div>
              </div>
            </button>
          )
        })}

        <button
          onClick={handleBrowse}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] p-3 text-sm text-[var(--text-tertiary)] hover:border-[var(--text-secondary)]"
        >
          + 다른 폴더 선택...
        </button>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add src/renderer/components/chat/WorkdirSelector.tsx
git commit -m "feat: add WorkdirSelector for choosing working directory"
```

---

## Task 17: Frontend — CommandPalette

**Files:**
- Create: `src/renderer/components/chat/CommandPalette.tsx`
- Modify: `src/renderer/components/InputControls.tsx`

- [x] **Step 1: Create CommandPalette**

```tsx
// src/renderer/components/chat/CommandPalette.tsx
import { useState, useMemo } from 'react'

interface CommandPaletteProps {
  query: string
  skills: Array<{ name: string; description: string }>
  onSelect: (skillName: string) => void
  onClose: () => void
}

export function CommandPalette({ query, skills, onSelect, onClose }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().replace(/^\//, '')
    if (!q) return skills
    return skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    )
  }, [query, skills])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      onSelect(filtered[selectedIndex].name)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (filtered.length === 0) return null

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2 shadow-xl"
      onKeyDown={handleKeyDown}
    >
      <div className="mb-1 px-2 text-xs text-[var(--text-tertiary)]">Skills</div>
      {filtered.map((skill, i) => (
        <button
          key={skill.name}
          onClick={() => onSelect(skill.name)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
            i === selectedIndex ? 'bg-[var(--accent-primary)]/15' : ''
          }`}
        >
          <span className="font-mono text-sm font-bold text-[var(--accent-primary)]">/{skill.name}</span>
          <span className="text-xs text-[var(--text-tertiary)]">— {skill.description}</span>
        </button>
      ))}
    </div>
  )
}
```

- [x] **Step 2: Update InputControls.tsx**

Read the current file. Add state for showing the CommandPalette:

```tsx
// Add to InputControls:
const [showPalette, setShowPalette] = useState(false)
const [paletteQuery, setPaletteQuery] = useState('')

// In the input onChange handler:
const handleInputChange = (value: string) => {
  setText(value)
  if (value.startsWith('/')) {
    setShowPalette(true)
    setPaletteQuery(value)
  } else {
    setShowPalette(false)
  }
}

// In the submit handler:
// If text starts with '/', send it as-is (the CLI will handle slash commands)

// Render CommandPalette above the input when showPalette is true
```

- [x] **Step 3: Commit**

```bash
git add src/renderer/components/chat/CommandPalette.tsx src/renderer/components/InputControls.tsx
git commit -m "feat: add CommandPalette for slash command skills"
```

---

## Task 18: Frontend — AgentPanel in Sidebar

**Files:**
- Create: `src/renderer/components/sidebar/AgentPanel.tsx`
- Modify: `src/renderer/components/sidebar/Sidebar.tsx`

- [x] **Step 1: Create AgentPanel**

```tsx
// src/renderer/components/sidebar/AgentPanel.tsx
import { useAppStore, type UnifiedMessage } from '../../stores/app-store'
import { useMemo } from 'react'

interface AgentState {
  id: string
  name: string
  description: string
  status: 'running' | 'completed'
  lastMessage: string
}

export function AgentPanel() {
  const { messages } = useAppStore()

  const agents = useMemo(() => {
    const agentMap = new Map<string, AgentState>()

    for (const msg of messages) {
      if (msg.type === 'agent_start') {
        agentMap.set(msg.id, {
          id: msg.id,
          name: msg.name,
          description: msg.description,
          status: 'running',
          lastMessage: '',
        })
      } else if (msg.type === 'agent_progress') {
        const agent = agentMap.get(msg.id)
        if (agent) agent.lastMessage = msg.message
      } else if (msg.type === 'agent_end') {
        const agent = agentMap.get(msg.id)
        if (agent) {
          agent.status = 'completed'
          agent.lastMessage = msg.result
        }
      }
    }

    return Array.from(agentMap.values())
  }, [messages])

  if (agents.length === 0) return null

  return (
    <div className="border-t border-[var(--border-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-secondary)]">Agents</span>
        <span className="text-xs text-[var(--text-tertiary)]">{agents.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)]">{agent.name}</span>
              <span
                className={`text-[10px] ${
                  agent.status === 'running' ? 'text-green-400' : 'text-[var(--text-tertiary)]'
                }`}
              >
                {agent.status === 'running' ? 'running' : 'done'}
              </span>
            </div>
            {agent.lastMessage && (
              <p className="mt-1 truncate text-[11px] text-[var(--text-tertiary)]">{agent.lastMessage}</p>
            )}
            {agent.status === 'running' && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-main)]">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-green-400" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [x] **Step 2: Update Sidebar.tsx**

Read current file. Add `<AgentPanel />` at the bottom of the sidebar, before the closing tag:

```tsx
import { AgentPanel } from './AgentPanel'

// At the bottom of the sidebar content:
<AgentPanel />
```

- [x] **Step 3: Commit**

```bash
git add src/renderer/components/sidebar/AgentPanel.tsx src/renderer/components/sidebar/Sidebar.tsx
git commit -m "feat: add AgentPanel to sidebar showing running agents"
```

---

## Task 19: Frontend — Update ProvidersTab for CLI Management

**Files:**
- Modify: `src/renderer/components/settings/tabs/ProvidersTab.tsx`

- [x] **Step 1: Read current ProvidersTab.tsx**

- [x] **Step 2: Rewrite ProvidersTab**

Replace OAuth provider configuration with CLI management:

```tsx
// Show for each CLI provider:
// - Name, install status, version, binary path
// - Install/update button
// - Status indicator (installed/not installed)

// Use cliApi.checkInstalled() and cliApi.install()
// Layout should follow the existing settings tab pattern
```

- [x] **Step 3: Commit**

```bash
git add src/renderer/components/settings/tabs/ProvidersTab.tsx
git commit -m "refactor: update ProvidersTab for CLI management"
```

---

## Task 20: Integration Test — Full Build Verification

- [x] **Step 1: Verify Rust backend compiles**

```bash
cd /Users/kangnam/projects/kangnam-client/src-tauri && cargo check
```

Fix all compilation errors.

- [x] **Step 2: Verify frontend compiles**

```bash
cd /Users/kangnam/projects/kangnam-client && npm run typecheck
```

Fix all TypeScript errors.

- [x] **Step 3: Verify Tauri dev build starts**

```bash
cd /Users/kangnam/projects/kangnam-client && npm run tauri:dev
```

Verify the app launches and shows the SetupWizard.

- [x] **Step 4: Run existing tests**

```bash
cd /Users/kangnam/projects/kangnam-client && npm test
```

Fix any broken tests. Remove tests for deleted code.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: resolve build errors and update tests for CLI wrapper"
```

---

## Task 21: Final Cleanup and .gitignore

- [x] **Step 1: Add .superpowers/ to .gitignore**

```bash
echo ".superpowers/" >> .gitignore
```

- [x] **Step 2: Remove unused dependencies from package.json**

If `@assistant-ui/react` and `@assistant-ui/react-markdown` are no longer used (since we removed use-assistant-runtime.ts), remove them:

```bash
npm uninstall @assistant-ui/react @assistant-ui/react-markdown
```

- [x] **Step 3: Remove unused Rust dependencies from Cargo.toml**

Check if `hyper` (was used for OAuth server), `sha2`, `base64`, `rand` (were used for PKCE) are still needed. Remove unused ones.

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused dependencies, update .gitignore"
```
