import { getDb, saveDatabase } from './database'
import { randomUUID } from 'crypto'
import type { BindParams } from 'sql.js'

// ── Types ────────────────────────────────────────

export interface EvalSet {
  id: string
  skillId: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface EvalCase {
  id: string
  evalSetId: string
  prompt: string
  expected: string
  shouldTrigger: boolean
  sortOrder: number
}

export interface EvalRun {
  id: string
  evalSetId: string
  skillId: string
  skillName: string
  skillDesc: string
  skillBody: string
  provider: string
  model: string | null
  status: 'running' | 'completed' | 'stopped' | 'error'
  triggerAccuracy: number | null
  qualityMean: number | null
  qualityStddev: number | null
  totalCases: number
  completedCases: number
  createdAt: number
}

export interface EvalResult {
  id: string
  runId: string
  caseId: string
  didTrigger: boolean | null
  triggerCorrect: boolean | null
  responseWith: string | null
  responseWithout: string | null
  qualityScore: number | null
  qualityReason: string | null
  feedback: string | null
  feedbackRating: number | null
  status: 'pending' | 'running' | 'completed' | 'error'
}

// ── Helpers ──────────────────────────────────────

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

// ── EvalSet CRUD ─────────────────────────────────

export function createEvalSet(skillId: string, name: string = 'Default'): EvalSet {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  execute(
    'INSERT INTO skill_eval_sets (id, skill_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, skillId, name, now, now]
  )
  return { id, skillId, name, createdAt: now, updatedAt: now }
}

export function listEvalSets(skillId: string): EvalSet[] {
  return queryAll<{ id: string; skill_id: string; name: string; created_at: number; updated_at: number }>(
    'SELECT * FROM skill_eval_sets WHERE skill_id = ? ORDER BY created_at DESC', [skillId]
  ).map(r => ({ id: r.id, skillId: r.skill_id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at }))
}

export function getEvalSet(id: string): EvalSet | null {
  const r = queryOne<{ id: string; skill_id: string; name: string; created_at: number; updated_at: number }>(
    'SELECT * FROM skill_eval_sets WHERE id = ?', [id]
  )
  return r ? { id: r.id, skillId: r.skill_id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at } : null
}

export function deleteEvalSet(id: string): void {
  execute('DELETE FROM skill_eval_sets WHERE id = ?', [id])
}

// ── EvalCase CRUD ────────────────────────────────

export function addEvalCase(evalSetId: string, prompt: string, expected: string, shouldTrigger: boolean): EvalCase {
  const id = randomUUID()
  const last = queryOne<{ max_sort: number | null }>(
    'SELECT MAX(sort_order) as max_sort FROM skill_eval_cases WHERE eval_set_id = ?', [evalSetId]
  )
  const sortOrder = (last?.max_sort ?? -1) + 1
  execute(
    'INSERT INTO skill_eval_cases (id, eval_set_id, prompt, expected, should_trigger, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [id, evalSetId, prompt, expected, shouldTrigger ? 1 : 0, sortOrder]
  )
  return { id, evalSetId, prompt, expected, shouldTrigger, sortOrder }
}

export function bulkAddEvalCases(evalSetId: string, cases: Array<{ prompt: string; expected: string; shouldTrigger: boolean }>): EvalCase[] {
  const db = getDb()
  const last = queryOne<{ max_sort: number | null }>(
    'SELECT MAX(sort_order) as max_sort FROM skill_eval_cases WHERE eval_set_id = ?', [evalSetId]
  )
  let sortOrder = (last?.max_sort ?? -1) + 1
  const results: EvalCase[] = []
  for (const c of cases) {
    const id = randomUUID()
    db.run(
      'INSERT INTO skill_eval_cases (id, eval_set_id, prompt, expected, should_trigger, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [id, evalSetId, c.prompt, c.expected, c.shouldTrigger ? 1 : 0, sortOrder]
    )
    results.push({ id, evalSetId, prompt: c.prompt, expected: c.expected, shouldTrigger: c.shouldTrigger, sortOrder })
    sortOrder++
  }
  saveDatabase()
  return results
}

export function updateEvalCase(id: string, prompt: string, expected: string, shouldTrigger: boolean): void {
  execute(
    'UPDATE skill_eval_cases SET prompt = ?, expected = ?, should_trigger = ? WHERE id = ?',
    [prompt, expected, shouldTrigger ? 1 : 0, id]
  )
}

export function deleteEvalCase(id: string): void {
  execute('DELETE FROM skill_eval_cases WHERE id = ?', [id])
}

export function listEvalCases(evalSetId: string): EvalCase[] {
  return queryAll<{ id: string; eval_set_id: string; prompt: string; expected: string; should_trigger: number; sort_order: number }>(
    'SELECT * FROM skill_eval_cases WHERE eval_set_id = ? ORDER BY sort_order ASC', [evalSetId]
  ).map(r => ({
    id: r.id, evalSetId: r.eval_set_id, prompt: r.prompt, expected: r.expected,
    shouldTrigger: r.should_trigger === 1, sortOrder: r.sort_order
  }))
}

// ── EvalRun CRUD ─────────────────────────────────

export function createEvalRun(
  evalSetId: string, skillId: string,
  skillName: string, skillDesc: string, skillBody: string,
  provider: string, model: string | null, totalCases: number
): EvalRun {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  execute(
    `INSERT INTO skill_eval_runs (id, eval_set_id, skill_id, skill_name, skill_desc, skill_body, provider, model, status, total_cases, completed_cases, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, 0, ?)`,
    [id, evalSetId, skillId, skillName, skillDesc, skillBody, provider, model, totalCases, now]
  )
  return {
    id, evalSetId, skillId, skillName, skillDesc, skillBody,
    provider, model, status: 'running',
    triggerAccuracy: null, qualityMean: null, qualityStddev: null,
    totalCases, completedCases: 0, createdAt: now
  }
}

export function updateEvalRun(id: string, update: Partial<Pick<EvalRun, 'status' | 'triggerAccuracy' | 'qualityMean' | 'qualityStddev' | 'completedCases'>>): void {
  const sets: string[] = []
  const params: (string | number | null)[] = []

  if (update.status !== undefined) { sets.push('status = ?'); params.push(update.status) }
  if (update.triggerAccuracy !== undefined) { sets.push('trigger_accuracy = ?'); params.push(update.triggerAccuracy) }
  if (update.qualityMean !== undefined) { sets.push('quality_mean = ?'); params.push(update.qualityMean) }
  if (update.qualityStddev !== undefined) { sets.push('quality_stddev = ?'); params.push(update.qualityStddev) }
  if (update.completedCases !== undefined) { sets.push('completed_cases = ?'); params.push(update.completedCases) }

  if (sets.length === 0) return
  params.push(id)
  execute(`UPDATE skill_eval_runs SET ${sets.join(', ')} WHERE id = ?`, params)
}

export function getEvalRun(id: string): EvalRun | null {
  const r = queryOne<{
    id: string; eval_set_id: string; skill_id: string; skill_name: string; skill_desc: string; skill_body: string;
    provider: string; model: string | null; status: string;
    trigger_accuracy: number | null; quality_mean: number | null; quality_stddev: number | null;
    total_cases: number; completed_cases: number; created_at: number
  }>('SELECT * FROM skill_eval_runs WHERE id = ?', [id])
  if (!r) return null
  return {
    id: r.id, evalSetId: r.eval_set_id, skillId: r.skill_id,
    skillName: r.skill_name, skillDesc: r.skill_desc, skillBody: r.skill_body,
    provider: r.provider, model: r.model, status: r.status as EvalRun['status'],
    triggerAccuracy: r.trigger_accuracy, qualityMean: r.quality_mean, qualityStddev: r.quality_stddev,
    totalCases: r.total_cases, completedCases: r.completed_cases, createdAt: r.created_at
  }
}

export function listEvalRuns(evalSetId: string): EvalRun[] {
  return queryAll<{
    id: string; eval_set_id: string; skill_id: string; skill_name: string; skill_desc: string; skill_body: string;
    provider: string; model: string | null; status: string;
    trigger_accuracy: number | null; quality_mean: number | null; quality_stddev: number | null;
    total_cases: number; completed_cases: number; created_at: number
  }>('SELECT * FROM skill_eval_runs WHERE eval_set_id = ? ORDER BY created_at DESC', [evalSetId]).map(r => ({
    id: r.id, evalSetId: r.eval_set_id, skillId: r.skill_id,
    skillName: r.skill_name, skillDesc: r.skill_desc, skillBody: r.skill_body,
    provider: r.provider, model: r.model, status: r.status as EvalRun['status'],
    triggerAccuracy: r.trigger_accuracy, qualityMean: r.quality_mean, qualityStddev: r.quality_stddev,
    totalCases: r.total_cases, completedCases: r.completed_cases, createdAt: r.created_at
  }))
}

export function deleteEvalRun(id: string): void {
  execute('DELETE FROM skill_eval_runs WHERE id = ?', [id])
}

// ── EvalResult CRUD ──────────────────────────────

export function createEvalResult(runId: string, caseId: string): EvalResult {
  const id = randomUUID()
  execute(
    `INSERT INTO skill_eval_results (id, run_id, case_id, status) VALUES (?, ?, ?, 'pending')`,
    [id, runId, caseId]
  )
  return {
    id, runId, caseId,
    didTrigger: null, triggerCorrect: null,
    responseWith: null, responseWithout: null,
    qualityScore: null, qualityReason: null,
    feedback: null, feedbackRating: null,
    status: 'pending'
  }
}

export function updateEvalResult(id: string, update: Partial<Omit<EvalResult, 'id' | 'runId' | 'caseId'>>): void {
  const sets: string[] = []
  const params: (string | number | null)[] = []

  if (update.didTrigger !== undefined) { sets.push('did_trigger = ?'); params.push(update.didTrigger === null ? null : update.didTrigger ? 1 : 0) }
  if (update.triggerCorrect !== undefined) { sets.push('trigger_correct = ?'); params.push(update.triggerCorrect === null ? null : update.triggerCorrect ? 1 : 0) }
  if (update.responseWith !== undefined) { sets.push('response_with = ?'); params.push(update.responseWith) }
  if (update.responseWithout !== undefined) { sets.push('response_without = ?'); params.push(update.responseWithout) }
  if (update.qualityScore !== undefined) { sets.push('quality_score = ?'); params.push(update.qualityScore) }
  if (update.qualityReason !== undefined) { sets.push('quality_reason = ?'); params.push(update.qualityReason) }
  if (update.feedback !== undefined) { sets.push('feedback = ?'); params.push(update.feedback) }
  if (update.feedbackRating !== undefined) { sets.push('feedback_rating = ?'); params.push(update.feedbackRating) }
  if (update.status !== undefined) { sets.push('status = ?'); params.push(update.status) }

  if (sets.length === 0) return
  params.push(id)
  execute(`UPDATE skill_eval_results SET ${sets.join(', ')} WHERE id = ?`, params)
}

export function listEvalResults(runId: string): EvalResult[] {
  return queryAll<{
    id: string; run_id: string; case_id: string;
    did_trigger: number | null; trigger_correct: number | null;
    response_with: string | null; response_without: string | null;
    quality_score: number | null; quality_reason: string | null;
    feedback: string | null; feedback_rating: number | null; status: string
  }>('SELECT * FROM skill_eval_results WHERE run_id = ? ORDER BY rowid ASC', [runId]).map(r => ({
    id: r.id, runId: r.run_id, caseId: r.case_id,
    didTrigger: r.did_trigger === null ? null : r.did_trigger === 1,
    triggerCorrect: r.trigger_correct === null ? null : r.trigger_correct === 1,
    responseWith: r.response_with, responseWithout: r.response_without,
    qualityScore: r.quality_score, qualityReason: r.quality_reason,
    feedback: r.feedback, feedbackRating: r.feedback_rating,
    status: r.status as EvalResult['status']
  }))
}

export function getEvalResult(id: string): EvalResult | null {
  const r = queryOne<{
    id: string; run_id: string; case_id: string;
    did_trigger: number | null; trigger_correct: number | null;
    response_with: string | null; response_without: string | null;
    quality_score: number | null; quality_reason: string | null;
    feedback: string | null; feedback_rating: number | null; status: string
  }>('SELECT * FROM skill_eval_results WHERE id = ?', [id])
  if (!r) return null
  return {
    id: r.id, runId: r.run_id, caseId: r.case_id,
    didTrigger: r.did_trigger === null ? null : r.did_trigger === 1,
    triggerCorrect: r.trigger_correct === null ? null : r.trigger_correct === 1,
    responseWith: r.response_with, responseWithout: r.response_without,
    qualityScore: r.quality_score, qualityReason: r.quality_reason,
    feedback: r.feedback, feedbackRating: r.feedback_rating,
    status: r.status as EvalResult['status']
  }
}
