# Phase 3: Frontend Panels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스킬 브라우저, 태스크 패널, 상태바를 구현하여 Claude Code 래퍼의 향상된 GUI를 완성한다.

**Architecture:** Phase 1에서 추가한 `cli.enhanced` 이벤트를 Zustand store에서 수신하고 있음. 이 데이터를 활용하여 사이드바에 스킬 브라우저/태스크 패널을 추가하고, 채팅 하단에 비용/모델/레이트리밋 상태바를 추가한다.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4, Zustand 5

**Design Spec:** `docs/llm/enhanced-wrapper-design.md` — Phase 3 섹션

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/renderer/components/sidebar/SkillBrowser.tsx` | 스킬/슬래시 커맨드 목록 + 클릭 전송 | Create |
| `src/renderer/components/sidebar/TaskPanel.tsx` | 백그라운드 태스크 모니터링 | Create |
| `src/renderer/components/chat/StatusBar.tsx` | 비용/모델/레이트리밋/턴 수 표시 | Create |
| `src/renderer/components/sidebar/AgentPanel.tsx` | 중첩 에이전트 트래킹 개선 | Modify |
| `src/renderer/components/sidebar/Sidebar.tsx` | 패널 배치 통합 | Modify |
| `src/renderer/components/chat/ChatView.tsx` | StatusBar 통합 | Modify |

---

### Task 1: Create SkillBrowser component

**Files:**
- Create: `src/renderer/components/sidebar/SkillBrowser.tsx`

- [ ] **Step 1: Create SkillBrowser.tsx**

```tsx
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

