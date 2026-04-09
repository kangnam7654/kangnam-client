# Phase 1: Layout Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 2-panel layout (Sidebar + ChatView) with a 4-panel IDE-style layout (Activity Bar + Side Panel + Main Chat + Right Panel) with resizable panels and updated design tokens.

**Architecture:** App.tsx becomes a flex container with 4 regions. ActivityBar is a fixed 48px icon column. SidePanel and RightPanel are resizable via drag handles. All existing components (ChatView, ConversationList, SkillBrowser, TaskPanel, AgentPanel, StatusBar) are relocated into the new structure without functional changes — only layout and styling changes in this phase.

**Tech Stack:** React 19, Tailwind CSS v4, Zustand 5, CSS custom properties

**Design spec:** `docs/llm/ide-ui-overhaul-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/renderer/styles/globals.css` | Modify | Replace design tokens (colors, fonts, radii) |
| `src/renderer/components/layout/ActivityBar.tsx` | Create | 48px icon column, tab switching |
| `src/renderer/components/layout/SidePanel.tsx` | Create | Left panel container, renders child based on active tab |
| `src/renderer/components/layout/RightPanel.tsx` | Create | Right panel container with 5 tab headers |
| `src/renderer/components/layout/ResizeHandle.tsx` | Create | Draggable divider for panel resize |
| `src/renderer/components/layout/StatusBar.tsx` | Create | Bottom status bar (move from chat/StatusBar.tsx + extend) |
| `src/renderer/stores/app-store.ts` | Modify | Add sidePanelTab, rightPanelVisible, rightPanelTab, panel widths |
| `src/renderer/App.tsx` | Modify | 4-region flex layout |

---

### Task 1: Update Design Tokens

**Files:**
- Modify: `src/renderer/styles/globals.css`

- [ ] **Step 1: Replace dark theme tokens**

In `globals.css`, replace the `:root` block's color variables. Keep all non-color rules unchanged (markdown, animations, scrollbar, etc.).

```css
:root {
  --bg-main: #1a1a1a;
  --bg-sidebar: #141414;
  --bg-surface: #1e1e1e;
  --bg-hover: #252525;
  --border: rgba(255, 255, 255, 0.08);
  --border-light: rgba(255, 255, 255, 0.15);
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-tertiary: #777777;
  --text-muted: #666666;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-soft: rgba(99, 102, 241, 0.12);
  --danger: #ef4444;
  --success: #4ade80;
  --warning: #f59e0b;
  --info: #60a5fa;
  --success-text: #4ade80;
  --danger-text: #f87171;

  /* Semantic */
  --bg-code: #141414;
  --bg-code-inline: rgba(255, 255, 255, 0.07);
  --text-code-inline: #c4b5fd;
  --bg-user-bubble: #252525;
  --bg-tool-result-ok: #1a3328;
  --text-tool-result-ok: #7dd3a8;
  --bg-tool-result-err: #1a1a1a;
  --text-tool-result-err: #f87171;
  --sidebar-bg: #141414;
  --sidebar-item-bg: #1a1a1a;
  --overlay-soft: rgba(0, 0, 0, 0.15);
  --shadow-pill: rgba(0, 0, 0, 0.2);
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-subtle-hover: rgba(255, 255, 255, 0.15);
  --scrollbar-thumb: rgba(255, 255, 255, 0.08);

  /* Activity Bar */
  --bg-activity-bar: #111111;
  --activity-icon: #666666;
  --activity-icon-active: #e0e0e0;

  /* Layout sizing */
  --activity-bar-width: 48px;
  --side-panel-width: 280px;
  --side-panel-min: 200px;
  --side-panel-max: 400px;
  --right-panel-width: 360px;
  --right-panel-min: 260px;
  --right-panel-max: 500px;
  --status-bar-height: 24px;

  /* Typography */
  --font-sans: Inter, 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Monaco, Menlo, monospace;
  --font-size-base: 13px;
  --font-size-mono: 12px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --composer-shadow: 0 0.25rem 1.25rem rgba(0, 0, 0, 0.12);
  --bg-composer: #1e1e1e;
  --transition-ease: 200ms ease;
}
```

- [ ] **Step 2: Update light theme tokens**

Replace the `[data-theme="light"]` block:

