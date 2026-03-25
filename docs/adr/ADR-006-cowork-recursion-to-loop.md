# ADR-006: cowork.rs 재귀 -> 반복문 전환

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`commands/cowork.rs`의 `run_cowork_loop` 함수는 tool call 후 자기 자신을 `Box::pin(run_cowork_loop(...)).await`로 재귀 호출한다 (294행). 각 재귀 호출은 async 함수의 Future를 힙에 할당하지만:

1. **스택 오버플로우 위험**: Box::pin으로 힙 할당하므로 스택 오버플로우는 방지되나, 재귀 깊이에 비례하여 Future 체인이 누적된다. 에이전트 루프가 20-50회 tool call을 실행하면 메모리 사용량이 선형 증가.
2. **디버깅 난이도**: 재귀 async 함수의 백트레이스가 복잡해져 오류 추적이 어렵다.
3. **동일 코드베이스 내 불일치**: `commands/chat.rs`는 `loop { ... }` 패턴으로 tool call 루프를 구현하고 있어 코드베이스 내 일관성이 없다.

## Decision

`run_cowork_loop`의 `Box::pin` 재귀를 `loop` 반복문으로 전환한다. `chat.rs`의 기존 패턴을 따른다.

### 변환 구조

```rust
async fn run_cowork_loop(
    messages: &mut Vec<ChatMessage>,
    tools: &[ToolDefinition],
    access_token: &str,
    provider: Arc<dyn LLMProvider>,
    model: Option<&str>,
    reasoning_effort: Option<&str>,
    state: &AppState,
    app: &AppHandle,
    abort_rx: tokio::sync::watch::Receiver<bool>,
) -> Result<(), String> {
    loop {
        let mut full_response = String::new();
        let mut plan_parsed = false;

        // ... (스트리밍 수신 로직, 현재와 동일) ...

        let result = send_handle.await.map_err(|e| e.to_string())??;

        if result.stop_reason == StopReason::ToolUse && !result.tool_calls.is_empty() {
            // assistant 메시지 추가
            // tool call 실행
            // tool result 메시지 추가
            continue;  // 다음 루프 반복 (재귀 대신)
        }

        // 완료: assistant 메시지 추가, cowork:complete emit
        break Ok(());
    }
}
```

### 핵심 변경 포인트

1. 함수 시작 부분의 변수 선언(`full_response`, `plan_parsed`)을 `loop` 블록 안으로 이동
2. `Box::pin(run_cowork_loop(...)).await` (294행) -> `continue`
3. 정상 종료 경로(308-321행) -> `break Ok(())`
4. abort 체크를 루프 시작 부분에도 추가

## Alternatives Rejected

1. **재귀 유지 + 깊이 제한**: `max_depth: u32` 파라미터를 추가하고 초과 시 에러 반환. 기각 이유: 근본 문제(불필요한 재귀)를 해결하지 않고 증상만 완화. loop가 더 간결하고 chat.rs와 일관적.

## Consequences

- `run_cowork_loop` 함수 시그니처 변경 없음.
- 메모리 사용: 재귀 깊이 n에 비례하던 Future 할당이 상수로 감소.
- `cowork_start`에서 `run_cowork_loop` 호출 코드 변경 없음 (함수 시그니처 유지).
- chat.rs와 cowork.rs가 동일한 tool-call 루프 패턴을 사용하게 되어 코드베이스 일관성 향상.
- 영향 파일: `src-tauri/src/commands/cowork.rs` 단일 파일.
