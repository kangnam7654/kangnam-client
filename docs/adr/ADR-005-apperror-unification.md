# ADR-005: AppError 에러 처리 통합

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`error.rs`에 `AppError` enum이 정의되어 있고 `impl From<AppError> for String`이 구현되어 있다. 그러나 실제 command 함수들은 `Result<T, String>`을 직접 반환하며 `AppError`를 사용하지 않는다. 현황:

- 9개 command 파일에 걸쳐 68건의 `Result<_, String>` 반환
- `.ok()` 38건: DB 에러, keychain 에러, emit 에러 등을 무시
- `.map_err(|e| e.to_string())` 패턴이 에러 원인을 문자열로 뭉개서 디버깅 곤란
- Tauri 2의 IPC는 command가 `Result<T, E: Into<InvokeError>>`를 반환할 수 있으며, `impl serde::Serialize for E`이면 구조화된 에러를 프론트엔드에 전달 가능

## Decision

**AppError를 모든 Tauri command의 에러 타입으로 통합**한다.

### 1. AppError 확장

```rust
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Auth error: {0}")]
    Auth(String),
    #[error("Provider error: {0}")]
    Provider(String),
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("MCP error: {0}")]
    Mcp(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Pool error: {0}")]
    Pool(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}
```

### 2. Tauri IPC 직렬화

```rust
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", &self.error_code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

impl AppError {
    fn error_code(&self) -> &'static str {
        match self {
            AppError::Auth(_) => "AUTH_ERROR",
            AppError::Provider(_) => "PROVIDER_ERROR",
            AppError::Db(_) => "DB_ERROR",
            AppError::Mcp(_) => "MCP_ERROR",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Pool(_) => "POOL_ERROR",
            AppError::Io(_) => "IO_ERROR",
            AppError::Serde(_) => "SERDE_ERROR",
        }
    }
}
```

### 3. Command 시그니처 변경

```rust
// Before:
#[tauri::command]
pub async fn send_message(...) -> Result<(), String> { ... }

// After:
#[tauri::command]
pub async fn send_message(...) -> Result<(), AppError> { ... }
```

### 4. .ok() 분류 및 처리

38건의 `.ok()` 사용을 분류:

- **emit 호출** (~25건): `let _ = app.emit(...)`. 이벤트 전송 실패는 치명적이지 않으므로 `let _ =` 유지하되, 디버그 로깅 추가: `if let Err(e) = app.emit(...) { tracing::debug!("emit failed: {e}"); }`. 단, tracing이 현재 미도입이므로 1차에서는 `let _ =` 유지.
- **DB .ok()** (~8건, seed_preset_skills 등): `?` 연산자로 교체. 실패 시 에러 전파.
- **keychain .ok()** (~5건): keychain 실패는 auth 에러로 전파. `?` + `AppError::Auth` 매핑.

### 5. 프론트엔드 에러 포맷

프론트엔드에서 수신하는 에러 형식:

```typescript
interface AppError {
  code: string   // "AUTH_ERROR" | "DB_ERROR" | ...
  message: string
}
```

기존 catch에서 `err instanceof Error ? err.message : String(err)` 패턴을 `err.code`/`err.message` 기반으로 변경.

## Alternatives Rejected

1. **anyhow 사용**: 기각 이유: anyhow는 에러 타입을 지우므로 프론트엔드에 구조화된 에러 코드를 전달할 수 없다. 디버깅에는 유용하지만 IPC 경계에서는 typed error가 필요하다.
2. **현재 상태 유지 + 문자열 에러 표준화**: 기각 이유: 에러 코드 없이는 프론트엔드에서 에러 종류별 UI 분기(재인증 안내, 재시도 버튼 등)가 불가능하다.

## Consequences

- `error.rs` 확장 (6 variant -> 9 variant).
- 9개 command 파일의 반환 타입 변경: `Result<T, String>` -> `Result<T, AppError>`.
- `.map_err(|e| e.to_string())` 패턴 제거. `?` 연산자와 `From` impl 활용.
- `.ok()` 38건 중 ~13건을 `?`로 교체, ~25건(emit)은 유지.
- 프론트엔드 에러 핸들링 코드 업데이트 필요.
- 점진적 적용 가능: command 파일 단위로 순차 변경.
