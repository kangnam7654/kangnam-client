# Enhanced Claude Code Wrapper — Design Spec

> Date: 2026-04-09
> Status: approved
> Protocol reference: `docs/llm/claude-code-protocol-reference.md`

## Purpose

kangnam-client를 Claude Code의 향상된 GUI 래퍼로 업그레이드한다.
CLI 서브프로세스(`-p --output-format stream-json`) 방식을 유지하면서, 프로토콜이 제공하는 21종 메시지를 전부 파싱하여 스킬 브라우저, 에이전트/태스크 트래킹, 권한 시스템, 비용/상태 표시를 GUI로 제공한다.

완료 기준:
- Claude Code 프로토콜 21종 메시지 전부 파싱
- MCP 기반 권한 시스템 동작 (기존 control_request 제거)
- 스킬 브라우저에서 클릭으로 슬래시 커맨드 전송
- 서브에이전트 중첩 트래킹
- 백그라운드 태스크 모니터링
- 비용/모델/레이트리밋 상태바
- Codex CLI 기본 채팅 기능 유지

## Constraints

- 멀티 CLI 유지: Codex 어댑터는 기본 채팅만 지원, 향상 기능은 Claude Code 전용
- `-p` 모드 사용 (스킬 자동 트리거 동작 확인됨 — `--bare` 미사용)
- 권한 처리: `--permission-prompt-tool`로 Axum 서버 내 MCP 엔드포인트 사용
- SDK 미사용 (Claude Max 구독 환경, API 키 없음)

## Architecture

```
React Frontend ←→ WebSocket (JSON-RPC 2.0) ←→ Axum Server ←→ CLI Subprocess
                   ws://localhost:3001/ws         │              claude -p --output-format stream-json
                                                  │                     ↑
                                                  ├── /mcp (SSE) ←─────┘
                                                  │   (permission-prompt-tool)
                                                  │
                                                  └── SQLite (conversations, messages)
```

- Axum 서버에 MCP SSE 엔드포인트(`/mcp`) 추가
- Claude CLI 실행 시 `--permission-prompt-tool mcp__kangnam__approve` 플래그 추가
- `CliAdapter` trait에 `enhanced_features() -> bool` 추가. Claude만 true → 향상 기능 활성화
- broadcast 채널 2개: `UnifiedMessage`(공통) + `ClaudeEnhancedEvent`(Claude 전용)

## CLI Execution Flags

```bash
# Claude Code (enhanced)
claude -p \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  --include-partial-messages \
  --include-hook-events \
  --mcp-server-uri http://localhost:3001/mcp \
  --permission-prompt-tool mcp__kangnam__approve

# Codex CLI (basic — unchanged)
codex exec --json "<prompt>"
```

## Phase 1: Parser Overhaul

### New Type: ClaudeEnhancedEvent

`src-tauri/src/cli/types.rs`에 추가:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClaudeEnhancedEvent {
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
    TaskStarted {
        task_id: String,
        tool_use_id: String,
        description: String,
        task_type: String, // local_bash, local_agent, remote_agent
    },
    TaskProgress {
        task_id: String,
        description: String,
        usage: Option<serde_json::Value>,
        last_tool_name: Option<String>,
    },
    TaskNotification {
        task_id: String,
        status: String, // completed, failed, stopped
        summary: Option<String>,
    },
    ResultSummary {
        cost_usd: Option<f64>,
        usage: Option<serde_json::Value>,
        duration_ms: Option<u64>,
        num_turns: Option<u32>,
        model_usage: Option<serde_json::Value>,
        permission_denials: Vec<serde_json::Value>,
    },
    RateLimit {
        status: String, // allowed, allowed_warning, rejected
        utilization: Option<f64>,
        rate_limit_type: String,
    },
    HookStarted {
        hook_id: String,
        hook_name: String,
        hook_event: String,
    },
    HookProgress {
        hook_id: String,
        stdout: Option<String>,
        stderr: Option<String>,
    },
    HookResponse {
        hook_id: String,
    },
    StatusUpdate {
        status: String,
        permission_mode: Option<String>,
    },
    CompactBoundary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub status: String,
}
```

### CliAdapter Trait Changes

`src-tauri/src/cli/adapter.rs`:

```rust
pub trait CliAdapter: Send + Sync {
    // Existing
    fn name(&self) -> &str;
    fn command(&self) -> &str;
    fn build_command(&self, working_dir: &Path) -> Command;
    fn parse_line(&self, line: &str) -> Result<Option<UnifiedMessage>, String>;
    fn format_user_message(&self, message: &str, session_id: &str) -> Option<String>;
    fn format_permission_response(&self, request_id: &str, allowed: bool) -> Option<String>;
    fn supports_persistent_session(&self) -> bool;
    fn version_command(&self) -> Vec<String>;
    fn install_command(&self) -> Option<Vec<String>>;

