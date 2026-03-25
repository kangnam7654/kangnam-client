# DB Schema Improvement Design Spec

**대상:** kangnam-client SQLite (src-tauri/src/db/)
**입력:** audit-report.md P3-1, P3-2, P3-6, P3-11
**현재 DB 점수:** 5.3 / 10

---

## 목적

현재 스키마의 인덱스 부재, LIKE 기반 검색, `let _ = ALTER TABLE` 마이그레이션 패턴, CHECK 제약조건 부재를 해결하여 쿼리 성능, 데이터 무결성, 스키마 진화 관리성을 확보한다.

**완료 조건:**
- `list_conversations` 쿼리가 복합 인덱스를 활용 (EXPLAIN QUERY PLAN으로 SCAN 없음 확인)
- `search_messages`가 FTS5 MATCH를 사용하여 LIKE 대비 10배 이상 성능 향상
- 마이그레이션이 버전 번호 기반으로 실행되며, 이미 적용된 버전은 건너뜀
- messages.role, skill_eval_runs.status에 CHECK 제약조건 적용
- conversations, prompts의 updated_at가 트리거로 자동 갱신
- 기존 DB 파일이 새 스키마로 무손실 마이그레이션

---

## 파일 변경 목록

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `src-tauri/src/db/schema.rs` | 대폭 수정 | `run_migrations()` 전체 교체: 마이그레이션 테이블 기반 버전 관리 시스템으로 전환 |
| `src-tauri/src/db/connection.rs` | 수정 | `busy_timeout` 5000 -> 10000 |
| `src-tauri/src/db/conversations.rs` | 수정 | `search_messages()` 함수에서 LIKE -> FTS5 MATCH 전환 |
| `src-tauri/src/db/mod.rs` | 수정 (해당 시) | 모듈 구조 변경 없음 |

---

## 구현 순서

1. connection.rs: busy_timeout 값 변경
2. schema.rs: migrations 테이블 DDL + 마이그레이션 실행 엔진 구현
3. schema.rs: V001 (현재 스키마를 baseline으로 등록)
4. schema.rs: V002 (인덱스 추가)
5. schema.rs: V003 (FTS5 가상 테이블 + 트리거)
6. schema.rs: V004 (CHECK 제약조건 — 신규 테이블 재생성)
7. schema.rs: V005 (updated_at 자동 갱신 트리거)
8. conversations.rs: search_messages를 FTS5 MATCH로 전환
9. 기존 테스트 업데이트 + 신규 마이그레이션 테스트 추가

---

## 1. 마이그레이션 시스템

### 1.1 migrations 테이블

