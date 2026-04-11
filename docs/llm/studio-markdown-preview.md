# Studio 마크다운 프리뷰

## Purpose

Studio(스킬/에이전트 편집기)에서 `.md` 파일을 raw text 대신 렌더링된 프리뷰로
볼 수 있게 한다. VSCode 스타일의 Edit ↔ Split(Edit + Preview) 2모드 토글을 추가한다.

**완료 기준**: 툴바 버튼(또는 Cmd+Shift+V)으로 Monaco 에디터 우측에 마크다운
렌더링 패널이 나타나고, 편집 내용이 실시간으로 반영된다.

## File Changes

| 파일 | 변경 |
|---|---|
| `src/renderer/components/common/MarkdownPreview.tsx` | 신규 생성 — 공용 마크다운 렌더러 |
| `src/renderer/components/chat/MessageRenderer.tsx` | 리팩토링 — ShikiCodeBlock 이동, MarkdownPreview 사용 |
| `src/renderer/components/studio/StudioEditor.tsx` | 수정 — 프리뷰 모드 상태, 토글 버튼, split 레이아웃 |

## Implementation Order

1. **`MarkdownPreview.tsx` 생성**
   - `MessageRenderer.tsx:81-139`에서 `CodeBlock`, `ShikiCodeBlock`, `escapeHtml` 이동
   - export `MarkdownPreview({ content, className? })` — `aui-markdown selectable` 클래스 래퍼
2. **`MessageRenderer.tsx` 리팩토링**
   - 이동한 로컬 정의 제거, `MarkdownPreview` import
   - `AssistantText` 비스트리밍 분기를 `<MarkdownPreview content={text} />`로 교체
   - 스트리밍 분기는 raw text 유지
3. **`StudioEditor.tsx` 수정**
   - `useState<'edit' | 'split'>('edit')` 추가
   - 파생값: `isRefMarkdown`, `previewAvailable`, `showPreview`, `previewContent`
   - top bar에 `ViewSplitIcon` 토글 버튼 (`previewAvailable`일 때만 렌더)
   - Cmd+Shift+V 키보드 단축키 리스너
   - Ref 모드 / Main Instructions 모드 각각 flex row split 레이아웃

## Function Signatures

```ts
// src/renderer/components/common/MarkdownPreview.tsx
export function MarkdownPreview(props: { content: string; className?: string }): JSX.Element

// 내부 비공개
function CodeBlock(props: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }): JSX.Element
function ShikiCodeBlock(props: { code: string; lang: string }): JSX.Element
function escapeHtml(s: string): string
```

```ts
// StudioEditor.tsx 추가 상태 및 파생값
const [viewMode, setViewMode] = useState<'edit' | 'split'>('edit')
const isRefMarkdown: boolean = activeFile?.endsWith('.md') ?? false
const previewAvailable: boolean = !activeFile || isRefMarkdown
const showPreview: boolean = previewAvailable && viewMode === 'split'
const previewContent: string = activeFile ? refContent : instructions
```

## Constraints

- 새 CSS 추가 금지. 기존 `.aui-markdown`, `.selectable`, CSS 변수만 사용
- 프리뷰는 1:1 고정 분할 (flex: 1 양쪽). Resize 핸들은 V2
- 적용 대상: `.md` 확장자 파일 + Main 모드 Instructions 영역
  `.py`, `.sh`, `.json` ref 파일에서 토글 버튼 숨김
- activeFile `.md`→`.py` 변경 시 viewMode 유지하되 `previewAvailable=false`로 자동 숨김
- 스트리밍 중 채팅 메시지는 raw text 유지 (기존 로직 건드리지 않음)

## Decisions

- **2모드(edit/split)** 채택 — 3모드(edit/preview/split)는 UI 복잡도 대비 실용성 낮음
- **공용 `MarkdownPreview.tsx`** 추출 — ShikiCodeBlock 40줄을 채팅/스튜디오 두 곳에서 재사용, 중복 방지
- **로컬 `useState`** — app-store 전역화 불필요, 편집기 단일 소비처
- **기본 모드 `edit`** — 현재 UX 보존, split은 opt-in
