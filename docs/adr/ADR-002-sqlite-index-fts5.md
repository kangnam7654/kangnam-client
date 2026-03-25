# ADR-002: SQLite 인덱스 + FTS5 전문 검색

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`conversations` 테이블의 목록 조회(`ORDER BY pinned DESC, updated_at DESC`)에 커버링 인덱스가 없어 풀 테이블 스캔이 발생한다. `search_messages` 함수는 `WHERE m.content LIKE '%keyword%'`로 `messages` 테이블을 풀스캔한다. 현재 `messages` 테이블에는 `idx_messages_conv(conversation_id, created_at)` 인덱스만 존재한다. 대화가 수백~수천 건 축적되면 검색 응답 시간이 선형 증가한다.

## Decision

### 1. B-tree 인덱스 추가

```sql
-- conversations 목록 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_conversations_list
  ON conversations(pinned DESC, updated_at DESC);

-- auth_tokens 조회 (이미 PK이므로 불필요하지만 명시적 확인)
-- 참고: idx_messages_role_content(conversation_id, role, created_at DESC)는
-- 검토 결과 기존 idx_messages_conv(conversation_id, created_at)로 충분히 커버되어
-- db-schema-improvement.md V002에서 제외됨. role 필터 쿼리가 추가되면 재검토.
```

### 2. FTS5 도입

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid'
);
```

**동기화 방법: 트리거 기반 자동 동기화**를 채택한다.

```sql
CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE OF content ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

**FTS5 검색 쿼리 변경**: `search_messages`의 LIKE 패턴을 FTS5 MATCH로 교체한다.

```sql
SELECT m.id, m.conversation_id, c.title, m.content, m.role, m.created_at
FROM messages m
JOIN messages_fts ON messages_fts.rowid = m.rowid
JOIN conversations c ON c.id = m.conversation_id
WHERE messages_fts MATCH ?1 AND m.role IN ('user', 'assistant')
ORDER BY m.created_at DESC LIMIT 50
```

**기존 데이터 초기 동기화**: 마이그레이션에서 `INSERT INTO messages_fts(rowid, content) SELECT rowid, content FROM messages` 실행.

### 3. FTS5 도입 범위

- `messages.content`만 인덱싱. `conversations.title`은 건수가 적어 LIKE로 충분.
- `tool_args`, `tool_name` 등 메타데이터 필드는 FTS 대상 제외. 사용자가 검색하는 대상은 대화 내용이므로.

## Alternatives Rejected

1. **수동 동기화 (앱 레벨 INSERT 시 FTS INSERT 호출)**: 기각 이유: 모든 메시지 삽입 경로(chat.rs, cowork.rs, eval.rs)에 FTS INSERT를 추가해야 하며, 누락 시 검색 결과 불일치. 트리거가 누락을 원천 방지한다.
2. **FTS5 외부 콘텐츠 없이 standalone 테이블**: 기각 이유: 메시지 본문이 FTS 테이블과 messages 테이블에 이중 저장되어 DB 용량이 2배 증가. `content=''` (외부 콘텐츠 테이블) 모드가 저장 효율적.

## Consequences

- `search_messages` 성능: O(n) 풀스캔 -> O(log n) FTS MATCH. 1만 건 기준 측정 가능한 차이.
- `list_conversations` 정렬: 인덱스 스캔으로 전환.
- rusqlite `bundled` feature는 FTS5를 기본 포함하므로 Cargo.toml 변경 불필요.
- DB 용량: FTS 인덱스 추가분은 messages 테이블 대비 약 30-50% 증가. 로컬 데스크톱 앱이므로 허용 범위.
- 마이그레이션 시스템(ADR-003)과 함께 적용해야 함. FTS5 테이블 생성 및 초기 동기화를 마이그레이션 단계로 관리.
