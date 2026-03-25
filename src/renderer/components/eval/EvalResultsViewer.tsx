import { useState, useEffect, useCallback } from 'react'

interface EvalResult {
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
  status: string
}

interface EvalCase {
  id: string
  prompt: string
  expected: string
  shouldTrigger: boolean
}

interface Props {
  runId: string
}

export function EvalResultsViewer({ runId }: Props) {
  const [results, setResults] = useState<EvalResult[]>([])
  const [cases, setCases] = useState<Map<string, EvalCase>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState(0)

  useEffect(() => {
    loadData()
  }, [runId])

  const loadData = async () => {
    const r = await window.api.eval.runResults(runId) as EvalResult[]
    setResults(r)

    const run = await window.api.eval.runGet(runId) as { evalSetId: string } | null
    if (run) {
      const c = await window.api.eval.caseList(run.evalSetId) as EvalCase[]
      const map = new Map<string, EvalCase>()
      for (const cas of c) map.set(cas.id, cas)
      setCases(map)
    }
  }

  const current = results[currentIndex]
  const currentCase = current ? cases.get(current.caseId) : null

  useEffect(() => {
    if (current) {
      setFeedback(current.feedback || '')
      setRating(current.feedbackRating || 0)
    }
  }, [currentIndex, current?.id])

  const navigate = useCallback((dir: number) => {
    setCurrentIndex(i => Math.max(0, Math.min(results.length - 1, i + dir)))
  }, [results.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigate(-1)
      if (e.key === 'ArrowRight') navigate(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const handleSaveFeedback = async () => {
    if (!current) return
    await window.api.eval.resultFeedback(current.id, feedback, rating)
    setResults(results.map(r => r.id === current.id ? { ...r, feedback, feedbackRating: rating } : r))
  }

  if (results.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No results to display</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => navigate(-1)}
          disabled={currentIndex === 0}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: 'var(--bg-hover)', color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
            fontSize: 13, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentIndex === 0 ? 0.4 : 1
          }}
        >
          Prev
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Case {currentIndex + 1} / {results.length}
        </span>
        <button
          onClick={() => navigate(1)}
          disabled={currentIndex === results.length - 1}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: 'var(--bg-hover)', color: currentIndex === results.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
            fontSize: 13, cursor: currentIndex === results.length - 1 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === results.length - 1 ? 0.4 : 1
          }}
        >
          Next
        </button>
      </div>

      {current && currentCase && (
        <>
          {/* Query + meta */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>USER QUERY</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{currentCase.prompt}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                background: current.triggerCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: current.triggerCorrect ? 'var(--success-text)' : 'var(--danger-text)'
              }}>
                {current.triggerCorrect ? 'TRIGGER CORRECT' : 'TRIGGER WRONG'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Expected: {currentCase.shouldTrigger ? 'trigger' : 'no trigger'} | Actual: {current.didTrigger ? 'triggered' : 'not triggered'}
              </span>
              {current.qualityScore !== null && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Quality: {current.qualityScore}/5
                </span>
              )}
            </div>
            {current.qualityReason && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                {current.qualityReason}
              </div>
            )}
          </div>

          {/* Side-by-side responses */}
          {(current.responseWith || current.responseWithout) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.12)',
                maxHeight: 400, overflow: 'auto'
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success-text)', marginBottom: 8 }}>WITH SKILL</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {current.responseWith || '(no response)'}
                </div>
              </div>
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                maxHeight: 400, overflow: 'auto'
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>WITHOUT SKILL</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {current.responseWithout || '(no response)'}
                </div>
              </div>
            </div>
          )}

          {/* Feedback */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>FEEDBACK</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: 'none',
                    background: rating === n ? 'var(--accent)' : 'var(--bg-hover)',
                    color: rating === n ? 'white' : 'var(--text-muted)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Notes about this result..."
                rows={2}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  background: 'var(--bg-main)', border: '1px solid var(--border)',
                  fontSize: 12.5, color: 'var(--text-primary)', outline: 'none',
                  fontFamily: 'inherit', resize: 'vertical'
                }}
                className="placeholder-[var(--text-muted)]"
              />
              <button
                onClick={handleSaveFeedback}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: 'white',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', alignSelf: 'flex-end'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
