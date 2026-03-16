import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'

interface EvalResultItem {
  caseId: string
  didTrigger: boolean
  triggerCorrect: boolean
  qualityScore: number | null
  qualityReason: string | null
}

interface Props {
  runId: string
  onComplete: (runId: string) => void
  onStop: () => void
}

export function EvalRunner({ runId, onComplete, onStop }: Props) {
  const { evalProgress, setEvalProgress, setEvalIsRunning } = useAppStore()
  const [results, setResults] = useState<EvalResultItem[]>([])
  const [status, setStatus] = useState<'running' | 'completed' | 'stopped' | 'error'>('running')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEvalIsRunning(true)

    const unsubProgress = window.api.eval.onProgress((data) => {
      if (data.runId !== runId) return
      setEvalProgress({ caseIndex: data.caseIndex + 1, totalCases: data.totalCases })
      setResults(prev => [...prev, data.result as EvalResultItem])
    })

    const unsubComplete = window.api.eval.onRunComplete((data: { runId: string }) => {
      if (data.runId !== runId) return
      setStatus('completed')
      setEvalIsRunning(false)
      setEvalProgress(null)
      onComplete(data.runId)
    })

    const unsubError = window.api.eval.onRunError((data: { runId: string; error: string }) => {
      if (data.runId !== runId) return
      setStatus('error')
      setError(data.error)
      setEvalIsRunning(false)
      setEvalProgress(null)
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [runId])

  const handleStop = async () => {
    await window.api.eval.runStop(runId)
    setStatus('stopped')
    setEvalIsRunning(false)
    setEvalProgress(null)
    onStop()
  }

  const progressPct = evalProgress
    ? Math.round((evalProgress.caseIndex / evalProgress.totalCases) * 100)
    : 0

  const correctCount = results.filter(r => r.triggerCorrect).length
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Progress bar */}
      <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {status === 'running' ? 'Running Eval...' : status === 'completed' ? 'Eval Complete' : status === 'stopped' ? 'Eval Stopped' : 'Eval Error'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {evalProgress ? `${evalProgress.caseIndex}/${evalProgress.totalCases}` : `${results.length} done`}
            </span>
            {status === 'running' && (
              <button
                onClick={handleStop}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: 'rgba(239,68,68,0.1)', color: '#f87171',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer'
                }}
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: status === 'error' ? '#f87171' : '#10b981',
            width: `${progressPct}%`,
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trigger Accuracy</span>
            <div style={{ fontSize: 16, fontWeight: 600, color: accuracy >= 80 ? '#34d399' : accuracy >= 50 ? '#fbbf24' : '#f87171' }}>
              {accuracy}%
            </div>
          </div>
          {results.some(r => r.qualityScore !== null) && (
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Quality</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                {(results.filter(r => r.qualityScore !== null).reduce((a, r) => a + (r.qualityScore ?? 0), 0) / results.filter(r => r.qualityScore !== null).length).toFixed(1)}/5
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', fontSize: 12, color: '#f87171' }}>
            {error}
          </div>
        )}
      </div>

      {/* Results list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {results.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            background: r.triggerCorrect ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
            border: `1px solid ${r.triggerCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>
              {r.triggerCorrect ? '\u2713' : '\u2717'}
            </span>
            <span style={{ fontSize: 12, color: r.triggerCorrect ? '#34d399' : '#f87171', fontWeight: 500, flexShrink: 0 }}>
              {r.triggerCorrect ? 'CORRECT' : 'WRONG'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
              trigger: {r.didTrigger ? 'yes' : 'no'}
            </span>
            {r.qualityScore !== null && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
                quality: {r.qualityScore}/5
              </span>
            )}
            {r.qualityReason && (
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.qualityReason}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