```sql
CREATE TABLE IF NOT EXISTS _migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    checksum    TEXT NOT NULL,
    applied_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

**설계 결정:**
- 테이블명 `_migrations` (언더스코어 접두어로 시스템 테이블 구분)
- `version`은 INTEGER PRIMARY KEY (자동 정렬, 비교 용이)
- `checksum`은 마이그레이션 SQL 본문의 SHA-256 해시 (변조 감지)
- 롤백 미지원: SQLite는 DDL 트랜잭션이 제한적이며, 이 프로젝트는 단일 사용자 데스크톱 앱이므로 롤백보다 백업+재실행이 안전함

**기각한 대안:**
- `down_sql` 컬럼을 두어 롤백 지원 -> SQLite에서 ALTER TABLE DROP COLUMN은 3.35.0+에서만 지원, CHECK 제약조건 변경은 테이블 재생성 필수. 롤백 SQL의 정확성 보장이 불가능하므로 기각.

### 1.2 마이그레이션 실행 로직 (Rust 의사코드)

```
fn run_migrations(conn: &mut Connection) -> Result<()> {
    -- 1. _migrations 테이블이 없으면 생성
    CREATE TABLE IF NOT EXISTS _migrations (...)

    -- 2. 현재 적용된 최대 버전 조회
    let current_version = SELECT COALESCE(MAX(version), 0) FROM _migrations

    -- 3. 기존 DB 감지 (conversations 테이블은 있지만 _migrations 없는 경우)
    if current_version == 0 AND table_exists("conversations") {
        -- 기존 DB를 V001 baseline으로 등록
        INSERT INTO _migrations (version, name, checksum)
        VALUES (1, 'V001_baseline', sha256("baseline"))
        current_version = 1
    }

    -- 4. 마이그레이션 목록 (코드에 하드코딩)
    let migrations = [
        Migration { version: 1, name: "V001_baseline", sql: BASELINE_SQL },
        Migration { version: 2, name: "V002_indexes", sql: INDEX_SQL },
        Migration { version: 3, name: "V003_fts5", sql: FTS5_SQL },
        Migration { version: 4, name: "V004_check_constraints", sql: CHECK_SQL },
        Migration { version: 5, name: "V005_updated_at_triggers", sql: TRIGGER_SQL },
    ]

    -- 5. 미적용 마이그레이션 순차 실행
    for m in migrations where m.version > current_version {
        let tx = conn.transaction()
        tx.execute_batch(m.sql)
        tx.execute(
            "INSERT INTO _migrations (version, name, checksum) VALUES (?1, ?2, ?3)",
            [m.version, m.name, sha256(m.sql)]
        )
        tx.commit()
    }

    -- 6. 변조 감지 (선택적)
    for m in migrations where m.version <= current_version {
        let stored_checksum = SELECT checksum FROM _migrations WHERE version = m.version
        if stored_checksum != sha256(m.sql) {
            log::warn!("Migration V{} checksum mismatch — SQL may have been modified after deployment", m.version)
        }
    }
}
```

**핵심 규칙:**
- 각 마이그레이션은 개별 트랜잭션에서 실행 (하나 실패 시 해당 버전만 롤백, 이전 버전은 보존)
- 이미 적용된 버전은 절대 재실행하지 않음
- 신규 DB (테이블 없음): V001부터 순차 실행
- 기존 DB (conversations 있지만 _migrations 없음): V001을 건너뛰고 V002부터 실행

---

## 2. V001 — Baseline (현재 스키마 등록)

신규 DB에서만 실행. 기존 DB에서는 건너뜀.

```sql
-- V001_baseline.sql
-- 현재 schema.rs의 CREATE TABLE IF NOT EXISTS 문 전체를 그대로 포함
-- (conversations, messages, mcp_servers, auth_tokens, prompts,
--  skill_references, skill_eval_sets, skill_eval_cases,
--  skill_eval_runs, skill_eval_results)
-- + 기존 ALTER TABLE 마이그레이션을 모두 통합한 최종 상태

CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    provider    TEXT NOT NULL,
    model       TEXT,
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    tool_use_id     TEXT,
    tool_name       TEXT,
    tool_args       TEXT,
    token_count     INTEGER,
    attachments     TEXT,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
    ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS mcp_servers (
    name     TEXT PRIMARY KEY,
    type     TEXT NOT NULL,
    command  TEXT,
    args     TEXT,
    url      TEXT,
    env      TEXT,
    headers  TEXT,
    enabled  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    provider      TEXT PRIMARY KEY,
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    expires_at    INTEGER,
    metadata      TEXT
);

