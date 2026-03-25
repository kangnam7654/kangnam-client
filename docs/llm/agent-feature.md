# Agent Feature 설계문서

## 목적

kangnam-client에 Claude Code 스타일의 **에이전트(subagent)** 기능을 추가한다. 스킬이 "현재 대화에 지식을 주입"하는 것이라면, 에이전트는 "격리된 컨텍스트에서 독립적으로 작업하고 결과를 반환"한다.

**완료 조건**: 사용자가 에이전트를 생성/편집/삭제할 수 있고, 대화에서 에이전트를 선택하여 격리된 컨텍스트로 작업을 위임하고 결과를 메인 대화에 수신할 수 있다.

---

## Agent vs Skill 차이

| 차원 | Skill (현재) | Agent (신규) |
|------|-------------|-------------|
| 컨텍스트 | 현재 대화에 system 메시지 주입 | 별도 임시 대화 생성, 격리 실행 |
| 대화 기록 접근 | 전체 접근 가능 | 불가 (task 메시지만 전달) |
| 모델 | 대화 모델 따름 | 에이전트별 모델 지정 가능 |
| 시스템 프롬프트 | 기존 대화에 추가 | 에이전트 instructions가 전체 시스템 프롬프트 |
| 도구 제한 | 없음 | 에이전트별 MCP 도구 allowlist |
| 결과 반환 | 없음 (대화 자체가 결과) | 에이전트 최종 응답이 메인 대화에 삽입 |
| 호출 방식 | 첫 메시지에 1회 주입 | 명시적 선택 또는 @멘션 |

---

## DB 스키마

### agents 테이블

```sql
CREATE TABLE IF NOT EXISTS agents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL,
    model       TEXT,
    allowed_tools TEXT,
    max_turns   INTEGER NOT NULL DEFAULT 10,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | `builtin-*` (프리셋) 또는 UUID (사용자) |
| name | TEXT | 표시 이름, kebab-case 권장 |
| description | TEXT | 위임 판단 기준 + UI 설명 |
| instructions | TEXT | 에이전트 시스템 프롬프트 (전체) |
| model | TEXT | 에이전트 전용 모델. NULL이면 대화 모델 상속 |
| allowed_tools | TEXT | JSON 배열. NULL이면 모든 도구 허용. 예: `["read","search"]` |
| max_turns | INTEGER | 에이전트 루프 최대 턴 수 (기본 10) |
| sort_order | INTEGER | 정렬 순서 (프리셋: 음수) |

### agent_runs 테이블 (실행 이력)

```sql
CREATE TABLE IF NOT EXISTS agent_runs (
    id                TEXT PRIMARY KEY,
    agent_id          TEXT NOT NULL REFERENCES agents(id),
    conversation_id   TEXT NOT NULL REFERENCES conversations(id),
    task              TEXT NOT NULL,
    result            TEXT,
    model_used        TEXT,
    status            TEXT NOT NULL DEFAULT 'running',
    started_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    completed_at      INTEGER
);

CREATE INDEX idx_agent_runs_conv ON agent_runs(conversation_id);
```

| 컬럼 | 설명 |
|------|------|
| task | 에이전트에게 위임한 작업 내용 |
| result | 에이전트 최종 응답 |
| status | `running`, `completed`, `failed`, `cancelled` |

---

## 파일 변경 목록

### Rust 백엔드

| 파일 | 변경 | 내용 |
|------|------|------|
| `src-tauri/src/db/schema.rs` | 수정 | `agents`, `agent_runs` 테이블 CREATE + 인덱스 추가 |
| `src-tauri/src/db/agents.rs` | **생성** | Agent CRUD 함수 + AgentRun CRUD |
| `src-tauri/src/db/mod.rs` | 수정 | `pub mod agents;` 추가 |
| `src-tauri/src/commands/agents.rs` | **생성** | Tauri IPC 커맨드 (CRUD + execute) |
| `src-tauri/src/commands/mod.rs` | 수정 | `pub mod agents;` 추가 |
| `src-tauri/src/lib.rs` | 수정 | agent 커맨드를 `invoke_handler`에 등록 |
| `src-tauri/data/preset-agents.json` | **생성** | 프리셋 에이전트 정의 (code-reviewer, explore 등) |

### 프론트엔드

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/renderer/lib/tauri-api.ts` | 수정 | `window.api.agents.*` 메서드 추가 |
| `src/renderer/stores/app-store.ts` | 수정 | `agents`, `activeAgentId` 상태 추가 |
| `src/renderer/components/settings/tabs/AgentsTab.tsx` | **생성** | 에이전트 관리 UI (CRUD) |
| `src/renderer/components/settings/SettingsPanel.tsx` | 수정 | "Agents" 탭 추가 |
| `src/renderer/components/chat/WelcomeScreen.tsx` | 수정 | 에이전트 칩 UI 추가 (스킬 칩 아래) |
| `src/renderer/components/chat/AgentRunPanel.tsx` | **생성** | 에이전트 실행 상태 표시 패널 |
| `src/renderer/components/chat/AssistantThread.tsx` | 수정 | 에이전트 결과 메시지 렌더링 |

