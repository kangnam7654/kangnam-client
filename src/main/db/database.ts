import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

let db: SqlJsDatabase
let dbPath: string

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  dbPath = join(dbDir, 'kangnam-client.db')

  const SQL = await initSqlJs()

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')
  runMigrations()
  saveDatabase()
}

export function saveDatabase(): void {
  if (!db || !dbPath) return
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

function runMigrations(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT 'New Chat',
      provider    TEXT NOT NULL,
      model       TEXT,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      tool_use_id     TEXT,
      token_count     INTEGER,
      created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv
      ON messages(conversation_id, created_at)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      name     TEXT PRIMARY KEY,
      type     TEXT NOT NULL,
      command  TEXT,
      args     TEXT,
      url      TEXT,
      env      TEXT,
      headers  TEXT,
      enabled  INTEGER NOT NULL DEFAULT 1
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      provider      TEXT PRIMARY KEY,
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expires_at    INTEGER,
      metadata      TEXT
    )
  `)
}
