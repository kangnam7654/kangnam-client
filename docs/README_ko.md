# Kangnam Client

**이미 구독 중인 서비스로 바로 사용할 수 있는 데스크톱 LLM 채팅 앱.**

[English](../README.md)

---

## Kangnam Client를 선택해야 하는 이유

ChatGPT Plus나 GitHub Copilot에 구독료를 이미 지불하고 있을 것입니다. 이러한 구독은 강력한 LLM에 대한 접근 권한을 제공합니다. 하지만 이들을 프로그래밍 방식으로 사용하려면 보통 API 키에 대해 *추가로* 비용을 지불해야 합니다.

Kangnam Client는 다른 접근 방식을 취합니다. 기존 구독 계정으로 로그인하고, 빠르고 네이티브한 데스크톱 앱을 통해 채팅하세요. API 키 없음. 추가 청구 없음. 이미 가지고 있는 것만 사용하면 됩니다.

---

## 작동 방식

Kangnam Client는 웹에서 사용하는 것과 동일한 구독 인증 방식을 통해 LLM 제공자에 연결됩니다. 앱은 Tauri 2로 구축된 네이티브 데스크톱 애플리케이션으로 실행됩니다. Tauri 2는 Rust 백엔드를 시스템의 웹 뷰와 결합하는 프레임워크입니다.

다음은 작동 흐름입니다:

1. **앱을 열고** 제공자를 선택합니다(Codex 또는 Copilot).
2. **기존 구독 계정으로 로그인**합니다. OAuth를 통해 로그인하므로 앱에 비밀번호가 노출되지 않습니다.
3. **채팅을 시작합니다.** 응답이 실시간으로 스트리밍되며 완전한 Markdown 지원으로 렌더링됩니다.
4. **MCP(Model Context Protocol) 서버를 연결합니다**(선택 사항). LLM이 파일 시스템, 데이터베이스 또는 API와 같은 외부 도구에 접근할 수 있게 해줍니다.

```text
[Your Subscription] --> [OAuth Login] --> [Kangnam Client] --> [LLM API]
                                               |
                                          [MCP Servers] (optional tools)
```

---

## 기능

### 다중 제공자 채팅

하나의 앱 내에서 LLM 제공자 간에 전환하세요. 각 제공자는 자신의 인증 방법을 사용합니다.

| 제공자 | 필수 구독 | 인증 방식 |
|----------|----------------------|-------------|
| **OpenAI Codex** | ChatGPT Plus / Pro | PKCE OAuth (앱의 신원을 증명하지만 클라이언트 비밀을 노출하지 않는 보안 코드 교환 흐름) |
| **GitHub Copilot** | Copilot 구독 | Device Flow (GitHub의 웹사이트에서 코드를 입력하여 앱을 승인) |

### MCP 통합

MCP(Model Context Protocol)를 사용하면 LLM이 외부 도구를 호출할 수 있습니다. 파일을 읽거나, 데이터베이스를 쿼리하거나, API와 상호작용할 수 있습니다. Kangnam Client에는 기본 제공 MCP 서버 관리자가 포함되어 있습니다.

- 모든 전송 방식을 지원합니다: stdio, HTTP, SSE(Server-Sent Events).
- 도구 호출을 인라인으로 시각화합니다. 접을 수 있는 뷰에서 도구 이름, 인자, 결과를 볼 수 있습니다.
- MCP 서버 구성을 자동 생성하는 AI 어시스턴트가 포함됩니다.
- Claude Desktop의 MCP 구성 형식과 호환됩니다.

**MCP 서버 구성 예제:**

앱은 Claude Desktop의 `mcpServers` 형식을 따르는 JSON 파일에 서버 구성을 저장합니다. 설정 패널을 통해 서버를 추가하거나 구성 파일을 직접 편집할 수 있습니다.

구성 파일 위치:
- **macOS**: `~/Library/Application Support/kangnam-client/mcp-config.json`
- **Windows**: `%APPDATA%/kangnam-client/mcp-config.json`
- **Linux**: `~/.config/kangnam-client/mcp-config.json`

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

각 서버 항목은 세 가지 전송 방식을 지원합니다:
- **stdio**: 로컬 프로세스를 실행합니다. `command`와 선택적 `args` 및 `env`가 필요합니다.
- **http**: 원격 HTTP 엔드포인트에 연결합니다. `url`과 선택적 `headers`가 필요합니다.
- **sse**: Server-Sent Events를 통해 연결합니다. `url`과 선택적 `headers`가 필요합니다.