---

## 구현 순서

### Stage 1: DB + Rust CRUD

**1-1. 스키마 추가** — `src-tauri/src/db/schema.rs`
- `ensure_tables()` 함수에 `agents`, `agent_runs` CREATE TABLE 추가
- `seed_preset_agents()` 함수 추가 (preset-agents.json 로딩)

**1-2. Rust 모델 + CRUD** — `src-tauri/src/db/agents.rs`

```rust
// === 구조체 ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub instructions: String,
    pub model: Option<String>,
    #[serde(rename = "allowedTools")]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(rename = "maxTurns")]
    pub max_turns: i64,
    #[serde(rename = "sortOrder")]
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRun {
    pub id: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "conversationId")]
    pub conversation_id: String,
    pub task: String,
    pub result: Option<String>,
    #[serde(rename = "modelUsed")]
    pub model_used: Option<String>,
    pub status: String,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
}

// === CRUD 함수 ===

pub fn list_agents(conn: &Connection) -> Result<Vec<Agent>>
pub fn get_agent(conn: &Connection, id: &str) -> Option<Agent>
pub fn create_agent(conn: &Connection, name: &str, description: &str, instructions: &str, model: Option<&str>, allowed_tools: Option<Vec<String>>, max_turns: i64) -> Result<Agent>
pub fn update_agent(conn: &Connection, id: &str, name: &str, description: &str, instructions: &str, model: Option<&str>, allowed_tools: Option<Vec<String>>, max_turns: i64) -> Result<()>
pub fn delete_agent(conn: &Connection, id: &str) -> Result<()>

// === AgentRun 함수 ===

pub fn create_agent_run(conn: &Connection, agent_id: &str, conversation_id: &str, task: &str) -> Result<AgentRun>
pub fn complete_agent_run(conn: &Connection, run_id: &str, result: &str, model_used: Option<&str>) -> Result<()>
pub fn fail_agent_run(conn: &Connection, run_id: &str, error: &str) -> Result<()>
pub fn get_agent_run(conn: &Connection, run_id: &str) -> Option<AgentRun>
```

**1-3. preset-agents.json** — `src-tauri/data/preset-agents.json`

초기 프리셋 에이전트:

| name | model | 용도 |
|------|-------|------|
| code-reviewer | inherit | 코드 리뷰 (격리 컨텍스트에서 파일 분석) |
| researcher | inherit | 리서치 (메인 대화 오염 없이 조사) |
| translator | inherit | 번역 (원문→번역문 격리 작업) |

### Stage 2: Tauri IPC 커맨드

**2-1. 커맨드 정의** — `src-tauri/src/commands/agents.rs`

```rust
#[tauri::command]
pub async fn agents_list(state: State<'_, AppState>) -> Result<Vec<Agent>, String>

#[tauri::command]
pub async fn agents_get(id: String, state: State<'_, AppState>) -> Result<Option<Agent>, String>

#[tauri::command]
pub async fn agents_create(
    name: String, description: String, instructions: String,
    model: Option<String>, allowed_tools: Option<Vec<String>>, max_turns: Option<i64>,
    state: State<'_, AppState>
) -> Result<Agent, String>

#[tauri::command]
pub async fn agents_update(
    id: String, name: String, description: String, instructions: String,
    model: Option<String>, allowed_tools: Option<Vec<String>>, max_turns: Option<i64>,
    state: State<'_, AppState>
) -> Result<(), String>

#[tauri::command]
pub async fn agents_delete(id: String, state: State<'_, AppState>) -> Result<(), String>

#[tauri::command]
pub async fn agents_execute(
    agent_id: String,
    conversation_id: String,
    task: String,
    provider: String,
    state: State<'_, AppState>,
    app: AppHandle
) -> Result<String, String>
```

