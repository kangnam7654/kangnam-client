# Studio Page Design

## Purpose

kangnam-client에 독립적인 Studio 페이지를 추가하여, skill-creator와 agent-create 워크플로우를 GUI로 통합한다. 편집, 테스트/평가, 디스크립션 최적화까지 풀 워크플로우를 Studio 안에서 완결한다.

**완료 기준:**
- ActivityBar에 Studio 탭이 추가되어 ChatView와 독립적으로 전환된다
- Skill/Agent 편집이 Monaco Editor 기반 하이브리드 에디터에서 동작한다
- CLI 세션을 통해 테스트 실행/평가/최적화가 Studio 하단 패널에서 동작한다
- eval viewer HTML이 iframe으로 임베드된다
- 대시보드 기본 화면에서 전체 통계를 확인할 수 있다

## File changes

### 신규 파일

| Path | Description |
|------|-------------|
| `src/renderer/components/studio/StudioView.tsx` | Studio 최상위 컨테이너. 대시보드/에디터 모드 전환 |
| `src/renderer/components/studio/StudioDashboard.tsx` | 대시보드 기본 화면 (통계, 최근 수정, eval 결과) |
| `src/renderer/components/studio/StudioEditor.tsx` | 파일 트리 + 에디터 + 하단 패널 통합 |
| `src/renderer/components/studio/StudioTopBar.tsx` | 저장/AI생성/검증 버튼 toolbar |
| `src/renderer/components/studio/StudioFileTree.tsx` | 스킬/에이전트 파일 트리 컴포넌트 |
| `src/renderer/components/studio/StudioBottomPanel.tsx` | 4탭 하단 패널 (CLI/Tests/Viewer/Optimize) |
| `src/renderer/components/studio/MonacoWrapper.tsx` | Monaco Editor React 래퍼 |
| `src/renderer/components/studio/tabs/CliOutputTab.tsx` | CLI 스트리밍 출력 탭 |
| `src/renderer/components/studio/tabs/TestsTab.tsx` | 테스트 케이스 관리/실행 탭 |
| `src/renderer/components/studio/tabs/EvalViewerTab.tsx` | eval viewer iframe 임베드 탭 |
| `src/renderer/components/studio/tabs/OptimizeTab.tsx` | 디스크립션 최적화 탭 |

### 수정 파일

| Path | Change |
|------|--------|
| `src/renderer/components/studio/Studio.tsx` | 기존 SkillStudio/AgentStudio 제거, StudioView로 교체 |
| `src/renderer/stores/app-store.ts` | `studioState` 확장 — `activeView: 'dashboard' \| 'editor'`, `bottomTab`, `dirty`, `snapshots` 추가 |
| `src/renderer/components/layout/ActivityBar.tsx` | Studio 전용 아이콘 탭 추가 |
| `src/renderer/App.tsx` | Studio 뷰 전환 로직 수정 — ActivityBar 탭 기반으로 변경 |
| `src/renderer/components/sidebar/SkillBrowser.tsx` | 편집 버튼 → `openStudio('skill', name)` (기존 유지, Studio 탭으로 자동 전환) |
| `src/renderer/components/sidebar/AgentPanel.tsx` | 편집 버튼 → `openStudio('agent', name)` (기존 유지, Studio 탭으로 자동 전환) |
| `src-tauri/src/commands/claude_commands.rs` | `snapshot_skill` command 추가 — 저장 시 이전 버전을 workspace에 보관 |
| `src-tauri/src/commands/agents.rs` | `snapshot_agent` command 추가 |
| `src-tauri/src/lib.rs` | 새 snapshot commands 등록 |
| `src/renderer/lib/tauri-api.ts` | snapshot API 래퍼 추가 |
| `package.json` | `monaco-editor` 및 `@monaco-editor/react` 의존성 추가 |

## Implementation order

### Phase 1: 기반 — ActivityBar + StudioView 셸
1. `app-store.ts` — `activeMainView: 'chat' | 'studio'` 상태 추가, `openStudio` 수정
2. `ActivityBar.tsx` — Studio 아이콘 탭 추가, `activeMainView` 전환
3. `App.tsx` — `activeMainView` 기반으로 ChatView/StudioView 조건부 렌더링
4. `StudioView.tsx` — 대시보드/에디터 모드 전환 셸
5. `StudioDashboard.tsx` — 스킬/에이전트 통계, 최근 수정 목록

### Phase 2: 에디터 — Monaco + 파일 트리
6. Monaco Editor 의존성 설치 (`@monaco-editor/react`)
7. `MonacoWrapper.tsx` — Monaco Editor React 래퍼 (다크 테마, 마크다운 구문 강조)
8. `StudioTopBar.tsx` — 저장/AI생성/검증 버튼
9. `StudioFileTree.tsx` — 트리 컴포넌트 (기존 TreeItem 패턴 재사용)
10. `StudioEditor.tsx` — 파일 트리 + 하이브리드 에디터 (폼 + Monaco) 통합
11. 기존 `Studio.tsx`를 `StudioView`로 교체

### Phase 3: 하단 패널 — CLI/Tests/Viewer/Optimize
12. `StudioBottomPanel.tsx` — 접기/펼치기 + 4탭 컨테이너
13. `CliOutputTab.tsx` — CLI 세션 스트리밍 출력 표시
14. `TestsTab.tsx` — eval 케이스 목록 + 실행 버튼 → CLI에 메시지 전송
15. `EvalViewerTab.tsx` — generate_review.py HTML iframe 임베드
16. `OptimizeTab.tsx` — 디스크립션 최적화 트리거 + 진행/결과 표시