```css
[data-theme="light"] {
  --bg-main: #f5f5f5;
  --bg-sidebar: #ebebeb;
  --bg-surface: #ffffff;
  --bg-hover: #e5e5e5;
  --border: rgba(0, 0, 0, 0.08);
  --border-light: rgba(0, 0, 0, 0.15);
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-tertiary: #888888;
  --text-muted: #aaaaaa;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-soft: rgba(99, 102, 241, 0.10);
  --success-text: #059669;
  --danger-text: #dc2626;

  --bg-code: #ebebeb;
  --bg-code-inline: rgba(0, 0, 0, 0.05);
  --text-code-inline: #7c3aed;
  --bg-user-bubble: #e5e5e5;
  --bg-tool-result-ok: #e8f5e9;
  --text-tool-result-ok: #2e7d32;
  --bg-tool-result-err: #fbe9e7;
  --text-tool-result-err: #c62828;
  --sidebar-bg: #ebebeb;
  --sidebar-item-bg: #f5f5f5;
  --border-subtle: rgba(0, 0, 0, 0.08);
  --border-subtle-hover: rgba(0, 0, 0, 0.15);
  --scrollbar-thumb: rgba(0, 0, 0, 0.10);

  --bg-activity-bar: #e0e0e0;
  --activity-icon: #888888;
  --activity-icon-active: #1a1a1a;

  --bg-composer: #ffffff;
  --composer-shadow: 0 0.25rem 1.25rem rgba(0, 0, 0, 0.035);
}
```

- [ ] **Step 3: Update body font-family**

Replace the `body` rule's `font-family` and `font-size`:

```css
body {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  /* keep all other properties unchanged */
}
```

- [ ] **Step 4: Verify the app still renders**

Run: `npm run tauri:dev:frontend`

Expected: App renders with new color scheme (darker background, indigo accent). No broken styles.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/styles/globals.css
git commit -m "style: update design tokens to IDE dark theme with indigo accent"
```

---

### Task 2: Add Layout State to Store

**Files:**
- Modify: `src/renderer/stores/app-store.ts`

- [ ] **Step 1: Add type definitions and state**

Add these types after the existing `ResultSummary` interface:

```typescript
export type SidePanelTab = 'chats' | 'files' | 'skills' | 'agents' | 'mcp'
export type RightPanelTab = 'terminal' | 'files' | 'tools' | 'agents' | 'tasks'
```

Add these fields to the `AppState` interface, after the `// Enhanced` section:

```typescript
  // Layout
  sidePanelTab: SidePanelTab
  setSidePanelTab: (tab: SidePanelTab) => void
  sidePanelVisible: boolean
  setSidePanelVisible: (v: boolean) => void
  toggleSidePanel: (tab?: SidePanelTab) => void
  sidePanelWidth: number
  setSidePanelWidth: (w: number) => void

  rightPanelTab: RightPanelTab
  setRightPanelTab: (tab: RightPanelTab) => void
  rightPanelVisible: boolean
  setRightPanelVisible: (v: boolean) => void
  toggleRightPanel: () => void
  rightPanelWidth: number
  setRightPanelWidth: (w: number) => void
```

- [ ] **Step 2: Add state implementations**

Add to the `create<AppState>` call, after the `// Enhanced` section:

```typescript
  // Layout
  sidePanelTab: 'chats',
  setSidePanelTab: (tab) => set({ sidePanelTab: tab }),
  sidePanelVisible: true,
  setSidePanelVisible: (v) => set({ sidePanelVisible: v }),
  toggleSidePanel: (tab) => set((s) => {
    if (tab && tab !== s.sidePanelTab) {
      return { sidePanelTab: tab, sidePanelVisible: true }
    }
    return { sidePanelVisible: !s.sidePanelVisible }
  }),
  sidePanelWidth: 280,
  setSidePanelWidth: (w) => set({ sidePanelWidth: w }),

  rightPanelTab: 'terminal',
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  rightPanelVisible: false,
  setRightPanelVisible: (v) => set({ rightPanelVisible: v }),
  toggleRightPanel: () => set((s) => ({ rightPanelVisible: !s.rightPanelVisible })),
  rightPanelWidth: 360,
  setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/app-store.ts
git commit -m "feat: add layout panel state to app store"
```

---

### Task 3: Create ResizeHandle Component

**Files:**
- Create: `src/renderer/components/layout/ResizeHandle.tsx`

- [ ] **Step 1: Create the layout directory**

Run: `mkdir -p src/renderer/components/layout`

- [ ] **Step 2: Write ResizeHandle**

