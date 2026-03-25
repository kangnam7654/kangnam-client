# Design Spec: kangnam-client 종합 개선

**Date:** 2026-03-25
**입력:** audit-report.md (42개 항목, P0~P3)
**범위:** UX/UI + 아키텍처 + DB + 보안 + 테스트 전면 개선

---

## 목적

쓰이지 않는 버튼, 어색한 UI, 데드 코드를 정리하고, CSS 토큰 체계를 수립하며, 아키텍처/DB/보안/테스트 인프라를 개선하여 코드베이스 전반의 품질을 베이스라인 5.83에서 8.0 이상으로 끌어올린다.

**완료 조건:**
- P0 6건 전부 해결 (데드 버튼/코드 제거, 삭제 확인, 하드코딩 텍스트)
- P1 14건 전부 해결 (CSS 토큰, 접근성, 색상 일관성)
- P2 9건 전부 해결 (SettingsPanel 분할, Zustand 슬라이스 등)
- P3 14건 전부 해결 (DB 인덱스, FTS5, 보안, 테스트 환경)
- 기존 테스트 전체 통과 (회귀 없음)

---

## 구현 순서 (6단계)

### 단계 1: 데드 코드 정리 + 즉시 UX 수정 (P0)

| # | 작업 | 대상 파일 | 변경 내용 |
|---|------|----------|----------|
| 1 | 데드 컴포넌트 삭제 | `sidebar/ModelSelector.tsx` | 파일 삭제 |
| 2 | 데드 컴포넌트 삭제 | `sidebar/ProviderSelector.tsx` | 파일 삭제 |
| 3 | 데드 컴포넌트 삭제 | `sidebar/ReasoningSelector.tsx` | 파일 삭제 |
| 4 | 빈 ui 디렉토리 삭제 | `components/ui/` | 디렉토리 삭제 |
| 5 | CoworkView 홈뷰 "+" 버튼 제거 | `cowork/CoworkView.tsx:289-301` | 파일 첨부 버튼 JSX 삭제 (Cowork은 파일 첨부 미지원) |
| 6 | CoworkView 채팅뷰 "+" 버튼 제거 | `cowork/CoworkView.tsx:438-450` | 동일 |
| 7 | TopBar "U" 아바타에 onClick 연결 | `chat/ChatView.tsx:102-106` | `onClick={() => useAppStore.getState().setShowSettings(true)}` 추가 |
| 8 | 대화 삭제 확인 다이얼로그 | `sidebar/ConversationList.tsx:27-35` | `if (!confirm('이 대화를 삭제하시겠습니까?')) return` 추가 |
| 9 | "User / Free plan" 텍스트 수정 | `sidebar/Sidebar.tsx:134-139` | "User" → "Settings", "Free plan" 행 제거 |

### 단계 2: CSS 토큰 + 접근성 + 색상 일관성 (P1)

| # | 작업 | 대상 파일 | 변경 내용 |
|---|------|----------|----------|
| 10 | CSS status 토큰 추가 | `styles/globals.css` | dark: `--warning: #fbbf24; --info: #60a5fa; --success-text: #34d399; --danger-text: #f87171;` light: 적절한 대비값 |
| 11 | --text-muted 대비 수정 | `styles/globals.css` | dark: `#8a8a8a`→`#9a9a9a`, light: `#999`→`#767676` |
| 12 | --accent 대비 수정 | `styles/globals.css` | dark: `#d97757`→`#e08060`, light 동일 비율 조정 |
| 13 | AssistantThread 하드코딩 색상 교체 | `chat/AssistantThread.tsx` | L155,166,200,353,361,379의 `#f87171`→`var(--danger-text)`, L484 `#1a1a1a`→`var(--bg-code)` |
| 14 | Eval 컴포넌트 하드코딩 색상 교체 | `eval/EvalRunner.tsx`, `EvalBenchmark.tsx`, `EvalSetEditor.tsx`, `EvalResultsViewer.tsx`, `DescriptionOptimizer.tsx` | 42+ 인스턴스를 CSS 변수로 교체 |
| 15 | SettingsPanel 하드코딩 색상 교체 | `settings/SettingsPanel.tsx` | grade/compare 색상을 CSS 변수로 교체 |
| 16 | Prettify 버튼 텍스트 수정 | `settings/SettingsPanel.tsx:444,612` | `{ }` → `{'{ }'}` |
| 17 | ErrorBoundary 복구 버튼 | `chat/ChatView.tsx:10-26` | "Start new conversation" 버튼 추가 |
| 18 | Send 버튼 크기 통일 | `cowork/CoworkView.tsx:310-314` | width/height 40→36 |
| 19 | ChatSearchBar aria-label | `chat/ChatSearchBar.tsx:161-208` | 3개 버튼에 aria-label 추가 |
| 20 | CoworkView composer border | `cowork/CoworkView.tsx:419` | `rgba(255,255,255,0.06)` → `var(--border-subtle)` |
| 21 | hover:text-white 수정 | `cowork/CoworkView.tsx:521`, `cowork/ProgressPanel.tsx:106` | → `hover:text-[var(--text-primary)]` |
| 22 | Sidebar JS hover → CSS | `sidebar/Sidebar.tsx:62-63,87-88,112-113,170-177` | onMouseEnter/Leave → Tailwind `hover:bg-[var(--bg-hover)]` |
| 23 | Export 완료 피드백 | `sidebar/ConversationList.tsx:273,282` | export 후 alert 또는 토스트 |

