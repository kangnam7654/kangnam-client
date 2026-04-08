# JSON-RPC 2.0 Protocol Layer — Design Spec

## Purpose

Frontend ↔ Backend 통신을 JSON-RPC 2.0으로 통일한다. Tauri invoke에 직접 의존하지 않는 전송 무관(transport-agnostic) 프로토콜 레이어를 만들어, 네이티브 앱과 웹앱 모두 동일한 메시지 포맷으로 통신한다.

### Completion Criteria

- Frontend는 JSON-RPC 2.0 메시지를 통해서만 Backend와 통신한다
- Tauri invoke는 transport 구현체 중 하나일 뿐이며, 교체 가능하다
- CLI 스트림 이벤트도 JSON-RPC 2.0 Notification 형태로 전달된다
- 기존 모든 기능(CLI 관리, 세션, 메시지, 퍼미션)이 동일하게 동작한다

---

## JSON-RPC 2.0 메시지 포맷

### 요청 (Frontend → Backend)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "cli.startSession",
  "params": { "provider": "claude", "workingDir": "/Users/me/project" }
}
```

### 성공 응답

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "session-uuid-123"
}
```

### 에러 응답

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": { "code": -32001, "message": "Directory does not exist" }
}
```

### 서버 → 클라이언트 알림 (스트리밍 이벤트)

```json
{
  "jsonrpc": "2.0",
  "method": "cli.stream",
  "params": { "type": "text_delta", "text": "안녕하세요" }
}
```

id가 없으면 Notification (응답 불필요). CLI 스트림에 사용.

---

## Method 목록

| Method | Params | Result | 설명 |
|--------|--------|--------|------|
| `cli.listProviders` | (없음) | `ProviderMeta[]` | 지원 CLI 목록 |
| `cli.checkInstalled` | `{ provider }` | `CliStatus` | 설치 여부/버전 |
| `cli.install` | `{ provider }` | `null` | CLI 설치 |
| `cli.startSession` | `{ provider, workingDir }` | `string` (sessionId) | 세션 시작 |
| `cli.sendMessage` | `{ sessionId, message }` | `null` | 메시지 전송 |
| `cli.sendPermission` | `{ sessionId, requestId, allowed }` | `null` | 퍼미션 응답 |
| `cli.stopSession` | `{ sessionId }` | `null` | 세션 종료 |

### 알림 (Backend → Frontend)

| Method | Params | 설명 |
|--------|--------|------|
| `cli.stream` | `UnifiedMessage` | CLI 출력 스트림 |

---

## 에러 코드

| Code | 의미 |
|------|------|
| -32700 | Parse error (잘못된 JSON) |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32001 | Provider not found |
| -32002 | Session not found |
| -32003 | CLI not installed |
| -32004 | Install failed |
| -32005 | Directory not found |

---

## File Changes

### Rust Backend

| Path | Action | Summary |
|------|--------|---------|
| `src-tauri/src/rpc/mod.rs` | Create | RPC 모듈 루트 |
| `src-tauri/src/rpc/types.rs` | Create | JsonRpcRequest, JsonRpcResponse, JsonRpcError 타입 |
| `src-tauri/src/rpc/dispatcher.rs` | Create | method → handler 디스패치 |
| `src-tauri/src/rpc/handlers.rs` | Create | 각 method의 실제 로직 (기존 commands/cli.rs에서 이동) |
| `src-tauri/src/commands/cli.rs` | Replace | 7개 커맨드 → `rpc` 1개 커맨드 |
| `src-tauri/src/lib.rs` | Modify | invoke_handler에서 7개 → 1개로 변경 |
| `src-tauri/src/cli/manager.rs` | Modify | emit을 JSON-RPC Notification 형태로 변경 |

### React Frontend

| Path | Action | Summary |
|------|--------|---------|
| `src/renderer/lib/rpc/types.ts` | Create | JSON-RPC 2.0 타입 정의 |
| `src/renderer/lib/rpc/client.ts` | Create | RPC 클라이언트 (call, notify, onNotification) |
| `src/renderer/lib/rpc/transport-tauri.ts` | Create | Tauri invoke 기반 transport |
| `src/renderer/lib/rpc/transport-ws.ts` | Create (stub) | WebSocket transport (향후) |
| `src/renderer/lib/cli-api.ts` | Modify | invoke 직접 호출 → rpcClient.call() 사용 |

---

## Implementation Order

1. `src/renderer/lib/rpc/types.ts` — JSON-RPC 2.0 타입
2. `src-tauri/src/rpc/types.rs` — Rust 쪽 JSON-RPC 타입
3. `src-tauri/src/rpc/dispatcher.rs` — method 디스패치
4. `src-tauri/src/rpc/handlers.rs` — 핸들러 (commands/cli.rs 로직 이동)
5. `src-tauri/src/commands/cli.rs` — 단일 `rpc` 커맨드로 교체
6. `src-tauri/src/cli/manager.rs` — emit을 JSON-RPC Notification으로
7. `src/renderer/lib/rpc/client.ts` — RPC 클라이언트
8. `src/renderer/lib/rpc/transport-tauri.ts` — Tauri transport
9. `src/renderer/lib/cli-api.ts` — rpcClient 사용으로 교체
10. 빌드 검증 + 테스트

---

## Function/API Signatures

### Rust — JSON-RPC Types

```rust
#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}
```

### Rust — Dispatcher

```rust
pub async fn dispatch(
    request: JsonRpcRequest,
    state: &AppState,
    app_handle: AppHandle,
) -> JsonRpcResponse {
    let result = match request.method.as_str() {
        "cli.listProviders" => handlers::list_providers().await,
        "cli.checkInstalled" => handlers::check_installed(request.params, state).await,
        "cli.install" => handlers::install(request.params, state).await,
        "cli.startSession" => handlers::start_session(request.params, state, app_handle).await,
        "cli.sendMessage" => handlers::send_message(request.params, state, app_handle).await,
        "cli.sendPermission" => handlers::send_permission(request.params, state).await,
        "cli.stopSession" => handlers::stop_session(request.params, state).await,
        _ => Err(JsonRpcError { code: -32601, message: "Method not found".into(), data: None }),
    };

    match result {
        Ok(value) => JsonRpcResponse::success(request.id, value),
        Err(error) => JsonRpcResponse::error(request.id, error),
    }
}
```

### Rust — 단일 Tauri 커맨드

```rust
#[tauri::command]
async fn rpc(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    request: JsonRpcRequest,
) -> Result<JsonRpcResponse, ()> {
    Ok(dispatcher::dispatch(request, state.inner(), app_handle).await)
}
```

### TypeScript — RPC Client

```typescript
interface RpcTransport {
  send(request: JsonRpcRequest): Promise<JsonRpcResponse>
  onNotification(callback: (notification: JsonRpcNotification) => void): () => void
}