**2-2. 에이전트 실행 로직** — `agents_execute` 내부

```
agents_execute(agent_id, conversation_id, task, provider):
  1. agent = get_agent(agent_id)
  2. run = create_agent_run(agent_id, conversation_id, task)
  3. model = agent.model ?? 대화의 activeModel
  4. access_token = auth.get_access_token(provider)
  5. messages = [
       { role: "system", content: agent.instructions },
       { role: "user", content: task }
     ]
  6. 스트리밍 이벤트 발행: "agent-run-start" { runId, agentName }
  7. result = LLM 호출 (messages, model, access_token)
     - agent.max_turns만큼 tool call 루프 허용
     - agent.allowed_tools로 도구 필터링
  8. complete_agent_run(run.id, result)
  9. 스트리밍 이벤트 발행: "agent-run-complete" { runId, result }
  10. 메인 대화에 결과 삽입:
      add_message(conversation_id, "assistant",
        "[Agent: {agent.name}]\n\n{result}")
  11. return result
```

**2-3. lib.rs 등록** — `invoke_handler`에 추가

```rust
agents_list, agents_get, agents_create, agents_update, agents_delete, agents_execute
```

### Stage 3: 프론트엔드 API + 상태

**3-1. tauri-api.ts** — `window.api.agents` 추가

```typescript
agents: {
    list: () => invoke('agents_list'),
    get: (id: string) => invoke('agents_get', { id }),
    create: (name: string, description: string, instructions: string,
             model?: string, allowedTools?: string[], maxTurns?: number) =>
        invoke('agents_create', { name, description, instructions, model, allowedTools, maxTurns }),
    update: (id: string, name: string, description: string, instructions: string,
             model?: string, allowedTools?: string[], maxTurns?: number) =>
        invoke('agents_update', { id, name, description, instructions, model, allowedTools, maxTurns }),
    delete: (id: string) => invoke('agents_delete', { id }),
    execute: (agentId: string, conversationId: string, task: string, provider: string) =>
        invoke('agents_execute', { agentId, conversationId, task, provider }),
    onRunStart: (cb: (data: { runId: string; agentName: string }) => void) => listen('agent-run-start', cb),
    onRunComplete: (cb: (data: { runId: string; result: string }) => void) => listen('agent-run-complete', cb),
}
```

**3-2. app-store.ts** — 상태 추가

```typescript
interface Agent {
    id: string
    name: string
    description: string
    instructions: string
    model: string | null
    allowedTools: string[] | null
    maxTurns: number
    sortOrder: number
}

// 추가 상태
agents: Agent[]
setAgents: (agents: Agent[]) => void
activeAgentId: string | null
setActiveAgentId: (id: string | null) => void
agentRunStatus: { runId: string; agentName: string; status: 'running' | 'completed' | 'failed' } | null
setAgentRunStatus: (status: ...) => void
```

### Stage 4: 프론트엔드 UI

**4-1. AgentsTab.tsx** — 설정 패널 에이전트 관리

PromptsTab.tsx 패턴을 따라 구현:
- 에이전트 목록 (이름, description 미리보기)
- 편집 모달: Name, Description, Instructions, Model (드롭다운), Max Turns
- 생성/수정/삭제
- AI 생성 기능 (스킬의 aiGenerate 재활용)

**4-2. SettingsPanel.tsx** — 탭 추가

```typescript
const TABS = [
    { id: 'providers', label: 'Providers', icon: '...' },
    { id: 'mcp', label: 'MCP Servers', icon: '...' },
    { id: 'prompts', label: 'Skills', icon: '...' },
    { id: 'agents', label: 'Agents', icon: '...' },  // 추가
    { id: 'general', label: 'General', icon: '...' },
]
```

