# Kangnam Client

Desktop LLM chat client with subscription-based providers and MCP support.

API 키 결제 없이 기존 구독(ChatGPT Plus, Copilot)만으로 LLM API를 사용하는 데스크톱 채팅 앱.

## Screenshots

> TODO: 스크린샷 추가

## Features

### Multi-Provider Chat
- **OpenAI Codex** — ChatGPT Plus/Pro 구독 (PKCE OAuth)
- **GitHub Copilot** — Copilot 구독 (Device Flow)

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
| Desktop | Tauri 2 (Rust backend) |
| UI | React 19 + Tailwind CSS 4 |
| State | Zustand |
| DB | rusqlite (native SQLite) |
| MCP | Node.js sidecar (@modelcontextprotocol/sdk) |
| Markdown | @assistant-ui/react-markdown + remark-gfm + KaTeX |
| Highlighting | Shiki |
| Language | Rust (backend) + TypeScript (frontend) |

## Getting Started

### Prerequisites

- Node.js 20+
- Rust (latest stable)
- npm 10+

### Development

```bash
git clone https://github.com/kangnam7654/kangnam-client.git
cd kangnam-client
npm install
npm run tauri:dev
```

### Build

```bash
npm run tauri:build
```

빌드 결과물: `src-tauri/target/release/bundle/`

## Project Structure

```
src-tauri/                 # Rust Backend (Tauri 2)
├── src/
│   ├── lib.rs             # Tauri builder (tray, commands, plugins)
│   ├── state.rs           # AppState (DB, MCP, Auth)
│   ├── auth/              # OAuth (PKCE, Device Flow, keyring)
│   ├── providers/         # LLM providers + router
│   ├── db/                # rusqlite (conversations, skills, evals)
│   ├── mcp/               # MCP sidecar bridge (JSON-RPC)
│   ├── commands/           # Tauri command handlers
│   └── skills/            # Skill AI + eval engine
sidecar/                   # MCP bridge (Node.js)
src/renderer/              # React UI
├── components/
│   ├── chat/              # ChatView, AssistantThread, ChatSearchBar
│   ├── cowork/            # CoworkView, ProgressPanel, InlineToolCall
│   ├── eval/              # EvalWorkbench, EvalRunner, EvalBenchmark
│   ├── settings/          # SettingsPanel
│   └── sidebar/           # Sidebar, ConversationList
├── hooks/                 # use-assistant-runtime
├── lib/                   # providers config, utilities
├── stores/                # Zustand app-store
└── styles/                # globals.css
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
| Tauri Migration | `docs/tauri-migration/design.md` |

## Releases

[GitHub Releases](https://github.com/kangnam7654/kangnam-client/releases)에서 Mac (arm64/x64), Windows (x64), Linux (x64) 다운로드 가능.

## License

Private — All rights reserved.