### 단계 3: 프론트엔드 아키텍처 (P2)

| # | 작업 | 대상 파일 | 변경 내용 |
|---|------|----------|----------|
| 24 | SettingsPanel 분할 (ADR-001) | `settings/SettingsPanel.tsx` | → 셸 (<150줄) + `tabs/ProvidersTab.tsx`, `MCPTab.tsx`, `PromptsTab.tsx`, `GeneralTab.tsx` + `types.ts` + `index.ts` |
| 25 | PROVIDER_INFO 중복 제거 | `settings/tabs/ProvidersTab.tsx` | `ALL_PROVIDERS` from `lib/providers.ts` 사용 |
| 26 | getState().devMode 수정 | `settings/tabs/ProvidersTab.tsx` | `useAppStore.getState().devMode` → `useAppStore(s => s.devMode)` |
| 27 | Zustand 슬라이스 분할 (ADR-010) | `stores/app-store.ts` | → 7개 슬라이스 + 결합 store (~40줄) + persist 미들웨어 |
| 28 | StopButton/onCancel 통합 | `chat/AssistantThread.tsx`, `hooks/use-assistant-runtime.ts` | 중복 로직 제거 |
| 29 | WelcomeScreen rAF hack 제거 | `chat/WelcomeScreen.tsx:113` | 이벤트 기반 동기화로 교체 |
| 30 | EvalWorkbench 조건부 마운트 | `App.tsx:71` | `{showEval && <EvalWorkbench />}` |
| 31 | 터치 타겟 확대 | 다수 컴포넌트 | 최소 24px, 이상적 32px+ |
| 32 | img alt 수정 | `chat/AssistantThread.tsx:723` | `alt=""` → `alt={att.file.name}` |

### 단계 4: Rust 백엔드 아키텍처 (P3)

| # | 작업 | 대상 파일 | 변경 내용 |
|---|------|----------|----------|
| 33 | 마이그레이션 시스템 (ADR-003) | `db/schema.rs` | `_migrations` 테이블 + 버전 기반 실행 엔진 |
| 34 | DB 인덱스 추가 (ADR-002) | `db/schema.rs` V002 | 3개 인덱스 |
| 35 | FTS5 검색 (ADR-002) | `db/schema.rs` V003 + `db/conversations.rs` | messages_fts + 트리거 + MATCH 전환 |
| 36 | CHECK 트리거 | `db/schema.rs` V004 | role, status, type 검증 |
| 37 | updated_at 트리거 | `db/schema.rs` V005 | 자동 갱신 |
| 38 | busy_timeout 증가 | `db/connection.rs` | 5000 → 10000 |
| 39 | Connection Pool (ADR-004) | `state.rs`, `commands/*.rs` | `Mutex<Connection>` → `r2d2::Pool` (max_size=4) |
| 40 | AppError 통합 (ADR-005) | `error.rs`, `commands/*.rs` | `Result<T, AppError>` 전환 |
| 41 | cowork 재귀→반복문 (ADR-006) | `commands/cowork.rs` | loop + continue 패턴 |
| 42 | unwrap() 제거 | `auth/manager.rs` | 5건 → `.ok_or()?` |
| 43 | JSON.parse 보호 | SettingsPanel MCPTab | try/catch + setAddError |
| 44 | loadData 에러 처리 | SettingsPanel | Promise.all + try/catch |

### 단계 5: 보안 (P3)

| # | 작업 | 대상 파일 | 변경 내용 |
|---|------|----------|----------|
| 45 | access_token 키체인 (ADR-007) | `auth/token_store.rs` | keyring 저장 + SQLite sentinel |
| 46 | CSP 강화 (ADR-008) | `tauri.conf.json` | `'wasm-unsafe-eval'` 전환, Shiki 번들 빌더 |
| 47 | withGlobalTauri 비활성화 | `tauri.conf.json` | `false` |
| 48 | MCP SSRF 검증 (ADR-009) | `sidecar/mcp-bridge.ts` | URL 블록리스트 + env 허용리스트 |
| 49 | OAuth read timeout | `auth/oauth_server.rs` | `set_read_timeout(10s)` |

### 단계 6: 테스트 인프라 (P3)

| # | 작업 | 대상 파일 | 변경 내용 |
|---|------|----------|----------|
| 50 | Vitest jsdom 환경 | `vitest.config.ts` | `'node'` → `'jsdom'` |
| 51 | @testing-library 설치 | `package.json` | devDependency 추가 |
| 52 | SSE 파서 테스트 | `providers/sse.rs` | 8+ 테스트 케이스 |
| 53 | DB skills 테스트 | `db/skills.rs` | CRUD 통합 테스트 |
| 54 | CI clippy 강제 | `.github/workflows/ci.yml` | `continue-on-error` 제거 |

