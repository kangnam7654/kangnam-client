import { IpcMain } from 'electron'
import { AuthManager } from '../auth/auth-manager'
import {
  listSkills, getSkill, createSkill, updateSkill, deleteSkill, getSkillInstructions,
  addSkillReference, updateSkillReference, deleteSkillReference, listSkillReferences
} from '../db/skills'
import { generateSkill, improveSkill, generateReference, generateEvals, gradeSkill, compareSkills, analyzeComparison } from '../skills/skill-ai'

export function registerPromptHandlers(ipcMain: IpcMain, authManager: AuthManager): void {
  // Skill CRUD
  ipcMain.handle('prompts:list', () => listSkills())
  ipcMain.handle('prompts:get', (_event, id: string) => getSkill(id))
  ipcMain.handle('prompts:get-instructions', (_event, id: string) => getSkillInstructions(id))

  ipcMain.handle('prompts:create', (_event, name: string, description: string, instructions: string, argumentHint?: string, model?: string, userInvocable?: boolean) => {
    return createSkill(name, description, instructions, argumentHint, model, userInvocable)
  })

  ipcMain.handle('prompts:update', (_event, id: string, name: string, description: string, instructions: string, argumentHint?: string, model?: string, userInvocable?: boolean) => {
    updateSkill(id, name, description, instructions, argumentHint, model, userInvocable)
  })

  ipcMain.handle('prompts:delete', (_event, id: string) => {
    deleteSkill(id)
  })

  // Reference CRUD
  ipcMain.handle('prompts:ref:list', (_event, skillId: string) => listSkillReferences(skillId))

  ipcMain.handle('prompts:ref:add', (_event, skillId: string, name: string, content: string) => {
    return addSkillReference(skillId, name, content)
  })

  ipcMain.handle('prompts:ref:update', (_event, id: string, name: string, content: string) => {
    updateSkillReference(id, name, content)
  })

  ipcMain.handle('prompts:ref:delete', (_event, id: string) => {
    deleteSkillReference(id)
  })

  // ── AI Assist ──────────────────────────────────────────────────

  ipcMain.handle('prompts:ai:generate', async (_event, userRequest: string, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)
    return generateSkill(userRequest, provider, accessToken, model)
  })

  ipcMain.handle('prompts:ai:improve', async (_event, currentSkill: { name: string; description: string; instructions: string }, feedback: string, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)
    return improveSkill(currentSkill, feedback, provider, accessToken, model)
  })

  ipcMain.handle('prompts:ai:generate-ref', async (_event, skillInstructions: string, userRequest: string, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)
    return generateReference(skillInstructions, userRequest, provider, accessToken, model)
  })

  ipcMain.handle('prompts:ai:generate-evals', async (_event, skill: { name: string; description: string; instructions: string }, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)
    return generateEvals(skill, provider, accessToken, model)
  })

  // ── Sub-Agents ───────────────────────────────────────────────────

  ipcMain.handle('prompts:ai:grade', async (_event, skill: { name: string; description: string; instructions: string }, criteria: string[], provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)
    return gradeSkill(skill, criteria, provider, accessToken, model)
  })

  ipcMain.handle('prompts:ai:compare', async (_event, skillA: { name: string; description: string; instructions: string }, skillB: { name: string; description: string; instructions: string }, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)
    return compareSkills(skillA, skillB, provider, accessToken, model)
  })

  ipcMain.handle('prompts:ai:analyze', async (_event, comparisonResult: unknown, winnerSkill: { name: string; description: string; instructions: string }, loserSkill: { name: string; description: string; instructions: string }, provider: string, model?: string) => {
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)
    return analyzeComparison(comparisonResult as Parameters<typeof analyzeComparison>[0], winnerSkill, loserSkill, provider, accessToken, model)
  })
}