    // New — Claude only, Codex returns (false, None)
    fn enhanced_features(&self) -> bool { false }
    fn parse_enhanced(&self, line: &str) -> Result<Option<ClaudeEnhancedEvent>, String> {
        let _ = line;
        Ok(None)
    }
}
```

### Claude Adapter parse_line Overhaul

`src-tauri/src/cli/adapters/claude.rs`의 `parse_line` 매칭 확장:

```rust
match msg_type {
    "system" => match subtype {
        "init"              => parse system/init → SessionInit (UnifiedMessage) 
                               + SessionMeta (ClaudeEnhancedEvent)
        "task_started"      → ClaudeEnhancedEvent::TaskStarted
        "task_progress"     → ClaudeEnhancedEvent::TaskProgress
        "task_notification" → ClaudeEnhancedEvent::TaskNotification
        "hook_started"      → ClaudeEnhancedEvent::HookStarted
        "hook_progress"     → ClaudeEnhancedEvent::HookProgress
        "hook_response"     → ClaudeEnhancedEvent::HookResponse
        "status"            → ClaudeEnhancedEvent::StatusUpdate
        "compact_boundary"  → ClaudeEnhancedEvent::CompactBoundary
        "api_retry"         → UnifiedMessage::Error (with retry info)
        _                   → None
    },
    "stream_event"      → existing text_delta/tool_use parsing (UnifiedMessage)
    "assistant"          → existing assistant parsing (UnifiedMessage)
                           + deduplicate by message.id for parallel tool calls
    "result"             → UnifiedMessage::TurnEnd
                           + ClaudeEnhancedEvent::ResultSummary
    "rate_limit_event"   → ClaudeEnhancedEvent::RateLimit
    "tool_progress"      → UnifiedMessage (new: ToolProgress variant)
    _                    → None
}
```

### Broadcast Changes

`src-tauri/src/server/broadcast.rs`:

```rust
// Existing
pub type BroadcastTx = tokio::sync::broadcast::Sender<JsonRpcNotification>;

// New — add enhanced channel to AppState
pub type EnhancedBroadcastTx = tokio::sync::broadcast::Sender<JsonRpcNotification>;
```

`src-tauri/src/state.rs`에 `enhanced_broadcast_tx` 필드 추가.

### Manager stdout reader 변경

`src-tauri/src/cli/manager.rs`의 stdout reader task:

```rust
// For each NDJSON line:
// 1. Try parse_line → if Some, emit on broadcast_tx (cli.stream)
// 2. If adapter.enhanced_features(), try parse_enhanced → if Some, emit on enhanced_tx (cli.enhanced)
```

### Frontend Subscription

`src/renderer/lib/cli-api.ts`:

```typescript
onEnhanced: (callback: (event: ClaudeEnhancedEvent) => void): (() => void) =>
    rpc.onNotification((method, params) => {
      if (method === 'cli.enhanced') {
        callback(params as ClaudeEnhancedEvent)
      }
    }),
```

`src/renderer/stores/app-store.ts`에 추가:

```typescript
// Session metadata (from system/init)
sessionMeta: null as SessionMeta | null,
setSessionMeta: (meta) => set({ sessionMeta: meta }),

// Skills list
skills: [] as string[],
slashCommands: [] as string[],

// Background tasks
tasks: [] as TaskState[],
addTask / updateTask / removeTask,

// Rate limit
rateLimit: null as RateLimitInfo | null,

// Cost tracking
sessionCost: null as ResultSummary | null,
```

## Phase 2: Permission System (MCP-based)

### MCP SSE Endpoint

`src-tauri/src/server/mcp.rs` 생성:

Axum SSE 핸들러로 MCP Streamable HTTP 프로토콜 구현:
- `GET /mcp` — SSE stream (server→client events)
- `POST /mcp` — tool call requests (client→server)

Claude Code가 `--mcp-server-uri http://localhost:3001/mcp`로 연결.

### Permission Tool: `mcp__kangnam__approve`

MCP 도구 정의:
```json
{
  "name": "approve",
  "description": "Request user approval for a tool execution",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tool_name": { "type": "string" },
      "tool_input": { "type": "object" },
      "description": { "type": "string" },
      "risk_level": { "type": "string" }
    }
  }
}
```

