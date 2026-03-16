import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import {
  EVAL_REVIEW_HTML,
  VIEWER_HTML,
  GENERATE_REVIEW_PY,
  RUN_EVAL_PY,
  RUN_LOOP_PY,
  AGGREGATE_BENCHMARK_PY,
  IMPROVE_DESCRIPTION_PY,
  QUICK_VALIDATE_PY,
  GENERATE_REPORT_PY,
  PACKAGE_SKILL_PY,
  UTILS_PY
} from './skill-creator-assets'
import { PRESET_SKILLS } from './skill-presets'

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

  // Migration: add pinned column
  try {
    db.run('ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0')
  } catch {
    // Column already exists
  }

  // Migration: add attachments column to messages
  try {
    db.run('ALTER TABLE messages ADD COLUMN attachments TEXT')
  } catch {
    // Column already exists
  }

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

  db.run(`
    CREATE TABLE IF NOT EXISTS prompts (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content     TEXT NOT NULL,
      icon        TEXT NOT NULL DEFAULT 'default',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)

  // Migration: add description column if missing (existing DBs)
  try {
    db.run('ALTER TABLE prompts ADD COLUMN description TEXT NOT NULL DEFAULT \'\'')
  } catch {
    // Column already exists — ignore
  }

  // Migration: add argument_hint, model, user_invocable to prompts
  // Migration: add tool_name and tool_args columns to messages
  try { db.run('ALTER TABLE messages ADD COLUMN tool_name TEXT') } catch { /* exists */ }
  try { db.run('ALTER TABLE messages ADD COLUMN tool_args TEXT') } catch { /* exists */ }

  try { db.run('ALTER TABLE prompts ADD COLUMN argument_hint TEXT') } catch { /* exists */ }
  try { db.run('ALTER TABLE prompts ADD COLUMN model TEXT') } catch { /* exists */ }
  try { db.run('ALTER TABLE prompts ADD COLUMN user_invocable INTEGER NOT NULL DEFAULT 1') } catch { /* exists */ }

  // Skill references table (1:N)
  db.run(`
    CREATE TABLE IF NOT EXISTS skill_references (
      id          TEXT PRIMARY KEY,
      skill_id    TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      content     TEXT NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_skill_refs_skill
      ON skill_references(skill_id, sort_order)
  `)

  // ── Eval tables ──

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_eval_sets (
      id          TEXT PRIMARY KEY,
      skill_id    TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT 'Default',
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_eval_sets_skill
      ON skill_eval_sets(skill_id)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_eval_cases (
      id            TEXT PRIMARY KEY,
      eval_set_id   TEXT NOT NULL REFERENCES skill_eval_sets(id) ON DELETE CASCADE,
      prompt        TEXT NOT NULL,
      expected      TEXT NOT NULL DEFAULT '',
      should_trigger INTEGER NOT NULL DEFAULT 1,
      sort_order    INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_eval_cases_set
      ON skill_eval_cases(eval_set_id, sort_order)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_eval_runs (
      id                TEXT PRIMARY KEY,
      eval_set_id       TEXT NOT NULL REFERENCES skill_eval_sets(id) ON DELETE CASCADE,
      skill_id          TEXT NOT NULL,
      skill_name        TEXT NOT NULL,
      skill_desc        TEXT NOT NULL DEFAULT '',
      skill_body        TEXT NOT NULL DEFAULT '',
      provider          TEXT NOT NULL,
      model             TEXT,
      status            TEXT NOT NULL DEFAULT 'running',
      trigger_accuracy  REAL,
      quality_mean      REAL,
      quality_stddev    REAL,
      total_cases       INTEGER NOT NULL DEFAULT 0,
      completed_cases   INTEGER NOT NULL DEFAULT 0,
      created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_eval_runs_set
      ON skill_eval_runs(eval_set_id, created_at DESC)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_eval_results (
      id                TEXT PRIMARY KEY,
      run_id            TEXT NOT NULL REFERENCES skill_eval_runs(id) ON DELETE CASCADE,
      case_id           TEXT NOT NULL REFERENCES skill_eval_cases(id) ON DELETE CASCADE,
      did_trigger       INTEGER,
      trigger_correct   INTEGER,
      response_with     TEXT,
      response_without  TEXT,
      quality_score     INTEGER,
      quality_reason    TEXT,
      feedback          TEXT,
      feedback_rating   INTEGER,
      status            TEXT NOT NULL DEFAULT 'pending'
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_eval_results_run
      ON skill_eval_results(run_id)
  `)

  // ── Seed: Skill Creator ──
  seedSkillCreator()

  // ── Seed: Preset Skills ──
  seedPresetSkills()
}

function seedSkillCreator(): void {
  const SEED_ID = 'builtin-skill-creator'
  const now = Math.floor(Date.now() / 1000)
  const existing = db.exec(`SELECT id FROM prompts WHERE id = '${SEED_ID}'`)
  const skillExists = existing.length > 0 && existing[0].values.length > 0

  if (!skillExists) {
    const name = 'Skill Creator'
    const description = 'Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill\'s description for better triggering accuracy.'
    const instructions = SKILL_CREATOR_MD

    db.run(
      'INSERT INTO prompts (id, title, description, content, argument_hint, model, user_invocable, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [SEED_ID, name, description, instructions, null, null, 1, -1, now, now]
    )
  }

  // Always seed references (skill row guaranteed to exist at this point)
  seedSkillCreatorRefs(SEED_ID)
}

function seedSkillCreatorRefs(skillId: string): void {
  const refs: Array<{ id: string; name: string; sortOrder: number; content: string }> = [
    { id: 'builtin-sc-ref-grader', name: 'agents/grader.md', sortOrder: 0, content: GRADER_AGENT_MD },
    { id: 'builtin-sc-ref-comparator', name: 'agents/comparator.md', sortOrder: 1, content: COMPARATOR_AGENT_MD },
    { id: 'builtin-sc-ref-analyzer', name: 'agents/analyzer.md', sortOrder: 2, content: ANALYZER_AGENT_MD },
    { id: 'builtin-sc-ref-schemas', name: 'references/schemas.md', sortOrder: 3, content: SCHEMAS_REF_MD },
    { id: 'builtin-sc-asset-eval-review', name: 'assets/eval_review.html', sortOrder: 4, content: EVAL_REVIEW_HTML },
    { id: 'builtin-sc-viewer-html', name: 'eval-viewer/viewer.html', sortOrder: 5, content: VIEWER_HTML },
    { id: 'builtin-sc-viewer-generate', name: 'eval-viewer/generate_review.py', sortOrder: 6, content: GENERATE_REVIEW_PY },
    { id: 'builtin-sc-script-run-eval', name: 'scripts/run_eval.py', sortOrder: 7, content: RUN_EVAL_PY },
    { id: 'builtin-sc-script-run-loop', name: 'scripts/run_loop.py', sortOrder: 8, content: RUN_LOOP_PY },
    { id: 'builtin-sc-script-aggregate', name: 'scripts/aggregate_benchmark.py', sortOrder: 9, content: AGGREGATE_BENCHMARK_PY },
    { id: 'builtin-sc-script-improve-desc', name: 'scripts/improve_description.py', sortOrder: 10, content: IMPROVE_DESCRIPTION_PY },
    { id: 'builtin-sc-script-quick-validate', name: 'scripts/quick_validate.py', sortOrder: 11, content: QUICK_VALIDATE_PY },
    { id: 'builtin-sc-script-gen-report', name: 'scripts/generate_report.py', sortOrder: 12, content: GENERATE_REPORT_PY },
    { id: 'builtin-sc-script-package', name: 'scripts/package_skill.py', sortOrder: 13, content: PACKAGE_SKILL_PY },
    { id: 'builtin-sc-script-utils', name: 'scripts/utils.py', sortOrder: 14, content: UTILS_PY }
  ]

  // Clean up old IDs from previous seeds
  try { db.run(`DELETE FROM skill_references WHERE id = 'builtin-skill-creator-schemas'`) } catch { /* ignore */ }

  for (const ref of refs) {
    const exists = db.exec(`SELECT id FROM skill_references WHERE id = '${ref.id}'`)
    if (exists.length > 0 && exists[0].values.length > 0) {
      // Update name to path format for existing refs
      db.run('UPDATE skill_references SET name = ? WHERE id = ?', [ref.name, ref.id])
      continue
    }
    db.run(
      'INSERT INTO skill_references (id, skill_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)',
      [ref.id, skillId, ref.name, ref.content, ref.sortOrder]
    )
  }
}

