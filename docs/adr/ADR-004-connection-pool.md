# ADR-004: Mutex<Connection> -> Connection Pool

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`state.rs`에서 `AppState`는 `db: Mutex<Connection>`으로 단일 SQLite 커넥션을 관리한다. 문제:

1. **동시성 병목**: Tauri command가 동시 호출되면(chat 스트리밍 중 conversation list 갱신 등) Mutex 대기 발생.
2. **우회 커넥션**: `commands/eval.rs:279`에서 `crate::db::connection::open_database(&db_path)`로 별도 커넥션을 직접 열어 Mutex를 우회한다. WAL 모드이므로 동작하지만, 커넥션 관리가 분산되어 있고 busy_timeout 설정이 각 커넥션에 개별 적용되어야 한다.
3. **장기 트랜잭션 위험**: 스트리밍 중 DB 잠금이 다른 command를 차단할 수 있음.

SQLite WAL 모드에서 **단일 writer + 다중 reader** 모델이 가능하므로, 읽기 전용 커넥션 풀이 효과적이다.

## Decision

**r2d2-sqlite** 커넥션 풀을 채택한다.

### 구성

```rust
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

pub struct AppState {
    pub db_pool: Pool<SqliteConnectionManager>,
    pub data_dir: PathBuf,
    pub auth: AuthManager,
    pub router: LLMRouter,
    pub mcp: McpBridge,
}
```

### 풀 설정

```rust
let manager = SqliteConnectionManager::file(&db_path)
    .with_init(|conn| {
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "busy_timeout", "10000")?;
        Ok(())
    });

let pool = Pool::builder()
    .max_size(4)        // 1 writer + 3 readers (데스크톱 앱 기준 충분)
    .min_idle(Some(1))  // 최소 1개 유휴 커넥션 유지
    .build(manager)
    .map_err(|e| format!("DB pool error: {e}"))?;
```

**풀 사이즈: 4**. 근거:
- Tauri command는 동시에 최대 2-3개 병렬 실행 (UI 스레드 + 백그라운드 스트리밍 + eval)
- SQLite WAL은 동시 reader에 제한이 없으나, 커넥션당 메모리(~2MB)와 파일 핸들 고려
- 데스크톱 단일 사용자 앱이므로 4개면 충분. 10 이상은 과잉

### 사용 패턴

```rust
// 기존: let conn = state.db.lock().unwrap();
// 변경: let conn = state.db_pool.get().map_err(|e| e.to_string())?;
```

### eval.rs 우회 제거

`eval.rs`에서 직접 `open_database(&db_path)` 호출을 제거하고, `state.db_pool.get()`으로 교체한다.

## Alternatives Rejected

1. **deadpool-sqlite**: 기각 이유: deadpool은 async 런타임(tokio) 기반 풀로, `rusqlite::Connection`은 `!Send`이므로 `spawn_blocking`이 필요하다. r2d2는 동기 풀이고 Tauri command의 동기 DB 접근 패턴에 더 자연스럽다. deadpool의 async 이점이 이 프로젝트에서 실질적 가치를 제공하지 않는다.
2. **커스텀 풀 (Mutex<Vec<Connection>>)**: 기각 이유: 커넥션 풀의 idle 관리, timeout, health check를 직접 구현하는 것은 r2d2가 이미 해결한 문제를 재구현하는 것. 유지보수 부담만 증가.

## Consequences

- Cargo.toml에 `r2d2 = "0.8"`, `r2d2_sqlite = "0.25"` 의존성 추가.
- `state.rs` 변경: `Mutex<Connection>` -> `Pool<SqliteConnectionManager>`.
- 전체 `state.db.lock().unwrap()` 호출을 `state.db_pool.get().map_err(...)` 로 교체. 영향 파일: `commands/conv.rs`, `commands/chat.rs`, `commands/eval.rs`, `commands/prompts_ai.rs`, `commands/mcp.rs`, `commands/skills.rs`, `commands/auth.rs`, `commands/settings.rs`, `auth/manager.rs`, `auth/token_store.rs`.
- eval.rs의 별도 커넥션 열기 우회 패턴 제거.
- 마이그레이션(ADR-003)은 풀 초기화 전에 단일 커넥션으로 실행해야 하므로, 풀 생성 전 마이그레이션 -> 풀 생성 순서 유지.
