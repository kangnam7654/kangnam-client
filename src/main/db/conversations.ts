import { getDb, saveDatabase } from './database'
import { randomUUID } from 'crypto'
import type { BindParams } from 'sql.js'

export interface Conversation {
  id: string
  title: string
  provider: string
  model: string | null
  pinned: number
  created_at: number
  updated_at: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_use_id: string | null
  tool_name: string | null
  tool_args: string | null
  token_count: number | null
  attachments: string | null
  created_at: number
}

// Helper: convert sql.js result rows to objects
function rowsToObjects<T>(stmt: ReturnType<ReturnType<typeof getDb>['prepare']>): T[] {
  const results: T[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    results.push(row as T)
  }
  stmt.free()
  return results
}

function queryOne<T>(sql: string, params: BindParams = []): T | null {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject() as T
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

function queryAll<T>(sql: string, params: BindParams = []): T[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  return rowsToObjects<T>(stmt)
}

function execute(sql: string, params: BindParams = []): void {
  const db = getDb()
  db.run(sql, params)
  saveDatabase()
}

export function listConversations(): Conversation[] {
  return queryAll<Conversation>('SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC')
}

export function togglePin(id: string): void {
  const conv = queryOne<Conversation>('SELECT * FROM conversations WHERE id = ?', [id])
  if (!conv) return
  execute('UPDATE conversations SET pinned = ? WHERE id = ?', [conv.pinned ? 0 : 1, id])
}

export function createConversation(provider: string, model?: string): Conversation {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  execute(
    'INSERT INTO conversations (id, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, provider, model ?? null, now, now]
  )
  return queryOne<Conversation>('SELECT * FROM conversations WHERE id = ?', [id])!
}

export function deleteConversation(id: string): void {
  execute('DELETE FROM messages WHERE conversation_id = ?', [id])
  execute('DELETE FROM conversations WHERE id = ?', [id])
}

export function deleteAllConversations(): void {
  execute('DELETE FROM messages')
  execute('DELETE FROM conversations')
}

export function getConversation(id: string): Conversation | null {
  return queryOne<Conversation>('SELECT * FROM conversations WHERE id = ?', [id])
}

export function updateConversationTitle(id: string, title: string): void {
  const now = Math.floor(Date.now() / 1000)
  execute('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title, now, id])
}

/**
 * Auto-set title from the first user message if still "New Chat".
 */
export function autoTitleIfNeeded(conversationId: string, userMessage: string): void {
  const conv = getConversation(conversationId)
  if (!conv || conv.title !== 'New Chat') return
  const trimmed = userMessage.trim()
  if (!trimmed) return
  // Take the first line, truncate to 40 chars
  const firstLine = trimmed.split('\n')[0]
  const title = firstLine.length > 40 ? firstLine.substring(0, 40) + '…' : firstLine
  updateConversationTitle(conversationId, title)
}

export interface SearchResult {
  messageId: string
  conversationId: string
  conversationTitle: string
  content: string
  role: 'user' | 'assistant'
  createdAt: number
}

export function searchMessages(query: string): SearchResult[] {
  if (!query.trim()) return []
  const rows = queryAll<{
    id: string
    conversation_id: string
    title: string
    content: string
    role: string
    created_at: number
  }>(
    `SELECT m.id, m.conversation_id, c.title, m.content, m.role, m.created_at
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.content LIKE '%' || ? || '%'
       AND m.role IN ('user', 'assistant')
     ORDER BY m.created_at DESC
     LIMIT 50`,
    [query.trim()]
  )
  return rows.map(r => ({
    messageId: r.id,
    conversationId: r.conversation_id,
    conversationTitle: r.title,
    content: r.content,
    role: r.role as 'user' | 'assistant',
    createdAt: r.created_at
  }))
}

export function getMessages(conversationId: string): Message[] {
  return queryAll<Message>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId]
  )
}

export function addMessage(
  conversationId: string,
  role: Message['role'],
  content: string,
  toolUseId?: string,
  tokenCount?: number,
  attachments?: string,
  toolName?: string,
  toolArgs?: string
): Message {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  execute(
    'INSERT INTO messages (id, conversation_id, role, content, tool_use_id, tool_name, tool_args, token_count, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, conversationId, role, content, toolUseId ?? null, toolName ?? null, toolArgs ?? null, tokenCount ?? null, attachments ?? null, now]
  )

  // Update conversation timestamp
  execute('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId])

  return queryOne<Message>('SELECT * FROM messages WHERE id = ?', [id])!
}
