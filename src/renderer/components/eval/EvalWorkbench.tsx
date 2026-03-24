import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { EvalSetEditor } from './EvalSetEditor'
import { EvalRunner } from './EvalRunner'
import { EvalResultsViewer } from './EvalResultsViewer'
import { EvalBenchmark } from './EvalBenchmark'
import { DescriptionOptimizer } from './DescriptionOptimizer'

interface EvalSet {
  id: string
  skillId: string
  name: string
}

interface Skill {
  id: string
  name: string
  description: string
  instructions: string
}

type SubView = 'editor' | 'running' | 'results'

export function EvalWorkbench() {
  const {
    showEval, setShowEval,
    evalSelectedSkillId, evalActiveTab, setEvalActiveTab,
    evalActiveRunId, setEvalActiveRunId, activeProvider, activeModel, prompts
  } = useAppStore()

  const [skill, setSkill] = useState<Skill | null>(null)
  const [evalSet, setEvalSet] = useState<EvalSet | null>(null)
  const [subView, setSubView] = useState<SubView>('editor')
  const [runningRunId, setRunningRunId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (showEval && evalSelectedSkillId) loadSkillAndSet()
  }, [showEval, evalSelectedSkillId])

  const loadSkillAndSet = async () => {
    if (!evalSelectedSkillId) return
    setLoading(true)
    try {
      const s = await window.api.prompts.get(evalSelectedSkillId) as Skill | null
      setSkill(s)

      // Get or create default eval set
      const sets = await window.api.eval.setList(evalSelectedSkillId) as EvalSet[]
      if (sets.length > 0) {
        setEvalSet(sets[0])
      } else {
        const newSet = await window.api.eval.setCreate(evalSelectedSkillId, 'Default') as EvalSet
        setEvalSet(newSet)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setShowEval(false)
    setSubView('editor')
    setRunningRunId(null)
  }

  const handleRunEval = async () => {
    if (!evalSet || !skill) return
    const run = await window.api.eval.runStart(evalSet.id, skill.id, activeProvider, activeModel) as { id: string }
    setRunningRunId(run.id)
    setSubView('running')
  }

  const handleRunComplete = (runId: string) => {
    setEvalActiveRunId(runId)
    setSubView('results')
  }

  const handleRunStop = () => {
    setSubView('editor')
    setRunningRunId(null)
  }

  const handleViewRun = (runId: string) => {
    setEvalActiveRunId(runId)
    setSubView('results')
  }

  if (!showEval) return null

  const selectedSkill = prompts.find(p => p.id === evalSelectedSkillId)

  const tabs = [
    { id: 'editor' as const, label: 'Test Cases' },
    { id: 'history' as const, label: 'Run History' },
    { id: 'optimize' as const, label: 'Optimize' }
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)'
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: 800, maxHeight: '90vh',
          background: 'var(--bg-sidebar)', borderRadius: 16,
          border: '1px solid var(--border)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              Skill Eval
            </span>
            {(selectedSkill || skill) && (
              <span style={{
                fontSize: 12, color: 'var(--text-muted)', padding: '2px 8px',
                borderRadius: 5, background: 'rgba(255,255,255,0.05)'
              }}>
                {selectedSkill?.name || skill?.name}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer'
            }}
            className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setEvalActiveTab(tab.id)
                if (tab.id === 'editor') setSubView('editor')
              }}
              style={{
                padding: '9px 16px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: evalActiveTab === tab.id ? 500 : 400,
                color: evalActiveTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: evalActiveTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
              className="hover:text-[var(--text-secondary)]"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {loading || !skill || !evalSet ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? 'Loading...' : 'No skill selected.'}
            </div>
          ) : (
            <>
              {evalActiveTab === 'editor' && subView === 'editor' && (
                <EvalSetEditor evalSetId={evalSet.id} skillId={skill.id} onRunEval={handleRunEval} />
              )}

              {evalActiveTab === 'editor' && subView === 'running' && runningRunId && (
                <EvalRunner runId={runningRunId} onComplete={handleRunComplete} onStop={handleRunStop} />
              )}

              {evalActiveTab === 'editor' && subView === 'results' && evalActiveRunId && (
                <div>
                  <button
                    onClick={() => { setSubView('editor'); setEvalActiveRunId(null) }}
                    style={{
                      padding: '5px 12px', borderRadius: 6, border: 'none',
                      background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                      fontSize: 12, cursor: 'pointer', marginBottom: 12
                    }}
                  >
                    Back to Editor
                  </button>
                  <EvalResultsViewer runId={evalActiveRunId} />
                </div>
              )}

              {evalActiveTab === 'history' && (
                subView === 'results' && evalActiveRunId ? (
                  <div>
                    <button
                      onClick={() => { setSubView('editor'); setEvalActiveRunId(null) }}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 'none',
                        background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                        fontSize: 12, cursor: 'pointer', marginBottom: 12
                      }}
                    >
                      Back to History
                    </button>
                    <EvalResultsViewer runId={evalActiveRunId} />
                  </div>
                ) : (
                  <EvalBenchmark evalSetId={evalSet.id} onViewRun={handleViewRun} />
                )
              )}

              {evalActiveTab === 'optimize' && (
                <DescriptionOptimizer skillId={skill.id} evalSetId={evalSet.id} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
