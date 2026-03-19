# Kangnam Client

A desktop LLM (Large Language Model) chat app that connects to providers through your existing subscriptions. No API keys required.

[한국어 문서 (Korean)](docs/README_ko.md)

---

## Why This Exists

This project started while building an Unreal Engine MCP server. During that work, it became clear that non-developers should also be able to use MCP (Model Context Protocol -- a standard that lets LLMs call external tools). The problem: existing MCP clients like Claude Desktop and terminal-based tools assume technical knowledge.

Kangnam Client came from that idea. It is a desktop app that tries to make MCP accessible to everyone. You log in with a subscription account you already have, and the app handles the rest.

It is a personal project, not a commercial product. It works, but it has rough edges.

---

## What It Does

Kangnam Client is a desktop chat application built with Tauri 2 (Rust backend + system WebView). It connects to LLM providers through their subscription authentication flows -- the same login you use on the web. You do not need separate API keys.

The app also includes a built-in MCP server manager. MCP lets LLMs call external tools like file systems, databases, or APIs. You can add and manage MCP servers through the settings panel.

---

## Prerequisites

### Required Knowledge

- Basic command-line usage (running commands in a terminal)
- An active subscription to at least one supported provider (see table below)

### Required Tools

Install these before proceeding:

| Tool | Minimum Version | Installation |
|------|----------------|-------------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | 1.75+ (edition 2021) | [rustup.rs](https://rustup.rs) |
| npm | 10+ | Included with Node.js |

### Platform-Specific Requirements

| Platform | Required | Install Command |
|----------|----------|----------------|
| macOS | Xcode Command Line Tools | `xcode-select --install` |
| Linux (Debian/Ubuntu) | webkit2gtk, build essentials | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` |
| Linux (Fedora) | webkit2gtk, development tools | `sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel` |
| Windows | WebView2 Runtime | Pre-installed on Windows 10/11. See [Tauri docs](https://v2.tauri.app/start/prerequisites/) if missing. |

---

## Supported Providers

Five providers are implemented. Each requires its own subscription.

| Provider | Auth Method | Subscription Required |
|----------|------------|----------------------|
| OpenAI Codex | PKCE OAuth | ChatGPT Plus / Pro |
| Gemini CLI | PKCE + client_secret | Google AI Pro |
| Antigravity | PKCE + client_secret | Google subscription |
| GitHub Copilot | Device Flow | Copilot subscription |
| Claude | Setup Token | Claude Max |

**Auth method definitions:**

- **PKCE OAuth** (Proof Key for Code Exchange): A secure login flow that proves the app's identity without exposing a secret. The app opens a browser window for login and receives a token via a local callback.
- **Device Flow**: You visit a URL and enter a code to authorize the app. No browser redirect is needed.
- **Setup Token**: A one-time token you paste into the app to authenticate.

---

## Features

- **Multi-provider chat** -- Switch between providers in a single app. Responses stream in real time.
- **MCP server manager** -- Add and manage MCP servers. Supports stdio (local process), HTTP, and SSE (Server-Sent Events) transports.
- **Tool call visualization** -- When the LLM uses an MCP tool, the call appears inline as a collapsible card showing inputs and outputs.
- **Cowork mode** -- The LLM executes multi-step tasks autonomously using MCP tools. A progress sidebar shows each step in real time.

  Example: You type "Find all TODO comments in my project and create a summary file." The LLM reads your filesystem via MCP, searches for TODOs, and writes a `todo-summary.md` -- each step visible in the progress sidebar.

- **Skill system** -- Reusable prompt templates (instructions that customize LLM behavior for a specific task). Ships with 14 built-in presets. You can create your own.

  Example: The built-in "Code Review" skill instructs the LLM to check for bugs, style issues, and security concerns. Select it from the skill dropdown before starting a conversation, and the LLM follows those instructions throughout.

- **Eval workbench** -- Test and benchmark skills with structured evaluation runs.

  Example: Create an eval set with 5 test prompts and a grading rubric. The workbench sends each prompt to the LLM using the selected skill, scores responses against your rubric, and shows pass/fail results.
- **Context window management** -- A token usage bar shows how much of the model's context window (the maximum text the model can process at once) is used. At 90% usage, the app auto-compresses the conversation.
- **Rich rendering** -- Markdown, code highlighting via [Shiki](https://shiki.style/) (25+ languages), and math via [KaTeX](https://katex.org/).
- **Conversation history** -- Search past conversations with Cmd/Ctrl+F. Export as Markdown or JSON.
- **System tray + themes** -- Runs in the system tray. Supports dark and light themes.

---

## Screenshots

> Screenshots will be added here.

---

## Getting Started

### Step 1: Clone the repository

```bash
git clone https://github.com/kangnam7654/kangnam-client.git
cd kangnam-client
```

### Step 2: Install dependencies

```bash
npm install
```

This installs both the frontend (React) and sidecar (a helper process that runs alongside the main app to bridge MCP communication) dependencies. Expect output like:

```text
added 1200+ packages in 30s
```

### Step 3: Run in development mode

```bash
npm run tauri:dev
```

This starts the Vite dev server and compiles the Rust backend. The first build compiles all Rust dependencies (300+ crates, which are Rust packages) and takes 2-5 minutes. Subsequent builds start in seconds.

After startup, expect output like:

```text
  VITE v7.x.x  ready in 300 ms

  ->  Local:   http://localhost:1420/

        Info Watching /Users/you/kangnam-client/src-tauri for changes...
   Compiling kangnam-client v0.1.0
    Finished `dev` profile target(s) in 3.21s
```

The app window opens automatically. Select a provider from the sidebar and log in.

### Step 4: Build for production

```bash
npm run tauri:build
```

Find the built application in `src-tauri/target/release/bundle/`.

---

## MCP Configuration

The app stores MCP server configurations in a JSON file. The format follows Claude Desktop's `mcpServers` structure.

### Config file locations

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/kangnam-client/mcp-config.json` |
| Windows | `%APPDATA%/kangnam-client/mcp-config.json` |
| Linux | `~/.config/kangnam-client/mcp-config.json` |

You can add servers through the Settings panel or edit the file directly.

### Example configuration

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

### Transport types

Each server entry uses one of three transport types:

- **stdio** -- Runs a local process. Requires `command`. Optional: `args`, `env`.
- **http** -- Connects to a remote HTTP endpoint. Requires `url`. Optional: `headers`.
- **sse** -- Connects via Server-Sent Events (a protocol for streaming data from server to client over HTTP). Requires `url`. Optional: `headers`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust backend + system WebView) |
| Frontend | React 19 + Vite 7 + Tailwind CSS v4 |
| State management | Zustand 5 |
| Database | rusqlite (native SQLite, bundled with the app) |
| Token storage | keyring (OS keychain) |
| HTTP | reqwest + eventsource-stream (SSE streaming) |
| MCP bridge | Node.js sidecar (@modelcontextprotocol/sdk) |
| Code highlighting | Shiki |
| Math rendering | KaTeX |
| Languages | Rust (backend) + TypeScript (frontend) |

