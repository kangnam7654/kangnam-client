import { IpcMain, BrowserWindow } from 'electron'
import { AuthManager } from '../auth/auth-manager'
import {
  createEvalSet, listEvalSets, deleteEvalSet,
  addEvalCase, bulkAddEvalCases, updateEvalCase, deleteEvalCase, listEvalCases,
  createEvalRun, updateEvalRun, getEvalRun, listEvalRuns, deleteEvalRun, listEvalResults,
  createEvalResult, updateEvalResult
} from '../db/evals'
import { getSkill } from '../db/skills'
import { generateEvals } from '../skills/skill-ai'
import { runEval, stopEval, computeBenchmarkStats, optimizeDescription } from '../skills/skill-eval-engine'

export function registerEvalHandlers(ipcMain: IpcMain, authManager: AuthManager): void {
  // ── EvalSet CRUD ──

  ipcMain.handle('eval:set:create', (_event, skillId: string, name?: string) => {
    return createEvalSet(skillId, name)
  })

  ipcMain.handle('eval:set:list', (_event, skillId: string) => {
    return listEvalSets(skillId)
  })

  ipcMain.handle('eval:set:delete', (_event, id: string) => {
    deleteEvalSet(id)
  })

  // ── EvalCase CRUD ──

  ipcMain.handle('eval:case:add', (_event, evalSetId: string, prompt: string, expected: string, shouldTrigger: boolean) => {
    return addEvalCase(evalSetId, prompt, expected, shouldTrigger)
  })

  ipcMain.handle('eval:case:bulk-add', (_event, evalSetId: string, cases: Array<{ prompt: string; expected: string; shouldTrigger: boolean }>) => {
    return bulkAddEvalCases(evalSetId, cases)
  })

  ipcMain.handle('eval:case:update', (_event, id: string, prompt: string, expected: string, shouldTrigger: boolean) => {
    updateEvalCase(id, prompt, expected, shouldTrigger)
  })

  ipcMain.handle('eval:case:delete', (_event, id: string) => {
    deleteEvalCase(id)
  })

  ipcMain.handle('eval:case:list', (_event, evalSetId: string) => {
    return listEvalCases(evalSetId)
  })

  // ── EvalRun ──

  ipcMain.handle('eval:run:start', async (event, evalSetId: string, skillId: string, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)

    const skill = getSkill(skillId)
    if (!skill) throw new Error(`Skill not found: ${skillId}`)

    const cases = listEvalCases(evalSetId)
    if (cases.length === 0) throw new Error('No test cases to run')

    // Create run with skill snapshot
    const run = createEvalRun(
      evalSetId, skillId,
      skill.name, skill.description, skill.instructions,
      provider, model ?? null, cases.length
    )

    // Pre-create result rows
    for (const c of cases) {
      createEvalResult(run.id, c.id)
    }

    // Run asynchronously, sending progress via IPC events
    const win = BrowserWindow.fromWebContents(event.sender)
    runEval(run.id, provider, accessToken, model, (progress) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('eval:progress', progress)
      }
    }).then((stats) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('eval:run-complete', { runId: run.id, stats })
      }
    }).catch((err) => {
      // Update DB status so Run History doesn't stay stuck on 'running'
      updateEvalRun(run.id, { status: 'error' })
      if (win && !win.isDestroyed()) {
        win.webContents.send('eval:run-error', { runId: run.id, error: (err as Error).message })
      }
    })

    return run
  })

  ipcMain.handle('eval:run:stop', (_event, runId: string) => {
    stopEval(runId)
  })

  ipcMain.handle('eval:run:list', (_event, evalSetId: string) => {
    return listEvalRuns(evalSetId)
  })

  ipcMain.handle('eval:run:get', (_event, runId: string) => {
    return getEvalRun(runId)
  })

  ipcMain.handle('eval:run:results', (_event, runId: string) => {
    return listEvalResults(runId)
  })

  ipcMain.handle('eval:run:stats', (_event, runId: string) => {
    return computeBenchmarkStats(runId)
  })

  ipcMain.handle('eval:run:delete', (_event, runId: string) => {
    deleteEvalRun(runId)
  })

  // ── Result feedback ──

  ipcMain.handle('eval:result:feedback', (_event, resultId: string, feedback: string, rating: number) => {
    updateEvalResult(resultId, { feedback, feedbackRating: rating })
  })

  // ── AI Generate (wraps existing generateEvals) ──

  ipcMain.handle('eval:ai:generate', async (_event, skill: { name: string; description: string; instructions: string }, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)
    return generateEvals(skill, provider, accessToken, model)
  })

  // ── Description Optimizer ──

  ipcMain.handle('eval:optimize:start', async (event, skillId: string, evalSetId: string, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)

    const skill = getSkill(skillId)
    if (!skill) throw new Error(`Skill not found: ${skillId}`)

    const win = BrowserWindow.fromWebContents(event.sender)

    const candidates = await optimizeDescription(
      skillId, evalSetId,
      skill.description, skill.instructions,
      provider, accessToken, model,
      (step, data) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('eval:optimize-progress', { step, ...data as Record<string, unknown> })
        }
      }
    )

    if (win && !win.isDestroyed()) {
      win.webContents.send('eval:optimize-complete', { candidates })
    }

    return candidates
  })
}
