# CLI Agent GUI Wrapper — Design Spec

## Purpose

kangnam-client를 코딩 에이전트 CLI(Claude Code, Codex CLI 등)의 GUI 래퍼로 피벗한다. CLI를 subprocess로 실행하고 JSON 스트림 출력을 파싱하여 비개발자도 사용할 수 있는 구조화된 채팅 UI로 렌더링한다.

### Completion Criteria

- Claude Code CLI(`claude`)와 Codex CLI(`codex`)를 subprocess로 spawn/관리할 수 있다
- CLI의 JSON 스트림 출력을 UnifiedMessage로 파싱하여 React UI에 실시간 렌더링한다
- Setup Wizard로 CLI 설치 감지, 자동 설치, 로그인을 안내한다
- Skills(slash commands)를 Command Palette로 발견/실행할 수 있다
- Agents를 사이드바에서 확인하고 실행 상태를 추적할 수 있다
- 파일 수정/명령 실행 전 Safety Confirm Dialog로 사용자 확인을 받는다

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React + Tailwind)                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│ │ Chat UI  │ │ Setup    │ │ Settings │ │ Safety      │ │
│ │ (new)    │ │ Wizard   │ │ Panel    │ │ Confirm     │ │
│ │          │ │ (new)    │ │ (reuse)  │ │ Dialog(new) │ │
│ └──────────┘ └──────────┘ └──────────┘ └─────────────┘ │
│ ┌──────────┐ ┌──────────────────────────┐               │
│ │ Sidebar  │ │ Slash Command Palette    │               │
│ │ (reuse)  │ │ + Agent Panel (new)      │               │
│ └──────────┘ └──────────────────────────┘               │
└──────────────────── Tauri IPC ──────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│ Backend (Rust / Tauri 2)                                │
│ ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐ │
│ │ CLI Manager  │ │ JSON Stream   │ │ CLI Registry     │ │
│ │ (new)        │ │ Parser (new)  │ │ (new)            │ │
│ └──────────────┘ └───────────────┘ └──────────────────┘ │
│ ┌──────────────┐ ┌───────────────┐                      │
│ │ DB (reuse)   │ │ MCP Bridge    │                      │
│ │              │ │ (reuse)       │                      │
│ └──────────────┘ └───────────────┘                      │
└──────────────────── subprocess ─────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│ CLI Subprocesses                                        │
│ ┌──────────────────┐ ┌──────────────────┐               │
│ │ claude           │ │ codex            │               │
│ │ --output-format  │ │ --json           │               │
│ │ stream-json      │ │                  │               │
│ └──────────────────┘ └──────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

### Reuse vs Replace vs Add

| Category | Action | Details |
|----------|--------|---------|
| **Delete** | `src-tauri/src/providers/` | SSE 직접 호출 전체 삭제 |
| **Delete** | `src-tauri/src/auth/` | OAuth PKCE 플로우 삭제 (CLI가 자체 인증 처리) |
| **Delete** | `src-tauri/src/skills/ai.rs` | AI 스킬 로직 삭제 (CLI에 위임) |
| **Reuse** | `src-tauri/src/db/` | conversations, messages 테이블 구조 유지 |
| **Reuse** | `src-tauri/src/mcp/` | MCP Bridge 유지 |
| **Reuse** | Settings UI 구조 | SettingsPanel, tabs 구조 재사용 |
| **Reuse** | Sidebar, ConversationList | 대화 목록/검색 재사용 |
| **Reuse** | Tauri 인프라 | vite.config, tauri.conf, 빌드 파이프라인 |
| **Add** | CLI Manager | subprocess spawn/kill/lifecycle 관리 |
| **Add** | JSON Stream Parser | CLI별 어댑터로 UnifiedMessage 변환 |
| **Add** | CLI Registry | CLI 설치 감지, 버전 확인, 자동 설치 |
| **Add** | Setup Wizard UI | 3단계 초기 설정 화면 |
| **Add** | Safety Confirm Dialog | 파일 수정/명령 실행 확인 UI |
| **Add** | Slash Command Palette | skill 검색/실행 UI |
| **Add** | Agent Panel | agent 목록/상태 표시 UI |