### Phase 4: 저장 + 스냅샷
17. `snapshot_skill` / `snapshot_agent` Rust command — `~/.claude/studio-snapshots/{name}/{timestamp}.md` 에 보관
18. `tauri-api.ts` — snapshot API 래퍼
19. StudioEditor 저장 로직 — Cmd+S → 스냅샷 생성 → 파일 쓰기 → dirty 해제

### Phase 5: 사이드바 연결 + 마무리
20. `SkillBrowser.tsx` / `AgentPanel.tsx` — 편집 버튼 클릭 시 `activeMainView`를 studio로 전환 + `openStudio` 호출
21. 기존 Studio.tsx 제거 또는 StudioView로 완전 교체

## Function/API signatures

### app-store.ts 상태 확장

```typescript
// 기존
studioState: { type: 'skill' | 'agent'; name?: string } | null

// 변경
activeMainView: 'chat' | 'studio'
studioState: {
  type: 'skill' | 'agent'
  name?: string
  activeView: 'dashboard' | 'editor'
  bottomTab: 'cli' | 'tests' | 'viewer' | 'optimize'
  bottomPanelVisible: boolean
  dirty: boolean
} | null

setActiveMainView: (view: 'chat' | 'studio') => void
openStudio: (type?: 'skill' | 'agent', name?: string) => void
closeStudio: () => void
setStudioBottomTab: (tab: 'cli' | 'tests' | 'viewer' | 'optimize') => void
toggleStudioBottomPanel: () => void
setStudioDirty: (dirty: boolean) => void
```

### Rust snapshot commands

```rust
#[tauri::command]
pub fn snapshot_skill(name: String) -> Result<String, String>
// ~/.claude/studio-snapshots/skills/{name}/{timestamp}.md 에 저장
// Returns: snapshot path

#[tauri::command]
pub fn snapshot_agent(name: String) -> Result<String, String>
// ~/.claude/studio-snapshots/agents/{name}/{timestamp}.md 에 저장
// Returns: snapshot path

#[tauri::command]
pub fn list_snapshots(item_type: String, name: String) -> Result<Vec<SnapshotInfo>, String>
// Returns: [{filename, timestamp, size}]
```

### tauri-api.ts 추가

```typescript
studio: {
  snapshotSkill: (name: string) => invoke('snapshot_skill', { name }) as Promise<string>,
  snapshotAgent: (name: string) => invoke('snapshot_agent', { name }) as Promise<string>,
  listSnapshots: (itemType: string, name: string) =>
    invoke('list_snapshots', { itemType, name }) as Promise<{ filename: string; timestamp: number; size: number }[]>,
}
```

### React 컴포넌트 Props

```typescript
// StudioView
interface StudioViewProps {} // app-store에서 직접 읽음

// StudioEditor
interface StudioEditorProps {
  type: 'skill' | 'agent'
  name: string
}

// StudioBottomPanel
interface StudioBottomPanelProps {
  activeTab: 'cli' | 'tests' | 'viewer' | 'optimize'
  onTabChange: (tab: string) => void
  visible: boolean
  onToggle: () => void
  skillOrAgentName: string
  type: 'skill' | 'agent'
}

// MonacoWrapper
interface MonacoWrapperProps {
  value: string
  onChange: (value: string) => void
  language?: string  // default: 'markdown'
  readOnly?: boolean
}
```

## Constraints

- 기존 `window.api.claudeCommands.*` 및 `window.api.agents.*` API는 그대로 사용한다. 새 API는 snapshot 관련만 추가한다.
- Monaco Editor 테마는 앱의 CSS 변수(`--bg-main`, `--text-primary` 등)와 동기화한다.
- 하단 패널 높이는 사용자가 드래그로 조절 가능해야 한다 (기존 `ResizeHandle` 패턴 재사용).
- eval viewer iframe은 `sandbox` 속성으로 보안 격리한다.
- CLI 세션에 메시지를 보낼 때는 기존 `cliApi.sendMessage()` 를 사용한다.
- 스냅샷은 `~/.claude/studio-snapshots/` 에 저장한다. 스킬/에이전트 원본 디렉토리에는 저장하지 않는다.
- dirty 상태에서 다른 스킬/에이전트로 전환 시 "저장하지 않은 변경사항이 있습니다" 확인 대화상자를 표시한다.

## Decisions

- **ActivityBar 탭 방식 채택** — 채팅과 독립적으로 Studio를 사용할 수 있어야 하므로. 멀티윈도우(Tauri 새 창)는 상태 공유 복잡성 때문에 기각.
- **CLI 세션을 통한 eval 실행** — Python 스크립트를 직접 실행하면 skill-creator의 오케스트레이션 로직을 재구현해야 하므로 기각. CLI가 이미 전체 워크플로우를 관리한다.
- **Monaco Editor 선택** — CodeMirror 6도 충분하지만, 사용자가 풀 IDE 경험을 선호. ~2MB 번들 증가는 허용 범위.
- **수동 저장 + 스냅샷** — auto-save가 빈 내용 덮어쓰기 사고를 일으킨 전례가 있어 수동 저장 채택. 스냅샷으로 실수 복구 가능.
- **iframe으로 eval viewer 임베드** — React로 재구현하면 generate_review.py 변경 시 동기화 필요. iframe이면 항상 최신 HTML을 그대로 표시.
