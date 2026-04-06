# CLI GUI Wrapper — Handoff Notes (2026-04-06)

## 현재 상태

kangnam-client를 코딩 에이전트 CLI(Claude Code, Codex CLI)의 GUI 래퍼로 피벗 완료.
**빌드 통과**: `cargo check` (0 warning), `npm run typecheck` (clean), `npm test` (7/7 pass).

## 완료된 작업

### Rust Backend (src-tauri/src/)
- `cli/types.rs` — UnifiedMessage enum, CliStatus, CliConfig, TokenUsage 등
- `cli/adapter.rs` — CliAdapter trait (subprocess spawn, JSON 파싱, stdin 메시징)
- `cli/adapters/claude.rs` — Claude Code NDJSON 파서 (system, stream_event, assistant, result, control_request)
- `cli/adapters/codex.rs` — Codex CLI JSONL 파서 (thread.started, turn.*, item.*, error)
- `cli/manager.rs` — CliManager (subprocess lifecycle, stdin/stdout piping, Tauri event emit)
- `cli/registry.rs` — ProviderMeta (provider 목록)
- `commands/cli.rs` — Tauri IPC 7개 커맨드
- DB 마이그레이션 — message_type 컬럼, provider → cli_provider

### React Frontend (src/renderer/)
- `stores/app-store.ts` — CliStatus, UnifiedMessage 타입, 새 상태 필드
- `lib/cli-api.ts` — Tauri IPC 래퍼 + event listener
- `components/chat/MessageRenderer.tsx` — UnifiedMessage 타입별 렌더러
- `components/chat/SafetyDialog.tsx` — 파일수정/명령실행 확인 다이얼로그
- `components/chat/ChatView.tsx` — Tauri event streaming으로 교체
- `components/chat/CommandPalette.tsx` — slash command 팔레트
- `components/chat/WorkdirSelector.tsx` — 작업 디렉토리 선택
- `components/setup/SetupWizard.tsx` + `CliCard.tsx` — CLI 감지/설치 위저드
- `components/sidebar/AgentPanel.tsx` — agent 상태 패널

### 삭제된 코드
- `providers/` (SSE 직접 호출), `auth/` (OAuth PKCE), `cowork/`, `eval/`
- `@assistant-ui/react`, `@assistant-ui/react-markdown` 패키지

## 다음 할 일

1. **앱 실행 테스트** — `npm run tauri:dev`로 SetupWizard 동작 확인
2. **실제 CLI 연동 테스트** — Claude Code 설치 후 실제 대화 테스트
3. **tauri-plugin-dialog 버전 맞추기** — Rust v2.6.0 vs npm v2.7.0 mismatch warning
4. **MCP 설정 연동** — 앱의 MCP 서버 설정을 CLI에 전달하는 로직
5. **대화 저장** — CLI 메시지를 SQLite에 저장하는 로직 (add_message 함수 연결)
6. **Codex 멀티턴** — Codex는 one-shot이므로 대화 히스토리를 프롬프트에 포함하는 로직

## 핵심 파일

| 관심 영역 | 파일 |
|-----------|------|
| CLI 통신 아키텍처 | `docs/llm/cli-gui-wrapper.md` (설계), `docs/llm/cli-gui-wrapper-plan.md` (구현계획) |
| Rust 진입점 | `src-tauri/src/lib.rs` |
| CLI 핵심 | `src-tauri/src/cli/manager.rs` |
| 프론트엔드 진입점 | `src/renderer/App.tsx` |
| 상태 관리 | `src/renderer/stores/app-store.ts` |
| CLI API | `src/renderer/lib/cli-api.ts` |