function seedPresetSkills(): void {
  const now = Math.floor(Date.now() / 1000)

  for (const skill of PRESET_SKILLS) {
    const existing = db.exec(`SELECT id FROM prompts WHERE id = '${skill.id}'`)
    const skillExists = existing.length > 0 && existing[0].values.length > 0

    if (!skillExists) {
      db.run(
        'INSERT INTO prompts (id, title, description, content, argument_hint, model, user_invocable, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [skill.id, skill.name, skill.description, skill.instructions, null, null, 1, skill.sortOrder, now, now]
      )
    }

    // Always seed/update references
    for (const ref of skill.refs) {
      const refExists = db.exec(`SELECT id FROM skill_references WHERE id = '${ref.id}'`)
      if (refExists.length > 0 && refExists[0].values.length > 0) {
        db.run('UPDATE skill_references SET name = ?, content = ? WHERE id = ?', [ref.name, ref.content, ref.id])
        continue
      }
      db.run(
        'INSERT INTO skill_references (id, skill_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)',
        [ref.id, skill.id, ref.name, ref.content, ref.sortOrder]
      )
    }
  }
}

// ── Reference contents (from Anthropic skill-creator repo) ──

/* eslint-disable no-useless-escape */

const GRADER_AGENT_MD = `# Grader Agent

Evaluate expectations against an execution transcript and outputs.

## Role

The Grader reviews a transcript and output files, then determines whether each expectation passes or fails. Provide clear evidence for each judgment.

You have two jobs: grade the outputs, and critique the evals themselves. A passing grade on a weak assertion is worse than useless — it creates false confidence. When you notice an assertion that's trivially satisfied, or an important outcome that no assertion checks, say so.

## Inputs

You receive these parameters in your prompt:

- **expectations**: List of expectations to evaluate (strings)
- **transcript_path**: Path to the execution transcript (markdown file)
- **outputs_dir**: Directory containing output files from execution

## Process

### Step 1: Read the Transcript

1. Read the transcript file completely
2. Note the eval prompt, execution steps, and final result
3. Identify any issues or errors documented

### Step 2: Examine Output Files

1. List files in outputs_dir
2. Read/examine each file relevant to the expectations. If outputs aren't plain text, use the inspection tools provided in your prompt — don't rely solely on what the transcript says the executor produced.
3. Note contents, structure, and quality

### Step 3: Evaluate Each Assertion

For each expectation:

1. **Search for evidence** in the transcript and outputs
2. **Determine verdict**:
   - **PASS**: Clear evidence the expectation is true AND the evidence reflects genuine task completion, not just surface-level compliance
   - **FAIL**: No evidence, or evidence contradicts the expectation, or the evidence is superficial (e.g., correct filename but empty/wrong content)
3. **Cite the evidence**: Quote the specific text or describe what you found

### Step 4: Extract and Verify Claims

Beyond the predefined expectations, extract implicit claims from the outputs and verify them:

1. **Extract claims** from the transcript and outputs:
   - Factual statements ("The form has 12 fields")
   - Process claims ("Used pypdf to fill the form")
   - Quality claims ("All fields were filled correctly")

2. **Verify each claim**:
   - **Factual claims**: Can be checked against the outputs or external sources
   - **Process claims**: Can be verified from the transcript
   - **Quality claims**: Evaluate whether the claim is justified

3. **Flag unverifiable claims**: Note claims that cannot be verified with available information

This catches issues that predefined expectations might miss.

### Step 5: Read User Notes

If \\\`{outputs_dir}/user_notes.md\\\` exists:
1. Read it and note any uncertainties or issues flagged by the executor
2. Include relevant concerns in the grading output
3. These may reveal problems even when expectations pass

### Step 6: Critique the Evals

After grading, consider whether the evals themselves could be improved. Only surface suggestions when there's a clear gap.

Good suggestions test meaningful outcomes — assertions that are hard to satisfy without actually doing the work correctly. Think about what makes an assertion *discriminating*: it passes when the skill genuinely succeeds and fails when it doesn't.

Suggestions worth raising:
- An assertion that passed but would also pass for a clearly wrong output (e.g., checking filename existence but not file content)
- An important outcome you observed — good or bad — that no assertion covers at all
- An assertion that can't actually be verified from the available outputs

Keep the bar high. The goal is to flag things the eval author would say "good catch" about, not to nitpick every assertion.

### Step 7: Write Grading Results

Save results to \\\`{outputs_dir}/../grading.json\\\` (sibling to outputs_dir).

## Grading Criteria

**PASS when**:
- The transcript or outputs clearly demonstrate the expectation is true
- Specific evidence can be cited
- The evidence reflects genuine substance, not just surface compliance

**FAIL when**:
- No evidence found for the expectation
- Evidence contradicts the expectation
- The expectation cannot be verified from available information
- The evidence is superficial — the assertion is technically satisfied but the underlying task outcome is wrong or incomplete
- The output appears to meet the assertion by coincidence rather than by actually doing the work

**When uncertain**: The burden of proof to pass is on the expectation.

### Step 8: Read Executor Metrics and Timing

1. If \\\`{outputs_dir}/metrics.json\\\` exists, read it and include in grading output
2. If \\\`{outputs_dir}/../timing.json\\\` exists, read it and include timing data

## Output Format

Write a JSON file with this structure:

\\\`\\\`\\\`json
{
  "expectations": [
    {
      "text": "The output includes the name 'John Smith'",
      "passed": true,
      "evidence": "Found in transcript Step 3: 'Extracted names: John Smith, Sarah Johnson'"
    }
  ],
  "summary": {
    "passed": 2,
    "failed": 1,
    "total": 3,
    "pass_rate": 0.67
  },
  "execution_metrics": {
    "tool_calls": { "Read": 5, "Write": 2, "Bash": 8 },
    "total_tool_calls": 15,
    "total_steps": 6,
    "errors_encountered": 0,
    "output_chars": 12450,
    "transcript_chars": 3200
  },
  "timing": {
    "executor_duration_seconds": 165.0,
    "grader_duration_seconds": 26.0,
    "total_duration_seconds": 191.0
  },
  "claims": [
    {
      "claim": "The form has 12 fillable fields",
      "type": "factual",
      "verified": true,
      "evidence": "Counted 12 fields in field_info.json"
    }
  ],
  "user_notes_summary": {
    "uncertainties": ["Used 2023 data, may be stale"],
    "needs_review": [],
    "workarounds": ["Fell back to text overlay for non-fillable fields"]
  },
  "eval_feedback": {
    "suggestions": [
      {
        "assertion": "The output includes the name 'John Smith'",
        "reason": "A hallucinated document that mentions the name would also pass"
      }
    ],
    "overall": "Assertions check presence but not correctness."
  }
}
\\\`\\\`\\\`

## Guidelines

- **Be objective**: Base verdicts on evidence, not assumptions
- **Be specific**: Quote the exact text that supports your verdict
- **Be thorough**: Check both transcript and output files
- **Be consistent**: Apply the same standard to each expectation
- **Explain failures**: Make it clear why evidence was insufficient
- **No partial credit**: Each expectation is pass or fail, not partial`

