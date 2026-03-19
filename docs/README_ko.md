# Kangnam Client

기존 구독으로 제공자에게 연결하는 데스크톱 LLM(대규모 언어 모델) 채팅 앱입니다. API 키가 필요 없습니다.

[English](../README.md)

---

## 왜 이 프로젝트가 존재하는가

이 프로젝트는 Unreal Engine MCP 서버를 만들면서 시작되었습니다. 그 과정에서 비개발자도 MCP(Model Context Protocol, LLM이 외부 도구를 호출할 수 있게 하는 표준)를 사용할 수 있어야 한다는 점이 명확해졌습니다. 문제는 Claude Desktop, 터미널 기반 도구 같은 기존 MCP 클라이언트들이 기술 지식을 가정한다는 것입니다.

Kangnam Client는 이 아이디어에서 나왔습니다. 누구나 MCP에 접근할 수 있도록 하는 데스크톱 앱입니다. 이미 가지고 있는 구독 계정으로 로그인하면 앱이 나머지를 처리합니다.

이것은 개인 프로젝트이며 상용 제품이 아닙니다. 동작하지만 거친 부분들이 있습니다.

---

## 이것이 하는 것

Kangnam Client는 Tauri 2(Rust 백엔드 + 시스템 WebView)로 만든 데스크톱 채팅 애플리케이션입니다. 웹에서 사용하는 것과 동일한 로그인(구독 인증 흐름)으로 LLM 제공자에게 연결됩니다. 별도의 API 키가 필요하지 않습니다.

앱에는 내장 MCP 서버 관리자도 포함되어 있습니다. MCP를 통해 LLM이 파일 시스템, 데이터베이스, API 같은 외부 도구를 호출할 수 있습니다. 설정 패널에서 MCP 서버를 추가하고 관리할 수 있습니다.

---

## 전제조건

### 필요한 지식

- 기본적인 명령어 사용법(터미널에서 명령어 실행)
- 지원되는 제공자 중 최소 하나에 대한 활성 구독(아래 표 참조)

### 필요한 도구

진행하기 전에 다음을 설치하세요:

