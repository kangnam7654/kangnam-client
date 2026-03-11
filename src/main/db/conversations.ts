import { getDb, saveDatabase } from './database'
import { randomUUID } from 'crypto'
import type { BindParams } from 'sql.js'

export interface Conversation {
  id: string
  title: string
  provider: string
  model: string | null
  created_at: number
  updated_at: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_use_id: string | null
  token_count: number | null
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
  return queryAll<Conversation>('SELECT * FROM conversations ORDER BY updated_at DESC')
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

export function updateConversationTitle(id: string, title: string): void {
  const now = Math.floor(Date.now() / 1000)
  execute('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title, now, id])
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
  tokenCount?: number
): Message {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  execute(
    'INSERT INTO messages (id, conversation_id, role, content, tool_use_id, token_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, conversationId, role, content, toolUseId ?? null, tokenCount ?? null, now]
  )

  // Update conversation timestamp
  execute('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId])

  return queryOne<Message>('SELECT * FROM messages WHERE id = ?', [id])!
}
