import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'

interface OptimizeCandidate {
  description: string
  reasoning: string
  triggerAccuracy: number | null
}

interface Props {
  skillId: string
  evalSetId: string
}

export function DescriptionOptimizer({ skillId, evalSetId }: Props) {
  const { activeProvider, activeModel } = useAppStore()
  const [currentDesc, setCurrentDesc] = useState('')
  const [candidates, setCandidates] = useState<OptimizeCandidate[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [step, setStep] = useState('')
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null)
  const [applied, setApplied] = useState<string | null>(null)

  useEffect(() => {
    loadSkill()
  }, [skillId])

  const loadSkill = async () => {
    const skill = await window.api.prompts.get(skillId) as { description: string; name: string; instructions: string; argumentHint?: string | null; model?: string | null; userInvocable: boolean } | null
    if (skill) setCurrentDesc(skill.description)
  }

  const handleOptimize = async () => {
    setIsRunning(true)
    setCandidates([])
    setStep('Starting optimization...')
    setCurrentAccuracy(null)

    const unsubProgress = window.api.eval.onOptimizeProgress((data) => {
      setStep(data.step)
      if (data.step === 'current-result' && 'accuracy' in data) {
        setCurrentAccuracy(data.accuracy as number)
      }
    })

    const unsubComplete = window.api.eval.onOptimizeComplete((data) => {
      setCandidates(data.candidates as OptimizeCandidate[])
      setIsRunning(false)
      setStep('')
    })

    try {
      await window.api.eval.optimizeStart(skillId, evalSetId, activeProvider, activeModel)
    } catch (err) {
      setStep(`Error: ${(err as Error).message}`)
      setIsRunning(false)
    }

    return () => {
      unsubProgress()
      unsubComplete()
    }
  }

  const handleApply = async (description: string) => {
    const skill = await window.api.prompts.get(skillId) as { description: string; name: string; instructions: string; argumentHint?: string | null; model?: string | null; userInvocable: boolean } | null
    if (!skill) return
    await window.api.prompts.update(skillId, skill.name, description, skill.instructions, skill.argumentHint ?? undefined, skill.model ?? undefined, skill.userInvocable)
    setCurrentDesc(description)
    setApplied(description)
  }

  const stepLabels: Record<string, string> = {
    'testing-current': 'Testing current description...',
    'current-result': 'Current description tested',
    'generating-candidates': 'Generating candidate descriptions...',
    'testing-candidate': 'Testing candidate...',
    'candidate-result': 'Candidate tested'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current description */}
      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Current Description
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {currentDesc || '(empty)'}
        </div>
        {currentAccuracy !== null && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            Trigger accuracy: <span style={{ fontWeight: 600, color: currentAccuracy >= 0.8 ? 'var(--success-text)' : currentAccuracy >= 0.5 ? 'var(--warning)' : 'var(--danger-text)' }}>
              {Math.round(currentAccuracy * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Optimize button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleOptimize}
          disabled={isRunning}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
            fontSize: 13, fontWeight: 500, cursor: isRunning ? 'wait' : 'pointer',
            opacity: isRunning ? 0.6 : 1
          }}
        >
          {isRunning ? 'Optimizing...' : 'Optimize Description'}
        </button>
        {step && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {stepLabels[step] || step}
          </span>
        )}
      </div>

      {/* Candidates */}
      {candidates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Candidates</div>
          {candidates.map((c, i) => (
            <div key={i} style={{
              padding: '14px 16px', borderRadius: 12,
              background: applied === c.description ? 'rgba(16,185,129,0.06)' : 'var(--bg-surface)',
              border: `1px solid ${applied === c.description ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 6 }}>
                {c.description}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 8 }}>
                {c.reasoning}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Accuracy: <span style={{
                    fontWeight: 600,
                    color: (c.triggerAccuracy ?? 0) >= 0.8 ? 'var(--success-text)' : (c.triggerAccuracy ?? 0) >= 0.5 ? 'var(--warning)' : 'var(--danger-text)'
                  }}>
                    {c.triggerAccuracy !== null ? `${Math.round(c.triggerAccuracy * 100)}%` : '...'}
                  </span>
                  {currentAccuracy !== null && c.triggerAccuracy !== null && (
                    <span style={{
                      marginLeft: 6, fontSize: 11,
                      color: c.triggerAccuracy > currentAccuracy ? 'var(--success-text)' : c.triggerAccuracy < currentAccuracy ? 'var(--danger-text)' : 'var(--text-muted)'
                    }}>
                      {c.triggerAccuracy > currentAccuracy ? '\u25B2' : c.triggerAccuracy < currentAccuracy ? '\u25BC' : '='} vs current
                    </span>
                  )}
                </span>
                <button
                  onClick={() => handleApply(c.description)}
                  disabled={applied === c.description}
                  style={{
                    padding: '5px 14px', borderRadius: 6, border: 'none',
                    background: applied === c.description ? 'rgba(16,185,129,0.15)' : 'var(--accent)',
                    color: applied === c.description ? 'var(--success-text)' : 'white',
                    fontSize: 12, fontWeight: 500, cursor: applied === c.description ? 'default' : 'pointer'
                  }}
                >
                  {applied === c.description ? 'Applied' : 'Apply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