| 도구 | 최소 버전 | 설치 |
|------|---------|------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | 1.75+ (edition 2021) | [rustup.rs](https://rustup.rs) |
| npm | 10+ | Node.js에 포함됨 |

### 플랫폼별 요구사항

| 플랫폼 | 필요 항목 | 설치 명령어 |
|--------|---------|-----------|
| macOS | Xcode Command Line Tools | `xcode-select --install` |
| Linux (Debian/Ubuntu) | webkit2gtk, 빌드 필수 | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` |
| Linux (Fedora) | webkit2gtk, 개발 도구 | `sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel` |
| Windows | WebView2 Runtime | Windows 10/11에 사전 설치됨. 누락된 경우 [Tauri 문서](https://v2.tauri.app/start/prerequisites/)를 참조하세요. |

---

## 지원하는 제공자

5개의 제공자가 구현되어 있습니다. 각각 자신의 구독이 필요합니다.

| 제공자 | 인증 방법 | 필요한 구독 |
|--------|---------|----------|
| OpenAI Codex | PKCE OAuth | ChatGPT Plus / Pro |
| Gemini CLI | PKCE + client_secret | Google AI Pro |
| Antigravity | PKCE + client_secret | Google 구독 |
| GitHub Copilot | Device Flow | Copilot 구독 |
| Claude | Setup Token | Claude Max |

**인증 방법 정의:**

- **PKCE OAuth** (Proof Key for Code Exchange): 비밀을 노출하지 않고 앱의 신원을 증명하는 안전한 로그인 흐름입니다. 앱이 브라우저 창을 열고 로컬 콜백을 통해 토큰을 받습니다.
- **Device Flow**: URL을 방문하고 코드를 입력하여 앱을 승인합니다. 브라우저 리다이렉트가 필요하지 않습니다.
- **Setup Token**: 앱에 붙여넣는 일회성 토큰입니다.

---

## 기능

- **다중 제공자 채팅** -- 하나의 앱에서 제공자 간에 전환합니다. 응답은 실시간으로 스트리밍됩니다.
- **MCP 서버 관리자** -- MCP 서버를 추가하고 관리합니다. stdio(로컬 프로세스), HTTP, SSE(Server-Sent Events) 전송을 지원합니다.
- **도구 호출 시각화** -- LLM이 MCP 도구를 사용할 때 호출이 인라인으로 입력과 출력을 보여주는 접을 수 있는 카드로 나타납니다.
- **협력 모드** -- LLM이 MCP 도구를 사용하여 다단계 작업을 자동으로 실행합니다. 진행 사이드바에 각 단계가 실시간으로 표시됩니다.

  예: "내 프로젝트의 모든 TODO 주석을 찾아서 요약 파일을 만들어"라고 입력하면, LLM은 MCP를 통해 파일 시스템을 읽고, TODO를 검색하고, `todo-summary.md`를 작성합니다. 각 단계가 진행 사이드바에 표시됩니다.

- **스킬 시스템** -- 재사용 가능한 프롬프트 템플릿(특정 작업에 대한 LLM 동작을 사용자 정의하는 지침)입니다. 14개의 기본 사전 설정과 함께 제공됩니다. 직접 만들 수도 있습니다.

  예: 기본 제공 "코드 리뷰" 스킬은 LLM에게 버그, 스타일 문제, 보안 문제를 확인하도록 지시합니다. 대화를 시작하기 전에 스킬 드롭다운에서 선택하면 LLM이 그 지침을 따릅니다.

- **평가 워크벤치** -- 구조화된 평가 실행으로 스킬을 테스트하고 벤치마크합니다.

  예: 5개의 테스트 프롬프트와 채점 기준으로 평가 세트를 만듭니다. 워크벤치는 각 프롬프트를 선택된 스킬로 LLM에 보내고, 응답을 기준에 따라 채점하고, 통과/실패 결과를 표시합니다.
- **컨텍스트 윈도우 관리** -- 토큰 사용량 표시줄이 모델의 컨텍스트 윈도우(모델이 한 번에 처리할 수 있는 최대 텍스트) 사용량을 보여줍니다. 90% 사용 시 앱이 자동으로 대화를 압축합니다.
- **풍부한 렌더링** -- Markdown, [Shiki](https://shiki.style/)를 통한 코드 하이라이팅(25개 이상의 언어), [KaTeX](https://katex.org/)를 통한 수식입니다.
- **대화 기록** -- Cmd/Ctrl+F로 과거 대화를 검색합니다. Markdown 또는 JSON으로 내보냅니다.
- **시스템 트레이 + 테마** -- 시스템 트레이에서 실행됩니다. 어두운 테마와 밝은 테마를 지원합니다.

---

## 스크린샷

> 스크린샷이 여기에 추가될 예정입니다.

---

## 시작하기

### 1단계: 저장소 클론

```bash
git clone https://github.com/kangnam7654/kangnam-client.git
cd kangnam-client
```

### 2단계: 의존성 설치

```bash
npm install
```

이는 프론트엔드(React)와 사이드카(앱 옆에서 실행되어 MCP 통신을 연결하는 보조 프로세스) 의존성을 모두 설치합니다. 다음과 같은 출력을 기대하세요:

```text
added 1200+ packages in 30s
```

### 3단계: 개발 모드에서 실행

```bash
npm run tauri:dev
```

이는 Vite 개발 서버를 시작하고 Rust 백엔드를 컴파일합니다. 첫 번째 빌드는 모든 Rust 의존성(300개 이상의 crates, Rust 패키지)을 컴파일하며 2~5분이 걸립니다. 그 이후 빌드는 컴파일된 캐시를 재사용하고 몇 초 내에 시작됩니다.

시작 후 다음과 같은 출력을 기대하세요:

```text
  VITE v7.x.x  ready in 300 ms

  ->  Local:   http://localhost:1420/

        Info Watching /Users/you/kangnam-client/src-tauri for changes...
   Compiling kangnam-client v0.1.0
    Finished `dev` profile target(s) in 3.21s
```

앱 창이 자동으로 열립니다. 사이드바에서 제공자를 선택하고 로그인하세요.

### 4단계: 프로덕션 빌드

```bash
npm run tauri:build
```

빌드된 애플리케이션을 `src-tauri/target/release/bundle/`에서 찾으세요.

---

## MCP 설정

앱은 MCP 서버 설정을 JSON 파일에 저장합니다. 형식은 Claude Desktop의 `mcpServers` 구조를 따릅니다.

### 설정 파일 위치

| 플랫폼 | 경로 |
|--------|------|
| macOS | `~/Library/Application Support/kangnam-client/mcp-config.json` |
| Windows | `%APPDATA%/kangnam-client/mcp-config.json` |
| Linux | `~/.config/kangnam-client/mcp-config.json` |

설정 패널을 통해 서버를 추가하거나 파일을 직접 편집할 수 있습니다.

### 예제 설정

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"],
      "env": {}
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    },
    "remote-api": {
      "type": "http",
      "url": "https://my-mcp-server.example.com/mcp",
      "headers": {
        "Authorization": "Bearer sk-xxxx"
      }
    }
  }
}
```

### 전송 유형

각 서버 항목은 세 가지 전송 유형 중 하나를 사용합니다:

- **stdio** -- 로컬 프로세스를 실행합니다. `command` 필수. 선택 사항: `args`, `env`.
- **http** -- 원격 HTTP 엔드포인트에 연결합니다. `url` 필수. 선택 사항: `headers`.
- **sse** -- Server-Sent Events(HTTP를 통해 서버에서 클라이언트로 데이터를 스트리밍하는 프로토콜)를 통해 연결합니다. `url` 필수. 선택 사항: `headers`.

---

## 기술 스택

| 계층 | 기술 |
|-----|------|
| 데스크톱 | Tauri 2 (Rust 백엔드 + 시스템 WebView) |
| 프론트엔드 | React 19 + Vite 7 + Tailwind CSS v4 |
| 상태 관리 | Zustand 5 |
| 데이터베이스 | rusqlite (네이티브 SQLite, 앱과 함께 번들됨) |
| 토큰 저장 | keyring (OS 키체인) |
| HTTP | reqwest + eventsource-stream (SSE 스트리밍) |
| MCP 브릿지 | Node.js 사이드카 (@modelcontextprotocol/sdk) |
| 코드 하이라이팅 | Shiki |
| 수식 렌더링 | KaTeX |
| 언어 | Rust (백엔드) + TypeScript (프론트엔드) |

---

## 프로젝트 구조

```text
src-tauri/                    # Rust 백엔드 (Tauri 2)
  src/
    lib.rs                    # Tauri 빌더 (트레이, 명령, 플러그인)
    state.rs                  # AppState (DB, MCP, 인증)
    auth/                     # OAuth (PKCE, Device Flow, keyring)
    providers/                # LLM 제공자 + 라우터
    db/                       # rusqlite (대화, 스킬, 평가)
    mcp/                      # MCP 사이드카 브릿지 (JSON-RPC)
    commands/                 # Tauri 명령 핸들러
    skills/                   # 스킬 AI + 평가 엔진
  prompts/                    # 시스템 프롬프트 템플릿
  data/                       # 사전 설정 스킬 (JSON)
sidecar/                      # MCP 브릿지 (Node.js)
src/renderer/                 # React 프론트엔드
  components/
    chat/                     # 채팅 UI, 보조 스레드, 검색창
    cowork/                   # 협력 모드, 진행 패널, 도구 호출
    eval/                     # 평가 워크벤치, 실행기, 벤치마크
    settings/                 # 설정 패널
    sidebar/                  # 사이드바, 대화 목록
  hooks/                      # assistant-ui 런타임
  lib/                        # 제공자 설정, 유틸리티
  stores/                     # Zustand 앱 스토어
  styles/                     # 글로벌 CSS
docs/                         # 설계 문서
```

---

## 현재 상태

이것은 활발히 개발 중인 개인 프로젝트입니다.

### 완료된 사항

- 1~4단계: 인증, 채팅, MCP 통합, 협력 모드, 스킬 시스템, 평가 워크벤치, 검색
- 5단계: Tauri 마이그레이션 (Electron에서 Tauri 2로 이동, 완전한 Rust 백엔드)
- 모든 5개의 제공자가 구현되고 작동 중

### 진행 중인 사항 (6단계: 최종 다듬기)

- 키보드 단축키
- 자동 업데이트 메커니즘
- MCP 사이드카 번들링 (현재 사용자 시스템에 Node.js 필요)
- 크로스 플랫폼 빌드 파이프라인

### 알려진 제한사항

- 앱이 MCP를 작동시키려면 사용자 시스템에 Node.js가 설치되어 있어야 합니다. 사이드카 번들링은 계획되어 있지만 아직 완료되지 않았습니다.
- 모든 플랫폼에 대한 사전 빌드 바이너리는 아직 없습니다.
- Electron 코드베이스(`src/main/`)는 여전히 저장소에 있지만 더 이상 사용되지 않습니다. 향후 정리에서 제거될 예정입니다.

---

## 문제 해결

### macOS에서 Rust 컴파일 실패

**증상:** `xcrun` 또는 `clang` 누락에 대한 오류.

**해결:** Xcode Command Line Tools를 설치하세요:

```bash
xcode-select --install
```

### Linux에서 "webkit2gtk not found"

**증상:** Rust 빌드가 `webkit2gtk-4.1` 검색 중 실패합니다.

**해결:** 필요한 시스템 라이브러리를 설치하세요. Debian/Ubuntu:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev
```

### MCP 사이드카가 시작되지 않음

**증상:** MCP 도구를 사용할 수 없습니다. 앱이 "MCP sidecar not found"를 표시합니다.

**해결:** Node.js 20+이 설치되어 있고 `npx`가 PATH에 있는지 확인하세요:

```bash
node --version   # v20.x 이상을 표시해야 합니다
npx --version    # 10.x 이상을 표시해야 합니다
```

`npx`를 찾을 수 없으면 [nodejs.org](https://nodejs.org)에서 Node.js를 다시 설치하세요.

### OAuth 로그인 창이 나타나지 않음

**증상:** "로그인"을 클릭해도 아무것도 일어나지 않거나 빈 창이 표시됩니다.

**해결:** 다른 애플리케이션이 OAuth 콜백 포트를 사용 중이 아닌지 확인하세요. Codex는 포트 1455를 사용합니다. 충돌하는 프로세스를 종료하고 다시 시도하세요.

### 첫 번째 빌드가 오래 걸림

**증상:** `npm run tauri:dev`가 초기 컴파일 중 멈춘 것처럼 보입니다.

**설명:** 첫 번째 빌드는 모든 Rust 의존성(300개 이상의 crates)을 컴파일합니다. 이는 머신에 따라 2~5분이 걸립니다. 그 이후 빌드는 컴파일된 캐시를 재사용하고 훨씬 더 빠르게 시작됩니다.

---

## 설계 문서

이 문서들은 각 기능 뒤의 아키텍처와 결정을 설명합니다.

| 문서 | 경로 |
|-----|------|
| 컨텍스트 윈도우 관리 | [`docs/context-window/design.md`](../context-window/design.md) |
| 협력 모드 | [`docs/cowork/design.md`](../cowork/design.md) |
| MCP AI 도움 | [`docs/mcp-ai-assist/design.md`](../mcp-ai-assist/design.md) |
| MCP 도구 시각화 | [`docs/mcp-tool-viz/design.md`](../mcp-tool-viz/design.md) |
| 스킬 시스템 | [`docs/prompts/design.md`](../prompts/design.md) |
| 채팅 검색 | [`docs/search/design.md`](../search/design.md) |
| Tauri 마이그레이션 | [`docs/tauri-migration/design.md`](../tauri-migration/design.md) |

---

## 기여하기

기여를 환영합니다.

1. 저장소를 포크하세요.
2. 기능 브랜치를 만드세요: `git checkout -b feature/your-feature-name`.
3. 변경 사항을 만들고 테스트를 추가하세요.
4. `npm run tauri:dev`를 실행하여 앱이 작동하는지 확인하세요.
5. 변경 사항에 대한 명확한 설명과 함께 풀 리퀘스트를 제출하세요.

더 큰 변경 사항의 경우 먼저 이슈를 열어 접근 방식을 논의하세요.

---

## 라이선스

[MIT](LICENSE) -- Copyright (c) 2026 Kangnam Kim