### Permission Flow

```
1. Claude → POST /mcp (tool call: approve) → Axum MCP handler
2. Axum creates oneshot channel, stores in pending_permissions map
3. Axum → WebSocket notification "cli.permissionRequest" { id, tool_name, description, input }
4. Frontend shows SafetyDialog → user clicks allow/deny
5. Frontend → JSON-RPC "cli.permissionResponse" { id, allowed }
6. Axum handler → resolves oneshot channel → MCP response to Claude
7. Claude receives { "approved": true/false } and proceeds
```

### SafetyDialog Changes

`src/renderer/components/chat/SafetyDialog.tsx`:
- 트리거 소스만 변경 (기존 `control_request` notification → `cli.permissionRequest` notification)
- UI 동일하게 유지
- `cli.sendPermission` RPC 호출을 `cli.permissionResponse`로 변경

### Remove Legacy

- `claude.rs`에서 `control_request` 파싱 제거
- `format_permission_response()` 메서드 제거 (MCP가 처리)
- `manager.rs`에서 `send_permission_response()` 제거

## Phase 3: Frontend Panels

### Skill Browser

`src/renderer/components/sidebar/SkillBrowser.tsx`:

```
┌─ Skills ──────────────┐
│ /commit               │  ← 클릭 → stdin에 "/commit" 전송
│ /review-pr            │
│ /test                 │
│ /my-custom-skill      │
└───────────────────────┘
```

- `sessionMeta.skills` + `sessionMeta.slash_commands`에서 목록 가져옴
- 클릭 시 `cliApi.sendMessage(sessionId, "/skill-name")` 호출
- 빌트인 커맨드(`/compact`, `/clear`, `/help`, `/cost`)는 별도 섹션으로 분리
- `/clear` 클릭 시 래퍼도 messages store 초기화

### Task Panel

`src/renderer/components/sidebar/TaskPanel.tsx`:

```
┌─ Tasks ───────────────┐
│ ● Running tests       │  ← task_started, animated
│   45/120 passed       │  ← task_progress
│ ✓ Lint check          │  ← task_notification (completed)
└───────────────────────┘
```

- `TaskStarted` → 카드 생성 (task_type 아이콘 구분)
- `TaskProgress` → 설명 업데이트, usage 표시
- `TaskNotification` → 상태 (completed/failed/stopped) 반영
- 완료된 태스크는 5초 후 접기 (삭제 아님)

### Agent Panel Enhancement

`src/renderer/components/sidebar/AgentPanel.tsx` 수정:

- 기존: flat list
- 변경: `parent_tool_use_id` 기반 트리 구조
- `Agent` + `Task`(레거시) 이름 모두 감지
- `run_in_background: true`인 에이전트는 TaskPanel과 연동

### Status Bar

`src/renderer/components/chat/StatusBar.tsx`:

```
┌────────────────────────────────────────────────────┐
│ claude-sonnet-4-6  │  $0.04  │  7 turns  │  ██░ 87%  │
│ (model)            │ (cost)  │  (turns)  │ (rate)    │
└────────────────────────────────────────────────────┘
```

- 모델: `sessionMeta.model`
- 비용: `ResultSummary.cost_usd` (턴 종료마다 누적)
- 턴 수: `ResultSummary.num_turns`
- 레이트 리밋: `RateLimit.utilization` (바 + 퍼센트)
- `allowed_warning` 시 노란색, `rejected` 시 빨간색

### Sidebar Layout

```
┌──────────────────────┐
│ [New Chat] [🔍] [◀]  │
│                      │
│ Conversations        │
│   ...                │
│                      │
├──────────────────────┤
│ Skills               │  ← SkillBrowser (세션 활성 시만 표시)
│   /commit            │
│   /review-pr         │
├──────────────────────┤
│ Agents (2)           │  ← AgentPanel (에이전트 있을 때만)
│   ● code-reviewer    │
├──────────────────────┤
│ Tasks (1)            │  ← TaskPanel (태스크 있을 때만)
│   ● Running tests    │
├──────────────────────┤
│ [Settings]           │
└──────────────────────┘
```

## File Changes

### Modify

