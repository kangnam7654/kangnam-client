# Phase 1: Parser Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code 프로토콜 21종 메시지를 전부 파싱하고 프론트엔드에 전달하여 향상된 래퍼의 기반을 구축한다.

**Architecture:** `CliAdapter` trait에 `enhanced_features()`/`parse_enhanced()` 메서드를 추가하고, Claude 어댑터에서 `ClaudeEnhancedEvent`를 파싱한다. enhanced 이벤트는 별도 broadcast 채널(`cli.enhanced`)로 프론트엔드에 전달된다. Codex 어댑터는 `enhanced_features() = false`로 기존 동작 유지.

**Tech Stack:** Rust (serde_json, tokio::broadcast), TypeScript (Zustand, Vitest)

**Design Spec:** `docs/llm/enhanced-wrapper-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src-tauri/src/cli/types.rs` | `ClaudeEnhancedEvent` enum, `McpServerInfo` struct | Modify |
| `src-tauri/src/cli/adapter.rs` | `CliAdapter` trait with enhanced methods | Modify |
| `src-tauri/src/cli/adapters/claude.rs` | 21종 메시지 파싱 | Modify |
| `src-tauri/src/cli/adapters/codex.rs` | `enhanced_features() = false` | Modify |
| `src-tauri/src/server/broadcast.rs` | enhanced broadcast 채널 | Modify |
| `src-tauri/src/state.rs` | `enhanced_broadcast_tx` 필드 | Modify |
| `src-tauri/src/cli/manager.rs` | stdout reader에서 `parse_enhanced` 호출 | Modify |
| `src-tauri/src/server/ws.rs` | enhanced broadcast 구독 | Modify |
| `src/renderer/stores/app-store.ts` | sessionMeta, tasks, rateLimit, cost 상태 | Modify |
| `src/renderer/lib/cli-api.ts` | `onEnhanced` 구독 | Modify |
| `src/renderer/components/chat/ChatView.tsx` | enhanced 이벤트 구독 + 연결 | Modify |

---

### Task 1: Define ClaudeEnhancedEvent types

**Files:**
- Modify: `src-tauri/src/cli/types.rs`

- [ ] **Step 1: Add McpServerInfo and ClaudeEnhancedEvent to types.rs**

Add the following after the existing `AgentInfo` struct at the end of the file:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClaudeEnhancedEvent {
    /// Extracted from system/init — session metadata
    SessionMeta {
        session_id: String,
        tools: Vec<String>,
        skills: Vec<String>,
        slash_commands: Vec<String>,
        mcp_servers: Vec<McpServerInfo>,
        model: String,
        permission_mode: String,
        cwd: String,
        claude_code_version: String,
    },
    /// Background task started (system/task_started)
    TaskStarted {
        task_id: String,
        tool_use_id: String,
        description: String,
        task_type: String,
    },
    /// Background task progress (system/task_progress)
    TaskProgress {
        task_id: String,
        description: String,
        usage: Option<serde_json::Value>,
        last_tool_name: Option<String>,
    },
    /// Background task completed/failed/stopped (system/task_notification)
    TaskNotification {
        task_id: String,
        status: String,
        summary: Option<String>,
    },
    /// Final result with cost and usage (result message)
    ResultSummary {
        cost_usd: Option<f64>,
        usage: Option<serde_json::Value>,
        duration_ms: Option<u64>,
        num_turns: Option<u32>,
        model_usage: Option<serde_json::Value>,
        permission_denials: Vec<serde_json::Value>,
    },
    /// Rate limit status change
    RateLimit {
        status: String,
        utilization: Option<f64>,
        rate_limit_type: String,
    },
    /// Hook execution started
    HookStarted {
        hook_id: String,
        hook_name: String,
        hook_event: String,
    },
    /// Hook stdout/stderr output
    HookProgress {
        hook_id: String,
        stdout: Option<String>,
        stderr: Option<String>,
    },
    /// Hook execution finished
    HookResponse {
        hook_id: String,
    },
    /// Status update (compacting, mode change)
    StatusUpdate {
        status: String,
        permission_mode: Option<String>,
    },
    /// Conversation was compacted
    CompactBoundary,
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/cli/types.rs
git commit -m "feat: add ClaudeEnhancedEvent and McpServerInfo types"
```

---

### Task 2: Extend CliAdapter trait

**Files:**
- Modify: `src-tauri/src/cli/adapter.rs`

- [ ] **Step 1: Add import and new methods to CliAdapter trait**

Add `use crate::cli::types::ClaudeEnhancedEvent;` to the imports. Then add two methods with default implementations at the end of the trait body (before the closing `}`):

```rust
use crate::cli::types::{UnifiedMessage, ClaudeEnhancedEvent};
```

Replace the existing `use crate::cli::types::UnifiedMessage;` with the above. Then add to the trait:

```rust
    /// Whether this CLI supports enhanced features (skills, tasks, etc.)
    /// Only Claude Code returns true.
    fn enhanced_features(&self) -> bool {
        false
    }

    /// Parse enhanced events from a line of stdout JSON.
    /// Returns None for CLIs that don't support enhanced features.
    fn parse_enhanced(&self, _line: &str) -> Result<Option<ClaudeEnhancedEvent>, String> {
        Ok(None)
    }