**도구 호출 시각화:**

LLM이 MCP 도구를 사용하면, 앱은 호출을 접을 수 있는 카드로 인라인으로 표시합니다. 카드를 클릭하면 전체 입력과 출력을 볼 수 있습니다.

```text
+----------------------------------------------------------+
| [wrench icon] filesystem__read_file          [check mark] |
|   file_path: /Users/me/projects/src/main.rs               |
+----------------------------------------------------------+
  (click to expand)
  INPUT:
    { "path": "/Users/me/projects/src/main.rs" }
  OUTPUT:
    fn main() {
        println!("Hello, world!");
    }
+----------------------------------------------------------+
```

### 풍부한 채팅 UI

채팅 인터페이스는 평문을 넘어섭니다. Markdown을 렌더링하고, [Shiki](https://shiki.style/)를 사용하여 25개 이상의 언어로 코드를 강조 표시하며(VS Code의 TextMate 문법으로 구동되는 구문 강조 도구), [KaTeX](https://katex.org/)로 수학을 표시합니다(빠른 LaTeX 수학 렌더러).

- 실시간 Markdown 렌더링을 포함한 스트리밍 응답.
- Shiki를 사용한 코드 강조 표시(github-dark 테마, 25개 이상의 언어 지원).
- 모델의 사고/추론 과정을 실시간으로 표시합니다.
- 파일 및 이미지 첨부.
- Cmd/Ctrl+F를 사용한 채팅 내 검색.
- 대화를 Markdown 또는 JSON으로 내보냅니다.

### 컨텍스트 윈도우 관리

토큰 사용 표시줄은 모델의 컨텍스트 윈도우(모델이 한 번에 처리할 수 있는 최대 텍스트 양)의 사용량을 보여줍니다. 사용량이 90%에 도달하면 앱은 LLM이 생성한 요약을 사용하여 대화를 자동으로 압축합니다.

### Cowork 모드

Cowork 모드를 사용하면 LLM이 MCP 도구를 사용하여 다단계 작업을 자율적으로 실행할 수 있습니다. 마치 LLM에 할 일 목록을 주고 각 단계를 진행하는 것을 지켜보는 것과 같습니다.

- MCP 도구로 구동되는 자율적 작업 실행.
- 각 단계를 보여주는 실시간 진행 상태 사이드바.
- 작업 내에서의 다중 턴 후속 대화.

**예제: Cowork에 프로젝트 분석 요청**

작업 설명을 입력하면 LLM이 계획을 세우고 사용 가능한 MCP 도구를 사용하여 각 단계를 실행합니다.

```text
YOU: "Analyze the error handling in my Rust project at ~/projects/my-app"

COWORK PROGRESS PANEL:
  Steps (3)
  +-----------------------------------------+
  | [check] 1. Read project file structure  |
  | [>>>]   2. Analyze error handling code  |  <- in progress
  | [  ]    3. Generate summary report      |
  +-----------------------------------------+

  Tool Calls (4)
  +-----------------------------------------+
  | [check] filesystem__list_directory      |
  |         path: ~/projects/my-app/src     |
  +-----------------------------------------+
  | [check] filesystem__read_file           |
  |         file_path: src/main.rs          |
  +-----------------------------------------+
  | [check] filesystem__read_file           |
  |         file_path: src/error.rs         |
  +-----------------------------------------+
  | [>>>]   filesystem__search_files        |  <- running
  |         pattern: unwrap\(\)             |
  +-----------------------------------------+
```

작업이 완료되면 Cowork가 요약을 생성합니다. 결과를 개선하기 위해 후속 메시지를 보낼 수 있습니다.

### 스킬 시스템

스킬은 재사용 가능한 프롬프트 템플릿입니다(특정 작업에 대해 LLM의 동작을 사용자 지정하는 명령 세트). 앱은 14개의 기본 프리셋과 함께 제공되며 사용자 정의 스킬을 만들 수 있습니다.

- 14개의 기본 프리셋 스킬.
- AI 기반 스킬 생성, 개선, 평가.
- 스킬 성능을 테스트하고 벤치마킹하는 Eval Workbench.
- 트리 기반 참조 자료 관리.

**기본 스킬 예제:**

| 스킬 | 기능 |
|-------|-------------|
| Agent Creator | 새로운 Claude Code 사용자 정의 에이전트 정의 파일 생성 |
| Code Reviewer | 버그, 성능, 모범 사례에 대해 코드 검토 |
| Technical Writer | 구조화된 품질 기준에 따라 문서 작성 |

**사용자 정의 스킬 생성:**

자연어로 원하는 것을 설명하면, AI가 스킬 이름, 설명, 명령을 생성합니다.

```text
YOU: "I need a skill that translates Korean technical docs to English
      while preserving code blocks and markdown formatting."

AI generates:
  Name:         "Korean Tech Translator"
  Description:  "Translates Korean technical documentation to English..."
  Instructions: "You are a professional technical translator specializing
                 in Korean-to-English translation. Preserve all code blocks,
                 markdown formatting, and technical terms. ..."
```

그 후 피드백으로 스킬을 개선하고, 참조 문서를 첨부하고, Eval Workbench를 사용하여 벤치마킹할 수 있습니다.

---

## 스크린샷

> TODO: Add screenshots

---

## 시작하기

### 필수 조건

진행하기 전에 다음 도구를 설치하세요:

| 도구 | 최소 버전 | 설치 |
|------|----------------|-------------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | 1.75+ (edition 2021) | [rustup.rs](https://rustup.rs) |
| npm | 10+ | Node.js와 함께 포함됨 |

**플랫폼별 필수 요구사항:**

| 플랫폼 | 필수 도구 | 설치 명령 |
|----------|---------------|----------------|
| macOS | Xcode Command Line Tools | `xcode-select --install` |
| Linux (Debian/Ubuntu) | webkit2gtk, build essentials | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` |
| Linux (Fedora) | webkit2gtk, development tools | `sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel` |
| Windows | WebView2 Runtime | Windows 10/11에 미리 설치되어 있습니다. 누락된 경우 [Tauri 문서](https://v2.tauri.app/start/prerequisites/)를 참조하세요. |

또한 지원되는 제공자(ChatGPT Plus/Pro 또는 GitHub Copilot) 중 최소 하나에 대한 활성 구독이 필요합니다.

### 1단계: 저장소 복제

```bash
git clone https://github.com/kangnam7654/kangnam-client.git
cd kangnam-client
```

### 2단계: 의존성 설치

```bash
npm install
```

설치가 완료되면 다음과 유사한 출력이 표시됩니다:

```text
added 1200+ packages in 30s
```

이는 프론트엔드(React)와 사이드카(MCP 브리지) 의존성을 모두 설치합니다.

### 3단계: 개발 모드에서 실행

```bash
npm run tauri:dev
```

이는 프론트엔드용 Vite 개발 서버를 시작하고 Rust 백엔드를 컴파일합니다. 첫 실행에서 Rust 컴파일에는 2-5분이 걸립니다. 후속 실행은 몇 초 내에 시작됩니다.

시작 후 다음과 유사한 출력을 볼 것으로 예상합니다:

```text
  VITE v7.x.x  ready in 300 ms

  ->  Local:   http://localhost:1420/

        Info Watching /Users/you/kangnam-client/src-tauri for changes...
   Compiling kangnam-client v0.1.0
    Finished `dev` profile target(s) in 3.21s
```

Tauri 앱 윈도우가 자동으로 열립니다. 사이드바에서 제공자를 선택하고 구독 계정으로 로그인합니다.

### 4단계: 프로덕션 빌드

```bash
npm run tauri:build
```

빌드가 완료되면 다음과 유사한 출력이 표시됩니다:

```text
    Finished `release` profile target(s) in 2m 15s
    Bundling kangnam-client.app
    Finished 1 bundle at:
        src-tauri/target/release/bundle/macos/kangnam-client.app
```

`src-tauri/target/release/bundle/`에서 빌드된 애플리케이션을 찾습니다.

---

## 기술 스택

| 계층 | 기술 |
|-------|-----------|
| Desktop | Tauri 2 (Rust 백엔드 + 시스템 WebView) |
| UI | React 19 + Tailwind CSS 4 |
| State | Zustand 5 |
| DB | rusqlite (네이티브 SQLite, 번들됨) |
| Token Storage | keyring (OS 키체인) |
| HTTP | reqwest + eventsource-stream (SSE) |
| MCP | Node.js sidecar (@modelcontextprotocol/sdk) |
| Markdown | @assistant-ui/react-markdown + remark-gfm + KaTeX |
| Code Highlighting | Shiki |
| Language | Rust (백엔드) + TypeScript (프론트엔드) |

---

## 프로젝트 구조

```text
src-tauri/                    # Rust Backend (Tauri 2)
  src/
    lib.rs                    # Tauri builder (tray, commands, plugins)
    state.rs                  # AppState (DB, MCP, Auth)
    auth/                     # OAuth (PKCE, Device Flow, keyring)
    providers/                # LLM providers + router
    db/                       # rusqlite (conversations, skills, evals)
    mcp/                      # MCP sidecar bridge (JSON-RPC)
    commands/                 # Tauri command handlers
    skills/                   # Skill AI + eval engine
  prompts/                    # System prompt templates
  data/                       # Preset skills (JSON)
sidecar/                      # MCP bridge (Node.js)
src/renderer/                 # React UI
  components/
    chat/                     # ChatView, AssistantThread, ChatSearchBar
    cowork/                   # CoworkView, ProgressPanel, InlineToolCall
    eval/                     # EvalWorkbench, EvalRunner, EvalBenchmark
    settings/                 # SettingsPanel
    sidebar/                  # Sidebar, ConversationList
  hooks/                      # use-assistant-runtime
  lib/                        # providers config, utilities
  stores/                     # Zustand app-store
  styles/                     # globals.css
```

---

## 문제 해결

### macOS에서 Rust 컴파일 실패

**증상:** `xcrun` 또는 `clang` 누락에 대한 오류.

**해결 방법:** Xcode Command Line Tools를 설치합니다:

```bash
xcode-select --install
```

### Linux에서 `npm run tauri:dev` 실패, "webkit2gtk not found" 메시지

**증상:** Rust 빌드 단계가 `webkit2gtk-4.1` 검색에 실패합니다.

**해결 방법:** 필요한 시스템 라이브러리를 설치합니다. Debian/Ubuntu의 경우:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev
```

### MCP 사이드카 시작 실패

**증상:** MCP 도구를 사용할 수 없습니다. 앱이 "MCP sidecar not found"를 표시합니다.

**해결 방법:** Node.js 20 이상이 설치되어 있고 `npx`를 PATH에서 사용할 수 있는지 확인합니다:

```bash
node --version   # Should show v20.x or higher
npx --version    # Should show 10.x or higher
```

`npx`를 찾을 수 없으면 [nodejs.org](https://nodejs.org)에서 Node.js를 다시 설치합니다.

### OAuth 로그인 윈도우가 나타나지 않음

**증상:** "Log in"을 클릭해도 아무 일이 없거나 빈 윈도우가 표시됩니다.

**해결 방법:** OAuth 콜백 포트를 다른 애플리케이션이 사용하지 않는지 확인합니다. Codex는 포트 1455를 사용합니다. 충돌하는 프로세스를 종료하고 다시 시도합니다.

### 첫 번째 Rust 빌드 시간이 오래 걸림

**증상:** `npm run tauri:dev`가 초기 컴파일 중에 응답하지 않는 것 같습니다.

**설명:** 첫 빌드는 모든 Rust 의존성(300개 이상의 크레이트)을 컴파일합니다. 이는 머신에 따라 2-5분이 걸립니다. 후속 빌드는 컴파일된 캐시를 재사용하며 훨씬 빠르게 시작됩니다.

---

## 설계 문서

이 문서들은 각 기능 뒤의 아키텍처와 설계 결정을 설명합니다.

| 문서 | 경로 |
|----------|------|
| Context Window Management | `docs/context-window/design.md` |
| Cowork Mode | `docs/cowork/design.md` |
| MCP AI Assist | `docs/mcp-ai-assist/design.md` |
| MCP Tool Visualization | `docs/mcp-tool-viz/design.md` |
| Skill System | `docs/prompts/design.md` |
| Chat Search | `docs/search/design.md` |
| Tauri Migration | `docs/tauri-migration/design.md` |

---

## 다운로드

[GitHub Releases](https://github.com/kangnam7654/kangnam-client/releases)에서 미리 빌드된 바이너리를 다운로드합니다.

사용 가능한 플랫폼:
- **macOS** (Apple Silicon / Intel)
- **Windows** (x64)
- **Linux** (x64)

---

## 기여

기여를 환영합니다. 다음은 참여하는 방법입니다:

1. 저장소를 포크합니다.
2. 기능 브랜치를 생성합니다: `git checkout -b feature/your-feature-name`.
3. 변경 사항을 만들고 테스트를 추가합니다.
4. `npm run tauri:dev`를 실행하여 앱이 작동하는지 확인합니다.
5. 변경 사항을 명확하게 설명하는 풀 리퀘스트를 제출합니다.

더 큰 변경의 경우 먼저 이슈를 열어 접근 방식에 대해 논의하세요.

---

## 라이선스

[MIT](LICENSE) -- Copyright (c) 2026 Kangnam Kim
