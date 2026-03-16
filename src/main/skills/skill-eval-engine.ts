/**
 * Skill Eval Engine — runs trigger checks, quality grading, and description optimization.
 */
import { callLLM, parseJSON } from './skill-ai'
import { listSkills } from '../db/skills'
import {
  listEvalCases, createEvalRun, createEvalResult,
  updateEvalResult, updateEvalRun, listEvalResults,
  getEvalRun, type EvalCase, type EvalRun
} from '../db/evals'

// ═══════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═══════════════════════════════════════════════════

const TRIGGER_CHECKER_SYSTEM = `You are a skill routing engine. Given a user query and a list of available skills, decide which skill (if any) should handle the query.

## Process

1. Read the user query carefully
2. Review each skill's name and description
3. Decide if any skill should be triggered
4. A skill should trigger only if the query genuinely falls within its domain AND is complex enough to benefit from specialized handling

## Output

Respond with ONLY valid JSON:
{
  "triggered_skill_id": "skill-id-here" or null,
  "reasoning": "한국어로 이 스킬이 선택된/선택되지 않은 이유를 간단히 설명"
}

All reasoning must be in Korean (한국어).
No explanation, no markdown fences — just the raw JSON object.`

const QUALITY_GRADER_SYSTEM = `You are a response quality grader. Compare two responses to the same user query — one generated WITH a skill's instructions, one WITHOUT — and rate the quality difference.

## Process

1. Read the user query
2. Read Response A (with skill) and Response B (without skill)
3. Evaluate which response better serves the user's needs
4. Score from 1-5:
   - 1: With-skill response is significantly worse
   - 2: With-skill response is slightly worse
   - 3: Both responses are roughly equal
   - 4: With-skill response is slightly better
   - 5: With-skill response is significantly better

## Output

Respond with ONLY valid JSON:
{
  "score": 1-5,
  "reason": "한국어로 품질 차이를 간단히 설명"
}

All reason must be in Korean (한국어).
No explanation, no markdown fences — just the raw JSON object.`

const DESCRIPTION_OPTIMIZER_SYSTEM = `You are optimizing a skill description for an AI assistant. A "skill" is sort of like a prompt, but with progressive disclosure — there's a title and description that the assistant sees when deciding whether to use the skill, and then if it does use the skill, it reads the full instructions which have lots more details and potentially links to other resources like helper files, scripts, and additional documentation or examples.

The description appears in the assistant's "available skills" list. When a user sends a query, the assistant decides whether to invoke the skill based solely on the title and on this description. Your goal is to write descriptions that trigger for relevant queries, and don't trigger for irrelevant ones.

## Process

1. Analyze the failed cases — understand why the current description failed to trigger (or falsely triggered)
2. Generate 3 candidate descriptions that address the failures
3. Each candidate should take a different approach — be creative and mix up the style since we'll test them all and grab the highest-scoring one

## Guidelines

Based on the failures, write improved descriptions. When I say "based on the failures", it's a bit of a tricky line to walk because we don't want to overfit to the specific cases. So what I DON'T want you to do is produce an ever-expanding list of specific queries that this skill should or shouldn't trigger for. Instead, try to generalize from the failures to broader categories of user intent and situations where this skill would be useful or not useful.

The reason for this is twofold:
1. Avoid overfitting
2. The description is injected into ALL queries and there might be a lot of skills, so we don't want to blow too much space on any given description.

Tips that work well:
- The description should be phrased in the imperative — "Use this skill for" rather than "this skill does"
- Focus on the user's intent, what they are trying to achieve, vs. the implementation details of how the skill works
- The description competes with other skills for the assistant's attention — make it distinctive and immediately recognizable
- If you're getting lots of failures after repeated attempts, change things up. Try different sentence structures or wordings
- Each candidate should stay under 200 characters. Concretely, your description should not be more than about 100-200 words, even if that comes at the cost of accuracy

## Output

Respond with ONLY valid JSON:
{
  "candidates": [
    { "description": "candidate 1 text", "reasoning": "한국어로 이 후보가 더 나은 이유" },
    { "description": "candidate 2 text", "reasoning": "한국어로 이 후보가 더 나은 이유" },
    { "description": "candidate 3 text", "reasoning": "한국어로 이 후보가 더 나은 이유" }
  ]
}

All reasoning must be in Korean (한국어).
No explanation, no markdown fences — just the raw JSON object.`

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface EvalProgress {
  runId: string
  caseIndex: number
  totalCases: number
  result: {
    caseId: string
    didTrigger: boolean
    triggerCorrect: boolean
    qualityScore: number | null
    qualityReason: string | null
  }
}