---

## Project Structure

```text
src-tauri/                    # Rust backend (Tauri 2)
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
src/renderer/                 # React frontend
  components/
    chat/                     # Chat UI, assistant thread, search bar
    cowork/                   # Cowork mode, progress panel, tool calls
    eval/                     # Eval workbench, runner, benchmarks
    settings/                 # Settings panel
    sidebar/                  # Sidebar, conversation list
  hooks/                      # assistant-ui runtime
  lib/                        # Provider configs, utilities
  stores/                     # Zustand app store
  styles/                     # Global CSS
docs/                         # Design documents
```

---

## Current Status

This is a personal project in active development.

### What is done

- Phases 1-4: Auth, chat, MCP integration, cowork mode, skill system, eval workbench, search
- Phase 5: Tauri migration (moved from Electron to Tauri 2, full Rust backend)
- All five providers are implemented and working

### What is in progress (Phase 6: Polish)

- Keyboard shortcuts
- Auto-update mechanism
- MCP sidecar bundling (currently requires Node.js on the user's machine)
- Cross-platform build pipeline

### Known limitations

- The app requires Node.js installed on the user's machine for MCP to work. Sidecar bundling is planned but not done yet.
- No pre-built binaries are available yet for all platforms.
- The Electron codebase (`src/main/`) still exists in the repo but is no longer used. It will be removed in a future cleanup.

---

## Troubleshooting

### Rust compilation fails on macOS

**Symptom:** Errors about missing `xcrun` or `clang`.

**Fix:** Install Xcode Command Line Tools:

```bash
xcode-select --install
```

### "webkit2gtk not found" on Linux

**Symptom:** The Rust build fails searching for `webkit2gtk-4.1`.

**Fix:** Install the required system libraries. On Debian/Ubuntu:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev
```

### MCP sidecar fails to start

**Symptom:** MCP tools are unavailable. The app shows "MCP sidecar not found."

**Fix:** Verify that Node.js 20+ is installed and `npx` is in your PATH:

```bash
node --version   # Should show v20.x or higher
npx --version    # Should show 10.x or higher
```

If `npx` is not found, reinstall Node.js from [nodejs.org](https://nodejs.org).

### OAuth login window does not appear

**Symptom:** Clicking "Log in" does nothing or shows a blank window.

**Fix:** Check that no other application is using the OAuth callback port. Codex uses port 1455. Close any conflicting processes and retry.

### First build takes a long time

**Symptom:** `npm run tauri:dev` appears stuck during initial compilation.

**Explanation:** The first build compiles all Rust dependencies (300+ crates). This takes 2-5 minutes depending on your machine. Subsequent builds reuse the compiled cache and start much faster.

---

## Design Documents

These documents describe the architecture and decisions behind each feature.

| Document | Path |
|----------|------|
| Context Window Management | [`docs/context-window/design.md`](docs/context-window/design.md) |
| Cowork Mode | [`docs/cowork/design.md`](docs/cowork/design.md) |
| MCP AI Assist | [`docs/mcp-ai-assist/design.md`](docs/mcp-ai-assist/design.md) |
| MCP Tool Visualization | [`docs/mcp-tool-viz/design.md`](docs/mcp-tool-viz/design.md) |
| Skill System | [`docs/prompts/design.md`](docs/prompts/design.md) |
| Chat Search | [`docs/search/design.md`](docs/search/design.md) |
| Tauri Migration | [`docs/tauri-migration/design.md`](docs/tauri-migration/design.md) |

---

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`.
3. Make your changes and add tests.
4. Run `npm run tauri:dev` to verify the app works.
5. Submit a pull request with a clear description of the change.

For larger changes, open an issue first to discuss the approach.

---

## License

[MIT](LICENSE) -- Copyright (c) 2026 Kangnam Kim