```typescript
import { useCallback, useEffect, useRef } from 'react'

interface ResizeHandleProps {
  side: 'left' | 'right'
  onResize: (delta: number) => void
  onDoubleClick?: () => void
}

export function ResizeHandle({ side, onResize, onDoubleClick }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - lastX.current
      lastX.current = e.clientX
      onResize(side === 'left' ? delta : -delta)
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onResize, side])

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        width: 4,
        cursor: 'col-resize',
        background: 'transparent',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 1,
          width: 2,
          background: 'var(--border)',
          transition: 'background 0.15s',
        }}
        className="hover:!bg-[var(--accent)]"
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/layout/ResizeHandle.tsx
git commit -m "feat: create ResizeHandle component for panel resizing"
```

---

### Task 4: Create ActivityBar Component

**Files:**
- Create: `src/renderer/components/layout/ActivityBar.tsx`

- [ ] **Step 1: Write ActivityBar**

```typescript
import { useAppStore, type SidePanelTab } from '../../stores/app-store'

const tabs: { id: SidePanelTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'chats',
    label: 'Chats',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    id: 'files',
    label: 'Files',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'mcp',
    label: 'MCP',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
]

export function ActivityBar() {
  const { sidePanelTab, sidePanelVisible, toggleSidePanel, setShowSettings } = useAppStore()

  return (
    <div
      style={{
        width: 'var(--activity-bar-width)',
        minWidth: 'var(--activity-bar-width)',
        background: 'var(--bg-activity-bar)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        gap: 4,
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Drag region for title bar */}
      <div className="drag-region" style={{ height: 32, width: '100%', flexShrink: 0 }} />

      {tabs.map((tab) => {
        const isActive = sidePanelVisible && sidePanelTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => toggleSidePanel(tab.id)}
            title={tab.label}
            aria-label={tab.label}
            className="no-drag"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              color: isActive ? 'var(--activity-icon-active)' : 'var(--activity-icon)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
          </button>
        )
      })}

      <div style={{ flex: 1 }} />

      {/* Settings at bottom */}
      <button
        onClick={() => setShowSettings(true)}
        title="Settings"
        aria-label="Settings"
        className="no-drag"
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          background: 'transparent',
          color: 'var(--activity-icon)',
          cursor: 'pointer',
          marginBottom: 8,
          transition: 'all 0.15s',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/layout/ActivityBar.tsx
git commit -m "feat: create ActivityBar component with tab icons"
```

---

### Task 5: Create SidePanel Container

**Files:**
- Create: `src/renderer/components/layout/SidePanel.tsx`

- [ ] **Step 1: Write SidePanel**

```typescript
import { useAppStore } from '../../stores/app-store'
import { ConversationList } from '../sidebar/ConversationList'
import { SkillBrowser } from '../sidebar/SkillBrowser'
import { AgentPanel } from '../sidebar/AgentPanel'

export function SidePanel() {
  const { sidePanelTab, sidePanelVisible, sidePanelWidth } = useAppStore()

  if (!sidePanelVisible) return null

  return (
    <div
      style={{
        width: sidePanelWidth,
        minWidth: sidePanelWidth,
        height: '100%',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Drag region for title bar */}
        <div className="drag-region" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44 }} />
        <span className="no-drag" style={{ position: 'relative' }}>
          {sidePanelTab === 'chats' && 'Chats'}
          {sidePanelTab === 'files' && 'Explorer'}
          {sidePanelTab === 'skills' && 'Skills & Commands'}
          {sidePanelTab === 'agents' && 'Agents'}
          {sidePanelTab === 'mcp' && 'MCP Servers'}
        </span>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {sidePanelTab === 'chats' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            <ConversationList />
          </div>
        )}
        {sidePanelTab === 'skills' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <SkillBrowser />
          </div>
        )}
        {sidePanelTab === 'agents' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <AgentPanel />
          </div>
        )}
        {sidePanelTab === 'files' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            File Explorer (Phase 3)
          </div>
        )}
        {sidePanelTab === 'mcp' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            MCP Servers (Phase 3)
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/layout/SidePanel.tsx
git commit -m "feat: create SidePanel container with tab routing"
```

---

### Task 6: Create RightPanel Container

**Files:**
- Create: `src/renderer/components/layout/RightPanel.tsx`

- [ ] **Step 1: Write RightPanel**