---

## File Changes

### Rust Backend — Delete

| Path | Summary |
|------|---------|
| `src-tauri/src/providers/*.rs` | SSE 프로바이더 전체 삭제 (claude.rs, copilot.rs, gemini.rs, codex.rs, antigravity.rs, mock.rs, router.rs, sse.rs, types.rs, mod.rs) |
| `src-tauri/src/auth/*.rs` | OAuth 인증 전체 삭제 (pkce.rs, oauth_server.rs, manager.rs, token_store.rs, credentials.rs, mod.rs) |
| `src-tauri/src/skills/ai.rs` | AI 스킬 생성 로직 삭제 |
| `src-tauri/src/commands/auth.rs` | 인증 커맨드 삭제 |
| `src-tauri/src/commands/chat.rs` | 직접 채팅 커맨드 삭제 |
| `src-tauri/src/commands/cowork.rs` | cowork 커맨드 삭제 |

### Rust Backend — New

| Path | Summary |
|------|---------|
| `src-tauri/src/cli/mod.rs` | CLI 모듈 루트 |
| `src-tauri/src/cli/manager.rs` | CLI subprocess lifecycle 관리 (spawn, kill, restart, health check) |
| `src-tauri/src/cli/parser.rs` | JSON 스트림 파싱 → UnifiedMessage 변환, CLI별 어댑터 dispatch |
| `src-tauri/src/cli/adapter.rs` | `CliAdapter` trait 정의 |
| `src-tauri/src/cli/adapters/claude.rs` | Claude Code JSON 포맷 파싱 어댑터 |
| `src-tauri/src/cli/adapters/codex.rs` | Codex CLI JSON 포맷 파싱 어댑터 |
| `src-tauri/src/cli/adapters/mod.rs` | 어댑터 모듈 루트 |
| `src-tauri/src/cli/registry.rs` | CLI 설치 감지 (`which`), 버전 확인, 설치 명령 실행 |
| `src-tauri/src/cli/types.rs` | UnifiedMessage enum, CliConfig, CliStatus 타입 정의 |
| `src-tauri/src/commands/cli.rs` | Tauri IPC 커맨드: cli_send_message, cli_start_session, cli_stop_session, cli_check_installed, cli_install, cli_login, cli_list_skills, cli_list_agents |

### Rust Backend — Modify

| Path | Summary |
|------|---------|
| `src-tauri/src/commands/mod.rs` | 삭제된 모듈 제거, cli 모듈 등록 |
| `src-tauri/src/lib.rs` | provider/auth 초기화 제거, CLI Manager 초기화 추가 |
| `src-tauri/src/state.rs` | AppState에서 provider 관련 제거, CliManager 추가 |
| `src-tauri/src/db/schema.rs` | messages 테이블에 `message_type` 컬럼 추가 (text, tool_use, tool_result, agent_start, agent_end, permission_request) |
| `src-tauri/src/db/conversations.rs` | provider 필드를 cli_provider로 변경 (값: "claude", "codex") |

### React Frontend — Delete

| Path | Summary |
|------|---------|
| `src/renderer/components/cowork/` | CoworkView, ProgressPanel, InlineToolCall 삭제 |
| `src/renderer/components/eval/` | EvalWorkbench 전체 삭제 |
| `src/renderer/hooks/use-assistant-runtime.ts` | assistant-ui 런타임 삭제 |
| `src/renderer/lib/providers.ts` | 프로바이더 설정 로직 삭제 |

### React Frontend — New

