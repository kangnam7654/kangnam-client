# MCP AI Assist

## 목적

MCP 서버 추가 시 JSON을 직접 작성하는 대신, 자연어 또는 파일 경로로 설정을 생성하는 AI 어시스트.

## 입력 방식

1. **자연어**: "fetch 서버 추가해줘", "GitHub MCP 연결", "파일시스템 접근"
2. **로컬 파일 경로**: `/path/to/server.py`, `./my-mcp-server/index.ts`
3. **JSON 정리**: 잘못된 JSON 붙여넣기 → AI가 포맷팅/수정

## 출력

생성된 JSON config → Add Server textarea에 자동 입력 (prettified). 사용자가 확인 후 Add.

## AI System Prompt 핵심

- 인기 MCP 서버 DB (name, command, args, env)
- stdio: `uvx`, `npx`, `node`, `python` 명령어
- http/sse: URL 기반
- 로컬 파일: 확장자로 런타임 추론 (.py → python, .ts → npx tsx, .js → node)
- env 변수 필요 시 placeholder로 안내
- JSON 포맷팅/검증

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/main/ipc/mcp-handlers.ts` | `mcp:ai-assist` IPC 핸들러 |
| `src/preload/index.ts` | `aiAssist` API 추가 |
| `src/renderer/components/settings/SettingsPanel.tsx` | MCPTab에 AI 입력 UI |

## UI

Add Server 영역 위에 AI 입력:
```
┌─────────────────────────────────────────┐
│ ✨ "fetch 서버 추가해줘"          [Generate] │
└─────────────────────────────────────────┘
↓ 생성된 JSON이 아래 textarea에 들어감
┌─────────────────────────────────────────┐
│ {                                       │
│   "name": "fetch",                      │
│   "type": "stdio",                      │
│   ...                                   │
│ }                               [Add]   │
└─────────────────────────────────────────┘
```