---

## 함수/API 시그니처 변경

### Rust

```rust
// state.rs
pub struct AppState {
    pub db: r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>,  // WAS: Mutex<Connection>
}

// error.rs
#[derive(Debug, Serialize)]
pub struct AppError { pub code: String, pub message: String }

// 모든 commands: Result<T, String> → Result<T, AppError>

// db/schema.rs
fn run_versioned_migrations(conn: &mut Connection) -> Result<(), rusqlite::Error>

// db/conversations.rs
pub fn search_messages(conn: &Connection, query: &str) -> Result<Vec<SearchResult>>
// LIKE → FTS5 MATCH
```

### TypeScript

```typescript
// stores/app-store.ts
export type AppState = AuthSlice & ConversationSlice & ChatSlice
  & UISlice & PromptSlice & EvalSlice & CoworkSlice
// useAppStore 훅 시그니처 동일 (하위호환)
```

---

## 의식적 연기 항목

아래 3건은 본 개선 범위 외로, 후속 작업에서 처리한다:

| audit ID | 항목 | 연기 사유 |
|---|---|---|
| P2-2 | border-radius 토큰 시스템 | 현재 13가지 값이 사용 중이나 기능 영향 없음. 디자인 시스템 전면 도입 시 함께 처리 |
| P2-3 | spacing 토큰 시스템 | P2-2와 동일. 현재 ad-hoc 값이 시각적 문제를 일으키지 않음 |
| P3-12 | ESLint + Prettier 도입 | 빌드 파이프라인 변경이 필요하며, 기존 코드 전체 포매팅으로 git blame 이력 오염. CI clippy 강제(#54)를 우선 |

## AppError 전환 시 프론트엔드 영향 파일

단계 4에서 `Result<T, String>` → `Result<T, AppError>` 전환 시, 프론트엔드에서 에러 핸들링 패턴을 업데이트해야 하는 파일:

| 파일 | 변경 내용 |
|---|---|
| `lib/tauri-api.ts` | `invoke()` 호출의 catch 블록에서 AppError 구조 (`{ code, message }`) 파싱 추가 |
| `hooks/use-assistant-runtime.ts` | `chat.send` 에러 핸들링에서 AppError.code 기반 분기 (AbortError 등) |
| `components/settings/SettingsPanel.tsx` (→ tabs/) | `loadData`, auth connect/disconnect catch 패턴 업데이트 |
| `components/cowork/CoworkView.tsx` | cowork.start 에러 핸들링 업데이트 |
| `components/eval/EvalWorkbench.tsx` | eval 관련 IPC 에러 핸들링 |

## Shiki 언어 목록 (ADR-008 보완)

static import 대상 26개 언어 (현재 코드베이스에서 사용 중인 언어):
`javascript`, `typescript`, `tsx`, `jsx`, `python`, `rust`, `go`, `java`, `c`, `cpp`, `csharp`, `ruby`, `php`, `swift`, `kotlin`, `sql`, `html`, `css`, `json`, `yaml`, `toml`, `markdown`, `bash`, `shell`, `diff`, `plaintext`

---

## 제약 조건

1. 기존 SQLite DB와 하위호환. 마이그레이션 V001이 baseline 등록.
2. `useAppStore`, `SettingsPanel` import 경로 변경 없음 (index.ts 배럴).
3. CSS 변수 네이밍: 기존 `--{category}-{name}` 패턴 유지.
4. `npm test` + `cargo test` 전체 통과 필수.
5. 단계별 커밋. 단계 간 빌드 깨짐 불허.

---

## 의사결정

| 결정 | 채택 방안 | 기각 대안 + 이유 |
|------|----------|----------------|
| SettingsPanel 분할 | 디렉토리 기반 tabs/ | 플랫 구조 — 하위 컴포넌트 추가 시 재구성 |
| Zustand 분할 | 슬라이스 패턴 (단일 store) | 별도 store — cross-store 참조 복잡 |
| 마이그레이션 | 자체 _migrations 테이블 | refinery — Tauri 빌드 체인 통합 복잡 |
| Connection Pool | r2d2-sqlite (동기, 4개) | deadpool — async 불필요 |
| 에러 처리 | AppError (code+message) | anyhow — IPC 구조화 불가 |
| access_token | OS 키체인 (keyring) | SQLCipher — 전체 암호화 과도 |
| CSP | wasm-unsafe-eval + Shiki 번들 | Prism.js — 기존 투자 폐기 |
| SSRF | URL 블록리스트 | URL 허용리스트 — 자유도 과도 제한 |
| CHECK | BEFORE 트리거 | ALTER TABLE — FK/FTS 의존성 깨짐 |
| FTS5 | external content 모드 | standalone — 디스크 2배 |

---

## ADR 참조

- `docs/adr/ADR-001` ~ `ADR-010`: 각 아키텍처 결정 상세
- `docs/llm/db-schema-improvement.md`: DB 스키마 개선 SQL 상세
- `docs/llm/audit-report.md`: 베이스라인 점수 + 전체 발견 목록