**4-3. WelcomeScreen.tsx** — 에이전트 선택 UI

스킬 칩 아래에 에이전트 칩 섹션 추가:

```tsx
{/* Agent chips */}
{agents.length > 0 && (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {agents.map(agent => {
            const isSelected = activeAgentId === agent.id
            return (
                <button onClick={() => setActiveAgentId(isSelected ? null : agent.id)}
                    style={{
                        border: `1px solid ${isSelected ? '#8b5cf6' : 'var(--border-subtle)'}`,
                        background: isSelected ? 'rgba(139,92,246,0.08)' : 'transparent',
                        color: isSelected ? '#8b5cf6' : 'var(--text-secondary)',
                        // 스킬과 시각적 구분: 보라색 계열
                    }}>
                    ⚡ {agent.name}
                </button>
            )
        })}
    </div>
)}
```

스킬과 에이전트는 **상호 배타적**: 하나를 선택하면 다른 하나는 해제.

**4-4. AgentRunPanel.tsx** — 실행 상태 표시

대화 화면 상단에 에이전트 실행 중 표시:

```tsx
export function AgentRunPanel() {
    const { agentRunStatus } = useAppStore()
    if (!agentRunStatus || agentRunStatus.status !== 'running') return null

    return (
        <div style={{
            padding: '8px 16px', background: 'rgba(139,92,246,0.06)',
            borderBottom: '1px solid rgba(139,92,246,0.15)',
            display: 'flex', alignItems: 'center', gap: 8
        }}>
            <Spinner size={14} />
            <span style={{ fontSize: 13, color: '#8b5cf6' }}>
                Agent "{agentRunStatus.agentName}" working...
            </span>
        </div>
    )
}
```

**4-5. AssistantThread.tsx** — 에이전트 결과 메시지 렌더링

`[Agent: name]` 접두어가 있는 메시지를 에이전트 결과로 식별하여 별도 스타일 적용:

```tsx
const isAgentResult = content.startsWith('[Agent:')
// 보라색 왼쪽 보더 + 에이전트 이름 배지 표시
```

### Stage 5: 대화 흐름 통합

**5-1. WelcomeScreen.tsx** — handleSend 수정

```typescript
const handleSend = async () => {
    const conv = await window.api.conv.create(...)

    if (activeAgentId) {
        // 에이전트 모드: 격리된 컨텍스트에서 실행
        setAgentRunStatus({ runId: '', agentName: selectedAgent.name, status: 'running' })
        await window.api.agents.execute(activeAgentId, conv.id, text, activeProvider)
        setActiveAgentId(null)
    } else {
        // 기존 스킬 모드
        await window.api.chat.send(conv.id, text, activeProvider, ..., activePromptId)
        setActivePromptId(null)
    }
}
```

**5-2. chat_send에서 에이전트 결과 메시지 처리**

에이전트 실행이 완료되면 `agents_execute`가 메인 대화에 결과를 assistant 메시지로 삽입한다. 프론트엔드는 기존 메시지 리스닝으로 자동 수신.

---

## 함수/API 시그니처 요약

### Rust (db/agents.rs)

```rust
pub fn list_agents(conn: &Connection) -> Result<Vec<Agent>, rusqlite::Error>
pub fn get_agent(conn: &Connection, id: &str) -> Option<Agent>
pub fn create_agent(conn: &Connection, name: &str, description: &str, instructions: &str, model: Option<&str>, allowed_tools: Option<Vec<String>>, max_turns: i64) -> Result<Agent, rusqlite::Error>
pub fn update_agent(conn: &Connection, id: &str, name: &str, description: &str, instructions: &str, model: Option<&str>, allowed_tools: Option<Vec<String>>, max_turns: i64) -> Result<(), rusqlite::Error>
pub fn delete_agent(conn: &Connection, id: &str) -> Result<(), rusqlite::Error>
pub fn create_agent_run(conn: &Connection, agent_id: &str, conversation_id: &str, task: &str) -> Result<AgentRun, rusqlite::Error>
pub fn complete_agent_run(conn: &Connection, run_id: &str, result: &str, model_used: Option<&str>) -> Result<(), rusqlite::Error>
pub fn fail_agent_run(conn: &Connection, run_id: &str, error: &str) -> Result<(), rusqlite::Error>
```

