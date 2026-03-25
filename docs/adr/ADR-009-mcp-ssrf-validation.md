# ADR-009: MCP SSRF 검증

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`sidecar/mcp-bridge.ts`의 `connectServer` 함수는 MCP 서버 설정에서 받은 URL(`config.url`)을 검증 없이 HTTP transport에 전달한다 (110행). 또한 stdio transport에서 `process.env`를 복사하여 child process에 전달한다 (107행). 현재 보안 조치:

- `sanitizeEnv`가 `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` 등 5개 위험 환경 변수를 차단 (72-88행)
- 그러나 URL 검증과 env 전파 범위가 불충분:

1. **SSRF**: 사용자가 MCP 서버 URL로 `http://localhost:8080/admin`, `http://169.254.169.254/metadata` 등 내부 서비스를 지정하면 요청이 그대로 전달된다.
2. **env 전파**: `{ ...process.env, PATH: fullPath, ...sanitizeEnv(config.env) }`는 부모 프로세스의 모든 환경 변수(API 키, 토큰, 비밀번호 등)를 MCP child process에 노출한다.
3. **command 검증 없음**: stdio transport의 `config.command`에 임의 바이너리 경로 지정 가능.

## Decision

### 1. HTTP URL 블록리스트 검증

**블록리스트 방식**을 채택한다. 허용리스트는 MCP 서버가 다양한 외부 호스트에 존재할 수 있어 비현실적.

```typescript
function validateMcpUrl(url: string): void {
  const parsed = new URL(url)

  // 프로토콜 제한: http, https만 허용
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol}`)
  }

  // 호스트 블록리스트
  const hostname = parsed.hostname.toLowerCase()
  const blockedPatterns = [
    /^localhost$/,
    /^127\.\d+\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^169\.254\.\d+\.\d+$/,    // AWS metadata
    /^metadata\.google\.internal$/,
  ]

  if (blockedPatterns.some(p => p.test(hostname))) {
    throw new Error(`Blocked internal address: ${hostname}`)
  }

  // 포트 블록리스트: 시스템 서비스 포트
  const blockedPorts = new Set(['22', '25', '53', '445', '3306', '5432', '6379', '27017'])
  if (parsed.port && blockedPorts.has(parsed.port)) {
    throw new Error(`Blocked port: ${parsed.port}`)
  }
}
```

`connectServer`에서 HTTP transport 생성 전에 `validateMcpUrl(config.url)` 호출.

### 2. 환경 변수 전파 허용리스트

`process.env` 전체 복사 대신 **허용리스트 기반 env 전파**를 채택한다.

```typescript
const ALLOWED_PARENT_ENV_KEYS = new Set([
  'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TERM', 'TMPDIR', 'XDG_RUNTIME_DIR',
  // Node/Python 런타임에 필요한 최소 변수
  'NODE_PATH', 'NODE_OPTIONS',
  'PYTHONPATH', 'VIRTUAL_ENV',
])

function buildChildEnv(configEnv?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}

  // 부모에서 허용된 키만 복사
  for (const key of ALLOWED_PARENT_ENV_KEYS) {
    if (process.env[key]) {
      env[key] = process.env[key]!
    }
  }

  // PATH 확장 (기존 로직 유지)
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/opt/homebrew/sbin']
  env.PATH = [...extraPaths, env.PATH ?? ''].join(':')

  // 사용자 지정 env (sanitizeEnv 적용)
  const sanitized = sanitizeEnv(configEnv)
  if (sanitized) {
    Object.assign(env, sanitized)
  }

  return env
}
```

### 3. command 경로 로깅

stdio transport의 command는 사용자가 직접 설정하는 값이므로 제한이 어렵다 (MCP 서버가 다양한 바이너리일 수 있음). 대신:
- command 실행 시 로그 출력 (`console.error`로 sidecar stderr에 기록)
- 향후 사용자 확인 다이얼로그 추가 가능 (이 ADR 범위 밖)

## Alternatives Rejected

1. **URL 허용리스트**: 사용자가 추가하는 MCP 서버 URL을 사전에 알 수 없으므로 비현실적. 기각.
2. **DNS 해석 후 IP 검증**: URL의 hostname을 DNS 해석하여 내부 IP인지 확인. 기각 이유: DNS rebinding 공격에 취약하고, 구현 복잡도가 높다. 블록리스트가 90%의 일반적 SSRF를 방지하며 충분하다.
3. **env 전파 완전 차단**: child process에 환경 변수를 전달하지 않음. 기각 이유: MCP 서버가 PATH 없이 실행 불가하고, 사용자 설정 env가 API 키를 전달하는 합법적 용도로 쓰임.

## Consequences

- 내부 네트워크 대상 SSRF 차단. `localhost`, RFC 1918 사설 IP, 클라우드 메타데이터 엔드포인트 접근 불가.
- MCP child process에 `API_KEY`, `SECRET` 등 부모 프로세스의 민감 환경 변수 미전파.
- 기존 MCP 서버 중 `localhost`로 통신하는 서버가 있으면 차단됨. MCP 서버는 일반적으로 stdio transport를 사용하므로 영향 제한적. HTTP transport를 `localhost`에서 사용하는 경우를 위해 명시적 로컬 허용 옵션 추가를 향후 고려.
- 영향 파일: `sidecar/mcp-bridge.ts`.
