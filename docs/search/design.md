# Search Feature Design

## 1. Overview

Two search modes:
- **Global Search** (sidebar button) — Search across all conversation history
- **In-Chat Search** (Cmd+F) — Search within current active conversation

## 2. Architecture

### 2.1 Global Search (Sidebar)

```
[Search Button] → [SearchPanel overlay in sidebar]
                      ↓ (debounced input)
                   IPC: conv:search(query)
                      ↓ (Main process)
                   SQL: SELECT messages + conversations WHERE content LIKE %query%
                      ↓
                   Return: [{ conversationId, conversationTitle, messageId, snippet, role, createdAt }]
                      ↓
                   [SearchResults list] → Click → Navigate to conversation
```

**UI Flow:**
1. User clicks search icon in sidebar (magnifying glass)
2. Sidebar transitions: conversation list → search panel (with back button)
3. Search input auto-focused at top
4. Results grouped by conversation, showing message snippets with highlighted query
5. Click result → set activeConversationId → scroll to message (future enhancement)

### 2.2 In-Chat Search (Cmd+F)

```
[Cmd+F] → [SearchBar at top of ChatContent]
              ↓ (input change)
           Client-side filter: messages.filter(m => m.content.includes(query))
              ↓
           Highlight matching text in rendered messages
           Show match count + prev/next navigation
```

**UI Flow:**
1. User presses Cmd+F while chat is active
2. Search bar appears at top of chat area (below header)
3. Matching text highlighted in yellow across all messages
4. "N of M" counter with up/down arrows to jump between matches
5. Esc or X button closes search bar

## 3. Database

### New Query (no schema changes needed)

```sql
-- Global search: find messages matching query
SELECT m.id, m.conversation_id, m.content, m.role, m.created_at,
       c.title as conversation_title
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE m.content LIKE '%' || ? || '%'
  AND m.role IN ('user', 'assistant')
ORDER BY m.created_at DESC
LIMIT 50
```

No new tables or indexes required. The existing `idx_messages_conv` index covers conversation-level queries. For global text search, SQLite LIKE is sufficient for the expected data volume (local chat history).

## 4. IPC API

### New Handlers

```typescript
// Main process
ipcMain.handle('conv:search', async (_, query: string) => {
  return db.searchMessages(query) // returns SearchResult[]
})

// Preload bridge
conv: {
  ...existing,
  search(query: string): Promise<SearchResult[]>
}
```

### Types

```typescript
interface SearchResult {
  messageId: string
  conversationId: string
  conversationTitle: string
  content: string       // full message content (truncated for display in renderer)
  role: 'user' | 'assistant'
  createdAt: number
}
```

## 5. Components

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/sidebar/SearchPanel.tsx` | Global search UI in sidebar |
| `src/renderer/components/chat/ChatSearchBar.tsx` | Cmd+F in-chat search bar |

### Modified Files

| File | Change |
|------|--------|
| `src/renderer/components/sidebar/Sidebar.tsx` | Toggle between ConversationList and SearchPanel |
| `src/renderer/components/chat/ChatView.tsx` | Add ChatSearchBar + Cmd+F keyboard listener |
| `src/renderer/stores/app-store.ts` | Add search state (sidebarSearch, chatSearch) |
| `src/main/db/conversations.ts` | Add `searchMessages()` query |
| `src/main/ipc/chat-handlers.ts` | Add `conv:search` handler |
| `src/preload/index.ts` | Add `conv.search()` bridge |

## 6. Store State

```typescript
// app-store.ts additions
sidebarMode: 'conversations' | 'search'
setSidebarMode: (mode) => void
```

## 7. UI Design

### Global Search Panel (replaces conversation list)
```
┌─────────────────────┐
│ ← Back    Search    │
├─────────────────────┤
│ 🔍 [search input..] │
├─────────────────────┤
│ Conversation Title 1│
│  "...matched text..." │
│  user · 2min ago    │
├─────────────────────┤
│ Conversation Title 2│
│  "...matched text..." │
│  assistant · 1hr ago│
└─────────────────────┘
```

### In-Chat Search Bar (top of chat)
```
┌──────────────────────────────────┐
│ 🔍 [search...] │ 3 of 12 │ ↑ ↓ │ ✕ │
└──────────────────────────────────┘
```

## 8. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+F` | Open in-chat search (when conversation active) |
| `Escape` | Close search bar / back to conversation list |
| `Enter` / `Cmd+G` | Next match (in-chat) |
| `Shift+Enter` / `Cmd+Shift+G` | Previous match (in-chat) |