### Rust (commands/agents.rs)

```rust
pub async fn agents_list(state: State<'_, AppState>) -> Result<Vec<Agent>, String>
pub async fn agents_get(id: String, state: State<'_, AppState>) -> Result<Option<Agent>, String>
pub async fn agents_create(name: String, description: String, instructions: String, model: Option<String>, allowed_tools: Option<Vec<String>>, max_turns: Option<i64>, state: State<'_, AppState>) -> Result<Agent, String>
pub async fn agents_update(id: String, name: String, description: String, instructions: String, model: Option<String>, allowed_tools: Option<Vec<String>>, max_turns: Option<i64>, state: State<'_, AppState>) -> Result<(), String>
pub async fn agents_delete(id: String, state: State<'_, AppState>) -> Result<(), String>
pub async fn agents_execute(agent_id: String, conversation_id: String, task: String, provider: String, state: State<'_, AppState>, app: AppHandle) -> Result<String, String>
```

### TypeScript (tauri-api.ts)

```typescript
window.api.agents.list(): Promise<Agent[]>
window.api.agents.get(id: string): Promise<Agent | null>
window.api.agents.create(name, description, instructions, model?, allowedTools?, maxTurns?): Promise<Agent>
window.api.agents.update(id, name, description, instructions, model?, allowedTools?, maxTurns?): Promise<void>
window.api.agents.delete(id: string): Promise<void>
window.api.agents.execute(agentId, conversationId, task, provider): Promise<string>
window.api.agents.onRunStart(cb): UnlistenFn
window.api.agents.onRunComplete(cb): UnlistenFn
```

---

## 제약 조건

1. **에이전트는 에이전트를 호출할 수 없다** — 재귀 방지. `agents_execute` 내부에서는 `agents_execute`를 호출하지 않는다.
2. **스킬과 에이전트 상호 배타** — 한 대화에서 스킬 또는 에이전트 중 하나만 선택 가능.
3. **에이전트 결과 메시지 형식** — `[Agent: {name}]\n\n{result}` 접두어로 일반 응답과 구분.
4. **프리셋 에이전트 ID 컨벤션** — `builtin-` 접두어. 사용자 에이전트는 UUID.
5. **allowed_tools** — JSON 문자열 배열로 DB 저장. NULL이면 모든 MCP 도구 허용.
6. **max_turns 기본값 10** — 무한 루프 방지.
7. **기존 스킬 코드 수정 최소화** — 에이전트는 별도 테이블/커맨드/UI로 분리. 스킬 로직은 건드리지 않는다.
8. **에이전트 실행 중 UI** — AgentRunPanel로 실행 상태 표시. 사용자가 취소할 수 있는 Cancel 버튼 포함.

---

## 의사결정

### 별도 테이블 vs prompts 확장

**채택**: `agents` 별도 테이블 생성.
**기각**: prompts 테이블에 `type` 컬럼 추가하여 skill/agent 구분.
**이유**: 에이전트는 `allowed_tools`, `max_turns` 등 스킬에 없는 컬럼이 필요하고, 실행 이력(`agent_runs`)도 별도 관리해야 한다. 테이블을 분리하면 기존 스킬 코드에 영향 없이 독립적으로 개발 가능.

### 에이전트 실행 방식

**채택**: 메인 대화에 결과를 assistant 메시지로 직접 삽입.
**기각**: 별도 임시 대화를 생성하고 링크.
**이유**: 사용자 경험상 결과가 현재 대화에 바로 보이는 것이 자연스럽다. 임시 대화 관리는 복잡성만 증가. 에이전트 내부 작업 과정은 `agent_runs` 테이블에 기록하되, 사용자에게는 최종 결과만 노출.

### 호출 방식

**채택**: v1은 수동 선택 (WelcomeScreen 칩 또는 설정).
**기각(v2 예정)**: @멘션 호출, 자동 위임 (description 기반 LLM 판단).
**이유**: 자동 위임은 LLM에 "delegate_to_agent" 도구를 추가해야 하며, 모든 프로바이더에서 tool_use 지원이 필요하다. v1은 수동 선택으로 핵심 인프라를 먼저 구축하고, v2에서 자동 위임을 추가한다.