class RpcClient {
  private transport: RpcTransport
  private nextId = 1

  constructor(transport: RpcTransport) { this.transport = transport }

  async call<T>(method: string, params?: unknown): Promise<T> {
    const request = { jsonrpc: "2.0", id: this.nextId++, method, params }
    const response = await this.transport.send(request)
    if (response.error) throw new RpcError(response.error)
    return response.result as T
  }

  onNotification(callback: (method: string, params: unknown) => void): () => void {
    return this.transport.onNotification((n) => callback(n.method, n.params))
  }
}
```

### TypeScript — Tauri Transport

```typescript
const tauriTransport: RpcTransport = {
  send: (request) => invoke<JsonRpcResponse>('rpc', { request }),
  onNotification: (callback) => {
    const promise = listen<JsonRpcNotification>('rpc-notification', (event) => {
      callback(event.payload)
    })
    return () => { promise.then(fn => fn()) }
  },
}
```

---

## Constraints

1. JSON-RPC 2.0 spec을 엄격히 따른다 — jsonrpc 필드는 항상 "2.0"
2. Notification(id 없음)은 Backend → Frontend 단방향으로만 사용
3. Tauri event 이름은 `rpc-notification`으로 통일
4. 기존 `cli-stream` 이벤트는 `rpc-notification` 안의 `cli.stream` method로 대체

## Decisions

- **단일 `rpc` 커맨드 방식 채택** — 커맨드별 함수 등록 대비 프로토콜 계층이 명확히 분리됨. Tauri invoke는 transport일 뿐.
- **WebSocket transport는 stub만** — 지금은 Tauri 전용, 나중에 웹앱 지원 시 구현.
