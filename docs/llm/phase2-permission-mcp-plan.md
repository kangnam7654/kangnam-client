# Phase 2: MCP-based Permission System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 레거시 `control_request` 파싱을 제거하고, MCP Streamable HTTP 엔드포인트를 통해 Claude Code의 공식 `--permission-prompt-tool` 메커니즘으로 권한 시스템을 교체한다.

**Architecture:** Axum 서버에 `/mcp` 엔드포인트를 추가하여 MCP 서버 역할을 한다. Claude Code가 `--permission-prompt-tool mcp__kangnam__approve` 플래그로 실행되면, 도구 실행 전 우리 MCP 서버의 `approve` 도구를 호출한다. Axum이 이 요청을 수신하면 WebSocket으로 프론트엔드에 알리고, 유저 응답을 받아 MCP 응답으로 리턴한다. 대기 메커니즘은 `tokio::sync::oneshot` 채널.

**Tech Stack:** Rust (Axum, tokio::sync::oneshot, serde_json), TypeScript (React)

**Design Spec:** `docs/llm/enhanced-wrapper-design.md` — Phase 2 섹션

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src-tauri/src/server/mcp.rs` | MCP Streamable HTTP 엔드포인트 | Create |
| `src-tauri/src/server/mod.rs` | mcp 모듈 등록 | Modify |
| `src-tauri/src/server/router.rs` | `/mcp` POST 라우트 추가 | Modify |
| `src-tauri/src/state.rs` | `pending_permissions` 맵 추가 | Modify |
| `src-tauri/src/cli/adapters/claude.rs` | `build_command` 플래그 추가, `control_request` 제거 | Modify |
| `src-tauri/src/cli/adapter.rs` | `format_permission_response` 제거 | Modify |
| `src-tauri/src/cli/adapters/codex.rs` | `format_permission_response` 제거 | Modify |
| `src-tauri/src/cli/manager.rs` | `send_permission_response` 제거 | Modify |
| `src-tauri/src/rpc/dispatcher.rs` | `cli.sendPermission` → `cli.permissionResponse` | Modify |
| `src-tauri/src/rpc/handlers.rs` | `send_permission` → `permission_response` (oneshot 기반) | Modify |
| `src/renderer/components/chat/ChatView.tsx` | 권한 요청 소스 변경 | Modify |
| `src/renderer/components/chat/SafetyDialog.tsx` | RPC 호출 변경 | Modify |
| `src/renderer/lib/cli-api.ts` | `sendPermission` → `permissionResponse` | Modify |

---

### Task 1: Create MCP endpoint handler

**Files:**
- Create: `src-tauri/src/server/mcp.rs`
- Modify: `src-tauri/src/server/mod.rs`

- [ ] **Step 1: Add mcp module to server/mod.rs**

In `src-tauri/src/server/mod.rs`, add `pub mod mcp;` to the module declarations.

- [ ] **Step 2: Create mcp.rs with MCP Streamable HTTP handler**

Create `src-tauri/src/server/mcp.rs`:

```rust
use std::sync::Arc;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use crate::state::AppState;
use crate::rpc::types::JsonRpcNotification;

/// MCP JSON-RPC request (from Claude Code)
#[derive(Debug, Deserialize)]
struct McpRequest {
    jsonrpc: String,
    id: Option<serde_json::Value>,
    method: String,
    #[serde(default)]
    params: Option<serde_json::Value>,
}

/// MCP JSON-RPC response (to Claude Code)
#[derive(Debug, Serialize)]
struct McpResponse {
    jsonrpc: String,
    id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<serde_json::Value>,
}

impl McpResponse {
    fn success(id: Option<serde_json::Value>, result: serde_json::Value) -> Self {
        Self { jsonrpc: "2.0".to_string(), id, result: Some(result), error: None }
    }

    fn error(id: Option<serde_json::Value>, code: i32, message: &str) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(serde_json::json!({ "code": code, "message": message })),
        }
    }
}

