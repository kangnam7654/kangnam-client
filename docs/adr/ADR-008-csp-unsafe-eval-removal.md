# ADR-008: CSP unsafe-eval 제거

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`tauri.conf.json`과 `src/renderer/index.html`의 CSP에 `script-src 'self' 'unsafe-eval' 'unsafe-inline'`이 설정되어 있다. `unsafe-eval`은 `eval()`, `new Function()`, WASM 실행을 허용한다. 원인은 Shiki 구문 강조 라이브러리가 WASM 기반 TextMate 그래머를 런타임에 로드하기 때문이다.

`unsafe-eval`은 XSS 공격 시 임의 코드 실행을 허용하는 가장 위험한 CSP 완화 중 하나이다. Tauri 데스크톱 앱에서 공격 표면은 웹보다 작지만, MCP tool 결과나 LLM 응답에 악성 HTML/JS가 포함될 경우 위험하다.

## Decision

**Shiki의 번들 빌더를 사용하여 빌드 타임에 테마와 언어를 고정**하고, `unsafe-eval`을 제거한다. 추가로 `'wasm-unsafe-eval'`을 사용하여 WASM 실행만 선택적으로 허용한다.

### 1. Shiki 번들 빌더 전환

현재 `createHighlighter`(런타임 동적 로드)를 `shiki/bundle/web`(빌드 타임 번들)로 교체한다.

```typescript
// Before (AssistantThread.tsx:409)
import { createHighlighter, type Highlighter } from 'shiki'

// After
import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import githubDark from 'shiki/themes/github-dark.mjs'
import langJs from 'shiki/langs/javascript.mjs'
import langTs from 'shiki/langs/typescript.mjs'
import langPy from 'shiki/langs/python.mjs'
import langRust from 'shiki/langs/rust.mjs'
// ... (사용 중인 26개 언어 static import)
```

빌드 타임 static import는 dynamic `import()`를 제거하므로 `unsafe-eval` 불필요.

### 2. CSP 변경

```
script-src 'self' 'wasm-unsafe-eval';
```

- `'unsafe-eval'` 제거: `eval()`, `new Function()` 차단.
- `'wasm-unsafe-eval'` 추가: Oniguruma WASM 엔진 실행 허용. 이는 `unsafe-eval`보다 범위가 좁아 JS 코드 실행은 차단하면서 WASM만 허용.
- `'unsafe-inline'` 유지: Tailwind CSS 인라인 스타일에 필요. 향후 nonce 기반으로 전환 가능하나 이 ADR 범위 밖.

### 3. 양쪽 CSP 동기화

CSP가 두 곳에 정의되어 있음:
- `tauri.conf.json` (31행): Tauri가 프로덕션 빌드에 적용
- `src/renderer/index.html` (8행): 개발 모드에서 적용

양쪽을 동일하게 변경. 향후 `index.html`의 CSP를 제거하고 `tauri.conf.json`만 사용하는 것을 권장하나, 개발 모드 호환을 위해 당분간 양쪽 유지.

## Alternatives Rejected

1. **Shiki 제거 + Prism.js 도입**: 기각 이유: Prism.js는 regex 기반이라 CSP 호환이지만, TextMate 그래머 대비 정확도가 낮다(특히 Rust, TSX). 사용자 경험 저하. Shiki 번들 빌더로 해결 가능하므로 라이브러리 교체 불필요.
2. **highlight.js 도입**: 기각 이유: Prism과 동일한 이유. 또한 지원 언어 수가 Shiki 대비 적음.
3. **CSP 현상 유지**: 기각 이유: LLM 응답에 사용자 제어 불가능한 콘텐츠가 포함되며, `dangerouslySetInnerHTML`로 렌더링하고 있어 XSS 위험이 실재한다. CSP가 마지막 방어선 역할을 해야 한다.

## Consequences

- `unsafe-eval` 제거로 `eval()`, `new Function()` 기반 코드 주입 차단.
- Shiki 초기 로드 동작 변경: 런타임 fetch -> 번들에 포함. 번들 크기 약 200-400KB 증가. 대신 초기 구문 강조 렌더링이 더 빠름 (네트워크 없이 즉시 사용 가능).
- 신규 언어 추가 시 static import 추가 + 빌드 필요. 현재 26개 언어로 대부분 커버.
- 영향 파일: `src/renderer/components/chat/AssistantThread.tsx`, `tauri.conf.json`, `src/renderer/index.html`.