export interface EvalRunStats {
  triggerAccuracy: number
  qualityMean: number | null
  qualityStddev: number | null
  totalCases: number
  completedCases: number
}

export interface OptimizeCandidate {
  description: string
  reasoning: string
  triggerAccuracy: number | null
}

// Track active runs for stop support
const activeRuns = new Map<string, { stopped: boolean }>()

// ═══════════════════════════════════════════════════
// CORE ENGINE
// ═══════════════════════════════════════════════════

/**
 * Run eval for all cases in a set.
 */
export async function runEval(
  runId: string,
  provider: string,
  accessToken: string,
  model: string | undefined,
  onProgress: (progress: EvalProgress) => void
): Promise<EvalRunStats> {
  const run = getEvalRun(runId)
  if (!run) throw new Error(`Run not found: ${runId}`)

  const cases = listEvalCases(run.evalSetId)
  const results = listEvalResults(runId)
  const allSkills = listSkills()

  // Build skill list for trigger checker
  const skillListText = allSkills.map(s =>
    `- ID: ${s.id}\n  Name: ${s.name}\n  Description: ${s.description}`
  ).join('\n')

  const runState = { stopped: false }
  activeRuns.set(runId, runState)

  try {
    for (let i = 0; i < cases.length; i++) {
      if (runState.stopped) break

      const evalCase = cases[i]
      const evalResult = results[i]
      if (!evalResult) continue

      updateEvalResult(evalResult.id, { status: 'running' })

      try {
        // Step 1: Trigger check
        const triggerResponse = await callLLM(provider, accessToken, [
          { role: 'system', content: TRIGGER_CHECKER_SYSTEM },
          { role: 'user', content: `## Available Skills\n\n${skillListText}\n\n## User Query\n\n${evalCase.prompt}` }
        ], model)

        const triggerResult = parseJSON<{ triggered_skill_id: string | null; reasoning: string }>(triggerResponse)
        const didTrigger = triggerResult.triggered_skill_id === run.skillId
        const triggerCorrect = didTrigger === evalCase.shouldTrigger

        let qualityScore: number | null = null
        let qualityReason: string | null = null
        let responseWith: string | null = null
        let responseWithout: string | null = null

        // Step 2-4: Only run quality check for should-trigger cases
        if (evalCase.shouldTrigger && !runState.stopped) {
          // With skill
          responseWith = await callLLM(provider, accessToken, [
            { role: 'system', content: run.skillBody },
            { role: 'user', content: evalCase.prompt }
          ], model)

          if (!runState.stopped) {
            // Without skill
            responseWithout = await callLLM(provider, accessToken, [
              { role: 'user', content: evalCase.prompt }
            ], model)
          }

          if (!runState.stopped && responseWith && responseWithout) {
            // Quality grade
            const gradeResponse = await callLLM(provider, accessToken, [
              { role: 'system', content: QUALITY_GRADER_SYSTEM },
              { role: 'user', content: `## User Query\n\n${evalCase.prompt}\n\n## Response A (With Skill)\n\n${responseWith}\n\n## Response B (Without Skill)\n\n${responseWithout}` }
            ], model)

            const grade = parseJSON<{ score: number; reason: string }>(gradeResponse)
            qualityScore = grade.score
            qualityReason = grade.reason
          }
        }

        updateEvalResult(evalResult.id, {
          didTrigger, triggerCorrect,
          responseWith, responseWithout,
          qualityScore, qualityReason,
          status: 'completed'
        })

        updateEvalRun(runId, { completedCases: i + 1 })

        onProgress({
          runId,
          caseIndex: i,
          totalCases: cases.length,
          result: { caseId: evalCase.id, didTrigger, triggerCorrect, qualityScore, qualityReason }
        })
      } catch (err) {
        updateEvalResult(evalResult.id, { status: 'error' })
        updateEvalRun(runId, { completedCases: i + 1 })
        onProgress({
          runId,
          caseIndex: i,
          totalCases: cases.length,
          result: { caseId: evalCase.id, didTrigger: false, triggerCorrect: false, qualityScore: null, qualityReason: (err as Error).message }
        })
      }
    }

    let stats: ReturnType<typeof computeBenchmarkStats>
    try {
      stats = computeBenchmarkStats(runId)
      updateEvalRun(runId, {
        status: runState.stopped ? 'stopped' : 'completed',
        triggerAccuracy: stats.triggerAccuracy,
        qualityMean: stats.qualityMean,
        qualityStddev: stats.qualityStddev
      })
    } catch (statsErr) {
      updateEvalRun(runId, { status: 'error' })
      throw statsErr
    }

    return stats
  } catch (err) {
    // Safety net: update DB status if it's still 'running'
    try { updateEvalRun(runId, { status: 'error' }) } catch { /* already updated above */ }
    throw err
  } finally {
    activeRuns.delete(runId)
  }
}