```

- [ ] **Step 2: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/cli/adapter.rs
git commit -m "feat: add enhanced_features and parse_enhanced to CliAdapter trait"
```

---

### Task 3: Update Codex adapter

**Files:**
- Modify: `src-tauri/src/cli/adapters/codex.rs`

- [ ] **Step 1: Add explicit enhanced_features and list_ methods**

The default trait implementations already return `false`/`None`, but for clarity add explicit implementations inside the `impl CliAdapter for CodexAdapter` block, replacing the existing `list_skills_command` and `list_agents_command`:

```rust
    fn enhanced_features(&self) -> bool {
        false
    }

    fn list_skills_command(&self) -> Option<Vec<String>> {
        None
    }

    fn list_agents_command(&self) -> Option<Vec<String>> {
        None
    }
```

- [ ] **Step 2: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/cli/adapters/codex.rs
git commit -m "feat: add explicit enhanced_features=false for Codex adapter"
```

---

### Task 4: Rewrite Claude adapter parser

This is the largest task. The Claude adapter needs to parse all 21 message types and emit both `UnifiedMessage` and `ClaudeEnhancedEvent`.

**Files:**
- Modify: `src-tauri/src/cli/adapters/claude.rs`

- [ ] **Step 1: Add ClaudeEnhancedEvent import and enhanced_features**

At the top of the file, add:

```rust
use crate::cli::types::{UnifiedMessage, ClaudeEnhancedEvent, McpServerInfo};
```

Inside `impl CliAdapter for ClaudeAdapter`, add:

```rust
    fn enhanced_features(&self) -> bool {
        true
    }
