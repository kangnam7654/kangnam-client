import { useState, useEffect } from 'react'

interface EvalRun {
  id: string
  evalSetId: string
  skillId: string
  skillName: string
  skillDesc: string
  provider: string
  model: string | null
  status: string
  triggerAccuracy: number | null
  qualityMean: number | null
  qualityStddev: number | null
  totalCases: number
  completedCases: number
  createdAt: number
}

interface Props {
  evalSetId: string
  onViewRun: (runId: string) => void
}

export function EvalBenchmark({ evalSetId, onViewRun }: Props) {
  const [runs, setRuns] = useState<EvalRun[]>([])
  const [loading, setLoading] = useState(false)

  const loadRuns = async () => {
    setLoading(true)
    try {
      const r = await window.api.eval.runList(evalSetId)
      setRuns(r)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRuns() }, [evalSetId])

  const handleDelete = async (id: string) => {
    await window.api.eval.runDelete(id)
    setRuns(runs.filter(r => r.id !== id))
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getDelta = (current: number | null, prev: number | null): string | null => {
    if (current === null || prev === null) return null
    const diff = current - prev
    if (Math.abs(diff) < 0.001) return null
    return diff > 0 ? `+${(diff * 100).toFixed(1)}%` : `${(diff * 100).toFixed(1)}%`
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  }

  if (runs.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No eval runs yet. Go to Test Cases tab and run an eval.
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 80px 90px 80px 60px 40px',
        gap: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        <span>Date</span>
        <span>Provider</span>
        <span>Status</span>
        <span>Trigger %</span>
        <span>Quality</span>
        <span>Cases</span>
        <span />
      </div>

      {runs.map((run, idx) => {
        const prevRun = idx < runs.length - 1 ? runs[idx + 1] : null
        const triggerDelta = getDelta(run.triggerAccuracy, prevRun?.triggerAccuracy ?? null)
        const qualityDelta = run.qualityMean !== null && prevRun?.qualityMean !== null
          ? getDelta(run.qualityMean ? run.qualityMean / 5 : null, prevRun?.qualityMean ? prevRun.qualityMean / 5 : null)
          : null

        return (
          <div
            key={run.id}
            onClick={() => onViewRun(run.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 80px 90px 80px 60px 40px',
              gap: 0, padding: '10px 14px', cursor: 'pointer',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              transition: 'background 0.1s'
            }}
            className="hover:bg-[rgba(255,255,255,0.03)]"
          >
            <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{formatDate(run.createdAt)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{run.provider}</span>
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: run.status === 'completed' ? '#34d399' : run.status === 'running' ? '#60a5fa' : run.status === 'stopped' ? '#fbbf24' : '#f87171'
            }}>
              {run.status}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
              {run.triggerAccuracy !== null ? `${Math.round(run.triggerAccuracy * 100)}%` : '-'}
              {triggerDelta && (
                <span style={{
                  fontSize: 10, marginLeft: 4,
                  color: triggerDelta.startsWith('+') ? '#34d399' : '#f87171'
                }}>
                  {triggerDelta.startsWith('+') ? '\u25B2' : '\u25BC'}{triggerDelta}
                </span>
              )}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
              {run.qualityMean !== null ? `${run.qualityMean.toFixed(1)}/5` : '-'}
              {qualityDelta && (
                <span style={{
                  fontSize: 10, marginLeft: 4,
                  color: qualityDelta.startsWith('+') ? '#34d399' : '#f87171'
                }}>
                  {qualityDelta.startsWith('+') ? '\u25B2' : '\u25BC'}{qualityDelta}
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {run.completedCases}/{run.totalCases}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(run.id) }}
              style={{
                width: 22, height: 22, borderRadius: 4, border: 'none',
                background: 'transparent', color: 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              className="hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger)]"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
