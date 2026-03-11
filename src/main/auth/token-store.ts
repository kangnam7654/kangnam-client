import { safeStorage } from 'electron'
import { getDb, saveDatabase } from '../db/database'

export interface StoredToken {
  provider: string
  access_token: string
  refresh_token: string | null
  expires_at: number | null
  metadata: Record<string, unknown> | null
}

export function saveToken(token: StoredToken): void {
  const db = getDb()
  const encryptedAccess = safeStorage.encryptString(token.access_token).toString('base64')
  const encryptedRefresh = token.refresh_token
    ? safeStorage.encryptString(token.refresh_token).toString('base64')
    : null

  db.run(
    'INSERT OR REPLACE INTO auth_tokens (provider, access_token, refresh_token, expires_at, metadata) VALUES (?, ?, ?, ?, ?)',
    [token.provider, encryptedAccess, encryptedRefresh, token.expires_at, token.metadata ? JSON.stringify(token.metadata) : null]
  )
  saveDatabase()
}

export function getToken(provider: string): StoredToken | null {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM auth_tokens WHERE provider = ?')
  stmt.bind([provider])

  if (!stmt.step()) {
    stmt.free()
    return null
  }

  const row = stmt.getAsObject() as {
    provider: string
    access_token: string
    refresh_token: string | null
    expires_at: number | null
    metadata: string | null
  }
  stmt.free()

  return {
    provider: row.provider,
    access_token: safeStorage.decryptString(Buffer.from(row.access_token, 'base64')),
    refresh_token: row.refresh_token
      ? safeStorage.decryptString(Buffer.from(row.refresh_token, 'base64'))
      : null,
    expires_at: row.expires_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  }
}

export function deleteToken(provider: string): void {
  const db = getDb()
  db.run('DELETE FROM auth_tokens WHERE provider = ?', [provider])
  saveDatabase()
}

export function listTokenProviders(): string[] {
  const db = getDb()
  const stmt = db.prepare('SELECT provider FROM auth_tokens')
  const providers: string[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as { provider: string }
    providers.push(row.provider)
  }
  stmt.free()
  return providers
}
