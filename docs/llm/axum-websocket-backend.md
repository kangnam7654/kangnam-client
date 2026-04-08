# Axum WebSocket Backend + Optional Directory — Design Spec

## Purpose

1. Tauri invoke 기반 통신을 Axum WebSocket으로 교체한다. 네이티브 앱과 웹 브라우저 모두 동일한 WebSocket 연결로 JSON-RPC 2.0 통신.
2. 작업 디렉토리 선택을 선택사항으로 변경한다. 폴더 없이 바로 채팅 가능, 필요하면 폴더 연결.

### Completion Criteria

- Axum 서버가 Tauri setup에서 `tokio::spawn`으로 기동된다
- WebSocket 엔드포인트(`/ws`)가 JSON-RPC 2.0 요청을 받아 dispatcher로 전달한다
- CLI 스트림 이벤트가 WebSocket을 통해 JSON-RPC Notification으로 전달된다
- 프로덕션 빌드에서 Axum이 프론트엔드 정적 파일도 서빙한다(`/`)
- Tauri invoke 코드가 완전히 제거된다
- 디렉토리 없이 세션을 시작할 수 있다
- 브라우저에서 `localhost:3001`로 접속해 동일하게 사용할 수 있다

---

## Architecture

```
┌─── Tauri 프로세스 (네이티브) ──────────────────┐
│                                               │
│  ┌──────────┐   WS localhost:3001  ┌────────┐ │
│  │ WebView  │ ◄──────────────────► │ Axum   │ │
│  │ (React)  │                      │ Server │ │
│  └──────────┘                      │  /ws   │ │
│                                    │  /     │ │
│                                    └────┬───┘ │
│                                         │     │
│                                    subprocess │
│                                         ▼     │
│                                  claude/codex │
└───────────────────────────────────────────────┘

웹 브라우저도 동일:
Browser → localhost:3001 → 정적 파일 + WebSocket
```

포트: 1개 (3001). 개발 시 Vite(5173)는 별도이나 배포 시 제거됨.

---

## File Changes

### Rust — New

| Path | Summary |
|------|---------|
| `src-tauri/src/server/mod.rs` | 서버 모듈 루트 |
| `src-tauri/src/server/ws.rs` | WebSocket 핸들러 — JSON-RPC 요청 파싱, dispatcher 호출, Notification broadcast |
| `src-tauri/src/server/router.rs` | Axum 라우터 설정 — `/ws`, `/` (정적 파일), CORS |
| `src-tauri/src/server/broadcast.rs` | CLI 스트림 이벤트 broadcast 채널 (tokio::broadcast) |

### Rust — Modify

| Path | Summary |
|------|---------|
| `Cargo.toml` | `axum`, `axum-extra` (ws feature), `tower-http` (cors, serve-dir), `tokio-tungstenite` 추가 |
| `src-tauri/src/lib.rs` | setup에서 Axum 서버를 `tokio::spawn`, Tauri invoke_handler에서 rpc 제거 |
| `src-tauri/src/state.rs` | broadcast::Sender 추가 |
| `src-tauri/src/cli/manager.rs` | `app_handle.emit()` 제거 → `broadcast_tx.send()` 로 변경. AppHandle 의존 제거 |
| `src-tauri/src/rpc/handlers.rs` | AppHandle 파라미터 → broadcast_tx로 변경 |
| `src-tauri/src/rpc/dispatcher.rs` | AppHandle → broadcast_tx |

### Rust — Delete

| Path | Summary |
|------|---------|
| `src-tauri/src/commands/cli.rs` | invoke rpc 커맨드 삭제 (WebSocket이 대체) |

### React — Modify

| Path | Summary |
|------|---------|
| `src/renderer/lib/rpc/transport-ws.ts` | stub → 실제 WebSocket 구현 |
| `src/renderer/lib/rpc/transport-tauri.ts` | 삭제 |
| `src/renderer/lib/cli-api.ts` | tauriTransport → wsTransport |
| `src/renderer/components/setup/SetupWizard.tsx` | 디렉토리 선택 없이 바로 시작 가능하게 변경 |
| `src/renderer/components/chat/ChatView.tsx` | 디렉토리 없는 세션 지원 |
| `src/renderer/stores/app-store.ts` | setupComplete 기본값 true (위저드 불필요 시 바로 진입) |

---

## WebSocket Protocol

동일한 JSON-RPC 2.0. 변경 없음.

```
Client → Server (WebSocket text frame):
{"jsonrpc":"2.0","id":1,"method":"cli.startSession","params":{"provider":"claude"}}

Server → Client (response):
{"jsonrpc":"2.0","id":1,"result":"session-uuid"}

Server → Client (notification, streaming):
{"jsonrpc":"2.0","method":"cli.stream","params":{"type":"text_delta","text":"Hello"}}
```

### 디렉토리 선택사항 변경

`cli.startSession`의 `workingDir` 파라미터가 optional:

```json
// Code 모드: 디렉토리 있음
{"jsonrpc":"2.0","id":1,"method":"cli.startSession","params":{"provider":"claude","workingDir":"/project"}}

// Chat 모드: 디렉토리 없음
{"jsonrpc":"2.0","id":1,"method":"cli.startSession","params":{"provider":"claude"}}
```

