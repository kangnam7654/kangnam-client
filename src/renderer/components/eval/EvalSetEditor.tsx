import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'

interface EvalCase {
  id: string
  evalSetId: string
  prompt: string
  expected: string
  shouldTrigger: boolean
  sortOrder: number
}

interface Props {
  evalSetId: string
  skillId: string
  onRunEval: () => void
}

export function EvalSetEditor({ evalSetId, skillId, onRunEval }: Props) {
  const { activeProvider, activeModel } = useAppStore()
  const [cases, setCases] = useState<EvalCase[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const loadCases = async () => {
    setLoading(true)
    try {
      const result = await window.api.eval.caseList(evalSetId) as EvalCase[]
      setCases(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCases() }, [evalSetId])

  const triggerCases = cases.filter(c => c.shouldTrigger)
  const noTriggerCases = cases.filter(c => !c.shouldTrigger)

  const handleAdd = async (shouldTrigger: boolean) => {
    const newCase = await window.api.eval.caseAdd(evalSetId, '', '', shouldTrigger) as EvalCase
    setCases([...cases, newCase])
  }

  const handleUpdate = async (id: string, field: 'prompt' | 'expected', value: string) => {
    setCases(cases.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const handleSave = async (c: EvalCase) => {
    await window.api.eval.caseUpdate(c.id, c.prompt, c.expected, c.shouldTrigger)
  }

  const handleDelete = async (id: string) => {
    await window.api.eval.caseDelete(id)
    setCases(cases.filter(c => c.id !== id))
  }

  const handleToggle = async (c: EvalCase) => {
    const updated = { ...c, shouldTrigger: !c.shouldTrigger }
    await window.api.eval.caseUpdate(c.id, c.prompt, c.expected, updated.shouldTrigger)
    setCases(cases.map(x => x.id === c.id ? updated : x))
  }

  const handleAiGenerate = async () => {
    setGenerating(true)
    try {
      const skill = await window.api.prompts.get(skillId) as { name: string; description: string; instructions: string } | null
      if (!skill) return
      const testCases = await window.api.eval.aiGenerate(
        { name: skill.name, description: skill.description, instructions: skill.instructions },
        activeProvider, activeModel
      ) as Array<{ prompt: string; expectedBehavior: string; shouldTrigger: boolean }>
      const mapped = testCases.map((tc: { prompt: string; expectedBehavior: string; shouldTrigger: boolean }) => ({
        prompt: tc.prompt,
        expected: tc.expectedBehavior,
        shouldTrigger: tc.shouldTrigger
      }))
      const added = await window.api.eval.caseBulkAdd(evalSetId, mapped) as EvalCase[]
      setCases([...cases, ...added])
    } finally {
      setGenerating(false)
    }
  }

  const renderCaseCard = (c: EvalCase) => (
    <div key={c.id} style={{
      padding: '10px 12px', borderRadius: 10, background: 'var(--bg-main)',
      border: '1px solid var(--border)', position: 'relative'
    }}>
      <div style={{ display: 'flex', gap: 6, position: 'absolute', top: 8, right: 8 }}>
        <button
          onClick={() => handleToggle(c)}
          title={c.shouldTrigger ? 'Move to Should NOT Trigger' : 'Move to Should Trigger'}
          style={{
            width: 22, height: 22, borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          className="hover:bg-[rgba(255,255,255,0.06)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 13 12 18 17 13" /><polyline points="7 6 12 11 17 6" />
          </svg>
        </button>
        <button
          onClick={() => handleDelete(c.id)}
          style={{
            width: 22, height: 22, borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          className="hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <textarea
        value={c.prompt}
        onChange={e => handleUpdate(c.id, 'prompt', e.target.value)}
        onBlur={() => handleSave(c)}
        placeholder="User query..."
        rows={2}
        style={{
          width: 'calc(100% - 50px)', padding: '6px 0', background: 'transparent', border: 'none',
          fontSize: 13, color: 'var(--text-primary)', outline: 'none',
          fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5
        }}
        className="placeholder-[var(--text-muted)]"
      />
      <input
        value={c.expected}
        onChange={e => handleUpdate(c.id, 'expected', e.target.value)}
        onBlur={() => handleSave(c)}
        placeholder="Expected behavior..."
        style={{
          width: '100%', padding: '4px 0', background: 'transparent',
          border: 'none', borderTop: '1px solid var(--border)',
          fontSize: 12, color: 'var(--text-secondary)', outline: 'none',
          fontFamily: 'inherit', marginTop: 4
        }}
        className="placeholder-[var(--text-muted)]"
      />
    </div>
  )

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleAiGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
              fontSize: 13, fontWeight: 500, cursor: generating ? 'wait' : 'pointer',
              opacity: generating ? 0.6 : 1
            }}
          >
            {generating ? 'Generating...' : 'AI Generate'}
          </button>
        </div>
        <button
          onClick={onRunEval}
          disabled={cases.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: '#10b981', color: 'white',
            fontSize: 13, fontWeight: 500, cursor: cases.length === 0 ? 'not-allowed' : 'pointer',
            opacity: cases.length === 0 ? 0.4 : 1
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Run Eval ({cases.length} cases)
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Should Trigger */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>
              Should Trigger ({triggerCases.length})
            </span>
            <button
              onClick={() => handleAdd(true)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: 'rgba(16,185,129,0.1)', color: '#34d399',
                fontSize: 12, cursor: 'pointer'
              }}
            >
              + Add
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {triggerCases.map(renderCaseCard)}
            {triggerCases.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, borderRadius: 10, border: '1px dashed var(--border)' }}>
                No trigger cases yet
              </div>
            )}
          </div>
        </div>

        {/* Should NOT Trigger */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>
              Should NOT Trigger ({noTriggerCases.length})
            </span>
            <button
              onClick={() => handleAdd(false)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: 'rgba(239,68,68,0.1)', color: '#f87171',
                fontSize: 12, cursor: 'pointer'
              }}
            >
              + Add
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {noTriggerCases.map(renderCaseCard)}
            {noTriggerCases.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, borderRadius: 10, border: '1px dashed var(--border)' }}>
                No negative cases yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