const COMPARATOR_AGENT_MD = `# Blind Comparator Agent

Compare two outputs WITHOUT knowing which skill produced them.

## Role

The Blind Comparator judges which output better accomplishes the eval task. You receive two outputs labeled A and B, but you do NOT know which skill produced which. This prevents bias toward a particular skill or approach.

Your judgment is based purely on output quality and task completion.

## Inputs

You receive these parameters in your prompt:

- **output_a_path**: Path to the first output file or directory
- **output_b_path**: Path to the second output file or directory
- **eval_prompt**: The original task/prompt that was executed
- **expectations**: List of expectations to check (optional - may be empty)

## Process

### Step 1: Read Both Outputs

1. Examine output A (file or directory)
2. Examine output B (file or directory)
3. Note the type, structure, and content of each
4. If outputs are directories, examine all relevant files inside

### Step 2: Understand the Task

1. Read the eval_prompt carefully
2. Identify what the task requires:
   - What should be produced?
   - What qualities matter (accuracy, completeness, format)?
   - What would distinguish a good output from a poor one?

### Step 3: Generate Evaluation Rubric

Based on the task, generate a rubric with two dimensions:

**Content Rubric** (what the output contains):
| Criterion | 1 (Poor) | 3 (Acceptable) | 5 (Excellent) |
|-----------|----------|----------------|---------------|
| Correctness | Major errors | Minor errors | Fully correct |
| Completeness | Missing key elements | Mostly complete | All elements present |
| Accuracy | Significant inaccuracies | Minor inaccuracies | Accurate throughout |

**Structure Rubric** (how the output is organized):
| Criterion | 1 (Poor) | 3 (Acceptable) | 5 (Excellent) |
|-----------|----------|----------------|---------------|
| Organization | Disorganized | Reasonably organized | Clear, logical structure |
| Formatting | Inconsistent/broken | Mostly consistent | Professional, polished |
| Usability | Difficult to use | Usable with effort | Easy to use |

Adapt criteria to the specific task.

### Step 4: Evaluate Each Output Against the Rubric

For each output (A and B):

1. **Score each criterion** on the rubric (1-5 scale)
2. **Calculate dimension totals**: Content score, Structure score
3. **Calculate overall score**: Average of dimension scores, scaled to 1-10

### Step 5: Check Assertions (if provided)

If expectations are provided:

1. Check each expectation against output A
2. Check each expectation against output B
3. Count pass rates for each output
4. Use expectation scores as secondary evidence (not the primary decision factor)

### Step 6: Determine the Winner

Compare A and B based on (in priority order):

1. **Primary**: Overall rubric score (content + structure)
2. **Secondary**: Assertion pass rates (if applicable)
3. **Tiebreaker**: If truly equal, declare a TIE

Be decisive - ties should be rare. One output is usually better, even if marginally.

### Step 7: Write Comparison Results

Save results to a JSON file at the path specified (or \\\`comparison.json\\\` if not specified).

## Output Format

Write a JSON file with this structure:

\\\`\\\`\\\`json
{
  "winner": "A",
  "reasoning": "Output A provides a complete solution with proper formatting and all required fields.",
  "rubric": {
    "A": {
      "content": { "correctness": 5, "completeness": 5, "accuracy": 4 },
      "structure": { "organization": 4, "formatting": 5, "usability": 4 },
      "content_score": 4.7,
      "structure_score": 4.3,
      "overall_score": 9.0
    },
    "B": {
      "content": { "correctness": 3, "completeness": 2, "accuracy": 3 },
      "structure": { "organization": 3, "formatting": 2, "usability": 3 },
      "content_score": 2.7,
      "structure_score": 2.7,
      "overall_score": 5.4
    }
  },
  "output_quality": {
    "A": {
      "score": 9,
      "strengths": ["Complete solution", "Well-formatted", "All fields present"],
      "weaknesses": ["Minor style inconsistency in header"]
    },
    "B": {
      "score": 5,
      "strengths": ["Readable output", "Correct basic structure"],
      "weaknesses": ["Missing date field", "Formatting inconsistencies", "Partial data extraction"]
    }
  },
  "expectation_results": {
    "A": { "passed": 4, "total": 5, "pass_rate": 0.80, "details": [{"text": "Output includes name", "passed": true}] },
    "B": { "passed": 3, "total": 5, "pass_rate": 0.60, "details": [{"text": "Output includes name", "passed": true}] }
  }
}
\\\`\\\`\\\`

If no expectations were provided, omit the \\\`expectation_results\\\` field entirely.

## Guidelines

- **Stay blind**: DO NOT try to infer which skill produced which output. Judge purely on output quality.
- **Be specific**: Cite specific examples when explaining strengths and weaknesses.
- **Be decisive**: Choose a winner unless outputs are genuinely equivalent.
- **Output quality first**: Assertion scores are secondary to overall task completion.
- **Explain your reasoning**: The reasoning field should make it clear why you chose the winner.
- **Handle edge cases**: If both outputs fail, pick the one that fails less badly. If both are excellent, pick the marginally better one.`

