# IDE-Style UI Overhaul — Design Spec

> Date: 2026-04-09
> Status: draft
> Prerequisite: `docs/llm/enhanced-wrapper-design.md` (Phase 1-3 완료 기준)

## Purpose

kangnam-client의 UI를 Cursor/Windsurf 스타일 IDE 레이아웃으로 전면 개편한다. 4영역 패널 시스템, Skill/Agent 네이티브 라우팅, 실시간 도구/에이전트 추적 패널, 커맨드 팔레트를 구현한다.

완료 기준:
- 4영역 레이아웃 (Activity Bar, Side Panel, Main Chat, Right Panel) 동작
- Skill Browser에서 클릭으로 skill 발동 (Native + Enhanced Routing)
- Right Panel 5개 탭 (Terminal, Files, Tools, Agents, Tasks) 동작
- 커맨드 팔레트 (Cmd+K) 에서 skill/agent/action 검색+실행
- 입력창 `/` 자동완성
- 키보드 단축키 전체 동작
- Status Bar에 연결상태/모델/비용/레이트리밋/cwd 표시

## Constraints

- JSON-RPC 2.0 프로토콜 유지 — 새 RPC 메서드 최소화
- 기존 `cli.stream`, `cli.enhanced` 브로드캐스트에서 모든 데이터 파싱
- MCP permission 시스템 (`/mcp` SSE 엔드포인트) 그대로 유지
- Codex CLI 기본 채팅 기능 유지 (enhanced 패널은 Claude 전용)
- `-p` 모드 유지 — Skill tool은 모델이 자율 호출 (검증 완료)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Title Bar (drag region)                          [_] [□] [×]      │
├────────┬────────────────────────────────┬───────────────────────────┤
│Activity│  Tab Bar [Chat 1] [Chat 2] [+] │  Tab Bar [Term] [Files]   │
│  Bar   ├────────────────────────────────┼───────────────────────────┤
│        │                                │                           │
│  ┌──┐  │  Chat Area                     │  Right Panel              │
│  │💬│ │  (messages + streaming)        │  (5 tabs)                 │
│  │📁│ │                                │  - Terminal Log            │
│  │🔧│ │                                │  - File Changes            │
│  │⚡│ │                                │  - Tool Timeline           │
│  │🤖│ │                                │  - Agent Tracker           │
│  │⚙ │ │                                │  - Task Monitor            │
│  └──┘  │                                │                           │
│        ├────────────────────────────────┼───────────────────────────┤
│        │  [Ask Claude anything...]  [→] │                           │
├────────┴────────────────────────────────┴───────────────────────────┤
│  Status Bar: ● connected │ model │ $cost │ turns │ ██░ rate │ cwd  │
└─────────────────────────────────────────────────────────────────────┘
```

### 4영역 구조

| 영역 | 위치 | 너비 | 역할 |
|------|------|------|------|
| Activity Bar | 좌측 아이콘 열 | 48px 고정 | 탭 전환 아이콘 (Chats, Files, Skills, Agents, MCP, Settings) |
| Side Panel | Activity Bar 우측 | 250-400px, 리사이즈 가능 | Activity Bar 선택에 따른 컨텐츠 |
| Main Chat | 중앙 | flex-1 | 채팅 탭 + 메시지 + 입력 |
| Right Panel | 우측 | 300-500px, 리사이즈 가능, 숨기기 가능 | 보조 정보 5개 탭 |

### 패널 동작

- Activity Bar 아이콘 클릭: 같은 아이콘 재클릭 시 Side Panel 토글
- Right Panel 토글: Cmd+B 또는 드래그로 숨기기
- 패널 크기 조절: 경계선 드래그
- 창 폭 < 800px: Side Panel 자동 숨김, Right Panel 하단 이동

## Skill / Agent / Team 처리: Native + Enhanced Routing

### 핵심 발견

`-p` 모드에서 `Skill` tool이 `system/init`의 tools 목록에 포함됨. 모델이 `{"name":"Skill","input":{"skill":"commit"}}` 형태로 자율 호출 가능 (2026-04-09 검증 완료). 유저가 `/commit`을 텍스트로 타이핑하는 것만 안 되고, 모델의 Skill tool 호출은 정상 동작.

### 프롬프트 라우팅 규칙

```
유저 입력 or GUI 클릭
    │
    ├─ 빌트인 커맨드? (compact, clear, cost, help, init, review, context)
    │   └─ YES → 텍스트 그대로 stdin 전송: "/compact"
    │
    ├─ GUI Skill 클릭?
    │   └─ YES → 강화 프롬프트: "Invoke the /commit skill using the Skill tool."
    │
    ├─ GUI Agent 클릭?
    │   └─ YES → 프롬프트: "Spawn a code-reviewer agent to review the current changes."
    │
    ├─ 자연어 입력?
    │   └─ YES → 그대로 전송 (모델이 자율적으로 Skill/Agent tool 판단)
    │
    └─ /로 시작하는 텍스트 입력?
        └─ slash_commands에서 매칭 → 빌트인이면 텍스트, 커스텀이면 강화 프롬프트
           매칭 실패 → 그대로 전송