CREATE TABLE IF NOT EXISTS prompts (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL,
    icon            TEXT NOT NULL DEFAULT 'default',
    argument_hint   TEXT,
    model           TEXT,
    user_invocable  INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS skill_references (
    id          TEXT PRIMARY KEY,
    skill_id    TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    content     TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_skill_refs_skill
    ON skill_references(skill_id, sort_order);

CREATE TABLE IF NOT EXISTS skill_eval_sets (
    id          TEXT PRIMARY KEY,
    skill_id    TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT 'Default',
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_sets_skill
    ON skill_eval_sets(skill_id);

CREATE TABLE IF NOT EXISTS skill_eval_cases (
    id             TEXT PRIMARY KEY,
    eval_set_id    TEXT NOT NULL REFERENCES skill_eval_sets(id) ON DELETE CASCADE,
    prompt         TEXT NOT NULL,
    expected       TEXT NOT NULL DEFAULT '',
    should_trigger INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_eval_cases_set
    ON skill_eval_cases(eval_set_id, sort_order);

CREATE TABLE IF NOT EXISTS skill_eval_runs (
    id                TEXT PRIMARY KEY,
    eval_set_id       TEXT NOT NULL REFERENCES skill_eval_sets(id) ON DELETE CASCADE,
    skill_id          TEXT NOT NULL,
    skill_name        TEXT NOT NULL,
    skill_desc        TEXT NOT NULL DEFAULT '',
    skill_body        TEXT NOT NULL DEFAULT '',
    provider          TEXT NOT NULL,
    model             TEXT,
    status            TEXT NOT NULL DEFAULT 'running',
    trigger_accuracy  REAL,
    quality_mean      REAL,
    quality_stddev    REAL,
    total_cases       INTEGER NOT NULL DEFAULT 0,
    completed_cases   INTEGER NOT NULL DEFAULT 0,
    created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_set
    ON skill_eval_runs(eval_set_id, created_at DESC);

CREATE TABLE IF NOT EXISTS skill_eval_results (
    id                TEXT PRIMARY KEY,
    run_id            TEXT NOT NULL REFERENCES skill_eval_runs(id) ON DELETE CASCADE,
    case_id           TEXT NOT NULL REFERENCES skill_eval_cases(id) ON DELETE CASCADE,
    did_trigger       INTEGER,
    trigger_correct   INTEGER,
    response_with     TEXT,
    response_without  TEXT,
    quality_score     INTEGER,
    quality_reason    TEXT,
    feedback          TEXT,
    feedback_rating   INTEGER,
    status            TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_eval_results_run
    ON skill_eval_results(run_id);
```

---

## 3. V002 — 인덱스 추가

```sql
-- V002_indexes.sql

-- conversations: list_conversations()의 ORDER BY pinned DESC, updated_at DESC 최적화
-- 현재 쿼리: SELECT ... FROM conversations ORDER BY pinned DESC, updated_at DESC
-- 개선 효과: full table scan -> index scan (대화 1000건 기준 ~10x 개선)
CREATE INDEX IF NOT EXISTS idx_conversations_list
    ON conversations(pinned DESC, updated_at DESC);

-- skill_eval_results: case_id로 조회하는 패턴 최적화
-- 현재: idx_eval_results_run은 run_id만 커버
-- 개선: case_id 단독 조회 시 index scan 가능
CREATE INDEX IF NOT EXISTS idx_eval_results_case
    ON skill_eval_results(case_id);

-- prompts: list_skills()의 ORDER BY sort_order ASC, title ASC 최적화
-- 소규모 테이블이므로 선택적이나, 인덱스 비용도 미미
CREATE INDEX IF NOT EXISTS idx_prompts_sort
    ON prompts(sort_order ASC, title ASC);
```

---

## 4. V003 — FTS5 전문 검색

### 4.1 FTS5 가상 테이블

```sql
-- V003_fts5.sql

-- FTS5 가상 테이블: messages.content 전문 검색
-- content=messages: 원본 데이터는 messages 테이블에 저장, FTS는 인덱스만 보유 (external content)
-- content_rowid=rowid: messages의 rowid와 동기화
-- tokenize='unicode61 remove_diacritics 2': 유니코드 기반 토크나이저, 한국어/영어 모두 지원
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    content=messages,
    content_rowid=rowid,
    tokenize='unicode61 remove_diacritics 2'
);
```

**설계 결정 — external content FTS5:**
- `content=messages`를 사용하여 데이터 중복 저장 방지 (디스크 절약)
- 트레이드오프: 트리거로 수동 동기화 필요. 그러나 messages는 INSERT 위주 (UPDATE/DELETE 드뭄)이므로 동기화 비용 최소
- `content=''` (contentless) 대안 기각: snippet() 함수 사용 불가, 향후 하이라이트 기능에 제약

**설계 결정 — tokenize:**
- `unicode61 remove_diacritics 2` 선택: 기본 유니코드 분리 + 발음 구별 부호 제거
- `trigram` 대안 검토: 한국어 부분 검색에 유리하나 인덱스 크기 3-5배 증가. 데스크톱 앱에서 디스크 비용 과다
- CJK 토크나이저 (`icu`) 대안 검토: ICU 라이브러리 의존성 추가 필요, 빌드 복잡도 증가로 기각

### 4.2 동기화 트리거

```sql
-- INSERT 트리거: 새 메시지 추가 시 FTS 인덱스에 반영
CREATE TRIGGER IF NOT EXISTS messages_fts_insert
AFTER INSERT ON messages
BEGIN
    INSERT INTO messages_fts(rowid, content)
    VALUES (NEW.rowid, NEW.content);
END;

-- DELETE 트리거: 메시지 삭제 시 FTS 인덱스에서 제거
-- external content 모드에서는 삭제 전 원본 값을 명시해야 함
CREATE TRIGGER IF NOT EXISTS messages_fts_delete
BEFORE DELETE ON messages
BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content)
    VALUES ('delete', OLD.rowid, OLD.content);
END;

-- UPDATE 트리거: 메시지 내용 변경 시 FTS 인덱스 갱신
-- (현재 코드에서 messages UPDATE는 없으나, 방어적으로 추가)
CREATE TRIGGER IF NOT EXISTS messages_fts_update
AFTER UPDATE OF content ON messages
BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content)
    VALUES ('delete', OLD.rowid, OLD.content);
    INSERT INTO messages_fts(rowid, content)
    VALUES (NEW.rowid, NEW.content);
END;
```

### 4.3 기존 데이터 인덱싱 (V003 마이그레이션 내 실행)

```sql
-- 기존 messages 데이터를 FTS 인덱스에 일괄 삽입
INSERT INTO messages_fts(rowid, content)
SELECT rowid, content FROM messages;
```

### 4.4 search_messages 쿼리 변경

**현재 (LIKE):**
```sql
SELECT m.id, m.conversation_id, c.title, m.content, m.role, m.created_at
FROM messages m JOIN conversations c ON c.id = m.conversation_id
WHERE m.content LIKE '%keyword%' AND m.role IN ('user', 'assistant')
ORDER BY m.created_at DESC LIMIT 50
```

**개선 (FTS5 MATCH):**
```sql
SELECT m.id, m.conversation_id, c.title, m.content, m.role, m.created_at
FROM messages m
JOIN messages_fts fts ON fts.rowid = m.rowid
JOIN conversations c ON c.id = m.conversation_id
WHERE messages_fts MATCH ?1
  AND m.role IN ('user', 'assistant')
ORDER BY m.created_at DESC
LIMIT 50
```

**Rust 코드 변경 (conversations.rs `search_messages`):**
- `format!("%{trimmed}%")` 제거
- FTS5 쿼리 문법으로 입력 변환: 사용자 입력의 특수문자를 이스케이프하고 `"` 로 감싸기
- 입력 예: `hello world` -> `"hello" "world"` (AND 검색)
- 시그니처 변경 없음: `fn search_messages(conn: &Connection, query: &str) -> Result<Vec<SearchResult>, rusqlite::Error>`

**FTS5 쿼리 이스케이프 함수 (신규):**
```
fn escape_fts5_query(input: &str) -> String {
    -- 각 단어를 큰따옴표로 감싸서 특수문자 이스케이프
    -- 빈 단어 제거
    input.split_whitespace()
        .map(|word| format!("\"{}\"", word.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ")
}
```

---

## 5. V004 — CHECK 제약조건

SQLite에서 기존 테이블에 CHECK 제약조건을 추가하려면 테이블 재생성이 필요하다. 그러나 이는 외래키 관계, 인덱스, 트리거를 모두 재구성해야 하므로 위험도가 높다.

**채택한 방안:** 테이블 재생성 대신 INSERT/UPDATE 트리거로 CHECK 로직 구현

**기각한 대안:** ALTER TABLE ... RENAME + CREATE TABLE 재생성 패턴 -> messages 테이블은 FTS5 트리거, 외래키 CASCADE 등 의존성이 많아 재생성 시 데이터 손실 위험. 트리거 방식이 안전.

### 5.1 messages.role 검증 트리거

```sql
-- V004_check_constraints.sql

-- messages.role 검증: INSERT
CREATE TRIGGER IF NOT EXISTS check_messages_role_insert
BEFORE INSERT ON messages
BEGIN
    SELECT CASE
        WHEN NEW.role NOT IN ('user', 'assistant', 'system', 'tool')
        THEN RAISE(ABORT, 'Invalid message role. Must be: user, assistant, system, tool')
    END;
END;

-- messages.role 검증: UPDATE
CREATE TRIGGER IF NOT EXISTS check_messages_role_update
BEFORE UPDATE OF role ON messages
BEGIN
    SELECT CASE
        WHEN NEW.role NOT IN ('user', 'assistant', 'system', 'tool')
        THEN RAISE(ABORT, 'Invalid message role. Must be: user, assistant, system, tool')
    END;
END;

-- skill_eval_runs.status 검증: INSERT
CREATE TRIGGER IF NOT EXISTS check_eval_run_status_insert
BEFORE INSERT ON skill_eval_runs
BEGIN
    SELECT CASE
        WHEN NEW.status NOT IN ('running', 'complete', 'stopped', 'pending')
        THEN RAISE(ABORT, 'Invalid eval run status. Must be: running, complete, stopped, pending')
    END;
END;

-- skill_eval_runs.status 검증: UPDATE
CREATE TRIGGER IF NOT EXISTS check_eval_run_status_update
BEFORE UPDATE OF status ON skill_eval_runs
BEGIN
    SELECT CASE
        WHEN NEW.status NOT IN ('running', 'complete', 'stopped', 'pending')
        THEN RAISE(ABORT, 'Invalid eval run status. Must be: running, complete, stopped, pending')
    END;
END;

-- skill_eval_results.status 검증: INSERT
CREATE TRIGGER IF NOT EXISTS check_eval_result_status_insert
BEFORE INSERT ON skill_eval_results
BEGIN
    SELECT CASE
        WHEN NEW.status NOT IN ('pending', 'running', 'complete', 'error')
        THEN RAISE(ABORT, 'Invalid eval result status. Must be: pending, running, complete, error')
    END;
END;

-- skill_eval_results.status 검증: UPDATE
CREATE TRIGGER IF NOT EXISTS check_eval_result_status_update
BEFORE UPDATE OF status ON skill_eval_results
BEGIN
    SELECT CASE
        WHEN NEW.status NOT IN ('pending', 'running', 'complete', 'error')
        THEN RAISE(ABORT, 'Invalid eval result status. Must be: pending, running, complete, error')
    END;
END;

-- mcp_servers.type 검증: INSERT
CREATE TRIGGER IF NOT EXISTS check_mcp_server_type_insert
BEFORE INSERT ON mcp_servers
BEGIN
    SELECT CASE
        WHEN NEW.type NOT IN ('stdio', 'sse', 'streamable-http')
        THEN RAISE(ABORT, 'Invalid MCP server type. Must be: stdio, sse, streamable-http')
    END;
    -- stdio: command 필수
    SELECT CASE
        WHEN NEW.type = 'stdio' AND (NEW.command IS NULL OR NEW.command = '')
        THEN RAISE(ABORT, 'stdio MCP server requires command field')
    END;
    -- sse, streamable-http: url 필수
    SELECT CASE
        WHEN NEW.type IN ('sse', 'streamable-http') AND (NEW.url IS NULL OR NEW.url = '')
        THEN RAISE(ABORT, 'sse/streamable-http MCP server requires url field')
    END;
END;

-- mcp_servers.type 검증: UPDATE
CREATE TRIGGER IF NOT EXISTS check_mcp_server_type_update
BEFORE UPDATE ON mcp_servers
BEGIN
    SELECT CASE
        WHEN NEW.type NOT IN ('stdio', 'sse', 'streamable-http')
        THEN RAISE(ABORT, 'Invalid MCP server type. Must be: stdio, sse, streamable-http')
    END;
    SELECT CASE
        WHEN NEW.type = 'stdio' AND (NEW.command IS NULL OR NEW.command = '')
        THEN RAISE(ABORT, 'stdio MCP server requires command field')
    END;
    SELECT CASE
        WHEN NEW.type IN ('sse', 'streamable-http') AND (NEW.url IS NULL OR NEW.url = '')
        THEN RAISE(ABORT, 'sse/streamable-http MCP server requires url field')
    END;
END;
```

**주의:** 기존 데이터 중 위 제약조건을 위반하는 행이 있을 수 있다. V004 마이그레이션 실행 전 검증 쿼리로 확인 후, 위반 행이 있으면 수정 또는 경고를 로그에 남기고 마이그레이션을 계속 진행한다 (트리거는 기존 행에 영향 없음, INSERT/UPDATE 시점에만 작동).

```sql
-- V004 사전 검증 쿼리 (마이그레이션 코드에서 실행, 실패해도 마이그레이션은 진행)
SELECT id, role FROM messages
WHERE role NOT IN ('user', 'assistant', 'system', 'tool');

SELECT id, status FROM skill_eval_runs
WHERE status NOT IN ('running', 'complete', 'stopped', 'pending');

SELECT name, type FROM mcp_servers
WHERE type NOT IN ('stdio', 'sse', 'streamable-http');
```

---

## 6. V005 — updated_at 자동 갱신 트리거

```sql
-- V005_updated_at_triggers.sql

-- conversations: 어떤 컬럼이든 UPDATE되면 updated_at 자동 갱신
CREATE TRIGGER IF NOT EXISTS conversations_updated_at
AFTER UPDATE ON conversations
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE conversations SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- prompts: 어떤 컬럼이든 UPDATE되면 updated_at 자동 갱신
CREATE TRIGGER IF NOT EXISTS prompts_updated_at
AFTER UPDATE ON prompts
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE prompts SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- skill_eval_sets: 동일 패턴
CREATE TRIGGER IF NOT EXISTS skill_eval_sets_updated_at
AFTER UPDATE ON skill_eval_sets
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE skill_eval_sets SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
```

**설계 결정 — WHEN 조건:**
- `WHEN NEW.updated_at = OLD.updated_at` 조건으로 무한 루프 방지
- 코드에서 명시적으로 `updated_at`를 설정한 경우 (예: `update_title`에서 `updated_at = ?2`) 트리거가 덮어쓰지 않음
- 코드에서 `updated_at`를 설정하지 않은 UPDATE (예: `toggle_pin`)에서 자동 갱신 동작

**코드 영향:**
- `toggle_pin()`: 현재 `updated_at` 미갱신 -> 트리거가 자동 처리하므로 코드 변경 불필요
- `update_title()`: 코드에서 명시적 `updated_at` 설정 -> 트리거 미작동, 기존 동작 보존
- `add_message()`의 `UPDATE conversations SET updated_at = ?1`: 명시적 설정이므로 트리거 미작동, 기존 동작 보존

---

## 7. Connection 설정 변경

### 7.1 busy_timeout

```
-- connection.rs 변경
현재: conn.pragma_update(None, "busy_timeout", "5000")
변경: conn.pragma_update(None, "busy_timeout", "10000")
```

**근거:** r2d2-sqlite 커넥션 풀 도입 시 다중 스레드에서 동시 쓰기 경합이 발생할 수 있다. WAL 모드에서 읽기는 병렬이지만 쓰기는 직렬. 10초 타임아웃은 일시적 락 경합을 흡수한다.

### 7.2 WAL 모드 (현행 유지)

```
conn.pragma_update(None, "journal_mode", "WAL")  -- 변경 없음
```

### 7.3 r2d2 호환성 참고사항

향후 `Mutex<Connection>` -> `r2d2::Pool<SqliteConnectionManager>` 전환 시:
- `SqliteConnectionManager::file(path)` 로 풀 생성
- 풀의 `connection_customizer`에서 PRAGMA 설정 (foreign_keys, busy_timeout)
- 이 설계의 모든 마이그레이션 SQL은 r2d2와 호환됨 (DDL은 단일 연결에서 실행하면 됨)

---

## 8. 하위호환성 마이그레이션 경로

### 시나리오 A: 신규 설치 (DB 파일 없음)

```
1. open_database() 호출 -> 빈 DB 생성
2. run_migrations() 호출
3. _migrations 테이블 생성
4. conversations 테이블 미존재 -> V001부터 순차 실행
5. V001: 모든 테이블 + 기존 인덱스 생성
6. V002: 추가 인덱스 생성
7. V003: FTS5 테이블 + 트리거 생성 (데이터 없으므로 일괄 삽입 건너뜀)
8. V004: CHECK 트리거 생성
9. V005: updated_at 트리거 생성
10. seed_preset_skills() 실행
```

### 시나리오 B: 기존 DB 업그레이드 (_migrations 테이블 없음)

```
1. open_database() 호출 -> 기존 DB 열기
2. run_migrations() 호출
3. _migrations 테이블 생성
4. conversations 테이블 존재 + _migrations 비어있음 -> 기존 DB로 판정
5. V001을 실행하지 않고 _migrations에 V001 레코드만 삽입 (baseline 등록)
6. V002: 인덱스 생성 (IF NOT EXISTS이므로 안전)
7. V003: FTS5 테이블 + 트리거 생성 + 기존 messages 일괄 인덱싱
8. V004: CHECK 트리거 생성 + 기존 데이터 검증 로그
9. V005: updated_at 트리거 생성
10. seed_preset_skills() 실행 (IF NOT EXISTS 패턴이므로 안전)
```

### 시나리오 C: 이미 일부 마이그레이션 적용된 DB

```
1. open_database() -> run_migrations()
2. _migrations에서 MAX(version) 조회 (예: 3)
3. V004, V005만 순차 실행
```

---

## 9. 전체 인덱스 목록 (개선 후)

| 인덱스명 | 테이블 | 컬럼 | 마이그레이션 |
|----------|--------|------|-------------|
| `idx_messages_conv` | messages | (conversation_id, created_at) | V001 (기존) |
| `idx_skill_refs_skill` | skill_references | (skill_id, sort_order) | V001 (기존) |
| `idx_eval_sets_skill` | skill_eval_sets | (skill_id) | V001 (기존) |
| `idx_eval_cases_set` | skill_eval_cases | (eval_set_id, sort_order) | V001 (기존) |
| `idx_eval_runs_set` | skill_eval_runs | (eval_set_id, created_at DESC) | V001 (기존) |
| `idx_eval_results_run` | skill_eval_results | (run_id) | V001 (기존) |
| **`idx_conversations_list`** | conversations | **(pinned DESC, updated_at DESC)** | **V002 (신규)** |
| **`idx_eval_results_case`** | skill_eval_results | **(case_id)** | **V002 (신규)** |
| **`idx_prompts_sort`** | prompts | **(sort_order ASC, title ASC)** | **V002 (신규)** |
| **`messages_fts`** | messages (virtual) | **(content)** | **V003 (신규)** |

---

## 10. 전체 트리거 목록 (개선 후)

| 트리거명 | 테이블 | 이벤트 | 마이그레이션 |
|----------|--------|--------|-------------|
| `messages_fts_insert` | messages | AFTER INSERT | V003 |
| `messages_fts_delete` | messages | BEFORE DELETE | V003 |
| `messages_fts_update` | messages | AFTER UPDATE OF content | V003 |
| `check_messages_role_insert` | messages | BEFORE INSERT | V004 |
| `check_messages_role_update` | messages | BEFORE UPDATE OF role | V004 |
| `check_eval_run_status_insert` | skill_eval_runs | BEFORE INSERT | V004 |
| `check_eval_run_status_update` | skill_eval_runs | BEFORE UPDATE OF status | V004 |
| `check_eval_result_status_insert` | skill_eval_results | BEFORE INSERT | V004 |
| `check_eval_result_status_update` | skill_eval_results | BEFORE UPDATE OF status | V004 |
| `check_mcp_server_type_insert` | mcp_servers | BEFORE INSERT | V004 |
| `check_mcp_server_type_update` | mcp_servers | BEFORE UPDATE | V004 |
| `conversations_updated_at` | conversations | AFTER UPDATE | V005 |
| `prompts_updated_at` | prompts | AFTER UPDATE | V005 |
| `skill_eval_sets_updated_at` | skill_eval_sets | AFTER UPDATE | V005 |

---

## 제약 조건

1. 모든 CREATE INDEX, CREATE VIRTUAL TABLE, CREATE TRIGGER는 `IF NOT EXISTS` 사용
2. V001 baseline SQL에서 `let _ = ALTER TABLE` 패턴 완전 제거 (컬럼이 통합된 최종 DDL 사용)
3. 기존 테스트 (`test_migrations_run_twice`, `test_tables_exist`, conversations 테스트)가 모두 통과해야 함
4. FTS5 토크나이저는 `unicode61`만 사용 (외부 의존성 없음, SQLite 내장)
5. CHECK 제약조건의 허용 값 목록은 Rust enum과 일치시킬 것 (향후 코드에서 enum 정의 시)
6. 마이그레이션 SQL 문자열은 Rust 코드 내 `const &str`로 관리 (외부 SQL 파일 불필요)

---

## 의사결정 요약

| 결정 | 채택 방안 | 기각 대안 | 기각 이유 |
|------|----------|----------|----------|
| 마이그레이션 시스템 | 코드 내 버전 번호 + _migrations 테이블 | diesel_migrations, refinery 크레이트 | 외부 의존성 추가 불필요, 마이그레이션 5개로 자체 구현이 간단 |
| 롤백 지원 | 미지원 (백업 기반 복구) | down_sql 컬럼 | SQLite DDL 트랜잭션 제한, 단일 사용자 앱에서 롤백 시나리오 희소 |
| CHECK 제약조건 | BEFORE INSERT/UPDATE 트리거 | 테이블 재생성 | 외래키/FTS 트리거 의존성으로 재생성 위험, 트리거가 동일 효과 |
| FTS5 모드 | external content (`content=messages`) | contentless (`content=''`), 독립 테이블 | 디스크 절약 + snippet() 지원 |
| FTS5 토크나이저 | `unicode61 remove_diacritics 2` | `trigram`, `icu` | trigram 인덱스 비대, icu 빌드 의존성 |
| updated_at 트리거 WHEN | `WHEN NEW.updated_at = OLD.updated_at` | 무조건 실행 | 무한 루프 방지 + 명시적 설정 존중 |
| busy_timeout | 10000ms | 5000ms (현행), 30000ms | 풀 도입 대비 여유 확보, 30초는 사용자 체감 과다 |
