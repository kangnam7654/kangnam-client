# Audit Report: kangnam-client

**Date:** 2026-03-24
**Target:** kangnam-client v0.1.0 (Tauri 2 Desktop LLM Client)
**Stack:** Rust backend + React 19 frontend + Node.js MCP sidecar
**Scope:** 디자인부터 기능까지 전체 종합 진단

---

## Baseline Scores

| Category | Score | Primary Gap |
|----------|-------|-------------|
| Code Quality | 6.1 | Code duplication (5.0), Error handling (5.5), Dead code (5.5) |
| Security | 6.1 | CSP unsafe-eval/inline (4.5), MCP command injection (5.0) |
| Architecture | 7.0 | State management (6), Error architecture (6), Tech debt (5) |
| DB | 6.5 | Migration strategy (5), Connection management (6), Data integrity (6) |
| Test Coverage | 1.5 | 0 TS tests, 5 Rust tests, 0 E2E |
| Repo Health | 5.0 | Linting (2), Git hygiene (5), CI/CD (6) |
| UX/UI | 6.0 | Inline styles (85%), Accessibility gaps, Theme toggle missing |
| **Weighted Average** | **5.5** | |

---

## CTO Gate Decision: PROCEED

개선 대상이 명확하고 우선순위 확정 가능. 전체 7개 영역 모두 개선 필요.

---

## Priority-Ranked Improvement Items

### P0: Security (릴리즈 전 필수)

| # | Item | Category | Files | Impact |
|---|------|----------|-------|--------|
| S1 | CSP `unsafe-eval` + `unsafe-inline` 제거, `wasm-unsafe-eval`로 교체 | Security | `src-tauri/tauri.conf.json:31` | XSS 방어 복구 |
| S2 | MCP stdio `command` 입력 검증 + `env` 오버라이드 필터링 | Security | `sidecar/mcp-bridge.ts:82-86`, `commands/mcp.rs` | 임의 코드 실행 방지 |
| S3 | Access token을 OS keychain으로 이동 또는 메모리 전용 | Security | `auth/token_store.rs:26-29` | 토큰 유출 방지 |
| S4 | OAuth callback listener에 120초 timeout 추가 | Security | `auth/oauth_server.rs:47` | DoS/hang 방지 |
| S5 | `withGlobalTauri: false` 설정 | Security | `src-tauri/tauri.conf.json:13` | 공격 표면 축소 |
| S6 | `ChatErrorBoundary`에서 stack trace 제거 | Security | `ChatView.tsx:19` | 정보 노출 방지 |

### P1: Crash Prevention (안정성)

| # | Item | Category | Files | Impact |
|---|------|----------|-------|--------|
| C1 | `GEMINI/ANTIGRAVITY client_secret.unwrap()` → `ok_or()` | Error | `auth/manager.rs:252,330` | 런타임 panic 방지 |
| C2 | DB `unwrap()` 11개소 → `Result` 반환 + `?` 전파 | Error | `conversations.rs`, `skills.rs` | DB 오류 시 panic 방지 |
| C3 | `.ok()` 15+개소 → 명시적 에러 로깅 또는 전파 | Error | DB layer 전체 | 사일런트 실패 방지 |
| C4 | Frontend `.then()` without `.catch()` → `.catch()` 추가 | Error | `App.tsx:39`, `use-assistant-runtime.ts:303` | 프라미스 에러 누락 방지 |
| C5 | `AppError` enum 정의 (`thiserror`) + String 에러 대체 | Architecture | 전체 Rust 코드 | 구조화된 에러 처리 |

### P2: Architecture (구조 개선)

| # | Item | Category | Files | Impact |
|---|------|----------|-------|--------|
| A1 | SSE 스트리밍 추상화 추출 (5개 provider 중복 ~400줄 제거) | Tech Debt | `providers/*.rs` | 유지보수성, 코드 중복 제거 |
| A2 | `Mutex<Connection>` → 커넥션 풀 (`r2d2-sqlite`) 또는 read/write 분리 | DB/Arch | `state.rs`, `commands/*.rs` | 동시성 병목 해소 |
| A3 | Zustand 단일 스토어 → 도메인별 슬라이스 분리 | Frontend | `app-store.ts` | 불필요한 리렌더 감소 |
| A4 | `eval.rs` 인라인 SQL → `db/eval.rs` 모듈 분리 | Architecture | `commands/eval.rs` (627줄) | 레이어 분리 일관성 |
| A5 | 에이전트 루프 중복 제거 (`chat.rs` + `cowork.rs` → `agent_loop.rs`) | Tech Debt | `commands/chat.rs`, `commands/cowork.rs` | 코드 중복 제거 |
| A6 | 배경 eval 커넥션 PRAGMA 누락 수정 | DB | `commands/eval.rs:279` | FK 미적용 방지 |
| A7 | DB 마이그레이션 버전 관리 (`PRAGMA user_version`) | DB | `db/schema.rs` | 향후 마이그레이션 안전성 |