```typescript
import { useAppStore, type RightPanelTab } from '../../stores/app-store'
import { TaskPanel } from '../sidebar/TaskPanel'

const tabs: { id: RightPanelTab; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'files', label: 'Files' },
  { id: 'tools', label: 'Tools' },
  { id: 'agents', label: 'Agents' },
  { id: 'tasks', label: 'Tasks' },
]

export function RightPanel() {
  const { rightPanelVisible, rightPanelTab, setRightPanelTab, rightPanelWidth } = useAppStore()

  if (!rightPanelVisible) return null

  return (
    <div
      style={{
        width: rightPanelWidth,
        minWidth: rightPanelWidth,
        height: '100%',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          paddingLeft: 8,
        }}
      >
        {tabs.map((tab) => {
          const isActive = rightPanelTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setRightPanelTab(tab.id)}
              style={{
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {rightPanelTab === 'tasks' && <TaskPanel />}
        {rightPanelTab === 'terminal' && (
          <Placeholder label="Terminal Log (Phase 4)" />
        )}
        {rightPanelTab === 'files' && (
          <Placeholder label="File Changes (Phase 4)" />
        )}
        {rightPanelTab === 'tools' && (
          <Placeholder label="Tool Timeline (Phase 4)" />
        )}
        {rightPanelTab === 'agents' && (
          <Placeholder label="Agent Tracker (Phase 4)" />
        )}
      </div>
    </div>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>
      {label}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/layout/RightPanel.tsx
git commit -m "feat: create RightPanel container with 5 tab headers"
```

---

### Task 7: Create StatusBar Component

**Files:**
- Create: `src/renderer/components/layout/StatusBar.tsx`

- [ ] **Step 1: Write StatusBar**

Move and extend the existing `chat/StatusBar.tsx`. The new version adds connection status, cwd, and permission mode.

```typescript
import { useAppStore } from '../../stores/app-store'

export function StatusBar() {
  const { sessionMeta, sessionCost, rateLimit, currentSessionId } = useAppStore()

  return (
    <div
      style={{
        height: 'var(--status-bar-height)',
        minHeight: 'var(--status-bar-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        background: 'var(--bg-activity-bar)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Connection status */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: currentSessionId ? 'var(--success)' : 'var(--text-muted)',
          }}
        />
        <span>{currentSessionId ? 'connected' : 'disconnected'}</span>
      </span>

      {sessionMeta && (
        <>
          <Sep />
          <span>{sessionMeta.model}</span>
        </>
      )}

      {sessionCost?.cost_usd != null && (
        <>
          <Sep />
          <span>${sessionCost.cost_usd.toFixed(3)}</span>
        </>
      )}

      {sessionCost?.num_turns != null && (
        <>
          <Sep />
          <span>{sessionCost.num_turns} turns</span>
        </>
      )}

      {rateLimit && rateLimit.utilization != null && (
        <>
          <Sep />
          <RateBar status={rateLimit.status} utilization={rateLimit.utilization} />
        </>
      )}

      <div style={{ flex: 1 }} />

      {sessionMeta?.cwd && (
        <span style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sessionMeta.cwd.replace(/^\/Users\/[^/]+/, '~')}
        </span>
      )}

      {sessionMeta?.permission_mode && (
        <>
          <Sep />
          <span>{sessionMeta.permission_mode}</span>
        </>
      )}
    </div>
  )
}

function Sep() {
  return <span style={{ color: 'var(--border-light)' }}>|</span>
}

function RateBar({ status, utilization }: { status: string; utilization: number }) {
  const pct = Math.round(utilization * 100)
  const color = status === 'rejected' ? 'var(--danger)' : status === 'allowed_warning' ? 'var(--warning)' : 'var(--success)'

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 2, background: color }} />
      </span>
      <span style={{ color }}>{pct}%</span>
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/layout/StatusBar.tsx
git commit -m "feat: create layout StatusBar with connection/model/cost/rate/cwd"
```

---

### Task 8: Rewire App.tsx to 4-Panel Layout

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Replace App.tsx content**

Replace the entire `App.tsx` with the 4-region layout:

