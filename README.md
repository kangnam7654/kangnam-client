# Kangnam Client

Desktop LLM chat client with subscription-based providers and MCP support.

API 키 결제 없이 기존 구독(ChatGPT Plus, Gemini Pro, Copilot, Claude)만으로 LLM API를 사용하는 데스크톱 채팅 앱.

## Screenshots

> TODO: 스크린샷 추가

## Features

### Multi-Provider Chat
- **OpenAI Codex** — ChatGPT Plus/Pro 구독 (PKCE OAuth)
- **Google Gemini** — Gemini Pro 구독 (PKCE + Secret)
- **Antigravity** — Gemini + Claude (Google OAuth)
- **GitHub Copilot** — Copilot 구독 (Device Flow)
- **Anthropic Claude** — Setup Token 또는 API Key

### MCP Integration
- stdio / http / sse 전체 transport 지원
- 툴 호출 시각화 (이름, 인자, 결과 — 접힌/펼침)
- AI Assist로 서버 설정 자동 생성
- 서버 편집, 재연결, Claude Desktop 형식 호환

### Chat UI
- 스트리밍 응답 + 마크다운 렌더링
- Shiki 코드 하이라이팅 (github-dark, 25+ 언어)
- Thinking/Reasoning 실시간 표시
- 파일/이미지 첨부
- 채팅 검색 (Cmd/Ctrl+F)
- 대화 내보내기 (Markdown / JSON)

### Context Window Management
- 토큰 사용량 바 (모델별 context window)
- 90% 도달 시 자동 압축 (LLM 요약)

### Cowork Mode
- MCP 툴 기반 자율 태스크 실행
- 실시간 진행상황 사이드바
- 멀티턴 follow-up

### Skill System
- 14개 빌트인 프리셋 스킬
- AI 스킬 생성/개선/평가
- Eval Workbench (테스트, 벤치마크, 설명 최적화)
- 트리 형식 레퍼런스 관리

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 41 + electron-vite 5 |
| UI | React 19 + Tailwind CSS 4 |
| State | Zustand |
| DB | sql.js (WASM SQLite) |
| MCP | @modelcontextprotocol/sdk |
| Markdown | @assistant-ui/react-markdown + remark-gfm + KaTeX |
| Highlighting | Shiki |
| Language | TypeScript (strict) |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Development

```bash
git clone https://github.com/kangnam7654/kangnam-client.git
cd kangnam-client
npm install
npm run dev
```

### Build

```bash
# Mac (Apple Silicon)
npm run package:mac

# Windows
npm run package:win

# Linux
npm run package:linux

# All platforms
npm run package:all
```

빌드 결과물: `dist/`

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── auth/              # OAuth flows (PKCE, Device Flow, Setup Token)
│   ├── db/                # sql.js SQLite (conversations, skills, evals, presets)
│   ├── ipc/               # IPC handlers (chat, auth, mcp, skills, eval)
│   ├── mcp/               # MCP client manager + tool adapter
│   ├── providers/         # LLM providers (Codex, Gemini, Antigravity, Copilot, Claude)
│   ├── skills/            # Skill AI + eval engine
│   └── index.ts           # App entry
├── preload/               # Context bridge (IPC API surface)
└── renderer/              # React UI
    ├── components/
    │   ├── chat/           # ChatView, AssistantThread, ChatSearchBar
    │   ├── cowork/         # CoworkView, ProgressPanel, InlineToolCall
    │   ├── eval/           # EvalWorkbench, EvalRunner, EvalBenchmark
    │   ├── settings/       # SettingsPanel (Providers, MCP, Skills, General)
    │   └── sidebar/        # Sidebar, ConversationList
    ├── hooks/              # use-assistant-runtime
    ├── lib/                # providers config, utilities
    ├── stores/             # Zustand app-store
    └── styles/             # globals.css
```

## Design Documents

| Document | Path |
|----------|------|
| Context Window Management | `docs/context-window/design.md` |
| Cowork Mode | `docs/cowork/design.md` |
| MCP AI Assist | `docs/mcp-ai-assist/design.md` |
| MCP Tool Visualization | `docs/mcp-tool-viz/design.md` |
| Skill System | `docs/prompts/design.md` |
| Chat Search | `docs/search/design.md` |

## Provider Authentication

각 프로바이더의 OAuth 인증 흐름, 엔드포인트, 토큰 갱신 방법은 `llm-provider-auth` 스킬에 정리되어 있습니다.

| Provider | Auth | Endpoint |
|----------|------|----------|
| Codex | PKCE OAuth | `chatgpt.com/backend-api/codex/responses` |
| Gemini | PKCE + Secret | `cloudcode-pa.googleapis.com/v1internal` |
| Antigravity | PKCE + Secret | 위와 동일 |
| Copilot | Device Flow | `api.githubcopilot.com/chat/completions` |
| Claude (API) | API Key | `api.anthropic.com/v1/messages` |
| Claude (Sub) | Setup Token + Beta | 위와 동일 (`anthropic-beta: claude-code-20250219,oauth-2025-04-20`) |

## Releases

[GitHub Releases](https://github.com/kangnam7654/kangnam-client/releases)에서 Mac (arm64), Windows (x64), Linux (x64 AppImage) 다운로드 가능.

## License

Private — All rights reserved.