export function SkillBrowser() {
  const { sessionMeta, currentSessionId } = useAppStore()

  if (!sessionMeta || !currentSessionId) return null

  const skills = sessionMeta.skills ?? []
  const slashCommands = sessionMeta.slash_commands ?? []

  // Separate built-in commands from custom skills
  const builtinCommands = slashCommands.filter((c) =>
    ['/compact', '/clear', '/help', '/cost'].includes(c)
  )
  const customCommands = slashCommands.filter(
    (c) => !['/compact', '/clear', '/help', '/cost'].includes(c)
  )
  const allItems = [...skills.map((s) => `/${s}`), ...customCommands]

  if (allItems.length === 0 && builtinCommands.length === 0) return null

  const handleInvoke = async (command: string) => {
    if (!currentSessionId) return
    if (command === '/clear') {
      useAppStore.getState().clearMessages()
    }
    try {
      await cliApi.sendMessage(currentSessionId, command)
    } catch {
      // ignore — error will appear in chat
    }
  }

  return (
    <div className="border-t border-[var(--border-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-secondary)]">Skills</span>
        <span className="text-xs text-[var(--text-tertiary)]">{allItems.length}</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {allItems.map((item) => (
          <button
            key={item}
            onClick={() => handleInvoke(item)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span className="text-[var(--text-muted)]">/</span>
            <span className="truncate">{item.replace(/^\//, '')}</span>
          </button>
        ))}
      </div>

      {builtinCommands.length > 0 && (
        <>
          <div className="mt-3 mb-1.5">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">System</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {builtinCommands.map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleInvoke(cmd)}
                className="rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:border-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/sidebar/SkillBrowser.tsx
git commit -m "feat: create SkillBrowser component for skill/slash command list"
```

---

### Task 2: Create TaskPanel component

**Files:**
- Create: `src/renderer/components/sidebar/TaskPanel.tsx`

- [ ] **Step 1: Create TaskPanel.tsx**

```tsx
import { useAppStore } from '../../stores/app-store'

export function TaskPanel() {
  const { activeTasks } = useAppStore()

  const visibleTasks = activeTasks.filter(
    (t) => t.status === 'running' || t.status === 'completed' || t.status === 'failed'
  )

  if (visibleTasks.length === 0) return null

  return (
    <div className="border-t border-[var(--border-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-secondary)]">Tasks</span>
        <span className="text-xs text-[var(--text-tertiary)]">{visibleTasks.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {visibleTasks.map((task) => (
          <div
            key={task.task_id}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <TaskStatusIcon status={task.status} />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {task.description}
                </span>
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 ml-2">
                {task.task_type}
              </span>
            </div>
            {task.summary && (
              <p className="mt-1 truncate text-[11px] text-[var(--text-tertiary)]">
                {task.summary}
              </p>
            )}
            {task.status === 'running' && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-main)]">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-green-400" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400 shrink-0" />
    case 'completed':
      return <span className="text-green-400 text-xs shrink-0">&#10003;</span>
    case 'failed':
      return <span className="text-red-400 text-xs shrink-0">&#10007;</span>
    case 'stopped':
      return <span className="text-yellow-400 text-xs shrink-0">&#9632;</span>
    default:
      return <span className="inline-block h-2 w-2 rounded-full bg-[var(--text-muted)] shrink-0" />
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/sidebar/TaskPanel.tsx
git commit -m "feat: create TaskPanel component for background task monitoring"
```

---

### Task 3: Create StatusBar component

**Files:**
- Create: `src/renderer/components/chat/StatusBar.tsx`

- [ ] **Step 1: Create StatusBar.tsx**

```tsx
import { useAppStore } from '../../stores/app-store'

export function StatusBar() {
  const { sessionMeta, sessionCost, rateLimit } = useAppStore()

  // Only show when session is active
  if (!sessionMeta) return null

  return (
    <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-1.5 text-[11px] text-[var(--text-tertiary)]">
      {/* Model */}
      <span className="font-medium">{sessionMeta.model}</span>

      {/* Cost */}
      {sessionCost?.cost_usd != null && (
        <>
          <Separator />
          <span>${sessionCost.cost_usd.toFixed(4)}</span>
        </>
      )}

      {/* Turns */}
      {sessionCost?.num_turns != null && (
        <>
          <Separator />
          <span>{sessionCost.num_turns} turns</span>
        </>
      )}

      {/* Rate Limit */}
      {rateLimit && (
        <>
          <Separator />
          <RateLimitBadge status={rateLimit.status} utilization={rateLimit.utilization} />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Version */}
      <span className="text-[var(--text-muted)]">v{sessionMeta.claude_code_version}</span>
    </div>
  )
}

function Separator() {
  return <span className="text-[var(--text-muted)]">|</span>
}

function RateLimitBadge({ status, utilization }: { status: string; utilization: number | null }) {
  const pct = utilization != null ? Math.round(utilization * 100) : null
  const isWarning = status === 'allowed_warning'
  const isRejected = status === 'rejected'

  return (
    <div className="flex items-center gap-1.5">
      {/* Bar */}
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--bg-main)]">
        <div
          className={`h-full rounded-full transition-all ${
            isRejected ? 'bg-red-400' : isWarning ? 'bg-yellow-400' : 'bg-green-400'
          }`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      {pct != null && (
        <span className={isRejected ? 'text-red-400' : isWarning ? 'text-yellow-400' : ''}>
          {pct}%
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/chat/StatusBar.tsx
git commit -m "feat: create StatusBar component for cost/model/rate-limit display"
```

---

### Task 4: Improve AgentPanel with nested tracking

**Files:**
- Modify: `src/renderer/components/sidebar/AgentPanel.tsx`

- [ ] **Step 1: Update AgentPanel to show agent hierarchy**

The current AgentPanel already tracks agents from messages. Enhance it to group subagent messages by `parent_tool_use_id`. Since `UnifiedMessage` doesn't carry `parent_tool_use_id` to the frontend (it's consumed during parsing to decide between TextDelta vs AgentProgress), the existing flat tracking is sufficient for now. Just add "Agent" and "Task" name detection:

In the agent detection logic, update to match both "Agent" and "Task":
```typescript
if (msg.type === 'agent_start') {
```
This already works — `agent_start` is emitted for both "Agent" and "Task" tool names by the Claude adapter. No code change needed.

Add a visual indicator for running vs background agents. Check if the agent panel is already displaying this correctly. If it is, skip to commit.

- [ ] **Step 2: Verify no changes needed**

Read `AgentPanel.tsx` and confirm it already handles `agent_start`, `agent_progress`, `agent_end` from the messages array. If it works correctly, commit as-is with a note.

- [ ] **Step 3: Commit (if changes made)**

```bash
git add src/renderer/components/sidebar/AgentPanel.tsx
git commit -m "refactor: verify AgentPanel handles Agent+Task names correctly"
```

---

### Task 5: Integrate panels into Sidebar

**Files:**
- Modify: `src/renderer/components/sidebar/Sidebar.tsx`

- [ ] **Step 1: Import and add SkillBrowser and TaskPanel**

Add imports at the top:
```typescript
import { SkillBrowser } from './SkillBrowser'
import { TaskPanel } from './TaskPanel'
```

In the sidebar JSX, between `<ConversationList />` and `<AgentPanel />`, add the new panels. The order from top to bottom should be:
1. Conversation List (existing, scrollable)
2. SkillBrowser (session active only)
3. AgentPanel (has agents only)
4. TaskPanel (has tasks only)
5. Settings button (existing, bottom)

Replace the section:
```tsx
{/* Conversation List */}
<div className="flex-1 overflow-y-auto" style={{ padding: 8 }}>
  <ConversationList />
</div>

{/* Agent Panel */}
<AgentPanel />
```

With:
```tsx
{/* Conversation List */}
<div className="flex-1 overflow-y-auto" style={{ padding: 8 }}>
  <ConversationList />
</div>

{/* Skills (shown when session is active) */}
<SkillBrowser />

{/* Active Agents */}
<AgentPanel />

{/* Background Tasks */}
<TaskPanel />
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/sidebar/Sidebar.tsx
git commit -m "feat: integrate SkillBrowser and TaskPanel into Sidebar"
```

---

### Task 6: Integrate StatusBar into ChatView

**Files:**
- Modify: `src/renderer/components/chat/ChatView.tsx`

- [ ] **Step 1: Import and add StatusBar**

Add import:
```typescript
import { StatusBar } from './StatusBar'
```

In the `ChatContent` component, add `<StatusBar />` right after `<MessageInput />` (inside the sessionActive branch), before `<SafetyDialog />`:

```tsx
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            ...
          </div>
          <MessageInput />
          <StatusBar />
        </>
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck 2>&1`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/chat/ChatView.tsx
git commit -m "feat: add StatusBar to ChatView for cost/model/rate-limit display"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` with no errors

Run: `npm run typecheck 2>&1`
Expected: clean

Run: `npm test 2>&1`
Expected: all pass

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -15`
Expected: all pass

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: Phase 3 complete — SkillBrowser, TaskPanel, StatusBar"
```