```

### 빌트인 커맨드 목록 (하드코딩)

compact, clear, cost, help, init, review, context, security-review, extra-usage, insights

### 데이터 소스

- `system/init` → skills, slash_commands, agents, plugins, tools 목록
- 세션 시작 시 Store의 `sessionMeta`에 저장
- Skill Browser, Agent Panel, 자동완성, 커맨드 팔레트 모두 이 데이터 사용

## Side Panel 컨텐츠

### Chats (💬)
- 대화 목록 + 검색
- 기존 ConversationList 리팩토링

### Files (📁)
- 작업 디렉토리 파일 트리
- `sessionMeta.cwd` 기반, Tauri `fs` plugin으로 디렉토리 읽기 (기존 Tauri IPC 사용, RPC 불필요)
- 파일 클릭 시 해당 파일을 프롬프트에 언급하는 UX (향후 확장)

### Skills (🔧)
- 3단 분류: Built-in / Custom Skills / Plugins
- 검색 필터
- 클릭 시 프롬프트 라우팅 규칙에 따라 전송
- `sessionMeta.skills` + `sessionMeta.slash_commands`에서 목록

### Agents (⚡)
- Available: `sessionMeta.agents` 목록
- Active: `cli.stream`의 agent_start/progress/end에서 실시간 추적
- 클릭 시 해당 에이전트 spawn 프롬프트 전송

### MCP (🤖)
- `sessionMeta.mcp_servers` 상태 표시
- connected / needs-auth / failed 상태별 아이콘

## Right Panel 탭

### Terminal Log
- 데이터: `cli.stream` → tool_use_start(name=Bash) + tool_result
- 표시: 명령어 + 출력, 터미널 스타일 렌더링
- 새 Store 상태: `terminalEntries: { command: string, output: string, timestamp: number, isError: boolean }[]`

### File Changes
- 데이터: `cli.stream` → tool_use_start(name=Edit/Write/Read) + tool_result
- 표시: 변경 파일 목록 (M/A/D) + 클릭 시 diff 미리보기
- 새 Store 상태: `fileChanges: { path: string, action: 'modified'|'created'|'read', diff?: string }[]`

### Tool Timeline
- 데이터: `cli.stream` → 모든 tool_use_start + tool_result
- 표시: 시간순 도구 호출 카드 (성공/실행중/거부 상태, 실행 시간)
- 새 Store 상태: `toolCalls: { id: string, name: string, input: unknown, status: 'running'|'done'|'error'|'denied', startTime: number, duration?: number }[]`

### Agent Tracker
- 데이터: `cli.stream` agent_start/progress/end + `cli.enhanced` task_started/progress/notification
- 표시: parent_tool_use_id 기반 트리 구조, 에이전트별 도구 호출 내역
- 기존 Store 상태 활용: `activeTasks`

### Task Monitor
- 데이터: `cli.enhanced` → task_started/progress/notification
- 표시: 백그라운드 태스크 카드 (running/completed/failed)
- 기존 Store 상태 활용: `activeTasks`

## UI 디자인 시스템

### 디자인 토큰 (Dark)

```css
/* Background */
--bg-main: #1a1a1a;
--bg-sidebar: #141414;
--bg-surface: #1e1e1e;
--bg-hover: #252525;

/* Text */
--text-primary: #e0e0e0;
--text-secondary: #a0a0a0;
--text-muted: #666666;

/* Accent */
--accent: #6366f1;  /* indigo */

