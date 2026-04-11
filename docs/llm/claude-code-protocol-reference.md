# Claude Code Stream-JSON Protocol Reference

> 조사일: 2026-04-08
> 용도: kangnam-client GUI 래퍼 설계를 위한 프로토콜 레퍼런스

## CLI 실행 방법

```bash
claude -p \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  --include-partial-messages \
  --include-hook-events
```

## 메시지 타입 전체 목록 (21종)

| `type` | `subtype` | 설명 |
|--------|-----------|------|
| `system` | `init` | 세션 초기화 (첫 메시지) |
| `system` | `compact_boundary` | 대화 compaction 완료 |
| `system` | `status` | 상태 업데이트 (compacting 등) |
| `system` | `hook_started` | Hook 실행 시작 |
| `system` | `hook_progress` | Hook stdout/stderr |
| `system` | `hook_response` | Hook 실행 완료 |
| `system` | `task_started` | 백그라운드 태스크 시작 |
| `system` | `task_progress` | 백그라운드 태스크 진행 |
| `system` | `task_notification` | 백그라운드 태스크 완료/실패 |
| `system` | `files_persisted` | 파일 체크포인트 저장 |
| `system` | `local_command_output` | 로컬 슬래시 커맨드 출력 |
| `system` | `api_retry` | API 재시도 |
| `assistant` | — | Claude 응답 (완전한 턴) |
| `user` | — | 유저 입력 또는 tool result |
| `result` | `success` / `error_*` | 쿼리 완료 (최종 메시지) |
| `stream_event` | — | 실시간 스트리밍 토큰 (`--include-partial-messages`) |
| `rate_limit_event` | — | 레이트 리밋 상태 |
| `tool_progress` | — | 도구 실행 진행 |
| `tool_use_summary` | — | 도구 사용 요약 |
| `auth_status` | — | 인증 플로우 |
| `prompt_suggestion` | — | 다음 프롬프트 제안 |

## system/init 메시지 구조

세션 시작 시 첫 번째로 출력. 래퍼가 참조해야 할 핵심 정보 포함:

```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "<uuid>",
  "tools": ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Agent", ...],
  "mcp_servers": [{ "name": "my-server", "status": "connected" }],
  "model": "claude-sonnet-4-6",
  "permissionMode": "default",
  "slash_commands": ["/compact", "/clear", "/help", "/my-custom-command"],
  "skills": ["my-skill"],
  "plugins": [{ "name": "my-plugin", "path": "/path/to/plugin" }],
  "agents": ["code-reviewer"],
  "claude_code_version": "2.x.x",
  "cwd": "/path/to/project"
}
```

## stream_event 시퀀스 (--include-partial-messages)

```
stream_event(message_start)
stream_event(content_block_start) — text block
stream_event(content_block_delta) × N — text_delta tokens
stream_event(content_block_stop)
stream_event(content_block_start) — tool_use block
stream_event(content_block_delta) × N — input_json_delta chunks
stream_event(content_block_stop)
stream_event(message_delta) — stop_reason, final usage
stream_event(message_stop)
assistant  ← 완성된 메시지
```

## assistant 메시지 구조

```json
{
  "type": "assistant",
  "session_id": "<uuid>",
  "parent_tool_use_id": null,
  "message": {
    "content": [
      { "type": "text", "text": "..." },
      { "type": "tool_use", "id": "toolu_01...", "name": "Bash", "input": { "command": "ls" } }
    ],
    "usage": { "input_tokens": 1250, "output_tokens": 83 }
  }
}
```

`parent_tool_use_id`가 null이 아니면 서브에이전트 내부의 메시지.

## 서브에이전트 (Agent)

Agent 도구 호출:
```json
{
  "type": "tool_use",
  "id": "toolu_01AGENT...",
  "name": "Agent",
  "input": {
    "description": "Review auth module",
    "prompt": "Analyze src/auth/",
    "subagent_type": "code-reviewer",
    "model": "sonnet",
    "run_in_background": false
  }
}
```

서브에이전트의 모든 출력은 `parent_tool_use_id: "toolu_01AGENT..."` 로 태깅됨.
v2.1.63 이전에는 `"Task"` 이름 사용 → 두 이름 모두 체크 필요.

## MCP 도구 호출

빌트인 도구와 동일한 형식. 이름만 `mcp__<server>__<tool>` 패턴:
```json
{ "type": "tool_use", "name": "mcp__playwright__browser_click", "input": { "selector": "#btn" } }
```

## 권한 처리 (Permission)

**`control_request`/`control_response`는 현재 공식 프로토콜에 없음.**

권한 처리 방법:
1. **`--permission-prompt-tool <mcp-tool-name>`**: MCP 도구를 지정하면 Claude가 권한 필요 시 해당 도구를 호출
2. **SDK `canUseTool` 콜백**: 프로그래밍 방식으로 권한 판단
3. **`AskUserQuestion` 도구**: Claude가 유저에게 질문할 때 사용

→ 래퍼는 `--permission-prompt-tool`로 자체 MCP 서버를 등록하여 권한 요청을 수신해야 함.

## 슬래시 커맨드 / 스킬

**중요: `-p` (headless) 모드에서는 유저 슬래시 커맨드(/commit, /review-pr 등)를 사용할 수 없음.**

- 빌트인 커맨드 (/compact, /clear): 일반 텍스트로 전송 가능
- 커스텀 스킬: `system/init`의 `slash_commands`/`skills` 필드에 목록은 나오지만 실행 불가
- `system/local_command_output`에서 로컬 커맨드 결과 수신

## Plan Mode

`permissionMode: "plan"`일 때:
- 읽기 도구(Read, Grep, Glob)만 실행 허용
- 수정 도구는 차단
- `ExitPlanMode` 도구로 모드 전환

## result 메시지 (최종)

```json
{
  "type": "result",
  "subtype": "success",
  "total_cost_usd": 0.04823,
  "duration_ms": 18420,
  "num_turns": 7,
  "result": "Done. I've refactored the auth module...",
  "usage": { "input_tokens": 42300, "output_tokens": 1820 },
  "modelUsage": { "claude-sonnet-4-6": { "inputTokens": 35000, "costUSD": 0.039 } },
  "permission_denials": [{ "tool_name": "Bash", "tool_input": { "command": "rm -rf" } }]
}
```

result의 `subtype`: `success`, `error_max_turns`, `error_during_execution`, `error_max_budget_usd`, `error_max_structured_output_retries`

## 백그라운드 태스크

```
system/task_started  → task_id, tool_use_id, description, task_type
system/task_progress → task_id, usage, last_tool_name
system/task_notification → task_id, status (completed/failed/stopped), summary
```

## 레이트 리밋

```json
{
  "type": "rate_limit_event",
  "rate_limit_info": {
    "status": "allowed_warning",
    "utilization": 0.87,
    "rate_limit_type": "five_hour"
  }
}
```

## stdin 입력 형식

```json
{
  "type": "user",
  "message": { "role": "user", "content": "메시지" },
  "parent_tool_use_id": null,
  "session_id": "<current-session-id>"
}
```

## 래퍼 설계 시 주의사항

1. `control_request` 대신 `--permission-prompt-tool` 사용해야 함
2. `-p` 모드에서 커스텀 스킬 실행 불가 → 별도 처리 필요
3. parallel tool call 시 동일 `message.id`로 중복 `assistant` 메시지 → 중복 제거 필요
4. Extended thinking 활성화 시 `stream_event` 미출력 → `assistant` 메시지만 수신
5. Agent와 Task(레거시) 이름 모두 체크 필요