/**
 * Stop a running eval.
 */
export function stopEval(runId: string): void {
  const runState = activeRuns.get(runId)
  if (runState) runState.stopped = true
}

/**
 * Compute benchmark statistics for a run.
 */
export function computeBenchmarkStats(runId: string): EvalRunStats {
  const results = listEvalResults(runId)
  const completed = results.filter(r => r.status === 'completed')

  let triggerCorrectCount = 0
  const qualityScores: number[] = []

  for (const r of completed) {
    if (r.triggerCorrect) triggerCorrectCount++
    if (r.qualityScore !== null) qualityScores.push(r.qualityScore)
  }

  const triggerAccuracy = completed.length > 0 ? triggerCorrectCount / completed.length : 0

  let qualityMean: number | null = null
  let qualityStddev: number | null = null

  if (qualityScores.length > 0) {
    qualityMean = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    if (qualityScores.length > 1) {
      const variance = qualityScores.reduce((sum, s) => sum + (s - qualityMean!) ** 2, 0) / (qualityScores.length - 1)
      qualityStddev = Math.sqrt(variance)
    } else {
      qualityStddev = 0
    }
  }

  return {
    triggerAccuracy,
    qualityMean,
    qualityStddev,
    totalCases: results.length,
    completedCases: completed.length
  }
}

/**
 * Optimize a skill's description for better trigger accuracy.
 */
