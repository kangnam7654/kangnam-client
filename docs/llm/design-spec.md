# Design Spec: kangnam-client 종합 개선

**입력 문서:** audit-report.md
**범위:** 보안, 에러 처리, 아키텍처, 코드 품질, UX/UI 전체 개선

---

## 목적

audit-report.md에서 식별된 49개 개선 항목(P0~P6)을 구현하여 코드베이스의 보안, 안정성, 유지보수성, 사용성을 향상시킨다.

**완료 조건:**
- 보안 점수 6.1 → 8.0+
- 테스트 커버리지 1.5 → 60%+ (핵심 경로)
- `unwrap()`/`.ok()` 남용 0건
- UX/UI 접근성 WCAG AA 충족
- 모든 기존 기능이 회귀 없이 동작

---

## 파일 변경 목록

### Rust Backend (src-tauri/)

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `tauri.conf.json` | 수정 | CSP에서 `unsafe-eval`/`unsafe-inline` 제거, `wasm-unsafe-eval` 추가; `withGlobalTauri: false` |
| `src/error.rs` | **생성** | `AppError` enum 정의 (`thiserror`) |
| `src/state.rs` | 수정 | `Mutex<Connection>` → read/write 분리; `busy_timeout` PRAGMA 추가 |
| `src/lib.rs` | 수정 | `error` 모듈 등록; `agent_loop` 모듈 등록 |
| `src/auth/manager.rs` | 수정 | `client_secret.unwrap()` → `ok_or()`; 에러 메시지에서 raw HTTP body 제거 |
| `src/auth/oauth_server.rs` | 수정 | `listener.accept()`에 120초 timeout 추가 |
| `src/auth/token_store.rs` | 수정 | access token을 keychain으로 이동 또는 메모리 전용으로 변경 |
| `src/db/connection.rs` | 수정 | `open_database()` 활용; `busy_timeout` PRAGMA 추가 |
| `src/db/schema.rs` | 수정 | `PRAGMA user_version` 기반 마이그레이션 버전 관리; CHECK constraints 추가 |
| `src/db/conversations.rs` | 수정 | `unwrap()` → `Result` + `?`; `.ok()` → 에러 로깅; `toggle_pin` 단일 SQL |
| `src/db/skills.rs` | 수정 | `unwrap()` → `Result` + `?` |
| `src/db/eval.rs` | **생성** | `commands/eval.rs`의 인라인 SQL을 DB 레이어로 분리 |
| `src/commands/chat.rs` | 수정 | 에이전트 루프를 `agent_loop.rs`로 추출 |
| `src/commands/cowork.rs` | 수정 | 재귀 → 반복 루프; `agent_loop.rs` 활용; `cowork_follow_up` 제거 |
| `src/commands/eval.rs` | 수정 | SQL → `db/eval.rs` 위임; 배경 커넥션에 PRAGMA 적용 |
| `src/commands/settings.rs` | 수정 | `serde_json::Value` → typed `PartialSettings` struct |
| `src/commands/agent_loop.rs` | **생성** | `chat.rs`와 `cowork.rs`의 공통 에이전트 루프 추출 |
| `src/commands/mcp.rs` | 수정 | MCP stdio `command` 검증 로직 추가 |
| `src/providers/streaming.rs` | **생성** | 공통 SSE 스트리밍 추상화 |
| `src/providers/claude.rs` | 수정 | `streaming.rs` 활용 |
| `src/providers/codex.rs` | 수정 | `streaming.rs` 활용 |
| `src/providers/copilot.rs` | 수정 | `streaming.rs` 활용 |
| `src/providers/gemini.rs` | 수정 | `streaming.rs` 활용 |
| `src/providers/antigravity.rs` | 수정 | `streaming.rs` 활용 |
| `src/providers/router.rs` | 수정 | `create_fresh` 팩토리 중복 제거 |