### P3: Code Quality (코드 품질)

| # | Item | Category | Files | Impact |
|---|------|----------|-------|--------|
| Q1 | `fileToDataUrl` 중복 → `lib/utils.ts`로 추출 | Duplication | `ChatView.tsx`, `AssistantThread.tsx` | 코드 중복 제거 |
| Q2 | `Starburst` SVG 중복 → 공유 컴포넌트로 추출 | Duplication | `ChatView.tsx`, `AssistantThread.tsx` | 코드 중복 제거 |
| Q3 | Optimistic user message 생성 중복 → 헬퍼 추출 | Duplication | `use-assistant-runtime.ts`, `ChatView.tsx` | 코드 중복 제거 |
| Q4 | `WelcomeScreen` 280줄 → 별도 파일로 분리 | Organization | `ChatView.tsx:193-474` | 가독성 |
| Q5 | Electron 잔재 제거 (주석, `__TAURI_INTERNALS__` 가드) | Dead Code | `main.tsx`, `tauri-api.ts` | 혼동 방지 |
| Q6 | `cowork_follow_up` 미완성 커맨드 제거 또는 완성 | Dead Code | `commands/cowork.rs:120-132` | 데드 코드 정리 |
| Q7 | `@modelcontextprotocol/sdk` 루트 package.json에서 제거 | Dependencies | `package.json:34` | 번들 크기 감소 |
| Q8 | IPC 반환값 Zod 검증 추가 | Type Safety | `tauri-api.ts` | 런타임 타입 안전성 |
| Q9 | `prompts`/`skills` 네이밍 통일 | Naming | 전체 | 인지 부하 감소 |

### P4: Testing (테스트)

| # | Item | Category | Files | Impact |
|---|------|----------|-------|--------|
| T1 | Vitest 설치 + test 스크립트 추가 | Test Infra | `package.json` | TS 테스트 인프라 |
| T2 | `estimateTokens`, `getVisibleProviders` 단위 테스트 | Test | `lib/providers.ts` | 순수 함수 테스트 |
| T3 | `db/conversations.rs` 통합 테스트 (CRUD, search, truncation) | Test | `db/conversations.rs` | DB 회귀 방지 |
| T4 | `auth/token_store.rs` 라운드트립 테스트 | Test | `auth/token_store.rs` | 토큰 저장 검증 |
| T5 | CI에 `cargo test` + `npm test` + `tsc --noEmit` 추가 | CI/CD | `.github/workflows/` | 자동화된 검증 |
| T6 | PR 트리거 CI 워크플로우 추가 | CI/CD | `.github/workflows/ci.yml` | 커밋별 검증 |

### P5: Repo Health

| # | Item | Category | Files | Impact |
|---|------|----------|-------|--------|
| R1 | ESLint 설치 + 설정 | Linting | `eslint.config.mjs`, `package.json` | 코드 일관성 |
| R2 | `cargo clippy` CI 추가 | Linting | `.github/workflows/` | Rust 안티패턴 감지 |
| R3 | `.DS_Store` git 추적 제거 | Git | `.DS_Store` | 불필요한 파일 제거 |
| R4 | `settings_set` raw `serde_json::Value` → typed struct | Type Safety | `commands/settings.rs:67-83` | 설정 주입 방지 |

### P6: UX/UI (디자인 개선)