const ANALYZER_AGENT_MD = `# Post-hoc Analyzer Agent

Analyze blind comparison results to understand WHY the winner won and generate improvement suggestions.

## Role

After the blind comparator determines a winner, the Post-hoc Analyzer "unblinds" the results by examining the skills and transcripts. The goal is to extract actionable insights: what made the winner better, and how can the loser be improved?

## Inputs

You receive these parameters in your prompt:

- **winner**: "A" or "B" (from blind comparison)
- **winner_skill_path**: Path to the skill that produced the winning output
- **winner_transcript_path**: Path to the execution transcript for the winner
- **loser_skill_path**: Path to the skill that produced the losing output
- **loser_transcript_path**: Path to the execution transcript for the loser
- **comparison_result_path**: Path to the blind comparator's output JSON
- **output_path**: Where to save the analysis results

## Process

### Step 1: Read Comparison Result

1. Read the blind comparator's output at comparison_result_path
2. Note the winning side (A or B), the reasoning, and any scores
3. Understand what the comparator valued in the winning output

### Step 2: Read Both Skills

1. Read the winner skill's SKILL.md and key referenced files
2. Read the loser skill's SKILL.md and key referenced files
3. Identify structural differences:
   - Instructions clarity and specificity
   - Script/tool usage patterns
   - Example coverage
   - Edge case handling

### Step 3: Read Both Transcripts

1. Read the winner's transcript
2. Read the loser's transcript
3. Compare execution patterns:
   - How closely did each follow their skill's instructions?
   - What tools were used differently?
   - Where did the loser diverge from optimal behavior?
   - Did either encounter errors or make recovery attempts?

### Step 4: Analyze Instruction Following

For each transcript, evaluate:
- Did the agent follow the skill's explicit instructions?
- Did the agent use the skill's provided tools/scripts?
- Were there missed opportunities to leverage skill content?
- Did the agent add unnecessary steps not in the skill?

Score instruction following 1-10 and note specific issues.

### Step 5: Identify Winner Strengths

Determine what made the winner better:
- Clearer instructions that led to better behavior?
- Better scripts/tools that produced better output?
- More comprehensive examples that guided edge cases?
- Better error handling guidance?

Be specific. Quote from skills/transcripts where relevant.

### Step 6: Identify Loser Weaknesses

Determine what held the loser back:
- Ambiguous instructions that led to suboptimal choices?
- Missing tools/scripts that forced workarounds?
- Gaps in edge case coverage?
- Poor error handling that caused failures?

### Step 7: Generate Improvement Suggestions

Based on the analysis, produce actionable suggestions for improving the loser skill:
- Specific instruction changes to make
- Tools/scripts to add or modify
- Examples to include
- Edge cases to address

Prioritize by impact. Focus on changes that would have changed the outcome.

### Step 8: Write Analysis Results

Save structured analysis to \\\`{output_path}\\\`.

## Output Format

\\\`\\\`\\\`json
{
  "comparison_summary": {
    "winner": "A",
    "winner_skill": "path/to/winner/skill",
    "loser_skill": "path/to/loser/skill",
    "comparator_reasoning": "Brief summary of why comparator chose winner"
  },
  "winner_strengths": [
    "Clear step-by-step instructions for handling multi-page documents",
    "Included validation script that caught formatting errors"
  ],
  "loser_weaknesses": [
    "Vague instruction 'process the document appropriately' led to inconsistent behavior",
    "No script for validation, agent had to improvise and made errors"
  ],
  "instruction_following": {
    "winner": { "score": 9, "issues": ["Minor: skipped optional logging step"] },
    "loser": { "score": 6, "issues": ["Did not use the skill's formatting template", "Invented own approach instead of following step 3"] }
  },
  "improvement_suggestions": [
    {
      "priority": "high",
      "category": "instructions",
      "suggestion": "Replace 'process the document appropriately' with explicit steps",
      "expected_impact": "Would eliminate ambiguity that caused inconsistent behavior"
    }
  ],
  "transcript_insights": {
    "winner_execution_pattern": "Read skill -> Followed 5-step process -> Used validation script -> Fixed 2 issues -> Produced output",
    "loser_execution_pattern": "Read skill -> Unclear on approach -> Tried 3 different methods -> No validation -> Output had errors"
  }
}
\\\`\\\`\\\`

## Categories for Suggestions

| Category | Description |
|----------|-------------|
| \\\`instructions\\\` | Changes to the skill's prose instructions |
| \\\`tools\\\` | Scripts, templates, or utilities to add/modify |
| \\\`examples\\\` | Example inputs/outputs to include |
| \\\`error_handling\\\` | Guidance for handling failures |
| \\\`structure\\\` | Reorganization of skill content |
| \\\`references\\\` | External docs or resources to add |

## Priority Levels

- **high**: Would likely change the outcome of this comparison
- **medium**: Would improve quality but may not change win/loss
- **low**: Nice to have, marginal improvement

## Guidelines

- **Be specific**: Quote from skills and transcripts, don't just say "instructions were unclear"
- **Be actionable**: Suggestions should be concrete changes, not vague advice
- **Focus on skill improvements**: The goal is to improve the losing skill, not critique the agent
- **Prioritize by impact**: Which changes would most likely have changed the outcome?
- **Consider causation**: Did the skill weakness actually cause the worse output, or is it incidental?
- **Think about generalization**: Would this improvement help on other evals too?

---

# Analyzing Benchmark Results

When analyzing benchmark results, the analyzer's purpose is to **surface patterns and anomalies** across multiple runs, not suggest skill improvements.

## Role

Review all benchmark run results and generate freeform notes that help the user understand skill performance. Focus on patterns that wouldn't be visible from aggregate metrics alone.

## Process

1. Read the benchmark.json containing all run results
2. Analyze per-assertion patterns (always pass? always fail? high variance?)
3. Analyze cross-eval patterns
4. Analyze metrics patterns (time, tokens, tool_calls)
5. Generate freeform observations as a list of strings

## Output

Save notes as a JSON array of strings:

\\\`\\\`\\\`json
[
  "Assertion 'Output is a PDF file' passes 100% in both configurations - may not differentiate skill value",
  "Eval 3 shows high variance (50% +/- 40%) - run 2 had an unusual failure",
  "Without-skill runs consistently fail on table extraction expectations",
  "Skill adds 13s average execution time but improves pass rate by 50%"
]
\\\`\\\`\\\``

const SCHEMAS_REF_MD = `# JSON Schemas

This document defines the JSON schemas used by skill-creator.

---

## evals.json

Defines the evals for a skill. Located at \\\`evals/evals.json\\\` within the skill directory.

\\\`\\\`\\\`json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's example prompt",
      "expected_output": "Description of expected result",
      "files": ["evals/files/sample1.pdf"],
      "expectations": [
        "The output includes X",
        "The skill used script Y"
      ]
    }
  ]
}
\\\`\\\`\\\`

**Fields:**
- \\\`skill_name\\\`: Name matching the skill's frontmatter
- \\\`evals[].id\\\`: Unique integer identifier
- \\\`evals[].prompt\\\`: The task to execute
- \\\`evals[].expected_output\\\`: Human-readable description of success
- \\\`evals[].files\\\`: Optional list of input file paths (relative to skill root)
- \\\`evals[].expectations\\\`: List of verifiable statements

---

## history.json

Tracks version progression in Improve mode.

\\\`\\\`\\\`json
{
  "started_at": "2026-01-15T10:30:00Z",
  "skill_name": "pdf",
  "current_best": "v2",
  "iterations": [
    { "version": "v0", "parent": null, "expectation_pass_rate": 0.65, "grading_result": "baseline", "is_current_best": false },
    { "version": "v1", "parent": "v0", "expectation_pass_rate": 0.75, "grading_result": "won", "is_current_best": false },
    { "version": "v2", "parent": "v1", "expectation_pass_rate": 0.85, "grading_result": "won", "is_current_best": true }
  ]
}
\\\`\\\`\\\`

---

## grading.json

Output from the grader agent.

\\\`\\\`\\\`json
{
  "expectations": [
    { "text": "The output includes the name 'John Smith'", "passed": true, "evidence": "Found in transcript Step 3" }
  ],
  "summary": { "passed": 2, "failed": 1, "total": 3, "pass_rate": 0.67 },
  "execution_metrics": {
    "tool_calls": { "Read": 5, "Write": 2, "Bash": 8 },
    "total_tool_calls": 15, "total_steps": 6, "errors_encountered": 0,
    "output_chars": 12450, "transcript_chars": 3200
  },
  "timing": { "executor_duration_seconds": 165.0, "grader_duration_seconds": 26.0, "total_duration_seconds": 191.0 },
  "claims": [
    { "claim": "The form has 12 fillable fields", "type": "factual", "verified": true, "evidence": "Counted 12 fields" }
  ],
  "eval_feedback": {
    "suggestions": [{ "assertion": "Output includes name", "reason": "A hallucinated document would also pass" }],
    "overall": "Assertions check presence but not correctness."
  }
}
\\\`\\\`\\\`

---

## benchmark.json

Output from Benchmark mode.

\\\`\\\`\\\`json
{
  "metadata": {
    "skill_name": "pdf", "skill_path": "/path/to/pdf",
    "executor_model": "claude-sonnet-4-20250514", "analyzer_model": "most-capable-model",
    "timestamp": "2026-01-15T10:30:00Z", "evals_run": [1, 2, 3], "runs_per_configuration": 3
  },
  "runs": [
    {
      "eval_id": 1, "eval_name": "Ocean", "configuration": "with_skill", "run_number": 1,
      "result": { "pass_rate": 0.85, "passed": 6, "failed": 1, "total": 7, "time_seconds": 42.5, "tokens": 3800, "tool_calls": 18, "errors": 0 }
    }
  ],
  "run_summary": {
    "with_skill": {
      "pass_rate": { "mean": 0.85, "stddev": 0.05, "min": 0.80, "max": 0.90 },
      "time_seconds": { "mean": 45.0, "stddev": 12.0 },
      "tokens": { "mean": 3800, "stddev": 400 }
    },
    "without_skill": {
      "pass_rate": { "mean": 0.35, "stddev": 0.08 },
      "time_seconds": { "mean": 32.0, "stddev": 8.0 },
      "tokens": { "mean": 2100, "stddev": 300 }
    },
    "delta": { "pass_rate": "+0.50", "time_seconds": "+13.0", "tokens": "+1700" }
  }
}
\\\`\\\`\\\`

**Important:** The viewer reads field names exactly. Using \\\`config\\\` instead of \\\`configuration\\\`, or putting \\\`pass_rate\\\` at the top level instead of nested under \\\`result\\\`, will cause empty/zero values.

---

## comparison.json

Output from blind comparator.

\\\`\\\`\\\`json
{
  "winner": "A",
  "reasoning": "Output A provides a complete solution with proper formatting.",
  "rubric": {
    "A": { "content_score": 4.7, "structure_score": 4.3, "overall_score": 9.0 },
    "B": { "content_score": 2.7, "structure_score": 2.7, "overall_score": 5.4 }
  },
  "output_quality": {
    "A": { "score": 9, "strengths": ["Complete solution"], "weaknesses": ["Minor style inconsistency"] },
    "B": { "score": 5, "strengths": ["Readable output"], "weaknesses": ["Missing date field"] }
  }
}
\\\`\\\`\\\`

---

## analysis.json

Output from post-hoc analyzer.

\\\`\\\`\\\`json
{
  "comparison_summary": { "winner": "A", "winner_skill": "path/to/winner", "loser_skill": "path/to/loser", "comparator_reasoning": "Brief summary" },
  "winner_strengths": ["Clear step-by-step instructions"],
  "loser_weaknesses": ["Vague instruction led to inconsistent behavior"],
  "improvement_suggestions": [
    { "priority": "high", "category": "instructions", "suggestion": "Replace vague instruction with explicit steps", "expected_impact": "Would eliminate ambiguity" }
  ]
}
\\\`\\\`\\\``