export async function optimizeDescription(
  skillId: string,
  evalSetId: string,
  currentDescription: string,
  skillInstructions: string,
  provider: string,
  accessToken: string,
  model: string | undefined,
  onProgress: (step: string, data?: unknown) => void
): Promise<OptimizeCandidate[]> {
  const cases = listEvalCases(evalSetId)
  const allSkills = listSkills()
  const skillListText = allSkills.map(s =>
    `- ID: ${s.id}\n  Name: ${s.name}\n  Description: ${s.description}`
  ).join('\n')

  // Step 1: Test current description
  onProgress('testing-current', { description: currentDescription })
  const currentAccuracy = await testTriggerAccuracy(
    skillId, cases, skillListText, provider, accessToken, model
  )
  onProgress('current-result', { accuracy: currentAccuracy })

  // Step 2: Get failed cases for optimizer
  const failedCases = await getFailedTriggerCases(
    skillId, cases, skillListText, provider, accessToken, model
  )

  const failedText = failedCases.map(f =>
    `- Query: "${f.prompt}"\n  Should trigger: ${f.shouldTrigger}\n  Did trigger: ${f.didTrigger}\n`
  ).join('\n')

  // Step 3: Generate candidates
  onProgress('generating-candidates')
  const response = await callLLM(provider, accessToken, [
    { role: 'system', content: DESCRIPTION_OPTIMIZER_SYSTEM },
    { role: 'user', content: `## Current Description\n\n${currentDescription}\n\n## Skill Instructions (summary)\n\n${skillInstructions.slice(0, 2000)}\n\n## Failed Cases\n\n${failedText || 'No failures — all cases triggered correctly.'}` }
  ], model)

  const { candidates } = parseJSON<{ candidates: Array<{ description: string; reasoning: string }> }>(response)

  // Step 4: Test each candidate
  const results: OptimizeCandidate[] = []
  for (let i = 0; i < candidates.length; i++) {
    onProgress('testing-candidate', { index: i, description: candidates[i].description })

    // Temporarily swap description in skill list for testing
    const testSkillList = allSkills.map(s => {
      if (s.id === skillId) {
        return `- ID: ${s.id}\n  Name: ${s.name}\n  Description: ${candidates[i].description}`
      }
      return `- ID: ${s.id}\n  Name: ${s.name}\n  Description: ${s.description}`
    }).join('\n')

    const accuracy = await testTriggerAccuracy(
      skillId, cases, testSkillList, provider, accessToken, model
    )

    results.push({
      description: candidates[i].description,
      reasoning: candidates[i].reasoning,
      triggerAccuracy: accuracy
    })

    onProgress('candidate-result', { index: i, accuracy })
  }

  return results
}

// ═══════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════

async function testTriggerAccuracy(
  skillId: string,
  cases: EvalCase[],
  skillListText: string,
  provider: string,
  accessToken: string,
  model: string | undefined
): Promise<number> {
  let correct = 0
  for (const c of cases) {
    const response = await callLLM(provider, accessToken, [
      { role: 'system', content: TRIGGER_CHECKER_SYSTEM },
      { role: 'user', content: `## Available Skills\n\n${skillListText}\n\n## User Query\n\n${c.prompt}` }
    ], model)

    try {
      const result = parseJSON<{ triggered_skill_id: string | null }>(response)
      const didTrigger = result.triggered_skill_id === skillId
      if (didTrigger === c.shouldTrigger) correct++
    } catch {
      // Parse error counts as incorrect
    }
  }
  return cases.length > 0 ? correct / cases.length : 0
}

async function getFailedTriggerCases(
  skillId: string,
  cases: EvalCase[],
  skillListText: string,
  provider: string,
  accessToken: string,
  model: string | undefined
): Promise<Array<{ prompt: string; shouldTrigger: boolean; didTrigger: boolean }>> {
  const failed: Array<{ prompt: string; shouldTrigger: boolean; didTrigger: boolean }> = []

  for (const c of cases) {
    const response = await callLLM(provider, accessToken, [
      { role: 'system', content: TRIGGER_CHECKER_SYSTEM },
      { role: 'user', content: `## Available Skills\n\n${skillListText}\n\n## User Query\n\n${c.prompt}` }
    ], model)

    try {
      const result = parseJSON<{ triggered_skill_id: string | null }>(response)
      const didTrigger = result.triggered_skill_id === skillId
      if (didTrigger !== c.shouldTrigger) {
        failed.push({ prompt: c.prompt, shouldTrigger: c.shouldTrigger, didTrigger })
      }
    } catch {
      failed.push({ prompt: c.prompt, shouldTrigger: c.shouldTrigger, didTrigger: false })
    }
  }

  return failed
}