### Frontend (src/renderer/)

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `main.tsx` | 수정 | Electron 조건부 가드 제거 |
| `App.tsx` | 수정 | `.then()` → `.then().catch()` |
| `stores/app-store.ts` | 수정 | 도메인별 슬라이스 분리 (auth, chat, eval, cowork, ui) |
| `hooks/use-assistant-runtime.ts` | 수정 | `.catch()` 추가; optimistic message 헬퍼 추출 |
| `lib/tauri-api.ts` | 수정 | Electron 주석 제거; IPC 반환값 검증 (선택적 Zod) |
| `lib/providers.ts` | 수정 | `PROVIDERS` deprecated 제거; `description` 필드 추가 |
| `lib/utils.ts` | 수정 | `fileToDataUrl` 추가 |
| `components/shared/Starburst.tsx` | **생성** | 공유 Starburst SVG 컴포넌트 |
| `components/chat/WelcomeScreen.tsx` | **생성** | `ChatView.tsx`에서 분리 |
| `components/chat/ChatView.tsx` | 수정 | WelcomeScreen 분리; disabled 버튼 스타일; 파일 크기 검증 |
| `components/chat/AssistantThread.tsx` | 수정 | `fileToDataUrl`/`Starburst` 임포트; 도구 이름 포맷팅; 코드 블록 복사 버튼 |
| `components/sidebar/ConversationList.tsx` | 수정 | 제목 tooltip 추가 |
| `components/sidebar/SearchPanel.tsx` | 수정 | 로딩 스피너 추가 |
| `components/settings/SettingsPanel.tsx` | 수정 | 테마 토글 추가; ESC 닫기; 반응형 너비; 포커스 트랩 |
| `styles/globals.css` | 수정 | `--text-muted` 색상 대비 수정; 포커스 링 스타일 |

### Sidecar

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `sidecar/mcp-bridge.ts` | 수정 | `command` 검증 로직; `env` 보안 키 필터링 |

### 인프라

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `.github/workflows/ci.yml` | **생성** | PR 트리거 CI (cargo test, clippy, tsc, npm test) |
| `.github/workflows/release.yml` | 수정 | `cargo test` 단계 추가 |
| `eslint.config.mjs` | **생성** | ESLint 설정 |
| `vitest.config.ts` | **생성** | Vitest 설정 |
| `package.json` | 수정 | test/lint 스크립트 추가; `@modelcontextprotocol/sdk` 제거 |

---

## 구현 순서

### Step 1: 보안 수정 (S1~S6)

1-1. `tauri.conf.json` — CSP 수정
- `script-src` 변경: `'self' 'unsafe-eval' 'unsafe-inline'` → `'self' 'wasm-unsafe-eval'`
- `withGlobalTauri` 변경: `true` → `false`

1-2. `auth/oauth_server.rs` — OAuth timeout
- `wait_for_oauth_callback()`: `tokio::time::timeout(Duration::from_secs(120), ...)` 래핑
- 타임아웃 시 `Err("OAuth login timed out after 120 seconds")` 반환

1-3. `auth/manager.rs` — unwrap→ok_or, 에러 메시지 정리
- `GEMINI.client_secret.unwrap()` → `.ok_or("Gemini client secret not configured")?`
- `ANTIGRAVITY.client_secret.unwrap()` → `.ok_or("Antigravity client secret not configured")?`
- `token_resp.text()` 에러 → HTTP status만 반환, body 미포함

1-4. `ChatView.tsx` — ChatErrorBoundary에서 `error.stack` DOM 렌더 제거
- `<pre>{this.state.error.stack}</pre>` → `<p>Something went wrong. Please restart the conversation.</p>`
- `console.error` 로 stack trace 출력 유지

1-5. `commands/mcp.rs` — MCP command 검증
- `transport_type` 검증: `["stdio", "http", "sse"]` 중 하나
- `stdio` command: 빈 문자열 거부

1-6. `sidecar/mcp-bridge.ts` — env 보안 필터링
- `config.env`에서 `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` 키 제거

### Step 2: 에러 아키텍처 (C1~C5)

2-1. `error.rs` 생성 — `AppError` enum
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Auth error: {0}")]
    Auth(String),
    #[error("Provider error: {0}")]
    Provider(String),
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("MCP error: {0}")]
    Mcp(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Not found: {0}")]
    NotFound(String),
}