```typescript
import { useEffect } from 'react'
import { useAppStore } from './stores/app-store'
import { cliApi } from './lib/cli-api'

import { ActivityBar } from './components/layout/ActivityBar'
import { SidePanel } from './components/layout/SidePanel'
import { RightPanel } from './components/layout/RightPanel'
import { ResizeHandle } from './components/layout/ResizeHandle'
import { StatusBar } from './components/layout/StatusBar'
import { ChatView } from './components/chat/ChatView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { SearchOverlay } from './components/sidebar/SearchPanel'

export default function App() {
  const {
    theme, currentProvider, setCurrentProvider, setSetupComplete,
    sidePanelVisible, sidePanelWidth, setSidePanelWidth,
    rightPanelVisible, rightPanelWidth, setRightPanelWidth,
    toggleSidePanel, toggleRightPanel,
  } = useAppStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Auto-detect CLI providers on startup
  useEffect(() => {
    if (currentProvider) return
    cliApi.listProviders()
      .then(async (metas) => {
        for (const meta of metas) {
          try {
            const status = await cliApi.checkInstalled(meta.name)
            if (status.installed) {
              setCurrentProvider(meta.name)
              setSetupComplete(true)
              return
            }
          } catch { /* ignore */ }
        }
        useAppStore.getState().setSettingsTab('providers')
        useAppStore.getState().setShowSettings(true)
      })
      .catch(() => {})
  }, [currentProvider, setCurrentProvider, setSetupComplete])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey
      if (meta && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        useAppStore.getState().toggleDevMode()
      }
      if (meta && e.key === '\\') {
        e.preventDefault()
        toggleSidePanel()
      }
      if (meta && e.key === 'b') {
        e.preventDefault()
        toggleRightPanel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSidePanel, toggleRightPanel])

  const handleSidePanelResize = (delta: number) => {
    const min = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--side-panel-min')) || 200
    const max = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--side-panel-max')) || 400
    setSidePanelWidth(Math.min(max, Math.max(min, sidePanelWidth + delta)))
  }

  const handleRightPanelResize = (delta: number) => {
    const min = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--right-panel-min')) || 260
    const max = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--right-panel-max')) || 500
    setRightPanelWidth(Math.min(max, Math.max(min, rightPanelWidth + delta)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* Main row: Activity Bar + Side Panel + Chat + Right Panel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ActivityBar />

        {sidePanelVisible && (
          <>
            <SidePanel />
            <ResizeHandle side="left" onResize={handleSidePanelResize} />
          </>
        )}

        {/* Main chat area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <ChatView />
        </div>

        {rightPanelVisible && (
          <>
            <ResizeHandle side="right" onResize={handleRightPanelResize} />
            <RightPanel />
          </>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Overlays */}
      <SettingsPanel />
      <SearchOverlay />
    </div>
  )
}
```

- [ ] **Step 2: Remove old StatusBar import from ChatView**

In `src/renderer/components/chat/ChatView.tsx`, remove the `StatusBar` import and usage:

Remove this import line:
```typescript
import { StatusBar } from './StatusBar'
```

Remove `<StatusBar />` from the ChatContent return JSX (near line 301).

- [ ] **Step 3: Remove old Sidebar from ChatView/App**

ChatView no longer needs the old Sidebar. It's replaced by ActivityBar + SidePanel. The old `Sidebar` import in App.tsx is already removed in step 1.

- [ ] **Step 4: Verify the app renders with 4-panel layout**

Run: `npm run tauri:dev:frontend`

Expected: App shows ActivityBar on left, SidePanel with Chats tab, Chat in center, no Right Panel by default. Cmd+B toggles Right Panel. Cmd+\ toggles Side Panel. Activity Bar icons switch Side Panel content. Resize handles work.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/chat/ChatView.tsx
git commit -m "feat: rewire App.tsx to 4-panel IDE layout"
```

---

### Task 9: Clean Up Old Sidebar

**Files:**
- Modify: `src/renderer/components/sidebar/Sidebar.tsx`

- [ ] **Step 1: Keep Sidebar.tsx but mark deprecated**

The old `Sidebar.tsx` is no longer imported by `App.tsx`. Its child components (ConversationList, SkillBrowser, AgentPanel, TaskPanel) are now used directly by SidePanel and RightPanel. Leave `Sidebar.tsx` in place for now — it will be deleted in Phase 5 cleanup. No code changes needed.

- [ ] **Step 2: Verify no import errors**

Run: `npm run typecheck`

Expected: No TypeScript errors. If there are unused import warnings, fix them.

- [ ] **Step 3: Commit if any fixes**

```bash
git add -A
git commit -m "fix: resolve import errors after layout migration"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Design tokens (Task 1), Store state (Task 2), ResizeHandle (Task 3), ActivityBar (Task 4), SidePanel (Task 5), RightPanel (Task 6), StatusBar (Task 7), App.tsx rewire (Task 8), cleanup (Task 9). All P1 items from spec covered.
- [x] **Placeholder scan:** No TBD/TODO. RightPanel tabs show explicit "Phase 4" placeholder text — this is intentional, not a plan gap.
- [x] **Type consistency:** `SidePanelTab` and `RightPanelTab` types defined in Task 2, used consistently in Task 4 (ActivityBar), Task 5 (SidePanel), Task 6 (RightPanel). `sidePanelWidth`/`rightPanelWidth` are numbers, used with `parseInt` fallbacks in Task 8.