```

- [ ] **Step 2: Add parse_system_init method to ClaudeAdapter impl block**

Add this method inside `impl ClaudeAdapter` (not the trait impl):

```rust
    /// Parse system/init message into SessionMeta enhanced event
    fn parse_system_init(&self, value: &serde_json::Value) -> Result<Option<ClaudeEnhancedEvent>, String> {
        let session_id = value.get("session_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let tools = value.get("tools").and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let skills = value.get("skills").and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let slash_commands = value.get("slash_commands").and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let mcp_servers = value.get("mcp_servers").and_then(|v| v.as_array())
            .map(|arr| arr.iter().map(|v| McpServerInfo {
                name: v.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string(),
                status: v.get("status").and_then(|s| s.as_str()).unwrap_or("").to_string(),
            }).collect())
            .unwrap_or_default();
        let model = value.get("model").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let permission_mode = value.get("permissionMode").and_then(|v| v.as_str()).unwrap_or("default").to_string();
        let cwd = value.get("cwd").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let claude_code_version = value.get("claude_code_version").and_then(|v| v.as_str()).unwrap_or("").to_string();

        Ok(Some(ClaudeEnhancedEvent::SessionMeta {
            session_id, tools, skills, slash_commands, mcp_servers,
            model, permission_mode, cwd, claude_code_version,
        }))
    }

    /// Parse system/task_* messages
    fn parse_system_task(&self, subtype: &str, value: &serde_json::Value) -> Result<Option<ClaudeEnhancedEvent>, String> {
        let task_id = value.get("task_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        match subtype {
            "task_started" => Ok(Some(ClaudeEnhancedEvent::TaskStarted {
                task_id,
                tool_use_id: value.get("tool_use_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                description: value.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                task_type: value.get("task_type").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            })),
            "task_progress" => Ok(Some(ClaudeEnhancedEvent::TaskProgress {
                task_id,
                description: value.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                usage: value.get("usage").cloned(),
                last_tool_name: value.get("last_tool_name").and_then(|v| v.as_str()).map(String::from),
            })),
            "task_notification" => Ok(Some(ClaudeEnhancedEvent::TaskNotification {
                task_id,
                status: value.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                summary: value.get("summary").and_then(|v| v.as_str()).map(String::from),
            })),
            _ => Ok(None),
        }
    }

    /// Parse system/hook_* messages
    fn parse_system_hook(&self, subtype: &str, value: &serde_json::Value) -> Result<Option<ClaudeEnhancedEvent>, String> {
        let hook_id = value.get("hook_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        match subtype {
            "hook_started" => Ok(Some(ClaudeEnhancedEvent::HookStarted {
                hook_id,
                hook_name: value.get("hook_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                hook_event: value.get("hook_event").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            })),
            "hook_progress" => Ok(Some(ClaudeEnhancedEvent::HookProgress {
                hook_id,
                stdout: value.get("stdout").and_then(|v| v.as_str()).map(String::from),
                stderr: value.get("stderr").and_then(|v| v.as_str()).map(String::from),
            })),
            "hook_response" => Ok(Some(ClaudeEnhancedEvent::HookResponse { hook_id })),
            _ => Ok(None),
        }
    }

    /// Parse result message into ResultSummary
    fn parse_result_summary(&self, value: &serde_json::Value) -> Result<Option<ClaudeEnhancedEvent>, String> {
        Ok(Some(ClaudeEnhancedEvent::ResultSummary {
            cost_usd: value.get("total_cost_usd").and_then(|v| v.as_f64()),
            usage: value.get("usage").cloned(),
            duration_ms: value.get("duration_ms").and_then(|v| v.as_u64()),
            num_turns: value.get("num_turns").and_then(|v| v.as_u64()).map(|n| n as u32),
            model_usage: value.get("modelUsage").cloned(),
            permission_denials: value.get("permission_denials").and_then(|v| v.as_array())
                .cloned().unwrap_or_default(),
        }))
    }

    /// Parse rate_limit_event
    fn parse_rate_limit(&self, value: &serde_json::Value) -> Result<Option<ClaudeEnhancedEvent>, String> {
        let info = value.get("rate_limit_info").unwrap_or(value);
        Ok(Some(ClaudeEnhancedEvent::RateLimit {
            status: info.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            utilization: info.get("utilization").and_then(|v| v.as_f64()),
            rate_limit_type: info.get("rate_limit_type").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        }))
    }
```

- [ ] **Step 3: Implement parse_enhanced on the CliAdapter trait**

Inside `impl CliAdapter for ClaudeAdapter`, add:

```rust
    fn parse_enhanced(&self, line: &str) -> Result<Option<ClaudeEnhancedEvent>, String> {
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
                match subtype {
                    "init" => self.parse_system_init(&value),
                    "task_started" | "task_progress" | "task_notification" => {
                        self.parse_system_task(subtype, &value)
                    }
                    "hook_started" | "hook_progress" | "hook_response" => {
                        self.parse_system_hook(subtype, &value)
                    }
                    "status" => Ok(Some(ClaudeEnhancedEvent::StatusUpdate {
                        status: value.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        permission_mode: value.get("permissionMode").and_then(|v| v.as_str()).map(String::from),
                    })),
                    "compact_boundary" => Ok(Some(ClaudeEnhancedEvent::CompactBoundary)),
                    _ => Ok(None),
                }
            }
            "result" => self.parse_result_summary(&value),
            "rate_limit_event" => self.parse_rate_limit(&value),
            _ => Ok(None),
        }
    }
```

- [ ] **Step 4: Update parse_line to handle Agent + Task names and content_block_stop**

In the existing `parse_stream_event` method, update the `content_block_start` handler to detect both `"Agent"` and `"Task"`:

Replace `if name == "Agent"` with `if name == "Agent" || name == "Task"`.

- [ ] **Step 5: Add --include-hook-events to build_command**

In `build_command`, add `"--include-hook-events"` to the args array:

```rust
    fn build_command(&self, working_dir: &Path) -> Command {
        let mut cmd = Command::new("claude");
        cmd.args([
            "-p",
            "--output-format", "stream-json",
            "--input-format", "stream-json",
            "--verbose",
            "--include-partial-messages",
            "--include-hook-events",
        ]);
        cmd.current_dir(working_dir);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd
    }
```

- [ ] **Step 6: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 7: Add unit tests for parse_enhanced**

Add a `#[cfg(test)]` module at the end of `claude.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_enhanced_system_init() {
        let adapter = ClaudeAdapter::new();
        let line = r#"{"type":"system","subtype":"init","session_id":"abc-123","tools":["Bash","Read"],"skills":["my-skill"],"slash_commands":["/compact"],"mcp_servers":[{"name":"server1","status":"connected"}],"model":"claude-sonnet-4-6","permissionMode":"default","cwd":"/tmp","claude_code_version":"2.1.0"}"#;
        let result = adapter.parse_enhanced(line).unwrap().unwrap();
        match result {
            ClaudeEnhancedEvent::SessionMeta { session_id, tools, skills, model, .. } => {
                assert_eq!(session_id, "abc-123");
                assert_eq!(tools, vec!["Bash", "Read"]);
                assert_eq!(skills, vec!["my-skill"]);
                assert_eq!(model, "claude-sonnet-4-6");
            }
            _ => panic!("Expected SessionMeta"),
        }
    }

    #[test]
    fn test_parse_enhanced_task_started() {
        let adapter = ClaudeAdapter::new();
        let line = r#"{"type":"system","subtype":"task_started","task_id":"task_01","tool_use_id":"toolu_01","description":"Running tests","task_type":"local_bash"}"#;
        let result = adapter.parse_enhanced(line).unwrap().unwrap();
        match result {
            ClaudeEnhancedEvent::TaskStarted { task_id, task_type, .. } => {
                assert_eq!(task_id, "task_01");
                assert_eq!(task_type, "local_bash");
            }
            _ => panic!("Expected TaskStarted"),
        }
    }

    #[test]
    fn test_parse_enhanced_task_notification() {
        let adapter = ClaudeAdapter::new();
        let line = r#"{"type":"system","subtype":"task_notification","task_id":"task_01","status":"completed","summary":"All tests passed"}"#;
        let result = adapter.parse_enhanced(line).unwrap().unwrap();
        match result {
            ClaudeEnhancedEvent::TaskNotification { task_id, status, summary } => {
                assert_eq!(task_id, "task_01");
                assert_eq!(status, "completed");
                assert_eq!(summary, Some("All tests passed".to_string()));
            }
            _ => panic!("Expected TaskNotification"),
        }
    }

    #[test]
    fn test_parse_enhanced_result_summary() {
        let adapter = ClaudeAdapter::new();
        let line = r#"{"type":"result","subtype":"success","total_cost_usd":0.048,"duration_ms":18420,"num_turns":7,"usage":{"input_tokens":42300},"permission_denials":[]}"#;
        let result = adapter.parse_enhanced(line).unwrap().unwrap();
        match result {
            ClaudeEnhancedEvent::ResultSummary { cost_usd, duration_ms, num_turns, .. } => {
                assert!((cost_usd.unwrap() - 0.048).abs() < 0.001);
                assert_eq!(duration_ms, Some(18420));
                assert_eq!(num_turns, Some(7));
            }
            _ => panic!("Expected ResultSummary"),
        }
    }

    #[test]
    fn test_parse_enhanced_rate_limit() {
        let adapter = ClaudeAdapter::new();
        let line = r#"{"type":"rate_limit_event","rate_limit_info":{"status":"allowed_warning","utilization":0.87,"rate_limit_type":"five_hour"}}"#;
        let result = adapter.parse_enhanced(line).unwrap().unwrap();
        match result {
            ClaudeEnhancedEvent::RateLimit { status, utilization, rate_limit_type } => {
                assert_eq!(status, "allowed_warning");
                assert!((utilization.unwrap() - 0.87).abs() < 0.01);
                assert_eq!(rate_limit_type, "five_hour");
            }
            _ => panic!("Expected RateLimit"),
        }
    }

    #[test]
    fn test_parse_enhanced_compact_boundary() {
        let adapter = ClaudeAdapter::new();
        let line = r#"{"type":"system","subtype":"compact_boundary"}"#;
        let result = adapter.parse_enhanced(line).unwrap().unwrap();
        assert!(matches!(result, ClaudeEnhancedEvent::CompactBoundary));
    }

    #[test]
    fn test_parse_enhanced_ignores_stream_event() {
        let adapter = ClaudeAdapter::new();
        let line = r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}}"#;
        let result = adapter.parse_enhanced(line).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_line_detects_agent_and_task_names() {
        let adapter = ClaudeAdapter::new();
        // Agent name
        let line = r#"{"type":"stream_event","event":{"type":"content_block_start","content_block":{"type":"tool_use","id":"t1","name":"Agent"}}}"#;
        let result = adapter.parse_line(line).unwrap().unwrap();
        assert!(matches!(result, UnifiedMessage::AgentStart { .. }));

        // Legacy Task name
        let line2 = r#"{"type":"stream_event","event":{"type":"content_block_start","content_block":{"type":"tool_use","id":"t2","name":"Task"}}}"#;
        let result2 = adapter.parse_line(line2).unwrap().unwrap();
        assert!(matches!(result2, UnifiedMessage::AgentStart { .. }));
    }
}
```

- [ ] **Step 8: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- cli::adapters::claude::tests 2>&1`
Expected: all 8 tests pass

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/cli/adapters/claude.rs
git commit -m "feat: rewrite Claude adapter with 21-type parser and enhanced events"
```

---

### Task 5: Enhanced broadcast channel

**Files:**
- Modify: `src-tauri/src/server/broadcast.rs`
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Add enhanced channel to broadcast.rs**

Add to `src-tauri/src/server/broadcast.rs`:

```rust
pub type EnhancedBroadcastTx = broadcast::Sender<JsonRpcNotification>;
pub type EnhancedBroadcastRx = broadcast::Receiver<JsonRpcNotification>;

pub fn create_enhanced_channel() -> (EnhancedBroadcastTx, EnhancedBroadcastRx) {
    broadcast::channel(256)
}
```

- [ ] **Step 2: Add enhanced_broadcast_tx to AppState**

In `src-tauri/src/state.rs`, add the field and initialization:

```rust
use crate::server::broadcast::{self, BroadcastTx, EnhancedBroadcastTx};
```

Add field to `AppState`:

```rust
pub struct AppState {
    pub db: Mutex<Connection>,
    pub cli_manager: tokio::sync::Mutex<CliManager>,
    pub mcp: McpBridge,
    pub broadcast_tx: BroadcastTx,
    pub enhanced_broadcast_tx: EnhancedBroadcastTx,
}
```

In `AppState::new()`, add after `let (broadcast_tx, _) = broadcast::create_channel();`:

```rust
        let (enhanced_broadcast_tx, _) = broadcast::create_enhanced_channel();
```

Add `enhanced_broadcast_tx` to the `Ok(Self { ... })` block.

- [ ] **Step 3: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/server/broadcast.rs src-tauri/src/state.rs
git commit -m "feat: add enhanced broadcast channel for Claude-specific events"
```

---

### Task 6: Update manager stdout reader

**Files:**
- Modify: `src-tauri/src/cli/manager.rs`

- [ ] **Step 1: Add enhanced_broadcast_tx parameter to start_session**

Update the `start_session` method signature:

```rust
    pub async fn start_session(
        &self,
        provider: &str,
        working_dir: &Path,
        session_id: &str,
        broadcast_tx: BroadcastTx,
        enhanced_tx: Option<crate::server::broadcast::EnhancedBroadcastTx>,
    ) -> Result<(), String> {
```

- [ ] **Step 2: Add enhanced event emission in stdout reader task**

In the `tokio::spawn` block that reads stdout lines, after the existing `match parsed` block, add enhanced parsing:

```rust
        let is_enhanced = enhanced_tx.is_some();
        let enhanced_tx_clone = enhanced_tx.clone();

        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let parsed = if is_claude {
                    crate::cli::adapters::claude::ClaudeAdapter::new().parse_line(&line)
                } else {
                    crate::cli::adapters::codex::CodexAdapter::new().parse_line(&line)
                };

                match parsed {
                    Ok(Some(msg)) => {
                        Self::emit_notification(&broadcast_tx, &msg);
                    }
                    Ok(None) => {}
                    Err(e) => {
                        Self::emit_notification(
                            &broadcast_tx,
                            &UnifiedMessage::Error {
                                message: format!("Parse error: {}", e),
                            },
                        );
                    }
                }

                // Enhanced events (Claude only)
                if is_enhanced {
                    if let Some(ref etx) = enhanced_tx_clone {
                        let enhanced = crate::cli::adapters::claude::ClaudeAdapter::new()
                            .parse_enhanced(&line);
                        if let Ok(Some(event)) = enhanced {
                            let notification = JsonRpcNotification::new(
                                "cli.enhanced",
                                serde_json::to_value(&event).unwrap_or_default(),
                            );
                            let _ = etx.send(notification);
                        }
                    }
                }
            }

            Self::emit_notification(
                &broadcast_tx,
                &UnifiedMessage::TurnEnd { usage: None },
            );

            let mut sessions_lock = sessions.lock().await;
            sessions_lock.remove(&sid);
        });
```

- [ ] **Step 3: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: errors from callers of `start_session` (missing new parameter) — fix in next step

- [ ] **Step 4: Update callers of start_session in handlers.rs**

In `src-tauri/src/rpc/handlers.rs`, update the `start_session` handler:

```rust
    let enhanced_tx = if manager.get_adapter(&p.provider).map(|a| a.enhanced_features()).unwrap_or(false) {
        Some(state.enhanced_broadcast_tx.clone())
    } else {
        None
    };
    manager
        .start_session(&p.provider, &working_dir, &session_id, broadcast_tx, enhanced_tx)
        .await
        .map_err(|e| JsonRpcError::internal(&e))?;
```

Note: `get_adapter` is private in CliManager. Either make it `pub` or add a `pub fn has_enhanced_features(&self, provider: &str) -> bool` method. Simpler approach — always pass `Some(enhanced_tx)` and let the manager decide based on the adapter:

```rust
    let enhanced_tx = state.enhanced_broadcast_tx.clone();
    manager
        .start_session(&p.provider, &working_dir, &session_id, broadcast_tx, Some(enhanced_tx))
        .await
        .map_err(|e| JsonRpcError::internal(&e))?;
```

And in `manager.rs`, check `adapter.enhanced_features()` to decide whether to use the enhanced channel:

```rust
        let use_enhanced = adapter.enhanced_features() && enhanced_tx.is_some();
```

- [ ] **Step 5: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/cli/manager.rs src-tauri/src/rpc/handlers.rs
git commit -m "feat: emit enhanced events from Claude stdout reader"
```

---

### Task 7: WebSocket enhanced broadcast subscription

**Files:**
- Modify: `src-tauri/src/server/ws.rs`

- [ ] **Step 1: Add enhanced broadcast subscription**

In `handle_socket`, after the existing broadcast subscription task (Task 2: `broadcast_rx`), add a third task for the enhanced channel:

```rust
    // Task 3: enhanced broadcast notifications → outbound channel
    let mut enhanced_rx = state.enhanced_broadcast_tx.subscribe();
    let enhanced_notify_tx = outbound_tx.clone();
    let enhanced_task = tokio::spawn(async move {
        while let Ok(notification) = enhanced_rx.recv().await {
            if let Ok(text) = serde_json::to_string(&notification) {
                if enhanced_notify_tx.send(text).await.is_err() {
                    break;
                }
            }
        }
    });
```

In the cleanup section, add: `enhanced_task.abort();`

- [ ] **Step 2: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/server/ws.rs
git commit -m "feat: subscribe WebSocket clients to enhanced broadcast channel"
```

---

### Task 8: Frontend store — enhanced state

**Files:**
- Modify: `src/renderer/stores/app-store.ts`

- [ ] **Step 1: Add enhanced types and state**

Add the TypeScript types after the existing `UnifiedMessage` type:

```typescript
export interface SessionMeta {
  session_id: string
  tools: string[]
  skills: string[]
  slash_commands: string[]
  mcp_servers: { name: string; status: string }[]
  model: string
  permission_mode: string
  cwd: string
  claude_code_version: string
}

export interface TaskState {
  task_id: string
  description: string
  task_type: string
  status: 'running' | 'completed' | 'failed' | 'stopped'
  summary?: string
}

export interface RateLimitInfo {
  status: string
  utilization: number | null
  rate_limit_type: string
}

export interface ResultSummary {
  cost_usd: number | null
  duration_ms: number | null
  num_turns: number | null
}
```

Add to the `AppState` interface:

```typescript
  // Enhanced (Claude-specific)
  sessionMeta: SessionMeta | null
  setSessionMeta: (meta: SessionMeta | null) => void
  activeTasks: TaskState[]
  addTask: (task: TaskState) => void
  updateTask: (taskId: string, updates: Partial<TaskState>) => void
  rateLimit: RateLimitInfo | null
  setRateLimit: (info: RateLimitInfo | null) => void
  sessionCost: ResultSummary | null
  setSessionCost: (cost: ResultSummary | null) => void
```

Add to the store implementation:

```typescript
  // Enhanced
  sessionMeta: null,
  setSessionMeta: (meta) => set({ sessionMeta: meta }),
  activeTasks: [],
  addTask: (task) => set((s) => ({ activeTasks: [...s.activeTasks, task] })),
  updateTask: (taskId, updates) => set((s) => ({
    activeTasks: s.activeTasks.map((t) =>
      t.task_id === taskId ? { ...t, ...updates } : t
    ),
  })),
  rateLimit: null,
  setRateLimit: (info) => set({ rateLimit: info }),
  sessionCost: null,
  setSessionCost: (cost) => set({ sessionCost: cost }),
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/app-store.ts
git commit -m "feat: add enhanced state (sessionMeta, tasks, rateLimit, cost) to store"
```

---

### Task 9: Frontend cli-api enhanced subscription

**Files:**
- Modify: `src/renderer/lib/cli-api.ts`

- [ ] **Step 1: Add onEnhanced subscription**

Add to the `cliApi` object after `onMessage`:

```typescript
  /** Subscribe to Claude-enhanced events (JSON-RPC Notifications) */
  onEnhanced: (callback: (event: Record<string, unknown>) => void): (() => void) =>
    rpc.onNotification((method, params) => {
      if (method === 'cli.enhanced') {
        callback(params as Record<string, unknown>)
      }
    }),
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/renderer/lib/cli-api.ts
git commit -m "feat: add onEnhanced subscription to cli-api"
```

---

### Task 10: ChatView enhanced event handling

**Files:**
- Modify: `src/renderer/components/chat/ChatView.tsx`

- [ ] **Step 1: Add enhanced event subscription in ChatContent**

In the `ChatContent` component, add a new `useEffect` for enhanced events after the existing `onMessage` subscription:

```typescript
  const { setSessionMeta, addTask, updateTask, setRateLimit, setSessionCost } = useAppStore()

  useEffect(() => {
    const unlisten = cliApi.onEnhanced((event) => {
      const type = event.type as string
      switch (type) {
        case 'session_meta':
          setSessionMeta(event as unknown as SessionMeta)
          break
        case 'task_started':
          addTask({
            task_id: event.task_id as string,
            description: event.description as string,
            task_type: event.task_type as string,
            status: 'running',
          })
          break
        case 'task_progress':
          updateTask(event.task_id as string, {
            description: event.description as string,
          })
          break
        case 'task_notification':
          updateTask(event.task_id as string, {
            status: event.status as TaskState['status'],
            summary: event.summary as string | undefined,
          })
          break
        case 'result_summary':
          setSessionCost({
            cost_usd: event.cost_usd as number | null,
            duration_ms: event.duration_ms as number | null,
            num_turns: event.num_turns as number | null,
          })
          break
        case 'rate_limit':
          setRateLimit({
            status: event.status as string,
            utilization: event.utilization as number | null,
            rate_limit_type: event.rate_limit_type as string,
          })
          break
      }
    })
    return unlisten
  }, [setSessionMeta, addTask, updateTask, setRateLimit, setSessionCost])
```

Add the import at the top:

```typescript
import type { SessionMeta, TaskState } from '../../stores/app-store'
```

- [ ] **Step 2: Update TopBar to show model from sessionMeta**

In the `TopBar` component, replace the static `currentProvider` display with model from sessionMeta:

```typescript
  const { currentProvider, currentWorkingDir, currentSessionId, clearMessages, setCurrentSessionId, isStreaming, sessionMeta } = useAppStore()
```

Replace the center section:

```typescript
      {/* Center: Provider + Model + Dir */}
      <div className="no-drag flex items-center gap-2 cursor-default">
        {currentProvider && (
          <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase">{currentProvider}</span>
        )}
        {sessionMeta?.model && (
          <>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-xs text-[var(--text-tertiary)]">{sessionMeta.model}</span>
          </>
        )}
        {dirName && (
          <>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-xs text-[var(--text-secondary)]" title={currentWorkingDir ?? ''}>{dirName}</span>
          </>
        )}
        {isStreaming && (
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" title="Streaming" />
        )}
      </div>
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 4: Run all tests**

Run: `npm test 2>&1`
Expected: all tests pass

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/chat/ChatView.tsx
git commit -m "feat: subscribe to enhanced events, display model in TopBar"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full build check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

Run: `npm run typecheck 2>&1`
Expected: clean

Run: `npm test 2>&1`
Expected: all pass

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: all pass

- [ ] **Step 2: Commit any remaining changes and tag**

```bash
git add -A
git commit -m "feat: Phase 1 complete — parser overhaul with 21-type support"
```
