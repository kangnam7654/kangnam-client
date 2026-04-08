# Kangnam Client

코딩 에이전트 CLI(Claude Code, Codex CLI)를 위한 데스크톱 GUI 래퍼. 터미널 대신 구조화된 채팅 인터페이스로 AI 코딩 에이전트를 사용할 수 있습니다.

[English](../README.md)

---

## 왜 이 프로젝트가 존재하는가

Claude Code, Codex CLI 같은 코딩 에이전트 CLI는 강력하지만, 터미널 사용에 익숙해야 합니다. Kangnam Client는 이런 CLI를 서브프로세스로 실행하고 JSON 출력을 구조화된 GUI로 보여줍니다 — 비개발자도 사용할 수 있도록.

개인 프로젝트이며 상용 제품이 아닙니다.

---

## 주요 기능

- **멀티 CLI 지원** — Claude Code와 Codex CLI 간 전환. 새 CLI 추가는 어댑터 구현만 하면 됨.
- **실시간 스트리밍** — 토큰 단위 텍스트 표시, 도구 호출 진행, 서브에이전트 활동 — 모두 실시간.
- **안전 다이얼로그** — CLI가 파일 수정이나 명령 실행 권한을 요청하면 확인 다이얼로그가 나타남.
- **설정 위저드** — 설치된 CLI 감지, 미설치 CLI 설치 안내, 초기 설정 가이드.
- **대화 저장** — 메시지가 로컬 SQLite 데이터베이스에 저장됨.
- **웹 접근** — WebSocket(ws://localhost:3001/ws)을 통해 브라우저에서도 동일한 UI 사용 가능.

---

## 전제조건

### 필요한 도구

| 도구 | 최소 버전 | 설치 |
|------|---------|------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | 1.75+ (edition 2021) | [rustup.rs](https://rustup.rs) |
| npm | 10+ | Node.js에 포함됨 |

### 지원 CLI (최소 하나 필요)

| CLI | 설치 | 구독 |
|-----|------|------|
| Claude Code | `npm install -g @anthropic-ai/claude-code` | Claude Max |
| Codex CLI | `npm install -g @openai/codex` | OpenAI 구독 |

### 플랫폼별 요구사항

| 플랫폼 | 필요 항목 | 설치 명령어 |
|--------|---------|-----------|
| macOS | Xcode Command Line Tools | `xcode-select --install` |
| Linux (Debian/Ubuntu) | webkit2gtk, 빌드 필수 | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` |
| Windows | WebView2 Runtime | Windows 10/11에 기본 설치됨. 없으면 [Tauri 문서](https://v2.tauri.app/start/prerequisites/) 참조. |

---

## 시작하기

### 1단계: 클론 및 설치

```bash
git clone https://github.com/kangnam7654/kangnam-client.git
cd kangnam-client
npm install
```

### 2단계: 개발 모드 실행

```bash
npm run tauri:dev
```

첫 빌드는 Rust 의존성(300+ crate)을 컴파일하므로 2-5분 소요. 이후 빌드는 수 초면 시작됨.

### 3단계: 프로덕션 빌드

```bash
npm run tauri:build
```

빌드된 앱은 `src-tauri/target/release/bundle/`에 생성됨.

---

## 아키텍처

```
React Frontend <--> WebSocket (JSON-RPC 2.0) <--> Axum Server <--> CLI Subprocess
                    ws://localhost:3001/ws          (Rust)       stdin/stdout NDJSON
```

- **프론트엔드**는 JSON-RPC 2.0 over WebSocket으로 통신
- **Axum 서버** (Tauri에 내장)가 RPC 호출을 핸들러에 디스패치
- **CLI Manager**가 CLI 서브프로세스를 생성하고 stdin/stdout 파이핑
- **CliAdapter trait**이 서로 다른 CLI JSON 포맷을 `UnifiedMessage`로 정규화
- **Broadcast 채널**이 CLI 스트림 이벤트를 모든 WebSocket 클라이언트에 팬아웃
- **Message saver** 백그라운드 태스크가 대화를 SQLite에 저장

---

## 프로젝트 구조

```text
src-tauri/                    # Rust 백엔드 (Tauri 2)
  src/
    lib.rs                    # Tauri 빌더 + Axum 서버 시작
    state.rs                  # AppState (DB, CliManager, broadcast)
    cli/                      # CLI 서브프로세스 관리
      adapter.rs              # CliAdapter trait
      adapters/claude.rs      # Claude Code NDJSON 파서
      adapters/codex.rs       # Codex CLI JSONL 파서
      manager.rs              # 서브프로세스 라이프사이클, stdin/stdout
      registry.rs             # CLI 감지 및 설치
      types.rs                # UnifiedMessage enum, CliStatus
    rpc/                      # JSON-RPC 2.0 레이어
      dispatcher.rs           # 메서드 라우팅
      handlers.rs             # RPC 메서드 구현
      types.rs                # Request/Response/Notification 타입
    server/                   # Axum WebSocket 서버
      ws.rs                   # WebSocket 핸들러
      router.rs               # HTTP 라우트
      broadcast.rs            # tokio::broadcast 채널
      saver.rs                # 백그라운드 메시지 저장
    db/                       # SQLite (대화, 메시지)
    commands/                 # Tauri IPC (설정, 레거시)
src/renderer/                 # React 프론트엔드
  lib/
    rpc/                      # JSON-RPC 클라이언트 + WebSocket 트랜스포트
    cli-api.ts                # 고수준 CLI API 래퍼
  components/
    chat/                     # 채팅 UI, 메시지 렌더러, 안전 다이얼로그
    setup/                    # CLI 설정 위저드
    sidebar/                  # 대화 목록, 에이전트 패널
    settings/                 # 설정 패널
  stores/                     # Zustand 상태 관리
docs/
  llm/                        # 구현 계획서, TODO
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 데스크톱 | Tauri 2 (Rust 백엔드 + 시스템 WebView) |
| 서버 | Axum (내장 WebSocket 서버) |
| 프로토콜 | JSON-RPC 2.0 over WebSocket |
| 프론트엔드 | React 19 + Vite 7 + Tailwind CSS v4 |
| 상태 관리 | Zustand 5 |
| 데이터베이스 | rusqlite (번들된 SQLite) |
| 비동기 I/O | tokio (서브프로세스, broadcast, 서버) |

---

## 현재 상태

활발한 개발 중. 백엔드 코어는 동작. UI 개편 필요.

### 완료

- CLI 서브프로세스 관리 (spawn, stdin/stdout 파이핑, 라이프사이클)
- Claude Code 어댑터 (NDJSON 스트림 파싱, 양방향 메시징)
- Codex CLI 어댑터 (JSONL 파싱, 히스토리 prepend 멀티턴)
- Axum WebSocket 서버 + JSON-RPC 2.0 프로토콜
- 실시간 토큰 단위 스트리밍
- 대화/메시지 SQLite 저장
- 설정 위저드 (CLI 감지 + 설치)
- 권한 요청 / 안전 다이얼로그 플로우

### 진행 중

- UI 전면 개편 (피벗으로 인해 현재 UI가 거침)
- 세션별 메시지 저장 (현재는 가장 최근 대화에 저장)
- 남은 Tauri IPC 커맨드를 JSON-RPC로 마이그레이션

---

## 라이선스

[MIT](LICENSE) -- Copyright (c) 2026 Kangnam Kim