const SKILL_CREATOR_MD = `# Skill Creator

A skill for creating new skills and iteratively improving them.

At a high level, the process of creating a skill goes like this:

- Decide what you want the skill to do and roughly how it should do it
- Write a draft of the skill
- Create a few test prompts and run claude-with-access-to-the-skill on them
- Help the user evaluate the results both qualitatively and quantitatively
  - While the runs happen in the background, draft some quantitative evals if there aren't any (if there are some, you can either use as is or modify if you feel something needs to change about them). Then explain them to the user (or if they already existed, explain the ones that already exist)
  - Use the \\\`eval-viewer/generate_review.py\\\` script to show the user the results for them to look at, and also let them look at the quantitative metrics
- Rewrite the skill based on feedback from the user's evaluation of the results (and also if there are any glaring flaws that become apparent from the quantitative benchmarks)
- Repeat until you're satisfied
- Expand the test set and try again at larger scale

Your job when using this skill is to figure out where the user is in this process and then jump in and help them progress through these stages. So for instance, maybe they're like "I want to make a skill for X". You can help narrow down what they mean, write a draft, write the test cases, figure out how they want to evaluate, run all the prompts, and repeat.

On the other hand, maybe they already have a draft of the skill. In this case you can go straight to the eval/iterate part of the loop.

Of course, you should always be flexible and if the user is like "I don't need to run a bunch of evaluations, just vibe with me", you can do that instead.

Then after the skill is done (but again, the order is flexible), you can also run the skill description improver, which we have a whole separate script for, to optimize the triggering of the skill.

Cool? Cool.

## Communicating with the user

The skill creator is liable to be used by people across a wide range of familiarity with coding jargon. If you haven't heard (and how could you, it's only very recently that it started), there's a trend now where the power of Claude is inspiring plumbers to open up their terminals, parents and grandparents to google "how to install npm". On the other hand, the bulk of users are probably fairly computer-literate.

So please pay attention to context cues to understand how to phrase your communication! In the default case, just to give you some idea:

- "evaluation" and "benchmark" are borderline, but OK
- for "JSON" and "assertion" you want to see serious cues from the user that they know what those things are before using them without explaining them

It's OK to briefly explain terms if you're in doubt, and feel free to clarify terms with a short definition if you're unsure if the user will get it.

---

## Creating a skill

### Capture Intent

Start by understanding the user's intent. The current conversation might already contain a workflow the user wants to capture (e.g., they say "turn this into a skill"). If so, extract answers from the conversation history first — the tools used, the sequence of steps, corrections the user made, input/output formats observed. The user may need to fill the gaps, and should confirm before proceeding to the next step.

1. What should this skill enable Claude to do?
2. When should this skill trigger? (what user phrases/contexts)
3. What's the expected output format?
4. Should we set up test cases to verify the skill works? Skills with objectively verifiable outputs (file transforms, data extraction, code generation, fixed workflow steps) benefit from test cases. Skills with subjective outputs (writing style, art) often don't need them. Suggest the appropriate default based on the skill type, but let the user decide.

### Interview and Research

Proactively ask questions about edge cases, input/output formats, example files, success criteria, and dependencies. Wait to write test prompts until you've got this part ironed out.

Check available MCPs - if useful for research (searching docs, finding similar skills, looking up best practices), research in parallel via subagents if available, otherwise inline. Come prepared with context to reduce burden on the user.

### Write the SKILL.md

Based on the user interview, fill in these components:

- **name**: Skill identifier
- **description**: When to trigger, what it does. This is the primary triggering mechanism - include both what the skill does AND specific contexts for when to use it. All "when to use" info goes here, not in the body. Note: currently Claude has a tendency to "undertrigger" skills -- to not use them when they'd be useful. To combat this, please make the skill descriptions a little bit "pushy". So for instance, instead of "How to build a simple fast dashboard to display internal Anthropic data.", you might write "How to build a simple fast dashboard to display internal Anthropic data. Make sure to use this skill whenever the user mentions dashboards, data visualization, internal metrics, or wants to display any kind of company data, even if they don't explicitly ask for a 'dashboard.'"
- **compatibility**: Required tools, dependencies (optional, rarely needed)
- **the rest of the skill :)**

### Skill Writing Guide

#### Anatomy of a Skill

\\\`\\\`\\\`
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
\\\`\\\`\\\`

#### Progressive Disclosure

Skills use a three-level loading system:
1. **Metadata** (name + description) - Always in context (~100 words)
2. **SKILL.md body** - In context whenever skill triggers (<500 lines ideal)
3. **Bundled resources** - As needed (unlimited, scripts can execute without loading)

These word counts are approximate and you can feel free to go longer if needed.

**Key patterns:**
- Keep SKILL.md under 500 lines; if you're approaching this limit, add an additional layer of hierarchy along with clear pointers about where the model using the skill should go next to follow up.
- Reference files clearly from SKILL.md with guidance on when to read them
- For large reference files (>300 lines), include a table of contents

**Domain organization**: When a skill supports multiple domains/frameworks, organize by variant:
\\\`\\\`\\\`
cloud-deploy/
├── SKILL.md (workflow + selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
\\\`\\\`\\\`
Claude reads only the relevant reference file.

#### Principle of Lack of Surprise

This goes without saying, but skills must not contain malware, exploit code, or any content that could compromise system security. A skill's contents should not surprise the user in their intent if described. Don't go along with requests to create misleading skills or skills designed to facilitate unauthorized access, data exfiltration, or other malicious activities. Things like a "roleplay as an XYZ" are OK though.

#### Writing Patterns

Prefer using the imperative form in instructions.

**Defining output formats** - You can do it like this:
\\\`\\\`\\\`markdown
## Report structure
ALWAYS use this exact template:
# [Title]
## Executive summary
## Key findings
## Recommendations
\\\`\\\`\\\`

**Examples pattern** - It's useful to include examples. You can format them like this (but if "Input" and "Output" are in the examples you might want to deviate a little):
\\\`\\\`\\\`markdown
## Commit message format
**Example 1:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
\\\`\\\`\\\`

### Writing Style

Try to explain to the model why things are important in lieu of heavy-handed musty MUSTs. Use theory of mind and try to make the skill general and not super-narrow to specific examples. Start by writing a draft and then look at it with fresh eyes and improve it.

### Test Cases

After writing the skill draft, come up with 2-3 realistic test prompts — the kind of thing a real user would actually say. Share them with the user: [you don't have to use this exact language] "Here are a few test cases I'd like to try. Do these look right, or do you want to add more?" Then run them.

Save test cases to \\\`evals/evals.json\\\`. Don't write assertions yet — just the prompts. You'll draft assertions in the next step while the runs are in progress.

\\\`\\\`\\\`json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "files": []
    }
  ]
}
\\\`\\\`\\\`

See \\\`references/schemas.md\\\` for the full schema (including the \\\`assertions\\\` field, which you'll add later).

## Running and evaluating test cases

This section is one continuous sequence — don't stop partway through. Do NOT use \\\`/skill-test\\\` or any other testing skill.

Put results in \\\`<skill-name>-workspace/\\\` as a sibling to the skill directory. Within the workspace, organize results by iteration (\\\`iteration-1/\\\`, \\\`iteration-2/\\\`, etc.) and within that, each test case gets a directory (\\\`eval-0/\\\`, \\\`eval-1/\\\`, etc.). Don't create all of this upfront — just create directories as you go.

### Step 1: Spawn all runs (with-skill AND baseline) in the same turn

For each test case, spawn two subagents in the same turn — one with the skill, one without. This is important: don't spawn the with-skill runs first and then come back for baselines later. Launch everything at once so it all finishes around the same time.

**With-skill run:**

\\\`\\\`\\\`
Execute this task:
- Skill path: <path-to-skill>
- Task: <eval prompt>
- Input files: <eval files if any, or "none">
- Save outputs to: <workspace>/iteration-<N>/eval-<ID>/with_skill/outputs/
- Outputs to save: <what the user cares about — e.g., "the .docx file", "the final CSV">
\\\`\\\`\\\`

**Baseline run** (same prompt, but the baseline depends on context):
- **Creating a new skill**: no skill at all. Same prompt, no skill path, save to \\\`without_skill/outputs/\\\`.
- **Improving an existing skill**: the old version. Before editing, snapshot the skill (\\\`cp -r <skill-path> <workspace>/skill-snapshot/\\\`), then point the baseline subagent at the snapshot. Save to \\\`old_skill/outputs/\\\`.

Write an \\\`eval_metadata.json\\\` for each test case (assertions can be empty for now). Give each eval a descriptive name based on what it's testing — not just "eval-0". Use this name for the directory too. If this iteration uses new or modified eval prompts, create these files for each new eval directory — don't assume they carry over from previous iterations.

\\\`\\\`\\\`json
{
  "eval_id": 0,
  "eval_name": "descriptive-name-here",
  "prompt": "The user's task prompt",
  "assertions": []
}
\\\`\\\`\\\`

### Step 2: While runs are in progress, draft assertions

Don't just wait for the runs to finish — you can use this time productively. Draft quantitative assertions for each test case and explain them to the user. If assertions already exist in \\\`evals/evals.json\\\`, review them and explain what they check.

Good assertions are objectively verifiable and have descriptive names — they should read clearly in the benchmark viewer so someone glancing at the results immediately understands what each one checks. Subjective skills (writing style, design quality) are better evaluated qualitatively — don't force assertions onto things that need human judgment.

Update the \\\`eval_metadata.json\\\` files and \\\`evals/evals.json\\\` with the assertions once drafted. Also explain to the user what they'll see in the viewer — both the qualitative outputs and the quantitative benchmark.

### Step 3: As runs complete, capture timing data

When each subagent task completes, you receive a notification containing \\\`total_tokens\\\` and \\\`duration_ms\\\`. Save this data immediately to \\\`timing.json\\\` in the run directory:

\\\`\\\`\\\`json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
\\\`\\\`\\\`

This is the only opportunity to capture this data — it comes through the task notification and isn't persisted elsewhere. Process each notification as it arrives rather than trying to batch them.

### Step 4: Grade, aggregate, and launch the viewer

Once all runs are done:

1. **Grade each run** — spawn a grader subagent (or grade inline) that reads \\\`agents/grader.md\\\` and evaluates each assertion against the outputs. Save results to \\\`grading.json\\\` in each run directory. The grading.json expectations array must use the fields \\\`text\\\`, \\\`passed\\\`, and \\\`evidence\\\` (not \\\`name\\\`/\\\`met\\\`/\\\`details\\\` or other variants) — the viewer depends on these exact field names. For assertions that can be checked programmatically, write and run a script rather than eyeballing it — scripts are faster, more reliable, and can be reused across iterations.

2. **Aggregate into benchmark** — run the aggregation script from the skill-creator directory:
   \\\`\\\`\\\`bash
   python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>
   \\\`\\\`\\\`
   This produces \\\`benchmark.json\\\` and \\\`benchmark.md\\\` with pass_rate, time, and tokens for each configuration, with mean ± stddev and the delta. If generating benchmark.json manually, see \\\`references/schemas.md\\\` for the exact schema the viewer expects.
Put each with_skill version before its baseline counterpart.

3. **Do an analyst pass** — read the benchmark data and surface patterns the aggregate stats might hide. See \\\`agents/analyzer.md\\\` (the "Analyzing Benchmark Results" section) for what to look for — things like assertions that always pass regardless of skill (non-discriminating), high-variance evals (possibly flaky), and time/token tradeoffs.

4. **Launch the viewer** with both qualitative outputs and quantitative data:
   \\\`\\\`\\\`bash
   nohup python <skill-creator-path>/eval-viewer/generate_review.py \\
     <workspace>/iteration-N \\
     --skill-name "my-skill" \\
     --benchmark <workspace>/iteration-N/benchmark.json \\
     > /dev/null 2>&1 &
   VIEWER_PID=$!
   \\\`\\\`\\\`
   For iteration 2+, also pass \\\`--previous-workspace <workspace>/iteration-<N-1>\\\`.

   **Cowork / headless environments:** If \\\`webbrowser.open()\\\` is not available or the environment has no display, use \\\`--static <output_path>\\\` to write a standalone HTML file instead of starting a server. Feedback will be downloaded as a \\\`feedback.json\\\` file when the user clicks "Submit All Reviews". After download, copy \\\`feedback.json\\\` into the workspace directory for the next iteration to pick up.

Note: please use generate_review.py to create the viewer; there's no need to write custom HTML.

5. **Tell the user** something like: "I've opened the results in your browser. There are two tabs — 'Outputs' lets you click through each test case and leave feedback, 'Benchmark' shows the quantitative comparison. When you're done, come back here and let me know."

### What the user sees in the viewer

The "Outputs" tab shows one test case at a time:
- **Prompt**: the task that was given
- **Output**: the files the skill produced, rendered inline where possible
- **Previous Output** (iteration 2+): collapsed section showing last iteration's output
- **Formal Grades** (if grading was run): collapsed section showing assertion pass/fail
- **Feedback**: a textbox that auto-saves as they type
- **Previous Feedback** (iteration 2+): their comments from last time, shown below the textbox

The "Benchmark" tab shows the stats summary: pass rates, timing, and token usage for each configuration, with per-eval breakdowns and analyst observations.

Navigation is via prev/next buttons or arrow keys. When done, they click "Submit All Reviews" which saves all feedback to \\\`feedback.json\\\`.

### Step 5: Read the feedback

When the user tells you they're done, read \\\`feedback.json\\\`:

\\\`\\\`\\\`json
{
  "reviews": [
    {"run_id": "eval-0-with_skill", "feedback": "the chart is missing axis labels", "timestamp": "..."},
    {"run_id": "eval-1-with_skill", "feedback": "", "timestamp": "..."},
    {"run_id": "eval-2-with_skill", "feedback": "perfect, love this", "timestamp": "..."}
  ],
  "status": "complete"
}
\\\`\\\`\\\`

Empty feedback means the user thought it was fine. Focus your improvements on the test cases where the user had specific complaints.

Kill the viewer server when you're done with it:

\\\`\\\`\\\`bash
kill $VIEWER_PID 2>/dev/null
\\\`\\\`\\\`

---

## Improving the skill

This is the heart of the loop. You've run the test cases, the user has reviewed the results, and now you need to make the skill better based on their feedback.

### How to think about improvements

1. **Generalize from the feedback.** The big picture thing that's happening here is that we're trying to create skills that can be used a million times (maybe literally, maybe even more who knows) across many different prompts. Here you and the user are iterating on only a few examples over and over again because it helps move faster. The user knows these examples in and out and it's quick for them to assess new outputs. But if the skill you and the user are codeveloping works only for those examples, it's useless. Rather than put in fiddly overfitty changes, or oppressively constrictive MUSTs, if there's some stubborn issue, you might try branching out and using different metaphors, or recommending different patterns of working. It's relatively cheap to try and maybe you'll land on something great.

2. **Keep the prompt lean.** Remove things that aren't pulling their weight. Make sure to read the transcripts, not just the final outputs — if it looks like the skill is making the model waste a bunch of time doing things that are unproductive, you can try getting rid of the parts of the skill that are making it do that and seeing what happens.

3. **Explain the why.** Try hard to explain the **why** behind everything you're asking the model to do. Today's LLMs are *smart*. They have good theory of mind and when given a good harness can go beyond rote instructions and really make things happen. Even if the feedback from the user is terse or frustrated, try to actually understand the task and why the user is writing what they wrote, and what they actually wrote, and then transmit this understanding into the instructions. If you find yourself writing ALWAYS or NEVER in all caps, or using super rigid structures, that's a yellow flag — if possible, reframe and explain the reasoning so that the model understands why the thing you're asking for is important. That's a more humane, powerful, and effective approach.

4. **Look for repeated work across test cases.** Read the transcripts from the test runs and notice if the subagents all independently wrote similar helper scripts or took the same multi-step approach to something. If all 3 test cases resulted in the subagent writing a \\\`create_docx.py\\\` or a \\\`build_chart.py\\\`, that's a strong signal the skill should bundle that script. Write it once, put it in \\\`scripts/\\\`, and tell the skill to use it. This saves every future invocation from reinventing the wheel.

This task is pretty important (we are trying to create billions a year in economic value here!) and your thinking time is not the blocker; take your time and really mull things over. I'd suggest writing a draft revision and then looking at it anew and making improvements. Really do your best to get into the head of the user and understand what they want and need.

### The iteration loop

After improving the skill:

1. Apply your improvements to the skill
2. Rerun all test cases into a new \\\`iteration-<N+1>/\\\` directory, including baseline runs. If you're creating a new skill, the baseline is always \\\`without_skill\\\` (no skill) — that stays the same across iterations. If you're improving an existing skill, use your judgment on what makes sense as the baseline: the original version the user came in with, or the previous iteration.
3. Launch the reviewer with \\\`--previous-workspace\\\` pointing at the previous iteration
4. Wait for the user to review and tell you they're done
5. Read the new feedback, improve again, repeat

Keep going until:
- The user says they're happy
- The feedback is all empty (everything looks good)
- You're not making meaningful progress

---

## Advanced: Blind comparison

For situations where you want a more rigorous comparison between two versions of a skill (e.g., the user asks "is the new version actually better?"), there's a blind comparison system. Read \\\`agents/comparator.md\\\` and \\\`agents/analyzer.md\\\` for the details. The basic idea is: give two outputs to an independent agent without telling it which is which, and let it judge quality. Then analyze why the winner won.

This is optional, requires subagents, and most users won't need it. The human review loop is usually sufficient.

---

## Description Optimization

The description field in SKILL.md frontmatter is the primary mechanism that determines whether Claude invokes a skill. After creating or improving a skill, offer to optimize the description for better triggering accuracy.

### Step 1: Generate trigger eval queries

Create 20 eval queries — a mix of should-trigger and should-not-trigger. Save as JSON:

\\\`\\\`\\\`json
[
  {"query": "the user prompt", "should_trigger": true},
  {"query": "another prompt", "should_trigger": false}
]
\\\`\\\`\\\`

The queries must be realistic and something a Claude Code or Claude.ai user would actually type. Not abstract requests, but requests that are concrete and specific and have a good amount of detail. For instance, file paths, personal context about the user's job or situation, column names and values, company names, URLs. A little bit of backstory. Some might be in lowercase or contain abbreviations or typos or casual speech. Use a mix of different lengths, and focus on edge cases rather than making them clear-cut (the user will get a chance to sign off on them).

Bad: \\\`"Format this data"\\\`, \\\`"Extract text from PDF"\\\`, \\\`"Create a chart"\\\`

Good: \\\`"ok so my boss just sent me this xlsx file (its in my downloads, called something like 'Q4 sales final FINAL v2.xlsx') and she wants me to add a column that shows the profit margin as a percentage. The revenue is in column C and costs are in column D i think"\\\`

For the **should-trigger** queries (8-10), think about coverage. You want different phrasings of the same intent — some formal, some casual. Include cases where the user doesn't explicitly name the skill or file type but clearly needs it. Throw in some uncommon use cases and cases where this skill competes with another but should win.

For the **should-not-trigger** queries (8-10), the most valuable ones are the near-misses — queries that share keywords or concepts with the skill but actually need something different. Think adjacent domains, ambiguous phrasing where a naive keyword match would trigger but shouldn't, and cases where the query touches on something the skill does but in a context where another tool is more appropriate.

The key thing to avoid: don't make should-not-trigger queries obviously irrelevant. "Write a fibonacci function" as a negative test for a PDF skill is too easy — it doesn't test anything. The negative cases should be genuinely tricky.

### Step 2: Review with user

Present the eval set to the user for review using the HTML template:

1. Read the template from \\\`assets/eval_review.html\\\`
2. Replace the placeholders:
   - \\\`__EVAL_DATA_PLACEHOLDER__\\\` → the JSON array of eval items (no quotes around it — it's a JS variable assignment)
   - \\\`__SKILL_NAME_PLACEHOLDER__\\\` → the skill's name
   - \\\`__SKILL_DESCRIPTION_PLACEHOLDER__\\\` → the skill's current description
3. Write to a temp file (e.g., \\\`/tmp/eval_review_<skill-name>.html\\\`) and open it: \\\`open /tmp/eval_review_<skill-name>.html\\\`
4. The user can edit queries, toggle should-trigger, add/remove entries, then click "Export Eval Set"
5. The file downloads to \\\`~/Downloads/eval_set.json\\\` — check the Downloads folder for the most recent version in case there are multiple (e.g., \\\`eval_set (1).json\\\`)

This step matters — bad eval queries lead to bad descriptions.

### Step 3: Run the optimization loop

Tell the user: "This will take some time — I'll run the optimization loop in the background and check on it periodically."

Save the eval set to the workspace, then run in the background:

\\\`\\\`\\\`bash
python -m scripts.run_loop \\
  --eval-set <path-to-trigger-eval.json> \\
  --skill-path <path-to-skill> \\
  --model <model-id-powering-this-session> \\
  --max-iterations 5 \\
  --verbose
\\\`\\\`\\\`

Use the model ID from your system prompt (the one powering the current session) so the triggering test matches what the user actually experiences.

While it runs, periodically tail the output to give the user updates on which iteration it's on and what the scores look like.

This handles the full optimization loop automatically. It splits the eval set into 60% train and 40% held-out test, evaluates the current description (running each query 3 times to get a reliable trigger rate), then calls Claude to propose improvements based on what failed. It re-evaluates each new description on both train and test, iterating up to 5 times. When it's done, it opens an HTML report in the browser showing the results per iteration and returns JSON with \\\`best_description\\\` — selected by test score rather than train score to avoid overfitting.

### How skill triggering works

Understanding the triggering mechanism helps design better eval queries. Skills appear in Claude's \\\`available_skills\\\` list with their name + description, and Claude decides whether to consult a skill based on that description. The important thing to know is that Claude only consults skills for tasks it can't easily handle on its own — simple, one-step queries like "read this PDF" may not trigger a skill even if the description matches perfectly, because Claude can handle them directly with basic tools. Complex, multi-step, or specialized queries reliably trigger skills when the description matches.

This means your eval queries should be substantive enough that Claude would actually benefit from consulting a skill. Simple queries like "read file X" are poor test cases — they won't trigger skills regardless of description quality.

### Step 4: Apply the result

Take \\\`best_description\\\` from the JSON output and update the skill's SKILL.md frontmatter. Show the user before/after and report the scores.

---

### Package and Present (only if \\\`present_files\\\` tool is available)

Check whether you have access to the \\\`present_files\\\` tool. If you don't, skip this step. If you do, package the skill and present the .skill file to the user:

\\\`\\\`\\\`bash
python -m scripts.package_skill <path/to/skill-folder>
\\\`\\\`\\\`

After packaging, direct the user to the resulting \\\`.skill\\\` file path so they can install it.

---

## Claude.ai-specific instructions

In Claude.ai, the core workflow is the same (draft → test → review → improve → repeat), but because Claude.ai doesn't have subagents, some mechanics change. Here's what to adapt:

**Running test cases**: No subagents means no parallel execution. For each test case, read the skill's SKILL.md, then follow its instructions to accomplish the test prompt yourself. Do them one at a time. This is less rigorous than independent subagents (you wrote the skill and you're also running it, so you have full context), but it's a useful sanity check — and the human review step compensates. Skip the baseline runs — just use the skill to complete the task as requested.

**Reviewing results**: If you can't open a browser (e.g., Claude.ai's VM has no display, or you're on a remote server), skip the browser reviewer entirely. Instead, present results directly in the conversation. For each test case, show the prompt and the output. If the output is a file the user needs to see (like a .docx or .xlsx), save it to the filesystem and tell them where it is so they can download and inspect it. Ask for feedback inline: "How does this look? Anything you'd change?"

**Benchmarking**: Skip the quantitative benchmarking — it relies on baseline comparisons which aren't meaningful without subagents. Focus on qualitative feedback from the user.

**The iteration loop**: Same as before — improve the skill, rerun the test cases, ask for feedback — just without the browser reviewer in the middle. You can still organize results into iteration directories on the filesystem if you have one.

**Description optimization**: This section requires the \\\`claude\\\` CLI tool (specifically \\\`claude -p\\\`) which is only available in Claude Code. Skip it if you're on Claude.ai.

**Blind comparison**: Requires subagents. Skip it.

**Packaging**: The \\\`package_skill.py\\\` script works anywhere with Python and a filesystem. On Claude.ai, you can run it and the user can download the resulting \\\`.skill\\\` file.

**Updating an existing skill**: The user might be asking you to update an existing skill, not create a new one. In this case:
- **Preserve the original name.** Note the skill's directory name and \\\`name\\\` frontmatter field -- use them unchanged. E.g., if the installed skill is \\\`research-helper\\\`, output \\\`research-helper.skill\\\` (not \\\`research-helper-v2\\\`).
- **Copy to a writeable location before editing.** The installed skill path may be read-only. Copy to \\\`/tmp/skill-name/\\\`, edit there, and package from the copy.
- **If packaging manually, stage in \\\`/tmp/\\\` first**, then copy to the output directory -- direct writes may fail due to permissions.

---

## Cowork-Specific Instructions

If you're in Cowork, the main things to know are:

- You have subagents, so the main workflow (spawn test cases in parallel, run baselines, grade, etc.) all works. (However, if you run into severe problems with timeouts, it's OK to run the test prompts in series rather than parallel.)
- You don't have a browser or display, so when generating the eval viewer, use \\\`--static <output_path>\\\` to write a standalone HTML file instead of starting a server. Then proffer a link that the user can click to open the HTML in their browser.
- For whatever reason, the Cowork setup seems to disincline Claude from generating the eval viewer after running the tests, so just to reiterate: whether you're in Cowork or in Claude Code, after running tests, you should always generate the eval viewer for the human to look at examples before revising the skill yourself and trying to make corrections, using \\\`generate_review.py\\\` (not writing your own boutique html code). Sorry in advance but I'm gonna go all caps here: GENERATE THE EVAL VIEWER *BEFORE* evaluating inputs yourself. You want to get them in front of the human ASAP!
- Feedback works differently: since there's no running server, the viewer's "Submit All Reviews" button will download \\\`feedback.json\\\` as a file. You can then read it from there (you may have to request access first).
- Packaging works — \\\`package_skill.py\\\` just needs Python and a filesystem.
- Description optimization (\\\`run_loop.py\\\` / \\\`run_eval.py\\\`) should work in Cowork just fine since it uses \\\`claude -p\\\` via subprocess, not a browser, but please save it until you've fully finished making the skill and the user agrees it's in good shape.
- **Updating an existing skill**: The user might be asking you to update an existing skill, not create a new one. Follow the update guidance in the claude.ai section above.

---

## Reference files

The agents/ directory contains instructions for specialized subagents. Read them when you need to spawn the relevant subagent.

- \\\`agents/grader.md\\\` — How to evaluate assertions against outputs
- \\\`agents/comparator.md\\\` — How to do blind A/B comparison between two outputs
- \\\`agents/analyzer.md\\\` — How to analyze why one version beat another

The references/ directory has additional documentation:
- \\\`references/schemas.md\\\` — JSON structures for evals.json, grading.json, etc.

---

Repeating one more time the core loop here for emphasis:

- Figure out what the skill is about
- Draft or edit the skill
- Run claude-with-access-to-the-skill on test prompts
- With the user, evaluate the outputs:
  - Create benchmark.json and run \\\`eval-viewer/generate_review.py\\\` to help the user review them
  - Run quantitative evals
- Repeat until you and the user are satisfied
- Package the final skill and return it to the user.

Please add steps to your TodoList, if you have such a thing, to make sure you don't forget. If you're in Cowork, please specifically put "Create evals JSON and run \\\`eval-viewer/generate_review.py\\\` so human can review test cases" in your TodoList to make sure it happens.

Good luck!`