| Path | Summary |
|------|---------|
| `src/renderer/components/setup/SetupWizard.tsx` | 3단계 Setup Wizard (CLI 감지 → 설치 → 로그인) |
| `src/renderer/components/setup/CliCard.tsx` | CLI 설치 상태 카드 컴포넌트 |
| `src/renderer/components/setup/LoginStep.tsx` | CLI별 로그인 상태/버튼 |
| `src/renderer/components/chat/MessageRenderer.tsx` | UnifiedMessage 타입별 렌더러 (TextDelta → 텍스트, ToolUseStart → 도구 호출 카드, PermissionRequest → Safety Dialog 등) |
| `src/renderer/components/chat/SafetyDialog.tsx` | 파일 수정/명령 실행 확인 다이얼로그 (diff 미리보기 포함) |
| `src/renderer/components/chat/CommandPalette.tsx` | `/` 입력 시 skill 검색/선택 팝업 |
| `src/renderer/components/sidebar/AgentPanel.tsx` | Agent 목록, 실행 상태, 진행률 표시 |
| `src/renderer/components/chat/WorkdirSelector.tsx` | 새 대화 시작 시 작업 디렉토리 선택 |
| `src/renderer/lib/cli-api.ts` | Tauri IPC 래퍼 (cli_* 커맨드 호출) |

### React Frontend — Modify

| Path | Summary |
|------|---------|
| `src/renderer/App.tsx` | cowork/eval 제거, SetupWizard 조건부 렌더링 추가 |
| `src/renderer/stores/app-store.ts` | AuthStatus 제거, CliStatus/UnifiedMessage/AgentRunStatus 타입 변경, setupComplete 상태 추가 |
| `src/renderer/components/chat/ChatView.tsx` | SSE 스트림 → Tauri event 리스닝으로 변경, MessageRenderer 사용 |
| `src/renderer/components/chat/WelcomeScreen.tsx` | 프로바이더 선택 → 작업 디렉토리 선택으로 변경 |
| `src/renderer/components/sidebar/Sidebar.tsx` | AgentPanel 추가 |
| `src/renderer/components/settings/tabs/ProvidersTab.tsx` | OAuth 설정 → CLI 경로/버전 관리로 변경 |
| `src/renderer/components/InputControls.tsx` | `/` 입력 감지 → CommandPalette 트리거 추가 |

---

## Implementation Order

### Phase 0: CLI JSON 포맷 검증 (리서치)

0. Claude Code `--output-format stream-json` 실제 출력 포맷 조사 및 문서화. Codex CLI JSON 출력 모드 존재 여부 및 포맷 확인. 이 결과에 따라 어댑터 구현이 달라지므로 Phase 1 착수 전 반드시 완료.

### Phase 1: CLI 인프라 (Backend)

1. `src-tauri/src/cli/types.rs` — UnifiedMessage enum, CliConfig, CliStatus 정의
2. `src-tauri/src/cli/adapter.rs` — `CliAdapter` trait 정의 (`parse_line(&self, line: &str) -> Option<UnifiedMessage>`, `spawn_args(&self) -> Vec<String>`, `send_message(&self, stdin: &mut ChildStdin, msg: &str) -> Result<()>`)
3. `src-tauri/src/cli/adapters/claude.rs` — Claude Code JSON 파서 구현
4. `src-tauri/src/cli/adapters/codex.rs` — Codex CLI JSON 파서 구현
5. `src-tauri/src/cli/manager.rs` — subprocess spawn/kill, stdin write, stdout 읽기 + Tauri event emit
6. `src-tauri/src/cli/registry.rs` — `which claude`, `claude --version` 등 설치 감지
7. `src-tauri/src/commands/cli.rs` — Tauri IPC 커맨드 노출

### Phase 2: 기존 코드 정리

8. providers/, auth/ 디렉토리 삭제
9. commands/auth.rs, commands/chat.rs, commands/cowork.rs 삭제
10. lib.rs, state.rs, commands/mod.rs 업데이트
11. DB 스키마 마이그레이션 (message_type 컬럼, provider → cli_provider)

### Phase 3: Frontend 핵심 UI

12. `stores/app-store.ts` — 상태 타입 변경 (CliStatus, UnifiedMessage 등)
13. `lib/cli-api.ts` — Tauri IPC 래퍼
14. `components/chat/MessageRenderer.tsx` — UnifiedMessage 타입별 렌더링
15. `components/chat/ChatView.tsx` — Tauri event 리스닝으로 변경
16. `App.tsx` — cowork/eval 제거, 라우팅 정리

### Phase 4: 비개발자 UX

