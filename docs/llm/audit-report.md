# Audit Report: kangnam-client

**Date:** 2026-03-25
**Target:** kangnam-client v0.1.0 (Tauri 2 Desktop LLM Client)
**Stack:** Rust backend + React 19 frontend + Node.js MCP sidecar
**User Focus:** 쓰이지 않는 버튼, 어색한 UI 개선

---

## 베이스라인 점수표

| 영역 | 점수 (0-10) | 주요 근거 |
|---|---|---|
| 코드 품질 | 5.0 | 미사용 파일 3개, 상수 중복, 비반응형 상태 읽기, 에러 처리 부재 |
| 보안 | 6.4 | CSP unsafe-eval, access_token 평문 저장, SSRF 미검증 |
| 아키텍처 | 6.5 | SettingsPanel 1816줄 God component, 재귀 Box::pin, Mutex 단일 연결 |
| DB | 5.3 | 인덱스 전무, FTS5 미사용, 마이그레이션 시스템 부재 |
| 테스트 | 3.3 | 프론트엔드 22개 컴포넌트 전체 무테스트, Vitest 환경 설정 오류 |
| Repo Health | 7.4 | 린터/포매터 부재, 대용량 바이너리 git 추적 |
| UX | 6.9 | onClick 없는 버튼 3개, 삭제 확인 없음, 데드 코드 |
| UI | 6.3 | 42+ 하드코딩 색상, WCAG 대비 실패, 토큰 시스템 부재 |
| **가중 평균** | **5.83** | |

---

## 게이트 판정

- **Decision:** PARTIAL
- **근거:** 사용자가 UI/UX 개선을 명시적으로 요청. P0/P1 항목은 난이도 S로 즉시 수정 가능. P2/P3는 설계 페이즈 필요.

---

## 우선순위 매트릭스

### P0 — 즉시 수정 (사용자 체감 품질 직결)

| ID | 항목 | 영역 | 난이도 | 파일 | 설명 |
|---|---|---|---|---|---|
| P0-1 | CoworkView 홈뷰 "+" 버튼 onClick 없음 | UX | S | `cowork/CoworkView.tsx:289-301` | cursor:pointer이나 클릭 무반응. 파일 첨부 미구현이면 버튼 제거 |
| P0-2 | CoworkView 채팅뷰 "+" 버튼 onClick 없음 | UX | S | `cowork/CoworkView.tsx:438-450` | 위와 동일 패턴 |
| P0-3 | TopBar "U" 아바타 클릭 핸들러 없음 | UX | S | `chat/ChatView.tsx:102-106` | cursor:pointer + hover 효과이나 onClick 없음. Sidebar 아바타는 설정 열기 동작 있음 |
| P0-4 | 데드 컴포넌트 3개 삭제 | UX/코드 | S | `sidebar/ModelSelector.tsx`, `sidebar/ProviderSelector.tsx`, `sidebar/ReasoningSelector.tsx` | import 0건. InputControls.tsx가 완전 대체 |
| P0-5 | 대화 삭제 확인 다이얼로그 부재 | UX | S | `sidebar/ConversationList.tsx:27-35` | 파괴적 액션에 확인 없이 즉시 삭제 |
| P0-6 | Sidebar "User / Free plan" 하드코딩 | UX | S | `sidebar/Sidebar.tsx:134-139` | 실제 정보와 무관한 더미 텍스트 |

### P1 — 단기 수정 (UI 일관성, 접근성)

| ID | 항목 | 영역 | 난이도 | 파일 | 설명 |
|---|---|---|---|---|---|
| P1-1 | Prettify 버튼 빈 중괄호 표현식 | UI | S | `settings/SettingsPanel.tsx:444,612-615` | `{ }` → `{'{ }'}` |
| P1-2 | ErrorBoundary 복구 버튼 추가 | UX | S | `chat/ChatView.tsx:10-26` | "Start new conversation" 버튼 필요 |
| P1-3 | Send 버튼 크기 통일 | UI | S | `cowork/CoworkView.tsx:310-314` | CoworkView 40px → 36px (Chat 표준) |
| P1-4 | ChatSearchBar aria-label 추가 | A11y | S | `chat/ChatSearchBar.tsx:161-208` | Prev/Next/Close 3개 버튼 |
| P1-5 | --text-muted 대비 수정 | A11y | S | `styles/globals.css` | dark #8a8a8a→#9a9a9a, light #999→#767676 |
| P1-6 | --accent 대비 수정 | A11y | S | `styles/globals.css` | #d97757→#e08060 (4.5:1 이상) |
| P1-7 | CSS status 토큰 추가 | UI | S | `styles/globals.css` | --warning, --info, --success-text, --danger-text 정의 |
| P1-8 | AssistantThread 하드코딩 색상 7건 | UI | M | `chat/AssistantThread.tsx:155,166,200,353,361,379,484` | CSS 변수로 교체 |
| P1-9 | Eval 하드코딩 색상 42+건 | UI | L | `eval/*.tsx`, `settings/SettingsPanel.tsx` | P1-7 토큰으로 교체 |
| P1-10 | 터치 타겟 위반 (첨부 삭제 16px 등) | A11y | M | WelcomeScreen, AssistantThread, ChatSearchBar 등 11건 | 최소 24px, 이상적 44px |
| P1-11 | CoworkView composer border 하드코딩 | UI | S | `cowork/CoworkView.tsx:419` | CSS 변수로 교체 |
| P1-12 | hover:text-white theme-unsafe 2건 | UI | S | `cowork/CoworkView.tsx:521`, `cowork/ProgressPanel.tsx:106` | var(--text-primary)로 교체 |
| P1-13 | Sidebar JS hover → CSS hover 4건 | UI | S | `sidebar/Sidebar.tsx:62-63,87-88,112-113,170-177` | Tailwind hover: 유틸리티로 교체 |
| P1-14 | Export 완료 피드백 없음 | UX | S | `sidebar/ConversationList.tsx:273,282` | 토스트/상태 메시지 추가 |