const SERVER_NAME: &str = "kangnam";
const SERVER_VERSION: &str = "0.1.0";
const PROTOCOL_VERSION: &str = "2024-11-05";

/// POST /mcp — MCP Streamable HTTP endpoint
/// Claude Code sends JSON-RPC requests here for:
/// - initialize (handshake)
/// - notifications/initialized (ack)
/// - tools/list (discover available tools)
/// - tools/call (invoke the approve tool)
pub async fn mcp_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<McpRequest>,
) -> impl IntoResponse {
    let response = match req.method.as_str() {
        "initialize" => handle_initialize(req.id),
        "notifications/initialized" => {
            // Notification — no response needed, but return empty OK
            return (StatusCode::OK, "").into_response();
        }
        "tools/list" => handle_tools_list(req.id),
        "tools/call" => handle_tools_call(req.id, req.params, &state).await,
        _ => McpResponse::error(req.id, -32601, "Method not found"),
    };

    (StatusCode::OK, Json(response)).into_response()
}

fn handle_initialize(id: Option<serde_json::Value>) -> McpResponse {
    McpResponse::success(id, serde_json::json!({
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": { "tools": {} },
        "serverInfo": {
            "name": SERVER_NAME,
            "version": SERVER_VERSION,
        }
    }))
}

fn handle_tools_list(id: Option<serde_json::Value>) -> McpResponse {
    McpResponse::success(id, serde_json::json!({
        "tools": [{
            "name": "approve",
            "description": "Request user approval for a tool execution. Shows a dialog in the GUI and waits for user response.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tool_name": {
                        "type": "string",
                        "description": "Name of the tool requesting permission"
                    },
                    "tool_input": {
                        "description": "Input parameters of the tool"
                    },
                    "description": {
                        "type": "string",
                        "description": "Human-readable description of what the tool will do"
                    }
                },
                "required": ["tool_name"]
            }
        }]
    }))
}

