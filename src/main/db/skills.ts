import { getDb, saveDatabase } from './database'
import { randomUUID } from 'crypto'
import type { BindParams } from 'sql.js'

export interface SkillReference {
  id: string
  skillId: string
  name: string
  content: string
  sortOrder: number
}

export interface Skill {
  id: string
  name: string
  description: string
  instructions: string
  argumentHint: string | null
  model: string | null
  userInvocable: boolean
  references: SkillReference[]
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
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

function execute(sql: string, params: BindParams = []): void {
  const db = getDb()
  db.run(sql, params)
  saveDatabase()
}

interface SkillRow {
  id: string
  title: string
  description: string
  content: string
  argument_hint: string | null
  model: string | null
  user_invocable: number
}

interface RefRow {
  id: string
  skill_id: string
  name: string
  content: string
  sort_order: number
}

function getRefsForSkill(skillId: string): SkillReference[] {
  return queryAll<RefRow>(
    'SELECT * FROM skill_references WHERE skill_id = ? ORDER BY sort_order ASC', [skillId]
  ).map(r => ({
    id: r.id,
    skillId: r.skill_id,
    name: r.name,
    content: r.content,
    sortOrder: r.sort_order
  }))
}

function toSkill(row: SkillRow, refs?: SkillReference[]): Skill {
  return {
    id: row.id,
    name: row.title,
    description: row.description,
    instructions: row.content,
    argumentHint: row.argument_hint,
    model: row.model,
    userInvocable: row.user_invocable === 1,
    references: refs ?? getRefsForSkill(row.id)
  }
}

export function listSkills(): Skill[] {
  const rows = queryAll<SkillRow>(
    'SELECT id, title, description, content, argument_hint, model, user_invocable FROM prompts ORDER BY sort_order ASC, title ASC'
  )
  // Batch-load all references
  const allRefs = queryAll<RefRow>('SELECT * FROM skill_references ORDER BY sort_order ASC')
  const refsBySkill = new Map<string, SkillReference[]>()
  for (const r of allRefs) {
    const list = refsBySkill.get(r.skill_id) ?? []
    list.push({ id: r.id, skillId: r.skill_id, name: r.name, content: r.content, sortOrder: r.sort_order })
    refsBySkill.set(r.skill_id, list)
  }
  return rows.map(row => toSkill(row, refsBySkill.get(row.id) ?? []))
}

export function getSkill(id: string): Skill | null {
  const row = queryOne<SkillRow>(
    'SELECT id, title, description, content, argument_hint, model, user_invocable FROM prompts WHERE id = ?', [id]
  )
  return row ? toSkill(row) : null
}

export function createSkill(
  name: string, description: string, instructions: string,
  argumentHint?: string, model?: string, userInvocable?: boolean
): Skill {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  execute(
    'INSERT INTO prompts (id, title, description, content, argument_hint, model, user_invocable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, description, instructions, argumentHint ?? null, model ?? null, userInvocable === false ? 0 : 1, now, now]
  )
  return { id, name, description, instructions, argumentHint: argumentHint ?? null, model: model ?? null, userInvocable: userInvocable !== false, references: [] }
}

export function updateSkill(
  id: string, name: string, description: string, instructions: string,
  argumentHint?: string, model?: string, userInvocable?: boolean
): void {
  const now = Math.floor(Date.now() / 1000)
  execute(
    'UPDATE prompts SET title = ?, description = ?, content = ?, argument_hint = ?, model = ?, user_invocable = ?, updated_at = ? WHERE id = ?',
    [name, description, instructions, argumentHint ?? null, model ?? null, userInvocable === false ? 0 : 1, now, id]
  )
}

export function deleteSkill(id: string): void {
  // References auto-deleted via ON DELETE CASCADE
  execute('DELETE FROM prompts WHERE id = ?', [id])
}

export function getSkillInstructions(id: string): string | null {
  const skill = getSkill(id)
  if (!skill) return null
  // Combine instructions + references
  let text = skill.instructions
  if (skill.references.length > 0) {
    text += '\n\n---\n\n'
    text += skill.references.map(r => `## ${r.name}\n\n${r.content}`).join('\n\n---\n\n')
  }
  return text
}

// ── Reference CRUD ──────────────────────────────

export function addSkillReference(skillId: string, name: string, content: string): SkillReference {
  const id = randomUUID()
  // Get next sort order
  const last = queryOne<{ max_sort: number | null }>(
    'SELECT MAX(sort_order) as max_sort FROM skill_references WHERE skill_id = ?', [skillId]
  )
  const sortOrder = (last?.max_sort ?? -1) + 1
  execute(
    'INSERT INTO skill_references (id, skill_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)',
    [id, skillId, name, content, sortOrder]
  )
  return { id, skillId, name, content, sortOrder }
}

export function updateSkillReference(id: string, name: string, content: string): void {
  execute('UPDATE skill_references SET name = ?, content = ? WHERE id = ?', [name, content, id])
}

export function deleteSkillReference(id: string): void {
  execute('DELETE FROM skill_references WHERE id = ?', [id])
}

export function listSkillReferences(skillId: string): SkillReference[] {
  return getRefsForSkill(skillId)
}
