# ADR-007: access_token 암호화 저장

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`auth/token_store.rs`의 `save_token` 함수는 `refresh_token`을 OS 키체인(keyring 3)에 저장하지만, `access_token`은 SQLite `auth_tokens` 테이블에 평문으로 저장한다 (24행 주석: "short-lived, acceptable in plaintext"). 그러나:

1. **access_token 수명이 짧지 않은 경우**: Copilot과 Claude OAT 토큰은 수시간~수일간 유효하며, DB 파일 접근 권한이 있으면 토큰을 탈취할 수 있다.
2. **DB 파일 보호 부재**: `~/Library/Application Support/kangnam-client/data/kangnam-client.db`는 사용자 권한으로 읽기 가능. 다른 앱이나 악성 소프트웨어가 접근 가능.
3. **현재 키체인 사용 패턴과 불일치**: refresh_token만 키체인에 저장하는 비대칭 보안 모델.

## Decision

**access_token도 OS 키체인에 저장**한다. SQLite에는 만료 시간과 메타데이터만 유지한다.

### 변경 설계

```rust
pub fn save_token(conn: &Connection, token: &StoredToken) {
    // refresh_token -> keychain (기존 유지)
    if let Some(ref rt) = token.refresh_token {
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-refresh", token.provider)) {
            let _ = entry.set_password(rt);
        }
    }

    // access_token -> keychain (신규)
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-access", token.provider)) {
        let _ = entry.set_password(&token.access_token);
    }

    // SQLite에는 메타데이터만 저장 (access_token 컬럼 제거 또는 빈 문자열)
    let metadata_str = token.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());
    conn.execute(
        "INSERT OR REPLACE INTO auth_tokens (provider, access_token, refresh_token, expires_at, metadata)
         VALUES (?1, '', NULL, ?2, ?3)",
        params![token.provider, token.expires_at, metadata_str],
    ).ok();
}

pub fn get_token(conn: &Connection, provider: &str) -> Option<StoredToken> {
    let mut token = /* SQLite에서 메타데이터 조회 */;

    // access_token을 키체인에서 복원
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-access", provider)) {
        if let Ok(at) = entry.get_password() {
            token.access_token = at;
        }
    }

    // refresh_token 키체인 복원 (기존 유지)
    // ...
}
```

### auth_tokens 테이블 마이그레이션

`access_token` 컬럼을 즉시 제거하지 않는다 (SQLite는 DROP COLUMN이 3.35.0+에서만 가능하고, bundled 버전 확인 필요). 대신:
1. 마이그레이션에서 기존 평문 access_token을 키체인으로 이동
2. SQLite의 access_token 컬럼에 빈 문자열 저장
3. 향후 테이블 재생성 시 컬럼 제거

### delete_token 변경

```rust
pub fn delete_token(conn: &Connection, provider: &str) {
    conn.execute("DELETE FROM auth_tokens WHERE provider = ?1", params![provider]).ok();
    // 키체인에서 refresh + access 모두 삭제
    for suffix in &["refresh", "access"] {
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{provider}-{suffix}")) {
            let _ = entry.delete_credential();
        }
    }
}
```

## Alternatives Rejected

1. **SQLCipher (DB 전체 암호화)**: 기각 이유: rusqlite의 bundled feature와 SQLCipher는 별도 빌드 설정이 필요하고, 전체 DB 암호화는 과잉이다. 민감 데이터는 토큰뿐이며 대화 내용은 평문으로 충분하다. 빌드 복잡도와 성능 오버헤드(DB 전체 암호화 시 10-20% 성능 저하) 대비 이점이 부족하다.
2. **선택적 컬럼 암호화 (AES-256-GCM)**: access_token 컬럼만 앱 레벨에서 암호화. 기각 이유: 암호화 키를 어디에 저장할지가 문제. 키를 키체인에 저장하면 결국 키체인을 사용하는 것이고, 하드코딩하면 의미 없음. 키체인에 직접 토큰을 저장하는 것이 더 간단하고 안전하다.

## Consequences

- 토큰이 SQLite 파일에서 완전히 제거됨. DB 파일 탈취 시에도 토큰 유출 없음.
- 키체인 항목 수 증가: provider당 1개(refresh) -> 2개(refresh + access).
- keyring 3 crate의 OS별 동작은 이미 검증됨 (refresh_token에서 사용 중).
- 영향 파일: `auth/token_store.rs`, `db/schema.rs` (마이그레이션 추가).
- 키체인 접근 실패 시(Linux Secret Service 미설정 등) 토큰 조회 실패 -> auth 에러. ADR-005의 AppError::Auth로 처리.