### P2 — 중기 개선 (아키텍처/코드 품질)

| ID | 항목 | 영역 | 난이도 |
|---|---|---|---|
| P2-1 | SettingsPanel.tsx 1816줄 분할 | 아키텍처 | L |
| P2-2 | border-radius 토큰 시스템 | UI | M |
| P2-3 | spacing 토큰 시스템 | UI | M |
| P2-4 | 상수 중복 통합 (PROVIDER_MODELS 등) | 코드 품질 | M |
| P2-5 | PROVIDER_INFO 상수 중복 | 코드 품질 | S |
| P2-6 | getState().devMode → useAppStore 구독 | 코드 품질 | S |
| P2-7 | StopButton/onCancel 중복 stop 로직 | 코드 품질 | S |
| P2-8 | WelcomeScreen rAF + setTimeout hack | 코드 품질 | M |
| P2-9 | EvalWorkbench 조건부 마운트 | 아키텍처 | S |

### P3 — 장기 개선 (DB/보안/테스트/인프라)

| ID | 항목 | 영역 | 난이도 |
|---|---|---|---|
| P3-1 | conversations 인덱스 추가 | DB | S |
| P3-2 | FTS5 검색 도입 | DB | M |
| P3-3 | access_token 암호화 저장 | 보안 | M |
| P3-4 | CSP unsafe-eval 제거 | 보안 | M |
| P3-5 | MCP HTTP URL SSRF 검증 | 보안 | M |
| P3-6 | Mutex → r2d2 커넥션 풀 | 아키텍처 | M |
| P3-7 | cowork.rs 재귀 → 반복문 | 아키텍처 | L |
| P3-8 | .ok() 에러 무시 38건 정리 | 아키텍처 | L |
| P3-9 | Vitest jsdom 환경 + 컴포넌트 테스트 | 테스트 | M |
| P3-10 | auth/manager.rs unwrap() 5건 | 보안 | S |
| P3-11 | 마이그레이션 시스템 도입 | DB | M |
| P3-12 | ESLint + Prettier 도입 | Repo Health | M |
| P3-13 | JSON.parse try/catch 추가 | 코드 품질 | S |
| P3-14 | loadData() 에러 처리 | 코드 품질 | S |

---

## 개선 범위 (Design Phase 전달용)

| 영역 | Design Phase 필요 여부 | 근거 |
|---|---|---|
| ux_ui | 부분 필요 | P0/P1 대부분 설계 불필요. P1-9(Eval 색상), P2-2/3(토큰 시스템)은 설계 선행 필요 |
| architecture | 필요 | SettingsPanel 분할, 에러 처리 통합, 커넥션 풀은 ADR 필요 |
| db | 필요 | 인덱스, FTS5, 마이그레이션은 스키마 변경으로 설계 선행 필수 |

---

## 제약 조건

1. **하위호환**: 기존 SQLite DB 파일과의 호환성 유지 필수. 스키마 변경 시 마이그레이션 제공.
2. **기존 테스트 보존**: `providers.test.ts`, `utils.test.ts`, Rust `db/schema.rs` 테스트, `db/conversations.rs` 테스트가 모두 통과해야 함.
3. **Tauri IPC 계약**: 프론트엔드 `tauri-api.ts`의 함수 시그니처 변경 시 양쪽 동시 수정 필수.
4. **CSS 변수 체계**: 기존 `globals.css`의 36개 CSS 변수와 일관된 네이밍으로 새 토큰 추가.
5. **데드 코드 삭제**: ModelSelector, ProviderSelector, ReasoningSelector 삭제 전 import 0건 재확인.