impl From<AppError> for String {
    fn from(e: AppError) -> String {
        e.to_string()
    }
}
```

2-2. `db/conversations.rs` — `unwrap()` 제거
- 모든 `prepare().unwrap()` → `prepare()?`
- 모든 `query_map().unwrap()` → `query_map()?`
- 함수 반환 타입: `Vec<T>` → `Result<Vec<T>, rusqlite::Error>`
- `.ok()` → `map_err(|e| log::warn!("DB error: {e}"))` 또는 `?` 전파

2-3. `db/skills.rs` — 동일 패턴 적용

2-4. `commands/*.rs` — `AppError` 활용
- DB 함수 호출 결과 `?` 전파 (Tauri command는 `Result<T, String>` 반환하므로 `AppError → String` 변환)

2-5. Frontend `.catch()` 추가
- `App.tsx`: `window.api.auth.status().then(setAuthStatuses).catch(console.error)`
- `use-assistant-runtime.ts`: `onCancel`에서 `catch()` 추가

### Step 3: DB 개선 (A2, A6, A7)

3-1. `db/schema.rs` — 마이그레이션 버전 관리
```rust
fn get_schema_version(conn: &Connection) -> i32 {
    conn.pragma_query_value(None, "user_version", |row| row.get(0)).unwrap_or(0)
}
fn set_schema_version(conn: &Connection, version: i32) {
    conn.pragma_update(None, "user_version", version).ok();
}
```
- 기존 `ALTER TABLE` → 버전 조건부 실행
- CHECK constraints 추가: `role IN ('user','assistant','system','tool')`, `type IN ('stdio','sse','http')`

3-2. `state.rs` — 커넥션 개선
- `busy_timeout` PRAGMA 추가: `conn.pragma_update(None, "busy_timeout", "5000")?`
- `db/connection.rs`의 `open_database()` 활용

3-3. `db/eval.rs` 생성
- `commands/eval.rs`에서 SQL 관련 함수 추출

3-4. `commands/eval.rs` — 배경 커넥션 PRAGMA
- `Connection::open(&db_path)` → `db::connection::open_database(&db_path)`

### Step 4: 아키텍처 리팩토링 (A1, A3, A4, A5)

4-1. `providers/streaming.rs` — SSE 스트리밍 추상화
```rust
pub struct StreamProcessor {
    abort: Arc<AtomicBool>,
    tx: mpsc::Sender<StreamEvent>,
}

impl StreamProcessor {
    pub async fn process_sse_stream<F>(
        &self,
        response: reqwest::Response,
        parse_event: F,
    ) -> Result<SendResult, String>
    where
        F: Fn(&str, &str) -> Option<ParsedEvent>,
    {
        // 공통: 버퍼 관리, tokio::select! abort, SSE 라인 파싱
        // provider별: parse_event 콜백으로 메시지 포맷 처리
    }
}

pub enum ParsedEvent {
    Token(String),
    Thinking(String),
    ToolCall(ToolCall),
    Done(StopReason),
    Skip,
}
```

4-2. 각 provider — `streaming.rs` 활용
- `send_message()`에서 HTTP 요청 구성 + `StreamProcessor::process_sse_stream()` 호출
- provider별 `parse_event` 클로저만 구현

4-3. `commands/agent_loop.rs` — 공통 에이전트 루프
```rust
pub struct AgentLoopConfig {
    pub max_iterations: usize,
    pub on_tool_call: Box<dyn Fn(&ToolCall) + Send>,
    pub on_tool_result: Box<dyn Fn(&str, &str) + Send>,
}

pub async fn run_agent_loop(
    provider: Arc<dyn LLMProvider>,
    messages: &mut Vec<ChatMessage>,
    tools: &[ToolDefinition],
    access_token: &str,
    mcp: &McpBridge,
    config: AgentLoopConfig,
) -> Result<(), String> {
    // 공통: tool call → MCP execute → result push → 재전송 루프
}
```

4-4. `stores/app-store.ts` — 슬라이스 분리
- `useAuthStore` — authStatuses, activeProvider, activeModel
- `useChatStore` — messages, streaming, toolCallLog, contextUsage
- `useUIStore` — sidebar, settings, theme, devMode, showSearch
- `useEvalStore` — eval 관련 전체
- `useCoworkStore` — cowork 관련 전체

4-5. `router.rs` — `create_fresh` 팩토리 통합
```rust
type ProviderFactory = Box<dyn Fn() -> Arc<dyn LLMProvider> + Send + Sync>;

pub struct LLMRouter {
    providers: HashMap<String, Arc<dyn LLMProvider>>,
    factories: HashMap<String, ProviderFactory>,
}
```

### Step 5: 코드 품질 (Q1~Q9)

5-1. `lib/utils.ts` — `fileToDataUrl` 추가
5-2. `components/shared/Starburst.tsx` — 공유 컴포넌트 생성
5-3. `components/chat/WelcomeScreen.tsx` — ChatView에서 분리
5-4. `main.tsx` — `__TAURI_INTERNALS__` 가드 + Electron 주석 제거
5-5. `tauri-api.ts` — Electron 주석 제거
5-6. `providers.ts` — `PROVIDERS` deprecated export 제거, `ALL_PROVIDERS` 직접 사용
5-7. `commands/cowork.rs` — `cowork_follow_up` 커맨드 제거; 재귀 → 반복 루프
5-8. `package.json` — `@modelcontextprotocol/sdk` 루트에서 제거

### Step 6: UX/UI 개선 (U1~U12)

6-1. `SettingsPanel.tsx` — General 탭에 테마 토글 추가
```tsx
<div style={{ display: 'flex', gap: 8 }}>
  {(['light', 'dark'] as const).map(t => (
    <button key={t} onClick={() => setTheme(t)}
      style={{
        padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
        border: theme === t ? '2px solid var(--accent)' : '1px solid var(--border)',
        background: theme === t ? 'var(--accent-soft)' : 'transparent',
        color: 'var(--text-primary)', textTransform: 'capitalize',
      }}>
      {t === 'dark' ? 'Dark' : 'Light'}
    </button>
  ))}
</div>
```

6-2. `SettingsPanel.tsx` — ESC 닫기 + 포커스 트랩 + 반응형
- `useEffect`로 `Escape` 키 핸들러 추가
- 모달 `width: 720` → `width: 'min(90vw, 720px)'`

6-3. `globals.css` — 접근성 수정
- `--text-muted: #727272` → `--text-muted: #8a8a8a` (WCAG AA 4.5:1 충족)
- 포커스 링: `*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`

6-4. `SearchPanel.tsx` — 로딩 스피너
- loading 상태에 SVG 스피너 + "Searching..." 텍스트

6-5. `ChatView.tsx` — 파일 크기 검증 (25MB 제한)
- `handleFileSelect`에 크기 체크 + 에러 상태

6-6. `AssistantThread.tsx` — 코드 블록 복사 버튼
- `CodeBlock` 컴포넌트에 "Copy" 버튼 추가 (hover 시 표시)
- `navigator.clipboard.writeText(code)` + 2초 피드백

6-7. `AssistantThread.tsx` — 도구 이름 포맷팅
- `formatToolName`: `list_files` → `List Files` (snake_case → Title Case)

6-8. `ConversationList.tsx` — tooltip
- truncated 제목에 `title={conv.title}` 추가

6-9. `ChatView.tsx` — disabled 버튼 스타일
- disabled 시 `background: var(--bg-hover)` + `opacity: 0.5`

6-10. 전체 컴포넌트 — `aria-label` 추가
- 아이콘 전용 버튼: sidebar toggle, search, settings, new chat, close, menu

### Step 7: 테스트 + CI (T1~T6, R1~R4)

7-1. `package.json` — Vitest + ESLint 설치
```json
"scripts": {
  "test": "vitest run",
  "lint": "eslint src/"
},
"devDependencies": {
  "vitest": "^3.x",
  "eslint": "^9.x",
  "@eslint/js": "^9.x",
  "typescript-eslint": "^8.x"
}
```

7-2. 프론트엔드 테스트 작성
- `lib/providers.test.ts` — `estimateTokens`, `getVisibleProviders`
- `lib/utils.test.ts` — `cn`, `fileToDataUrl`

7-3. Rust 테스트 추가
- `db/conversations.rs` — CRUD, search, auto_title truncation
- `auth/token_store.rs` — save/get round-trip
- `providers/streaming.rs` — SSE 파싱 단위 테스트

7-4. `.github/workflows/ci.yml` 생성
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: sudo apt-get install -y libwebkit2gtk-4.1-dev libssl-dev
      - run: cd src-tauri && cargo test
      - run: cd src-tauri && cargo clippy -- -D warnings
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

7-5. `.DS_Store` git 추적 제거 (커밋 시 포함)

---

## 함수/API 시그니처

### 신규 생성

```rust
// src/error.rs
pub enum AppError {
    Auth(String),
    Provider(String),
    Db(rusqlite::Error),  // From<rusqlite::Error>
    Mcp(String),
    Validation(String),
    NotFound(String),
}
impl From<AppError> for String;

// src/providers/streaming.rs
pub struct StreamProcessor {
    pub abort: Arc<AtomicBool>,
    pub tx: mpsc::Sender<StreamEvent>,
}
impl StreamProcessor {
    pub fn new(abort: Arc<AtomicBool>, tx: mpsc::Sender<StreamEvent>) -> Self;
    pub async fn process_sse_stream<F>(&self, response: Response, parse_event: F) -> Result<SendResult, String>
    where F: Fn(&str, &str) -> Option<ParsedEvent>;
}
pub enum ParsedEvent { Token(String), Thinking(String), ToolCall(ToolCall), Done(StopReason), Skip }

// src/commands/agent_loop.rs
pub async fn run_agent_loop(
    provider: Arc<dyn LLMProvider>,
    messages: &mut Vec<ChatMessage>,
    tools: &[ToolDefinition],
    access_token: &str,
    model: Option<&str>,
    reasoning_effort: Option<&str>,
    mcp: &McpBridge,
    app: &AppHandle,
    conv_id: &str,
    event_prefix: &str,  // "chat" or "cowork"
) -> Result<(), String>;

// src/db/eval.rs
pub fn list_eval_sets(conn: &Connection, skill_id: &str) -> Result<Vec<EvalSet>>;
pub fn get_eval_set(conn: &Connection, set_id: &str) -> Result<Option<EvalSet>>;
pub fn create_eval_set(conn: &Connection, skill_id: &str, name: &str) -> Result<String>;
pub fn list_eval_cases(conn: &Connection, set_id: &str) -> Result<Vec<EvalCase>>;
pub fn create_eval_run(conn: &Connection, run: &EvalRun) -> Result<String>;
pub fn update_eval_run(conn: &Connection, run_id: &str, updates: &EvalRunUpdate) -> Result<()>;
pub fn create_eval_result(conn: &Connection, result: &EvalResult) -> Result<String>;
pub fn update_eval_result(conn: &Connection, result_id: &str, updates: &EvalResultUpdate) -> Result<()>;

// src/db/schema.rs (추가)
fn get_schema_version(conn: &Connection) -> i32;
fn set_schema_version(conn: &Connection, version: i32);
```

### 시그니처 변경

```rust
// db/conversations.rs — 기존: Vec<T> 직접 반환 → 변경: Result 반환
pub fn list_conversations(conn: &Connection) -> Result<Vec<Conversation>, rusqlite::Error>;
pub fn get_messages(conn: &Connection, conv_id: &str) -> Result<Vec<Message>, rusqlite::Error>;
pub fn search_messages(conn: &Connection, query: &str) -> Result<Vec<SearchResult>, rusqlite::Error>;
pub fn create_conversation(conn: &Connection, ...) -> Result<String, rusqlite::Error>;
pub fn delete_conversation(conn: &Connection, id: &str) -> Result<(), rusqlite::Error>;
pub fn toggle_pin(conn: &Connection, id: &str) -> Result<bool, rusqlite::Error>;

// db/skills.rs — 동일 패턴
pub fn list_skills(conn: &Connection) -> Result<Vec<Skill>, rusqlite::Error>;
pub fn get_skill(conn: &Connection, id: &str) -> Result<Option<Skill>, rusqlite::Error>;
pub fn create_skill(conn: &Connection, ...) -> Result<String, rusqlite::Error>;

// auth/manager.rs — 기존: unwrap() → 변경: Result 전파
pub async fn start_gemini_oauth(...) -> Result<(), String>;  // 내부 client_secret.ok_or()
pub async fn start_antigravity_oauth(...) -> Result<(), String>;  // 동일

// providers/router.rs — create_fresh 통합
pub fn create_fresh(&self, name: &str) -> Option<Arc<dyn LLMProvider>>;  // 팩토리 활용
```

### Frontend

```typescript
// stores/app-store.ts → 5개 슬라이스로 분리
export const useAuthStore = create<AuthStore>(...);
export const useChatStore = create<ChatStore>(...);
export const useUIStore = create<UIStore>(...);
export const useEvalStore = create<EvalStore>(...);
export const useCoworkStore = create<CoworkStore>(...);

// 하위호환: 기존 useAppStore 유지 (5개 슬라이스 re-export)
// 각 컴포넌트는 점진적으로 개별 슬라이스로 마이그레이션

// lib/utils.ts (추가)
export function fileToDataUrl(file: File): Promise<string>;

// components/shared/Starburst.tsx (신규)
export function Starburst(props: { size?: number; color?: string; animated?: boolean }): JSX.Element;
```

---

## 제약 조건

1. 기존 Tauri IPC 커맨드명과 이벤트명을 변경하지 마라. Frontend↔Backend 인터페이스 유지.
2. DB 스키마 변경은 backward-compatible 해야 한다 (ADD COLUMN만, DROP/RENAME 금지).
3. 기존 preset skills JSON(`data/preset-skills.json`) 구조를 변경하지 마라.
4. Zustand 슬라이스 분리 시 기존 `useAppStore` 셀렉터 패턴이 깨지지 않도록 하위호환 유지.
5. SSE 스트리밍 추상화 시 각 provider의 응답 포맷 차이를 `parse_event` 콜백으로 분리하라.
6. `thiserror` crate는 이미 `Cargo.toml`에 있으므로 별도 추가 불필요.
7. PKCE, OAuth flow의 로직 자체는 수정하지 마라. 에러 처리만 개선.
8. `ChatErrorBoundary`의 `error.stack`을 `console.error`로만 출력하고 DOM에서 제거.

---

## 의사결정

| 결정 | 채택 방안 | 기각 대안 | 기각 이유 |
|------|----------|----------|----------|
| 커넥션 관리 | read/write 분리 + `busy_timeout` | `r2d2-sqlite` 풀 | 데스크톱 앱에 풀은 과잉; read 전용 커넥션 1개면 충분 |
| 에러 타입 | `thiserror` enum + `From<AppError> for String` | `anyhow` | Tauri command가 `String` 에러를 요구하므로 구조화된 enum이 적합 |
| 스토어 분리 | Zustand 5개 슬라이스 + 하위호환 re-export | Redux Toolkit | 이미 Zustand 사용 중; 마이그레이션 비용 불필요 |
| SSE 추상화 | `StreamProcessor` + `parse_event` 콜백 | 매크로 기반 추상화 | 콜백이 더 명시적이고 디버깅 용이 |
| Access token 저장 | 메모리 전용 캐시 (AuthManager 내부 HashMap) | OS keychain (access + refresh 모두) | keychain 호출 빈도 증가로 성능 이슈; access token은 단명이므로 메모리 충분 |
| 마이그레이션 | `PRAGMA user_version` | 별도 `schema_migrations` 테이블 | SQLite 내장 기능으로 충분 |
| CSP | `wasm-unsafe-eval` (Shiki WASM용) | nonce 기반 | Tauri 2 WebView에서 nonce 주입이 복잡; `wasm-unsafe-eval`이 실용적 |