| # | Item | Category | Files | Impact |
|---|------|----------|-------|--------|
| U1 | 테마 토글 UI 추가 (Settings > General) | UX | `SettingsPanel.tsx` | 사용자가 테마 변경 가능 |
| U2 | WCAG AA 색상 대비 수정 (`--text-muted` #727272 → #8a8a8a+) | A11y | `globals.css` | 접근성 |
| U3 | 모든 아이콘 버튼에 `aria-label` 추가 | A11y | 전체 컴포넌트 | 스크린 리더 지원 |
| U4 | 포커스 링 + 포커스 트랩 (Settings 모달) | A11y | `SettingsPanel.tsx`, 전체 | 키보드 접근성 |
| U5 | Settings 모달 반응형 (`width: min(90vw, 720px)`) | Responsive | `SettingsPanel.tsx` | 작은 화면 지원 |
| U6 | 검색 로딩 스피너 추가 | UX | `SearchPanel.tsx` | 피드백 |
| U7 | 파일 첨부 크기 검증 + 에러 메시지 | UX | `ChatView.tsx` | 사일런트 실패 방지 |
| U8 | 코드 블록 복사 버튼 추가 | UX | `AssistantThread.tsx` | 사용 편의 |
| U9 | 대화 목록 truncated 제목에 tooltip 추가 | UX | `ConversationList.tsx` | 가독성 |
| U10 | 도구 이름 포맷팅 (`list_files` → `List Files`) | Polish | `AssistantThread.tsx` | 시각적 품질 |
| U11 | disabled 버튼 스타일 개선 | UX | `ChatView.tsx` | 상태 명확성 |
| U12 | 인라인 스타일 정리 → Tailwind 클래스 + 공유 스타일 상수 | Maintainability | 전체 컴포넌트 | 유지보수성 |

---

## Improvement Scope (Design Phase Input)

### 필수 실행 (P0-P2)
- **Security 6건**: CSP, MCP 검증, 토큰 저장, OAuth timeout, globalTauri, stack trace
- **Crash Prevention 5건**: unwrap→Result, .ok()→로깅, .catch() 추가, AppError enum
- **Architecture 7건**: SSE 추상화, 커넥션 풀, Zustand 분리, eval 모듈 분리, 에이전트 루프 통합, PRAGMA 수정, 마이그레이션 버전

### 권장 실행 (P3-P6)
- **Code Quality 9건**: 중복 제거, 데드 코드, 타입 안전성
- **Testing 6건**: Vitest 설치, 핵심 테스트, CI 개선
- **Repo Health 4건**: ESLint, clippy, .DS_Store, settings 타입
- **UX/UI 12건**: 테마 토글, 접근성, 반응형, 사용성 개선

### Design Phase 서브-루프 실행 계획
| audit 결과 | design-loop 실행 |
|---|---|
| 아키텍처/DB 개선 필요 | architecture-loop 실행 |
| UX/UI 개선 필요 | ux-ui-loop 실행 |
| **결론: 둘 다 실행** | |

---

## Key Files Reference

### Backend (src-tauri/src/)
- `state.rs` — AppState, Mutex<Connection>
- `auth/manager.rs` (876 LOC) — 5 OAuth flows, unwrap() 위험
- `auth/token_store.rs` — 토큰 저장 (plaintext SQLite)
- `auth/oauth_server.rs` — OAuth callback listener (no timeout)
- `auth/credentials.rs` — OAuth client IDs
- `providers/*.rs` — 5 LLM providers (SSE 중복)
- `providers/router.rs` — Provider registry
- `providers/types.rs` — LLMProvider trait
- `db/schema.rs` — Schema + migrations (no versioning)
- `db/connection.rs` — open_database() (unused)
- `db/conversations.rs` — CRUD (unwrap(), .ok())
- `db/skills.rs` — Skills CRUD
- `commands/chat.rs` (367 LOC) — Agent loop, mixed concerns
- `commands/cowork.rs` — Cowork loop (recursive, duplicated)
- `commands/eval.rs` (627 LOC) — Inline SQL, background connection
- `commands/settings.rs` — Raw serde_json::Value
- `mcp/bridge.rs` — MCP sidecar bridge
- `tauri.conf.json` — CSP, withGlobalTauri

### Frontend (src/renderer/)
- `App.tsx` — Theme, .then() without .catch()
- `stores/app-store.ts` (319 LOC) — Monolithic Zustand
- `hooks/use-assistant-runtime.ts` — Assistant adapter
- `lib/tauri-api.ts` — IPC boundary (untyped)
- `lib/providers.ts` — Provider configs
- `components/chat/ChatView.tsx` (475 LOC) — WelcomeScreen embedded
- `components/chat/AssistantThread.tsx` (1000+ LOC) — Message thread
- `components/sidebar/ConversationList.tsx` — Conversation list
- `components/settings/SettingsPanel.tsx` (500+ LOC) — Settings modal
- `components/cowork/CoworkView.tsx` — Cowork mode
- `styles/globals.css` — Design system (color contrast issue)

### Sidecar
- `sidecar/mcp-bridge.ts` — MCP bridge (no command validation)