Backend에서 `workingDir`이 없으면 홈 디렉토리 또는 temp 디렉토리로 fallback. CLI를 `--no-project` 등 옵션 없이 실행하되 cwd를 temp로 설정.

---

## Broadcast Pattern

CLI 스트림 이벤트를 여러 WebSocket 클라이언트에 전달하는 구조:

```rust
// state.rs
pub struct AppState {
    pub db: Mutex<DbConnection>,
    pub cli_manager: Mutex<CliManager>,
    pub broadcast_tx: broadcast::Sender<JsonRpcNotification>,
}

// manager.rs — CLI stdout 읽은 후:
let _ = broadcast_tx.send(notification);

// ws.rs — WebSocket 핸들러:
let mut rx = broadcast_tx.subscribe();
while let Ok(notification) = rx.recv().await {
    ws.send(Message::Text(serde_json::to_string(&notification))).await;
}
```

---

## Implementation Order

1. `Cargo.toml` — axum, tower-http, tokio-tungstenite 의존성 추가
2. `src-tauri/src/server/broadcast.rs` — broadcast 채널 타입
3. `src-tauri/src/state.rs` — broadcast_tx 추가
4. `src-tauri/src/cli/manager.rs` — emit → broadcast_tx.send
5. `src-tauri/src/rpc/dispatcher.rs`, `handlers.rs` — AppHandle → broadcast_tx
6. `src-tauri/src/server/ws.rs` — WebSocket 핸들러
7. `src-tauri/src/server/router.rs` — Axum 라우터
8. `src-tauri/src/server/mod.rs` — 모듈 루트
9. `src-tauri/src/lib.rs` — Axum spawn, invoke 제거
10. `commands/cli.rs` 삭제
11. `src/renderer/lib/rpc/transport-ws.ts` — 실제 구현
12. `src/renderer/lib/rpc/transport-tauri.ts` 삭제
13. `src/renderer/lib/cli-api.ts` — wsTransport 사용
14. Frontend — 디렉토리 선택사항 UI 변경
15. 빌드 검증

---

## Function Signatures

### Rust — Axum Router

```rust
pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/ws", get(ws_handler))
        .nest_service("/", ServeDir::new("dist"))  // 정적 파일
        .layer(CorsLayer::permissive())
        .with_state(state)
}
```

### Rust — WebSocket Handler

```rust
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to broadcast for notifications
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    // Task 1: broadcast → client
    let send_task = tokio::spawn(async move {
        while let Ok(notification) = broadcast_rx.recv().await {
            let text = serde_json::to_string(&notification).unwrap();
            if sender.send(Message::Text(text.into())).await.is_err() { break; }
        }
    });

    // Task 2: client → dispatcher → client response
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            if let Ok(request) = serde_json::from_str::<JsonRpcRequest>(&text) {
                let response = dispatcher::dispatch(request, &state).await;
                let response_text = serde_json::to_string(&response).unwrap();
                // send response back through the socket
            }
        }
    }

    send_task.abort();
}
```

### Rust — StartSession 변경

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartSessionParams {
    provider: String,
    working_dir: Option<String>,  // Optional로 변경
}

// handler에서:
let working_dir = match p.working_dir {
    Some(dir) => PathBuf::from(&dir),
    None => dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp")),
};
```

### TypeScript — WebSocket Transport

```typescript
export function createWsTransport(url: string): RpcTransport {
  const ws = new WebSocket(url)
  const pending = new Map<number, { resolve: Function, reject: Function }>()
  const notificationCallbacks: ((n: JsonRpcNotification) => void)[] = []

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)!.resolve(msg)
      pending.delete(msg.id)
    } else if (!msg.id && msg.method) {
      notificationCallbacks.forEach(cb => cb(msg))
    }
  }

  return {
    send: (request) => new Promise((resolve, reject) => {
      pending.set(request.id, { resolve, reject })
      ws.send(JSON.stringify(request))
    }),
    onNotification: (callback) => {
      notificationCallbacks.push(callback)
      return () => {
        const idx = notificationCallbacks.indexOf(callback)
        if (idx >= 0) notificationCallbacks.splice(idx, 1)
      }
    },
  }
}
```

---

## Constraints

1. Axum 서버 포트는 3001 기본, 환경변수 `KANGNAM_PORT`로 변경 가능
2. 개발 시 Vite(5173)와 Axum(3001) 병행, 프로덕션은 Axum(3001)만
3. WebSocket 재연결: 프론트엔드에서 연결 끊기면 3초 후 자동 재연결
4. CORS: 개발 시 permissive, 프로덕션은 same-origin

## Decisions

- **Axum을 Tauri 안에 내장** — 별도 프로세스 대비 관리가 단순. tokio::spawn으로 같은 런타임 공유.
- **Tauri invoke 완전 제거** — transport를 하나(WebSocket)로 통일. 디버깅 단순화.
- **broadcast 채널** — 다수 WebSocket 클라이언트 대응. 향후 멀티 탭/창 지원.
- **workingDir optional** — 모드 구분 없이 자연스럽게 Code/Chat 전환.