17. `components/setup/SetupWizard.tsx` — CLI 감지/설치/로그인 위저드
18. `components/chat/WorkdirSelector.tsx` — 작업 디렉토리 선택
19. `components/chat/SafetyDialog.tsx` — 파일 수정/명령 실행 확인
20. `settings/tabs/ProvidersTab.tsx` — CLI 경로/버전 관리로 변경

### Phase 5: Skills & Agents

21. `components/chat/CommandPalette.tsx` — slash command 팔레트
22. `components/sidebar/AgentPanel.tsx` — agent 목록/상태
23. `InputControls.tsx` — `/` 입력 감지 연동

---

## Function/API Signatures

### Rust — CliAdapter trait

```rust
#[async_trait]
pub trait CliAdapter: Send + Sync {
    /// CLI 이름 (e.g., "claude", "codex")
    fn name(&self) -> &str;

    /// subprocess spawn 시 사용할 명령어와 인자
    fn spawn_command(&self) -> &str;
    fn spawn_args(&self, working_dir: &Path, session_id: &str) -> Vec<String>;

    /// stdout에서 읽은 한 줄을 UnifiedMessage로 파싱
    fn parse_line(&self, line: &str) -> Result<Option<UnifiedMessage>>;

    /// 사용자 메시지를 stdin에 쓰기
    async fn send_message(&self, stdin: &mut ChildStdin, message: &str) -> Result<()>;

    /// Permission 응답을 stdin에 쓰기 (허용/거부)
    async fn send_permission_response(&self, stdin: &mut ChildStdin, id: &str, allowed: bool) -> Result<()>;

    /// CLI 설치 확인 명령
    fn check_command(&self) -> &str; // e.g., "claude --version"

    /// CLI 설치 명령
    fn install_command(&self) -> Option<&str>; // e.g., "npm install -g @anthropic-ai/claude-code"

    /// Skill/Agent 목록 조회 명령
    fn list_skills_args(&self) -> Option<Vec<String>>;
    fn list_agents_args(&self) -> Option<Vec<String>>;
}
```

### Rust — UnifiedMessage

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum UnifiedMessage {
    TextDelta { text: String },
    ToolUseStart { id: String, name: String, input: serde_json::Value },
    ToolResult { id: String, output: String, is_error: bool },
    PermissionRequest { id: String, tool: String, description: String, diff: Option<String> },
    AgentStart { id: String, name: String, description: String },
    AgentProgress { id: String, message: String },
    AgentEnd { id: String, result: String },
    SkillInvoked { name: String, args: Option<String> },
    TurnEnd { usage: Option<TokenUsage> },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
}
```

### Rust — CliManager

```rust
pub struct CliManager {
    sessions: Arc<Mutex<HashMap<String, CliSession>>>,
    adapters: HashMap<String, Box<dyn CliAdapter>>,
}