async fn handle_tools_call(
    id: Option<serde_json::Value>,
    params: Option<serde_json::Value>,
    state: &AppState,
) -> McpResponse {
    let params = match params {
        Some(p) => p,
        None => return McpResponse::error(id, -32602, "Missing params"),
    };

    let tool_name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
    if tool_name != "approve" {
        return McpResponse::error(id, -32602, &format!("Unknown tool: {}", tool_name));
    }

    let arguments = params.get("arguments").cloned().unwrap_or(serde_json::json!({}));
    let request_tool = arguments.get("tool_name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let description = arguments.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let tool_input = arguments.get("tool_input").cloned();

    // Generate a unique permission request ID
    let permission_id = uuid::Uuid::new_v4().to_string();

    // Create oneshot channel for the user's response
    let (tx, rx) = tokio::sync::oneshot::channel::<bool>();

    // Store the sender in pending_permissions
    {
        let mut pending = state.pending_permissions.lock().await;
        pending.insert(permission_id.clone(), tx);
    }

    // Notify frontend via WebSocket broadcast
    let notification = JsonRpcNotification::new(
        "cli.permissionRequest",
        serde_json::json!({
            "id": permission_id,
            "tool": request_tool,
            "description": description,
            "input": tool_input,
        }),
    );
    let _ = state.broadcast_tx.send(notification);

    // Wait for user response (with 5-minute timeout)
    let allowed = match tokio::time::timeout(
        std::time::Duration::from_secs(300),
        rx,
    ).await {
        Ok(Ok(allowed)) => allowed,
        Ok(Err(_)) => {
            // Sender dropped — permission denied
            false
        }
        Err(_) => {
            // Timeout — permission denied
            let mut pending = state.pending_permissions.lock().await;
            pending.remove(&permission_id);
            false
        }
    };

    // Return MCP tool result
    let result_text = if allowed {
        serde_json::json!({"approved": true}).to_string()
    } else {
        serde_json::json!({"approved": false, "reason": "User denied"}).to_string()
    };

    McpResponse::success(id, serde_json::json!({
        "content": [{ "type": "text", "text": result_text }]
    }))
}
```

- [ ] **Step 3: Verify it compiles (will fail — pending_permissions not in AppState yet)**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: error about `pending_permissions` not found — fixed in Task 2

- [ ] **Step 4: Commit mcp.rs**

```bash
git add src-tauri/src/server/mcp.rs src-tauri/src/server/mod.rs
git commit -m "feat: create MCP Streamable HTTP endpoint for permission handling"
```

---

### Task 2: Add pending_permissions to AppState

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Add pending_permissions field**

Add import:
```rust
use std::collections::HashMap;
use tokio::sync::oneshot;
```

Add field to `AppState`:
```rust
pub pending_permissions: tokio::sync::Mutex<HashMap<String, oneshot::Sender<bool>>>,
```

Initialize in `AppState::new()`:
```rust
pending_permissions: tokio::sync::Mutex::new(HashMap::new()),
```

- [ ] **Step 2: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat: add pending_permissions map to AppState"
```

---

### Task 3: Register MCP route

**Files:**
- Modify: `src-tauri/src/server/router.rs`

- [ ] **Step 1: Add /mcp POST route**

Add import: `use axum::routing::post;`
Add import: `use crate::server::mcp;`

Add route before `.layer(CorsLayer::permissive())`:
```rust
.route("/mcp", post(mcp::mcp_handler))
```

- [ ] **Step 2: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/server/router.rs
git commit -m "feat: register /mcp POST route for MCP endpoint"
```

---

### Task 4: Update Claude CLI flags

**Files:**
- Modify: `src-tauri/src/cli/adapters/claude.rs`

- [ ] **Step 1: Update build_command to accept MCP port**

The `build_command` needs to know the Axum server port to construct the MCP URI. Change `build_command` to take an additional port parameter. But since the trait signature is fixed, we add port as a field on ClaudeAdapter:

```rust
pub struct ClaudeAdapter {
    mcp_port: u16,
}

impl ClaudeAdapter {
    pub fn new() -> Self {
        Self { mcp_port: 3001 }
    }

    pub fn with_port(port: u16) -> Self {
        Self { mcp_port: port }
    }
}
```

Then update `build_command`:

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
        // Register our MCP server for permission handling
        let mcp_config = serde_json::json!({
            "kangnam": {
                "url": format!("http://localhost:{}/mcp", self.mcp_port)
            }
        });
        cmd.arg("--mcp-config");
        cmd.arg(mcp_config.to_string());
        cmd.arg("--permission-prompt-tool");
        cmd.arg("mcp__kangnam__approve");

        cmd.current_dir(working_dir);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd
    }
```

- [ ] **Step 2: Remove control_request parsing from parse_line**

In `parse_line`, remove the `"control_request"` arm from the match:

Change:
```rust
"control_request" => self.parse_control_request(&value),
```
To: remove that line entirely.

Also remove the `parse_control_request` method from `impl ClaudeAdapter`.

- [ ] **Step 3: Remove format_permission_response from CliAdapter impl**

In `impl CliAdapter for ClaudeAdapter`, remove or change `format_permission_response` to return `None`:

```rust
    fn format_permission_response(&self, _request_id: &str, _allowed: bool) -> Option<String> {
        // Permissions now handled via MCP endpoint, not stdin
        None
    }
```

- [ ] **Step 4: Update ClaudeAdapter::new() call in state.rs**

In `src-tauri/src/state.rs`, the adapter is created with `ClaudeAdapter::new()`. This still works since `new()` defaults to port 3001. But pass the actual port:

Read the port from env in state.rs (same as lib.rs does):
```rust
let port: u16 = std::env::var("KANGNAM_PORT")
    .ok()
    .and_then(|p| p.parse().ok())
    .unwrap_or(3001);
cli_manager.register_adapter(Box::new(
    crate::cli::adapters::claude::ClaudeAdapter::with_port(port),
));
```

- [ ] **Step 5: Fix tests that construct ClaudeAdapter**

Update the test module — `ClaudeAdapter::new()` still works (defaults to 3001), so tests should still pass without changes. But verify.

- [ ] **Step 6: Verify it compiles and tests pass**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Run: `cargo test --manifest-path src-tauri/Cargo.toml -- cli::adapters::claude::tests 2>&1`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/cli/adapters/claude.rs src-tauri/src/state.rs
git commit -m "feat: add MCP flags to Claude CLI, remove control_request parsing"
```

---

### Task 5: Permission response RPC handler

**Files:**
- Modify: `src-tauri/src/rpc/handlers.rs`
- Modify: `src-tauri/src/rpc/dispatcher.rs`

- [ ] **Step 1: Replace send_permission with permission_response in handlers.rs**

Replace the existing `send_permission` function:

```rust
pub async fn permission_response(params: Option<serde_json::Value>, state: &AppState) -> RpcResult {
    let p: PermissionResponseParams = parse_params(params)?;

    let tx = {
        let mut pending = state.pending_permissions.lock().await;
        pending.remove(&p.id)
    };

    match tx {
        Some(sender) => {
            let _ = sender.send(p.allowed);
            Ok(serde_json::Value::Null)
        }
        None => Err(JsonRpcError::internal(&format!(
            "No pending permission request with id: {}", p.id
        ))),
    }
}
```

Replace `SendPermissionParams` with:

```rust
#[derive(Deserialize)]
struct PermissionResponseParams {
    id: String,
    allowed: bool,
}
```

Remove the old `SendPermissionParams` struct.

- [ ] **Step 2: Update dispatcher.rs**

Change `"cli.sendPermission"` to `"cli.permissionResponse"`:

```rust
"cli.permissionResponse" => handlers::permission_response(request.params, state).await,
```

Remove the old `"cli.sendPermission"` line.

- [ ] **Step 3: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/rpc/handlers.rs src-tauri/src/rpc/dispatcher.rs
git commit -m "feat: replace sendPermission with permissionResponse (oneshot-based)"
```

---

### Task 6: Remove legacy permission code from manager and adapter trait

**Files:**
- Modify: `src-tauri/src/cli/manager.rs`
- Modify: `src-tauri/src/cli/adapter.rs`

- [ ] **Step 1: Remove send_permission_response from manager.rs**

Delete the entire `send_permission_response` method from `CliManager`. It's no longer called since permissions go through MCP → oneshot.

- [ ] **Step 2: Remove format_permission_response from adapter.rs trait**

Remove `fn format_permission_response(...)` from the `CliAdapter` trait definition. This will cause compile errors in adapters — fix in next step.

- [ ] **Step 3: Remove format_permission_response from both adapter implementations**

In `claude.rs`: remove the `format_permission_response` method from `impl CliAdapter for ClaudeAdapter`.
In `codex.rs`: remove the `format_permission_response` method from `impl CliAdapter for CodexAdapter`.

- [ ] **Step 4: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 5: Run all tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -15`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/cli/manager.rs src-tauri/src/cli/adapter.rs src-tauri/src/cli/adapters/claude.rs src-tauri/src/cli/adapters/codex.rs
git commit -m "refactor: remove legacy format_permission_response and send_permission_response"
```

---

### Task 7: Frontend — update SafetyDialog and cli-api

**Files:**
- Modify: `src/renderer/lib/cli-api.ts`
- Modify: `src/renderer/components/chat/SafetyDialog.tsx`
- Modify: `src/renderer/components/chat/ChatView.tsx`

- [ ] **Step 1: Update cli-api.ts — rename sendPermission to permissionResponse**

Replace the existing `sendPermission` method:

```typescript
  permissionResponse: (id: string, allowed: boolean) =>
    rpc.call<void>('cli.permissionResponse', { id, allowed }),
```

Remove the old `sendPermission` method.

- [ ] **Step 2: Update SafetyDialog.tsx — use new RPC method and permission data**

The `pendingPermission` now comes from `cli.permissionRequest` notification (emitted by our MCP endpoint) instead of the old `control_request` from the CLI stream. The notification data has the shape: `{ id, tool, description, input }`.

Update `handleResponse`:

```typescript
  const handleResponse = async (allowed: boolean) => {
    if (pendingPermission && pendingPermission.type === 'permission_request') {
      await cliApi.permissionResponse(pendingPermission.id, allowed)
    }
    setPendingPermission(null)
  }
```

Note: the `pendingPermission` is already set by the `cli.stream` handler for `permission_request` type in ChatView. But now it can ALSO come from `cli.permissionRequest` notification. We need to handle both sources during the transition, but since we removed `control_request` parsing, only the MCP-based source remains.

- [ ] **Step 3: Update ChatView.tsx — handle cli.permissionRequest notification**

The existing `onMessage` handler already handles `permission_request` from `cli.stream`. But now permissions come from the MCP endpoint as a separate `cli.permissionRequest` notification (not via `cli.stream`).

Add a new `useEffect` in ChatContent to listen for `cli.permissionRequest`:

```typescript
  useEffect(() => {
    const unlisten = rpc.onNotification((method, params) => {
      if (method === 'cli.permissionRequest') {
        const p = params as Record<string, unknown>
        setPendingPermission({
          type: 'permission_request',
          id: p.id as string,
          tool: p.tool as string,
          description: p.description as string,
        })
      }
    })
    return unlisten
  }, [setPendingPermission])
```

Import `rpc` is not directly available in ChatView — use `cliApi` to add a new subscription method. Actually simpler: add an `onPermissionRequest` method to `cliApi`:

In `cli-api.ts`:
```typescript
  onPermissionRequest: (callback: (req: { id: string; tool: string; description: string; input?: unknown }) => void): (() => void) =>
    rpc.onNotification((method, params) => {
      if (method === 'cli.permissionRequest') {
        callback(params as { id: string; tool: string; description: string; input?: unknown })
      }
    }),
```

Then in ChatView's ChatContent, add useEffect:
```typescript
  useEffect(() => {
    const unlisten = cliApi.onPermissionRequest((req) => {
      setPendingPermission({
        type: 'permission_request',
        id: req.id,
        tool: req.tool,
        description: req.description,
      })
    })
    return unlisten
  }, [setPendingPermission])
```

- [ ] **Step 4: Remove permission_request handling from onMessage**

In the existing `onMessage` handler, the `permission_request` case came from the CLI stream (`control_request` parsing). Since we removed that parsing, this case will never fire. Remove it:

Change:
```typescript
    const unlisten = cliApi.onMessage((msg) => {
      if (msg.type === 'permission_request') {
        setPendingPermission(msg)
      } else if (msg.type === 'turn_end') {
```

To:
```typescript
    const unlisten = cliApi.onMessage((msg) => {
      if (msg.type === 'turn_end') {
```

- [ ] **Step 5: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 6: Run tests**

Run: `npm test 2>&1`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/lib/cli-api.ts src/renderer/components/chat/SafetyDialog.tsx src/renderer/components/chat/ChatView.tsx
git commit -m "feat: switch SafetyDialog to MCP-based permission flow"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full build check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

Run: `npm run typecheck 2>&1`
Expected: clean

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -15`
Expected: all pass

Run: `npm test 2>&1`
Expected: all pass

- [ ] **Step 2: Verify no remaining legacy permission references**

Run: `grep -r "control_request\|sendPermission\|send_permission_response\|format_permission_response" src-tauri/src/ src/renderer/ --include="*.rs" --include="*.ts" --include="*.tsx"`
Expected: no matches (or only in comments/docs)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Phase 2 complete — MCP-based permission system"
```