/* Semantic */
--success: #4ade80;
--warning: #f59e0b;
--error: #ef4444;

/* Border & Radius */
--border: rgba(255, 255, 255, 0.08);
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;

/* Typography */
font-family: Inter, system-ui, sans-serif;
font-size: 13px;
font-family-mono: 'JetBrains Mono', monospace;
font-size-mono: 12px;
```

### 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| Cmd+\ | Side Panel 토글 |
| Cmd+B | Right Panel 토글 |
| Cmd+N | 새 채팅 |
| Cmd+K | 커맨드 팔레트 |
| Cmd+Shift+F | 대화 검색 |
| Cmd+1~5 | Activity Bar 탭 전환 |
| Esc | 스트리밍 중단 |

### Status Bar

```
● connected │ claude-opus-4-6 │ $0.042 │ 7 turns │ ██░ 87% │ ~/projects/kangnam-client │ bypassPermissions
```

- 연결 상태: WebSocket 연결 (green dot)
- 모델: `sessionMeta.model`
- 비용: `ResultSummary.cost_usd`
- 턴 수: `ResultSummary.num_turns`
- 레이트리밋: `RateLimit.utilization` (bar + percent, warning=yellow, rejected=red)
- cwd: `sessionMeta.cwd`
- 권한 모드: `sessionMeta.permission_mode`

### Command Palette (Cmd+K)

- Cursor 스타일 오버레이
- 카테고리: Skills / Agents / Actions
- 퍼지 검색
- Enter로 실행 → 프롬프트 라우팅 규칙 적용

### 입력창 자동완성

- `/` 입력 시 slash_commands 목록 팝업
- 방향키 + Enter로 선택
- 빌트인 아이콘 (⌘) vs 커스텀 아이콘 (⚡) 구분

## File Changes

### Backend (Rust) — Modify

| File | Change |
|------|--------|
| `src-tauri/src/cli/types.rs` | `UnifiedMessage`에 `ToolResult { id, output, is_error }` variant 추가 |
| `src-tauri/src/cli/adapters/claude.rs` | `user` 타입 메시지 중 tool_result role 파싱 추가 |

### Frontend — Create (13 files)

| File | Purpose |
|------|---------|
| `src/renderer/components/layout/ActivityBar.tsx` | 좌측 아이콘 바 |
| `src/renderer/components/layout/SidePanel.tsx` | 좌측 패널 컨테이너 |
| `src/renderer/components/layout/RightPanel.tsx` | 우측 패널 컨테이너 + 탭 전환 |
| `src/renderer/components/layout/StatusBar.tsx` | 하단 상태바 |
| `src/renderer/components/layout/ResizeHandle.tsx` | 패널 리사이즈 핸들 |
| `src/renderer/components/chat/ChatTabBar.tsx` | 채팅 탭 바 |
| `src/renderer/components/chat/MessageInput.tsx` | 입력 컴포넌트 (ChatView에서 분리) |
| `src/renderer/components/chat/SlashAutocomplete.tsx` | / 자동완성 팝업 |
| `src/renderer/components/sidebar/McpPanel.tsx` | MCP 서버 상태 |
| `src/renderer/components/sidebar/FileExplorer.tsx` | 파일 트리 |
| `src/renderer/components/panels/TerminalLog.tsx` | Bash 로그 |
| `src/renderer/components/panels/FileChanges.tsx` | 변경 파일 + diff |
| `src/renderer/components/panels/ToolTimeline.tsx` | 도구 호출 타임라인 |
| `src/renderer/components/panels/AgentTracker.tsx` | 서브에이전트 트리 |
| `src/renderer/components/panels/TaskMonitor.tsx` | 백그라운드 태스크 |
| `src/renderer/lib/prompt-router.ts` | 프롬프트 라우팅 로직 |

### Frontend — Modify (11 files)

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | 4영역 레이아웃 구조로 재구성 |
| `src/renderer/styles/globals.css` | 디자인 토큰 전면 교체 |
| `src/renderer/stores/app-store.ts` | rightPanel, sidePanelTab, toolCalls, terminalEntries, fileChanges 등 상태 추가 |
| `src/renderer/lib/cli-api.ts` | skill/agent 라우팅 헬퍼 추가 |
| `src/renderer/components/chat/ChatView.tsx` | 탭 바 추가, MessageInput/StatusBar 분리 |
| `src/renderer/components/chat/MessageRenderer.tsx` | 디자인 토큰 적용 |
| `src/renderer/components/chat/CommandPalette.tsx` | Cmd+K 팔레트 전면 개편 (skill/agent/action 통합) |
| `src/renderer/components/chat/WelcomeScreen.tsx` | 디자인 토큰 적용 |
| `src/renderer/components/sidebar/ConversationList.tsx` | SidePanel용 리팩토링 |
| `src/renderer/components/sidebar/SkillBrowser.tsx` | 빌트인/커스텀/플러그인 분류, 검색, 클릭 라우팅 |
| `src/renderer/components/sidebar/AgentPanel.tsx` | 사용 가능 + 활성 분리, 클릭 → spawn 프롬프트 |

## Implementation Order

### Phase 1 — 레이아웃 쉘
1. `globals.css` 디자인 토큰 교체
2. `ActivityBar.tsx` 생성
3. `SidePanel.tsx` 생성
4. `RightPanel.tsx` 생성
5. `ResizeHandle.tsx` 생성
6. `StatusBar.tsx` 생성 (기존 chat/StatusBar.tsx 이동+확장)
7. `App.tsx` 4영역 레이아웃으로 재구성
8. `app-store.ts`에 rightPanelVisible, rightPanelTab, sidePanelTab 추가

### Phase 2 — 채팅 개선
1. `prompt-router.ts` 생성 (빌트인/커스텀/자연어 분기 로직)
2. `MessageInput.tsx` — ChatView에서 분리, 자동완성 통합
3. `SlashAutocomplete.tsx` 생성
4. `ChatTabBar.tsx` 생성
5. `CommandPalette.tsx` 전면 개편
6. `ChatView.tsx` 수정 (탭 바 추가, 분리된 컴포넌트 통합)
7. `cli-api.ts`에 라우팅 헬퍼 추가

### Phase 3 — Side Panel
1. `ConversationList.tsx` SidePanel용 리팩토링
2. `SkillBrowser.tsx` — 빌트인/커스텀/플러그인 3단 분류 + 검색 + 클릭 라우팅
3. `AgentPanel.tsx` — Available + Active 분리
4. `FileExplorer.tsx` 생성
5. `McpPanel.tsx` 생성

### Phase 4 — Right Panel
1. `app-store.ts`에 terminalEntries, fileChanges, toolCalls 추가
2. `cli/types.rs`에 ToolResult variant 추가
3. `cli/adapters/claude.rs`에 tool_result 파싱 추가
4. `ChatView.tsx`에서 cli.stream 파싱 로직 확장 (terminal, files, tools 데이터 추출)
5. `TerminalLog.tsx` 생성
6. `FileChanges.tsx` 생성
7. `ToolTimeline.tsx` 생성
8. `AgentTracker.tsx` 생성
9. `TaskMonitor.tsx` 생성

### Phase 5 — 통합 & 폴리시
1. 키보드 단축키 전체 바인딩
2. 반응형 레이아웃 (< 800px 처리)
3. MessageRenderer.tsx, WelcomeScreen.tsx 디자인 토큰 적용
4. 에러 상태 처리 (연결 끊김, 세션 만료 등)
5. 라이트 테마 디자인 토큰 추가

## Decisions

- **Native + Enhanced Routing** — Skill injection/PTY/SDK 대신. 이유: `-p` 모드에서 Skill tool이 정상 동작 확인됨 (2026-04-09). 우회 로직 불필요.
- **4영역 IDE 레이아웃** — 단일 채팅 레이아웃 대신. 이유: Cursor/Windsurf 스타일 요청, 정보 밀도 높은 패널 기반.
- **Right Panel 데이터는 cli.stream에서 파싱** — 별도 RPC 메서드 대신. 이유: tool_use_start/tool_result가 이미 broadcast되므로 프론트엔드에서 분류만 하면 됨.
- **빌트인 커맨드 하드코딩** — 동적 감지 대신. 이유: 빌트인 목록은 Claude Code 버전에 따라 거의 변하지 않고, 잘못 분류해도 텍스트 전송이라 부작용 없음.
- **커맨드 팔레트 (Cmd+K)** — 별도 검색 UI 대신. 이유: Cursor/VS Code 사용자에게 익숙한 패턴, skill+agent+action을 한곳에서 접근.