impl CliManager {
    pub fn new() -> Self;
    pub fn register_adapter(&mut self, adapter: Box<dyn CliAdapter>);
    pub async fn start_session(&self, provider: &str, working_dir: &Path, session_id: &str, app_handle: AppHandle) -> Result<()>;
    pub async fn send_message(&self, session_id: &str, message: &str) -> Result<()>;
    pub async fn send_permission_response(&self, session_id: &str, request_id: &str, allowed: bool) -> Result<()>;
    pub async fn stop_session(&self, session_id: &str) -> Result<()>;
    pub async fn check_installed(&self, provider: &str) -> Result<CliStatus>;
    pub async fn install_cli(&self, provider: &str) -> Result<()>;
    pub async fn list_skills(&self, provider: &str) -> Result<Vec<SkillInfo>>;
    pub async fn list_agents(&self, provider: &str) -> Result<Vec<AgentInfo>>;
}
```

### Rust — Tauri IPC Commands

```rust
#[tauri::command]
async fn cli_start_session(state: State<'_, AppState>, provider: String, working_dir: String) -> Result<String, String>;

#[tauri::command]
async fn cli_send_message(state: State<'_, AppState>, session_id: String, message: String) -> Result<(), String>;

#[tauri::command]
async fn cli_send_permission(state: State<'_, AppState>, session_id: String, request_id: String, allowed: bool) -> Result<(), String>;

#[tauri::command]
async fn cli_stop_session(state: State<'_, AppState>, session_id: String) -> Result<(), String>;

#[tauri::command]
async fn cli_check_installed(state: State<'_, AppState>, provider: String) -> Result<CliStatus, String>;

#[tauri::command]
async fn cli_install(state: State<'_, AppState>, provider: String) -> Result<(), String>;

#[tauri::command]
async fn cli_list_skills(state: State<'_, AppState>, provider: String) -> Result<Vec<SkillInfo>, String>;

#[tauri::command]
async fn cli_list_agents(state: State<'_, AppState>, provider: String) -> Result<Vec<AgentInfo>, String>;
```

### TypeScript — Tauri Event Listening

```typescript
// cli-api.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

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

export const cliApi = {
  startSession: (provider: string, workingDir: string) => invoke<string>('cli_start_session', { provider, workingDir }),
  sendMessage: (sessionId: string, message: string) => invoke<void>('cli_send_message', { sessionId, message }),
  sendPermission: (sessionId: string, requestId: string, allowed: boolean) => invoke<void>('cli_send_permission', { sessionId, requestId, allowed }),
  stopSession: (sessionId: string) => invoke<void>('cli_stop_session', { sessionId }),
  checkInstalled: (provider: string) => invoke<CliStatus>('cli_check_installed', { provider }),
  install: (provider: string) => invoke<void>('cli_install', { provider }),
  listSkills: (provider: string) => invoke<SkillInfo[]>('cli_list_skills', { provider }),
  listAgents: (provider: string) => invoke<AgentInfo[]>('cli_list_agents', { provider }),
  onMessage: (callback: (msg: UnifiedMessage) => void) => listen<UnifiedMessage>('cli-stream', (event) => callback(event.payload)),
}
```

---

## Constraints

1. **CLI 버전 의존성**: Claude Code의 `--output-format stream-json`과 Codex CLI의 JSON 출력 포맷은 CLI 버전에 따라 변경될 수 있다. 어댑터에 지원 버전 범위를 명시하고, 호환되지 않는 버전은 업데이트를 안내한다.
2. **네이밍**: 모든 Rust 모듈은 snake_case, React 컴포넌트는 PascalCase. Tauri 커맨드는 `cli_` 접두사.
3. **에러 처리**: CLI 프로세스 crash 시 자동 재시작하지 않는다. 사용자에게 상태를 보여주고 수동 재시작 버튼을 제공한다.
4. **MCP와의 관계**: MCP Bridge는 그대로 유지한다. CLI 에이전트가 자체 MCP 클라이언트를 가지고 있지만, 앱 자체의 MCP 서버 관리 기능은 유지하여 CLI에 전달할 수 있게 한다.
5. **DB 마이그레이션**: 기존 conversations/messages 데이터는 마이그레이션하지 않는다. 새 스키마로 시작하되, 이전 데이터는 읽기 전용으로 접근 가능하게 한다.
6. **작업 디렉토리**: 각 대화(conversation)는 하나의 작업 디렉토리에 바인딩된다. 대화 중 변경 불가.
7. **동시 세션**: v0.1에서는 한 번에 하나의 CLI 세션만 활성화. 멀티 세션은 향후.

---

## Decisions

- **Subprocess + JSON 모드 채택** — PTY(파싱 불안정, 비개발자 UI 부적합) 및 SDK(CLI별 SDK 유무 불확실, 업데이트 추적 부담) 대비 가장 안정적이고 확장 가능.
- **기존 코드베이스 리팩토링** — 클린 스타트 대비 Tauri 인프라, DB, MCP Bridge, Settings UI, Sidebar 등 60-70% 재사용 가능. 교체 대상은 providers/auth 레이어에 한정.
- **v0.1 범위를 Claude Code + Codex CLI로 제한** — 두 프로바이더로 멀티 프로바이더 추상화(CliAdapter trait)를 검증하고, 이후 Gemini CLI 등 추가 시 어댑터만 구현.
