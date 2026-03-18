# Kangnam Client

**A desktop LLM chat app that uses the subscriptions you already pay for.**

ChatGPT Plus, GitHub Copilot -- 이미 결제하고 있는 구독으로 LLM API를 사용하는 데스크톱 채팅 앱입니다. API 키 결제가 필요 없습니다.

---

## Why Kangnam Client? / 왜 Kangnam Client인가?

You already pay for ChatGPT Plus or GitHub Copilot. Those subscriptions give you access to powerful LLMs. But using them programmatically usually means paying *again* for API keys.

Kangnam Client takes a different approach. Log in with your existing subscription account, and chat through a fast, native desktop app. No API keys. No extra billing. You use what you already have.

이미 ChatGPT Plus나 GitHub Copilot을 결제하고 있다면, 그 구독만으로 충분합니다. API 키를 따로 구매할 필요 없이, 기존 계정으로 로그인하면 바로 사용할 수 있습니다.

---

## How It Works / 작동 방식

Kangnam Client connects to LLM providers through their subscription authentication flow -- the same login you use on the web. The app runs as a native desktop application built with Tauri 2 (a framework that pairs a Rust backend with your system's web view).

Here is the flow:

1. **Open the app** and choose a provider (Codex or Copilot).
2. **Log in** with your existing subscription account via OAuth (a secure login protocol that never exposes your password to the app).
3. **Start chatting.** Responses stream in real time, rendered with full Markdown support.
4. **Connect MCP (Model Context Protocol) servers** (optional) to give the LLM access to external tools like file systems, databases, or APIs.

```text
[Your Subscription] --> [OAuth Login] --> [Kangnam Client] --> [LLM API]
                                               |
                                          [MCP Servers] (optional tools)
```

---

## Features / 주요 기능

### Multi-Provider Chat / 멀티 프로바이더 채팅

Switch between LLM providers within a single app. Each provider uses its own authentication method.

여러 LLM 프로바이더를 하나의 앱에서 전환하며 사용할 수 있습니다.

| Provider | Subscription Required | Auth Method |
|----------|----------------------|-------------|
| **OpenAI Codex** | ChatGPT Plus / Pro | PKCE OAuth (a secure code-exchange flow that proves the app's identity without exposing a client secret) |
| **GitHub Copilot** | Copilot subscription | Device Flow (you enter a code on GitHub's website to authorize the app) |

### MCP Integration / MCP 연동

MCP (Model Context Protocol) lets LLMs call external tools -- read files, query databases, or interact with APIs. Kangnam Client includes a built-in MCP server manager.

MCP(Model Context Protocol)는 LLM이 외부 도구를 호출할 수 있게 해주는 프로토콜입니다.

- Supports all transport types: stdio, HTTP, and SSE (Server-Sent Events).
- Visualizes tool calls inline -- see the tool name, arguments, and results in a collapsible view.
- Includes AI Assist that auto-generates MCP server configurations.
- Compatible with Claude Desktop's MCP config format.

**MCP server config example:**

The app stores server configurations in a JSON file that follows Claude Desktop's `mcpServers` format. Add servers through the Settings panel, or edit the config file directly.

Config file location (MCP 설정 파일 위치):
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

Each server entry supports three transport types:
- **stdio**: Runs a local process. Requires `command` and optional `args` and `env`.
- **http**: Connects to a remote HTTP endpoint. Requires `url` and optional `headers`.
- **sse**: Connects via Server-Sent Events. Requires `url` and optional `headers`.

**Tool call visualization (도구 호출 시각화):**

When the LLM uses an MCP tool, the app displays the call inline as a collapsible card. Click the card to expand the full input and output.

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

### Rich Chat UI / 채팅 UI

The chat interface goes beyond plain text. It renders Markdown, highlights code in 25+ languages using [Shiki](https://shiki.style/) (a syntax highlighter powered by VS Code's TextMate grammars), and displays math with [KaTeX](https://katex.org/) (a fast LaTeX math renderer).

- Streaming responses with real-time Markdown rendering.
- Code highlighting with Shiki (github-dark theme, 25+ languages supported).
- Live display of the model's thinking/reasoning process.
- File and image attachments.
- In-chat search with Cmd/Ctrl+F.
- Export conversations as Markdown or JSON.

### Context Window Management / 컨텍스트 관리

A token usage bar shows how much of the model's context window (the maximum amount of text the model can process at once) you have used. When usage reaches 90%, the app automatically compresses the conversation using LLM-generated summaries.

### Cowork Mode / 코워크 모드

Cowork mode lets the LLM execute multi-step tasks autonomously using MCP tools. Think of it as giving the LLM a to-do list and watching it work through each step.

코워크 모드는 LLM이 MCP 도구를 사용하여 다단계 작업을 자율적으로 수행하는 기능입니다.

- Autonomous task execution powered by MCP tools.
- Real-time progress sidebar showing each step.
- Multi-turn follow-up conversations within a task.

**Example: ask Cowork to analyze a project**

Enter a task description and the LLM builds a plan, then executes each step using available MCP tools.

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

When the task completes, Cowork emits a summary. You can send follow-up messages to refine the results.

### Skill System / 스킬 시스템

Skills are reusable prompt templates (a set of instructions that customize LLM behavior for a specific task). The app ships with 14 built-in presets and lets you create your own.

스킬은 특정 작업에 맞게 LLM 동작을 커스터마이즈하는 재사용 가능한 프롬프트 템플릿입니다. 14개의 내장 프리셋을 제공하며, 직접 생성할 수도 있습니다.

- 14 built-in preset skills.
- AI-powered skill creation, refinement, and evaluation.
- Eval Workbench for testing and benchmarking skill performance.
- Tree-based reference management.

**Built-in skill examples (내장 스킬 예시):**

| Skill | What it does |
|-------|-------------|
| Agent Creator | Generates a new Claude Code custom agent definition file |
| Code Reviewer | Reviews code for bugs, performance, and best practices |
| Technical Writer | Writes documentation following structured quality criteria |

**Creating a custom skill:**

Describe what you want in natural language. The AI generates the skill name, description, and instructions.

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

You can then refine the skill with feedback, attach reference documents, and benchmark it using the Eval Workbench.

---

## Screenshots

> TODO: Add screenshots / 스크린샷 추가 예정

---

## Getting Started / 시작하기

### Prerequisites / 사전 요구사항

Install these tools before proceeding:

| Tool | Minimum Version | Installation |
|------|----------------|-------------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | 1.75+ (edition 2021) | [rustup.rs](https://rustup.rs) |
| npm | 10+ | Included with Node.js |

**Platform-specific requirements (플랫폼별 추가 요구사항):**

| Platform | Required Tools | Install Command |
|----------|---------------|----------------|
| macOS | Xcode Command Line Tools | `xcode-select --install` |
| Linux (Debian/Ubuntu) | webkit2gtk, build essentials | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` |
| Linux (Fedora) | webkit2gtk, development tools | `sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel` |
| Windows | WebView2 Runtime | Pre-installed on Windows 10/11. See [Tauri docs](https://v2.tauri.app/start/prerequisites/) if missing. |

You also need an active subscription to at least one supported provider (ChatGPT Plus/Pro or GitHub Copilot).

### Step 1: Clone the Repository / 저장소 클론

```bash
git clone https://github.com/kangnam7654/kangnam-client.git
cd kangnam-client
```

### Step 2: Install Dependencies / 의존성 설치

```bash
npm install
```

After installation completes, expect output similar to:

```text
added 1200+ packages in 30s
```

This installs both the frontend (React) and sidecar (MCP bridge) dependencies.

프론트엔드(React)와 사이드카(MCP 브릿지) 의존성이 함께 설치됩니다.

### Step 3: Run in Development Mode / 개발 모드 실행

```bash
npm run tauri:dev
```

This starts the Vite dev server for the frontend and compiles the Rust backend. On first run, Rust compilation takes 2-5 minutes. Subsequent runs start in seconds.

After startup, expect to see output similar to this:

```text
  VITE v7.x.x  ready in 300 ms

  ->  Local:   http://localhost:1420/

        Info Watching /Users/you/kangnam-client/src-tauri for changes...
   Compiling kangnam-client v0.1.0
    Finished `dev` profile target(s) in 3.21s
```

The Tauri app window opens automatically. Select a provider from the sidebar and log in with your subscription account.

Vite 개발 서버와 Tauri 앱이 동시에 실행됩니다. 첫 실행 시 Rust 컴파일에 2-5분이 소요됩니다. 이후 실행은 수 초 내에 시작됩니다.

### Step 4: Build for Production / 프로덕션 빌드

```bash
npm run tauri:build
```

After the build completes, expect output similar to:

```text
    Finished `release` profile target(s) in 2m 15s
    Bundling kangnam-client.app
    Finished 1 bundle at:
        src-tauri/target/release/bundle/macos/kangnam-client.app
```

Find the built application in `src-tauri/target/release/bundle/`.

빌드 결과물은 `src-tauri/target/release/bundle/` 에서 확인할 수 있습니다.

---

## Tech Stack / 기술 스택

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust backend + system WebView) |
| UI | React 19 + Tailwind CSS 4 |
| State | Zustand 5 |
| DB | rusqlite (native SQLite, bundled) |
| Token Storage | keyring (OS keychain) |
| HTTP | reqwest + eventsource-stream (SSE) |
| MCP | Node.js sidecar (@modelcontextprotocol/sdk) |
| Markdown | @assistant-ui/react-markdown + remark-gfm + KaTeX |
| Code Highlighting | Shiki |
| Language | Rust (backend) + TypeScript (frontend) |

---

## Project Structure / 프로젝트 구조

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

## Troubleshooting / 문제 해결

### Rust compilation fails on macOS

**Symptom:** Errors about missing `xcrun` or `clang`.

**Fix:** Install Xcode Command Line Tools:

```bash
xcode-select --install
```

### `npm run tauri:dev` fails with "webkit2gtk not found" on Linux

**Symptom:** The Rust build step fails searching for `webkit2gtk-4.1`.

**Fix:** Install the required system libraries. On Debian/Ubuntu:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev
```

### MCP sidecar fails to start

**Symptom:** MCP tools are not available. The app shows "MCP sidecar not found."

**Fix:** Verify that Node.js 20+ is installed and `npx` is available in your PATH:

```bash
node --version   # Should show v20.x or higher
npx --version    # Should show 10.x or higher
```

If `npx` is not found, reinstall Node.js from [nodejs.org](https://nodejs.org).

### OAuth login window does not appear

**Symptom:** Clicking "Log in" does nothing or shows a blank window.

**Fix:** Check that no other application is using the OAuth callback port. Codex uses port 1455. Close any conflicting processes and try again.

### First Rust build takes a long time

**Symptom:** `npm run tauri:dev` appears stuck during initial compilation.

**Explanation:** The first build compiles all Rust dependencies (300+ crates). This takes 2-5 minutes depending on your machine. Subsequent builds reuse the compiled cache and start much faster.

---

## Design Documents / 설계 문서

These documents describe the architecture and design decisions behind each feature.

| Document | Path |
|----------|------|
| Context Window Management | `docs/context-window/design.md` |
| Cowork Mode | `docs/cowork/design.md` |
| MCP AI Assist | `docs/mcp-ai-assist/design.md` |
| MCP Tool Visualization | `docs/mcp-tool-viz/design.md` |
| Skill System | `docs/prompts/design.md` |
| Chat Search | `docs/search/design.md` |
| Tauri Migration | `docs/tauri-migration/design.md` |

---

## Downloads / 다운로드

Download pre-built binaries from [GitHub Releases](https://github.com/kangnam7654/kangnam-client/releases).

Available platforms:
- **macOS** (Apple Silicon / Intel)
- **Windows** (x64)
- **Linux** (x64)

---

## Contributing / 기여하기

Contributions are welcome. Here is how to get involved:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`.
3. Make your changes and add tests.
4. Run `npm run tauri:dev` to verify the app works.
5. Submit a pull request with a clear description of the change.

For larger changes, open an issue first to discuss the approach.

---

## License / 라이선스

[MIT](LICENSE) -- Copyright (c) 2026 Kangnam Kim
