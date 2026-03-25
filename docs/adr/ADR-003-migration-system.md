# ADR-003: 마이그레이션 시스템

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

현재 `db/schema.rs`의 `run_migrations`는 `CREATE TABLE IF NOT EXISTS`와 `let _ = tx.execute_batch("ALTER TABLE ...")` 패턴을 사용한다. `let _`은 ALTER가 실패해도(이미 컬럼 존재) 무시한다. 이 방식의 문제:

1. **버전 추적 없음**: 어떤 마이그레이션이 적용되었는지 알 수 없다. 앱 업데이트 시 어디서부터 실행해야 하는지 불명확.
2. **에러 무시**: `let _`가 의도적 중복 방지와 실제 오류를 구분하지 않는다. ALTER TABLE 구문 오류도 무시된다.
3. **순서 보장 약함**: 마이그레이션 간 의존성(예: FTS5 트리거가 messages 테이블 컬럼에 의존)을 코드 순서로만 관리.
4. **롤백 불가**: 실패 시 부분 적용 상태에서 복구 방법 없음.

## Decision

**자체 구현 버전 기반 마이그레이션 시스템**을 채택한다. 이 ADR은 마이그레이션 엔진 설계를 정의한다. 구체적인 마이그레이션 버전 목록(V001~V005)은 `docs/llm/db-schema-improvement.md`에 위임한다.

### 설계

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  version  INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

```rust
struct Migration {
    version: u32,
    name: &'static str,
    up: &'static str,   // SQL 문
}

const MIGRATIONS: &[Migration] = &[
    Migration { version: 1, name: "initial_schema", up: "CREATE TABLE IF NOT EXISTS conversations (...); CREATE TABLE IF NOT EXISTS messages (...); CREATE INDEX IF NOT EXISTS idx_messages_conv ..." },
    Migration { version: 2, name: "add_pinned_column", up: "ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0" },
    Migration { version: 3, name: "add_message_attachments", up: "ALTER TABLE messages ADD COLUMN attachments TEXT" },
    Migration { version: 4, name: "add_tool_columns", up: "ALTER TABLE messages ADD COLUMN tool_name TEXT; ALTER TABLE messages ADD COLUMN tool_args TEXT" },
    Migration { version: 5, name: "create_mcp_servers", up: "CREATE TABLE IF NOT EXISTS mcp_servers (...)" },
    Migration { version: 6, name: "create_auth_tokens", up: "CREATE TABLE IF NOT EXISTS auth_tokens (...)" },
    Migration { version: 7, name: "create_prompts", up: "CREATE TABLE IF NOT EXISTS prompts (...)" },
    Migration { version: 8, name: "add_prompt_columns", up: "ALTER TABLE prompts ADD COLUMN description ...; ALTER TABLE prompts ADD COLUMN argument_hint ...; ALTER TABLE prompts ADD COLUMN model ...; ALTER TABLE prompts ADD COLUMN user_invocable ..." },
    Migration { version: 9, name: "create_skill_references", up: "CREATE TABLE IF NOT EXISTS skill_references (...)" },
    Migration { version: 10, name: "create_eval_tables", up: "CREATE TABLE IF NOT EXISTS skill_eval_sets (...); ..." },
    Migration { version: 11, name: "add_fts5_search", up: "CREATE VIRTUAL TABLE ... (ADR-002)" },
    Migration { version: 12, name: "add_conversation_index", up: "CREATE INDEX ... (ADR-002)" },
];
```

### 실행 로직

```rust
fn run_migrations(conn: &mut Connection) -> Result<()> {
    // 1. _migrations 테이블 생성 (IF NOT EXISTS)
    // 2. SELECT MAX(version) FROM _migrations
    // 3. current_version 이후의 마이그레이션만 순차 실행
    // 4. 각 마이그레이션을 개별 트랜잭션으로 실행
    // 5. 성공 시 _migrations에 INSERT
    // 6. 실패 시 트랜잭션 롤백 + 에러 반환 (let _ 패턴 제거)
}
```

### 기존 DB 호환

기존 사용자의 DB에는 `_migrations` 테이블이 없다. 첫 실행 시:
1. `_migrations` 테이블 생성
2. 테이블 존재 여부로 현재 상태 감지 (`conversations` 테이블에 `pinned` 컬럼 존재 확인 등)
3. 이미 적용된 마이그레이션을 `_migrations`에 소급 기록
4. 미적용 마이그레이션만 실행

## Alternatives Rejected

1. **refinery (Rust 마이그레이션 프레임워크)**: 기각 이유: refinery는 PostgreSQL/MySQL 중심이고, SQLite FTS5 `CREATE VIRTUAL TABLE` 구문과의 호환성이 불확실하다. 외부 의존성 추가 대비 이점이 크지 않다. 마이그레이션이 12개 수준이고 증가 속도가 느린 데스크톱 앱이므로 자체 구현이 복잡도 대비 적절하다.
2. **barrel (스키마 빌더)**: 기각 이유: barrel은 DDL 생성 DSL이며 마이그레이션 실행/추적은 별도 구현 필요. DSL 레이어가 오히려 원본 SQL보다 가독성이 낮고 FTS5 같은 SQLite 확장을 지원하지 않는다.

## Consequences

- `let _` 에러 무시 패턴 전면 제거. 마이그레이션 실패 시 앱 시작이 실패하며 사용자에게 에러 보고.
- `_migrations` 테이블로 적용 이력 추적 가능. 디버깅과 지원에 유용.
- 신규 마이그레이션 추가 시 `MIGRATIONS` 배열에 항목 추가만 필요.
- `db/schema.rs`의 현재 코드를 `db/migrations.rs`로 이동 및 재구성.
- ADR-002(FTS5), ADR-004(커넥션 풀)의 전제 조건.