| File | Change |
|------|--------|
| `src-tauri/src/cli/adapter.rs` | trait에 `enhanced_features()`, `parse_enhanced()` 추가 |
| `src-tauri/src/cli/adapters/claude.rs` | 21종 메시지 파싱 전면 개편 |
| `src-tauri/src/cli/adapters/codex.rs` | `enhanced_features() = false` 구현 |
| `src-tauri/src/cli/manager.rs` | CLI 플래그 업데이트, enhanced broadcast, permission 메서드 제거 |
| `src-tauri/src/cli/types.rs` | `ClaudeEnhancedEvent`, `McpServerInfo` 추가 |
| `src-tauri/src/state.rs` | `enhanced_broadcast_tx`, `pending_permissions` 추가 |
| `src-tauri/src/server/router.rs` | `/mcp` 라우트 추가 |
| `src-tauri/src/server/broadcast.rs` | enhanced 채널 추가 |
| `src-tauri/src/rpc/dispatcher.rs` | `cli.permissionResponse` 라우트 추가 |
| `src-tauri/src/rpc/handlers.rs` | `permissionResponse` 핸들러 수정, `sendPermission` 제거 |
| `src/renderer/stores/app-store.ts` | sessionMeta, skills, tasks, rateLimit, sessionCost 상태 추가 |
| `src/renderer/lib/cli-api.ts` | `onEnhanced` 구독, `permissionResponse` 추가 |
| `src/renderer/components/chat/ChatView.tsx` | StatusBar 통합, enhanced 이벤트 구독 |
| `src/renderer/components/chat/SafetyDialog.tsx` | MCP 기반 트리거로 변경 |
| `src/renderer/components/sidebar/Sidebar.tsx` | SkillBrowser, TaskPanel 배치 |
| `src/renderer/components/sidebar/AgentPanel.tsx` | 중첩 트래킹 트리 구조 |

### Create

| File | Purpose |
|------|---------|
| `src-tauri/src/server/mcp.rs` | MCP SSE 엔드포인트 핸들러 |
| `src/renderer/components/sidebar/SkillBrowser.tsx` | 스킬 목록 + 클릭 전송 |
| `src/renderer/components/sidebar/TaskPanel.tsx` | 백그라운드 태스크 모니터링 |
| `src/renderer/components/chat/StatusBar.tsx` | 비용/모델/레이트리밋 표시 |

## Implementation Phases

### Phase 1 — Parser Overhaul
1. `ClaudeEnhancedEvent` enum + `McpServerInfo` struct 정의
2. `CliAdapter` trait 확장 (default impl 제공)
3. `claude.rs` 파서 전면 개편 (21종)
4. `codex.rs`에 `enhanced_features() = false` 추가
5. enhanced broadcast 채널 추가 (`state.rs`, `broadcast.rs`)
6. `manager.rs` stdout reader에서 `parse_enhanced` 호출 + enhanced broadcast
7. 프론트엔드: `cli.enhanced` 구독, store에 sessionMeta/tasks/rateLimit 반영

### Phase 2 — Permission System
1. `mcp.rs` MCP SSE 엔드포인트 구현
2. `router.rs`에 `/mcp` 라우트 추가
3. `state.rs`에 `pending_permissions: HashMap<String, oneshot::Sender>` 추가
4. `manager.rs` build_command에 `--mcp-server-uri`, `--permission-prompt-tool` 플래그 추가
5. RPC `cli.permissionResponse` 핸들러 구현
6. `SafetyDialog` 트리거를 `cli.permissionRequest` notification으로 변경
7. 레거시 `control_request` 파싱 + `send_permission_response` 제거

### Phase 3 — Frontend Panels
1. `SkillBrowser` 컴포넌트 구현
2. `TaskPanel` 컴포넌트 구현
3. `AgentPanel` 중첩 트래킹 개선
4. `StatusBar` 컴포넌트 구현
5. `Sidebar` 레이아웃에 패널 통합
6. `ChatView`에 StatusBar 통합

## Decisions

- **MCP를 Axum에 통합** — 별도 stdio 프로세스 대신. 이유: 이미 Axum 서버가 있고, 프로세스 관리 복잡성 회피.
- **broadcast 채널 분리** (UnifiedMessage / ClaudeEnhancedEvent) — 이유: Codex 등 비-Claude CLI는 enhanced 이벤트가 없으므로 분리해야 공통 채널이 오염되지 않음.
- **스킬은 프롬프트 전송 방식** — 래퍼가 스킬을 직접 실행하지 않고, 슬래시 커맨드 텍스트를 stdin으로 보냄. 이유: `-p` 모드에서 슬래시 커맨드가 프롬프트로 동작 확인됨.
- **PTY 방식 기각** — 이유: 터미널 출력 파싱이 극도로 불안정하고 유지보수 불가.
- **SDK 방식 기각** — 이유: Claude Max 구독 환경에서 Opus/Sonnet 사용 불가.
