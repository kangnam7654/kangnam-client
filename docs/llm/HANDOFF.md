# CLI GUI Wrapper — TODO (2026-04-08)

## 현재 상태

kangnam-client를 코딩 에이전트 CLI(Claude Code, Codex CLI)의 GUI 래퍼로 피벗 완료.
Axum WebSocket + JSON-RPC 2.0 통신 레이어 구현 완료. 실시간 스트리밍, DB 저장, Codex 멀티턴 지원.

**빌드**: `cargo check` (0 warning), `npm run typecheck` (clean), `npm test` (7/7 pass)

## 아키텍처 요약

```
React Frontend ←→ WebSocket (ws://localhost:3001/ws) ←→ Axum Server ←→ CLI Subprocess
                    JSON-RPC 2.0                          (Rust)      stdin/stdout NDJSON
```

- **프론트엔드**: `src/renderer/lib/rpc/` (WebSocket transport + RPC client)
- **서버**: `src-tauri/src/server/` (Axum WS handler, broadcast channel, message saver)
- **RPC**: `src-tauri/src/rpc/` (dispatcher, handlers, types)
- **CLI 관리**: `src-tauri/src/cli/` (adapter trait, claude/codex parsers, manager, registry)

## 남은 작업 (TODO)

### 높은 우선순위

1. **UI 전면 개편** — 현재 UI가 피벗 이전 상태와 혼재됨. 비개발자용 깔끔한 채팅 UI 필요
2. **saver.rs session_id 추적** — 현재 "가장 최근 대화"에 저장하는 방식이 취약. session_id 별 저장으로 변경
3. **Settings/Conv/Skills/MCP/Agents RPC 마이그레이션** — 아직 Tauri invoke로 남아있음. JSON-RPC over WebSocket으로 전환 필요

### 중간 우선순위

4. **tauri-plugin-dialog 버전 맞추기** — Rust v2.6.0 vs npm v2.7.0 mismatch warning
5. **MCP 설정 연동** — 앱의 MCP 서버 설정을 CLI에 전달하는 로직
6. **에러 핸들링 강화** — CLI 프로세스 crash, WebSocket 연결 끊김 등 edge case 처리

### 낮은 우선순위

7. **Codex CLI 실제 연동 테스트** — Codex CLI 설치 후 실제 대화 테스트
8. **새 CLI 어댑터 추가** — 다른 코딩 에이전트 CLI 지원 확장
9. **웹 단독 실행 모드** — Tauri 없이 브라우저만으로 사용하는 모드 (이미 아키텍처는 지원)

## 핵심 파일

| 관심 영역 | 파일 |
|-----------|------|
| 구현 계획 | `docs/llm/cli-gui-wrapper-plan.md` |
| Rust 진입점 | `src-tauri/src/lib.rs` |
| 서버 (Axum) | `src-tauri/src/server/mod.rs` |
| RPC 핸들러 | `src-tauri/src/rpc/handlers.rs` |
| CLI 매니저 | `src-tauri/src/cli/manager.rs` |
| CLI API (FE) | `src/renderer/lib/cli-api.ts` |
| RPC 클라이언트 (FE) | `src/renderer/lib/rpc/client.ts` |
| 상태 관리 | `src/renderer/stores/app-store.ts` |
