# Audit Report — Round 1

**Date**: 2026-03-25
**Composite Score**: 5.94/10 (FAIL — floor violation: Test 3.3 < 5.0)

## Baseline Scores

| Domain | Score |
|--------|-------|
| Code Quality | 7.0 |
| Security | 6.5 |
| Architecture | 5.85 |
| DB | 5.65 |
| Test Coverage | 3.3 |
| Repo Health | 7.2 |
| UX/UI | 6.66 |

## Priority Matrix (56 items)

### P0 — Immediate (8 items)

| ID | Domain | Issue | Difficulty |
|----|--------|-------|------------|
| P0-01 | Code | Zustand `get()` ReferenceError — `create((set) => ...)` 에서 get 미바인딩 → 앱 크래시 | S |
| P0-02 | Arch | cowork.rs 재귀 Box::pin → 반복문 전환 필요 | L |
| P0-03 | Arch | Mutex\<Connection\> 단일 연결 → 커넥션 풀 도입 | L |
| P0-04 | Security | access_token 평문 SQLite 저장 → keychain 이동 | M |
| P0-05 | Security | CSP unsafe-eval + unsafe-inline 제거 | M |
| P0-06 | Security | MCP HTTP URL SSRF 미검증 | M |
| P0-07 | Security | OAuth error HTML injection | S |
| P0-08 | DB | role/status CHECK 제약조건 없음 + 용어 불일치 | S |

### P1 — Fast Fix (19 items)

| ID | Domain | Issue | Difficulty |
|----|--------|-------|------------|
| P1-01 | Code | Rust .unwrap() 5곳 (auth/manager.rs, oauth_server.rs) | M |
| P1-02 | Code | JSON.parse 미방어 (SettingsPanel) | S |
| P1-03 | Code | loadData() 에러 무음 처리 | S |
| P1-04 | Code | InputControls getState() 반응성 파손 | S |
| P1-05 | Code | WelcomeScreen 50ms 타이밍핵 | S |
| P1-06 | Arch | AppError 미활용 → String 에러 통일 | M |
| P1-07 | Arch | app-store.ts get() 미바인딩 (P0-01과 연관) | S |
| P1-08 | Arch | use-assistant-runtime stale closure | M |
| P1-09 | DB | search_messages LIKE full scan → FTS5 | M |
| P1-10 | DB | eval_case_bulk_add N+1 | M |
| P1-11 | DB | chat_send 다중 lock acquire | M |
| P1-12 | DB | .filter_map(\|r\| r.ok()) 에러 무시 14곳 | M |
| P1-13 | Test | vitest environment 'node' → 'happy-dom' | S |
| P1-14 | Test | SSE parser 테스트 0개 | M |
| P1-15 | Test | commands/ 테스트 0개 | L |
| P1-16 | UX | Sidebar.tsx className 중복 | S |
| P1-17 | UX | TopBar 탭 span → button | S |
| P1-18 | Security | withGlobalTauri:true 제거 | M |
| P1-19 | Security | cowork session 소유권 미검증 | M |

### P2 — Quality (21 items)

P2-01~P2-21: add_message 구조체화, tool_id 통합, agent loop 중복 제거, AuthManager 분할, Zustand 슬라이스, 마이그레이션 시스템, json_valid CHECK, seed 트랜잭션, updated_at 트리거, 인덱스 추가, 커버리지 캠페인, ESLint/Prettier, 의존성 업데이트, 색상 토큰화, style 통일, 반응형, WAI-ARIA, undo 패턴

### P3 — Nice-to-Have (8 items)

P3-01~P3-08: .gitignore .env, auth 로깅, .DS_Store, pre-commit hooks, docs, user-select, light theme tokens, 언어 통일

## Gate Decision: PARTIAL → PROCEED

P0/P1이 존재하므로 Design → Build → Verify로 진행한다.
