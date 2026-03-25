import { useState } from 'react'
import { useAppStore, type CoworkToolCall } from '../../stores/app-store'

function formatPreview(input: Record<string, unknown>): string {
  const keys = Object.keys(input)
  if (keys.length === 0) return ''
  const key = ['command', 'file_path', 'path', 'pattern', 'query'].find(k => input[k]) || keys[0]
  const val = input[key]
  if (typeof val === 'string') return val.length > 40 ? val.substring(0, 40) + '...' : val
  return ''
}

function ToolCallItem({ tc }: { tc: CoworkToolCall }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ background: 'var(--sidebar-item-bg)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
      {/* Header — matches open-claude-cowork .tool-call-header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', transition: 'background 0.15s' }}
        className="hover:bg-[var(--border)]"
      >
        {/* Status icon — matches open-claude-cowork .tool-call-icon */}
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: tc.status === 'running' ? 'var(--accent)' : tc.status === 'success' ? 'var(--success)' : 'var(--danger)',
          animation: tc.status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none'
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tc.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tc.status === 'running' ? formatPreview(tc.input) || 'Running...'
              : tc.status === 'success' ? 'Completed' : 'Failed'}
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
          style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Details — matches open-claude-cowork .tool-call-details */}
      {expanded && (
        <div style={{ padding: 8, background: 'var(--sidebar-bg)', borderTop: '1px solid var(--border)', fontSize: 11, maxHeight: 150, overflowY: 'auto' }}>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Input</div>
            <pre style={{
              background: 'var(--bg-code)', padding: '6px 8px', borderRadius: 4, overflowX: 'auto',
              color: 'var(--text-secondary)', fontFamily: "'Monaco','Menlo',monospace", fontSize: 9, lineHeight: 1.3,
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 60, overflowY: 'auto'
            }}>{JSON.stringify(tc.input, null, 2)}</pre>
          </div>
          {tc.result && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Output</div>
              <pre style={{
                background: tc.status === 'error' ? 'var(--bg-tool-result-err)' : 'var(--bg-tool-result-ok)',
                color: tc.status === 'error' ? 'var(--text-tool-result-err)' : 'var(--text-tool-result-ok)',
                borderLeft: `3px solid ${tc.status === 'error' ? 'var(--danger)' : 'var(--success)'}`,
                padding: '6px 8px', borderRadius: 4,
                fontFamily: "'Monaco','Menlo',monospace", fontSize: 9, lineHeight: 1.3,
                margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 60, overflowY: 'auto'
              }}>{tc.result.substring(0, 2000)}{tc.result.length > 2000 ? '...' : ''}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ProgressPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { coworkSteps, coworkToolCalls } = useAppStore()
  const [stepsCollapsed, setStepsCollapsed] = useState(false)

  if (collapsed) return null

  return (
    <aside style={{
      width: 320, minWidth: 320, height: '100%',
      background: 'var(--sidebar-bg)', color: 'var(--text-primary)',
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden'
    }}>
      {/* Header — matches open-claude-cowork .sidebar-header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Progress</h3>
        <button
          onClick={onToggle}
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)',
            transition: 'background 0.15s, color 0.15s'
          }}
          className="hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
          title="Collapse sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Steps section — matches open-claude-cowork .sidebar-section:first-of-type */}
      <div style={{
        flex: '0 0 auto', maxHeight: 200,
        borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div
          onClick={() => setStepsCollapsed(!stepsCollapsed)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
            padding: '16px 20px 12px', cursor: 'pointer', flexShrink: 0
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transition: 'transform 0.2s', transform: stepsCollapsed ? 'rotate(-90deg)' : 'none' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span>{coworkSteps.length} steps</span>
        </div>
        {!stepsCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', padding: '0 20px 16px' }}>
            {coworkSteps.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No active tasks</div>
            ) : (
              coworkSteps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', background: 'var(--sidebar-item-bg)', borderRadius: 8, fontSize: 13
                }}>
                  {/* Step status icon — matches open-claude-cowork .step-status */}
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                    background: step.status === 'completed' ? 'var(--success)'
                      : step.status === 'in_progress' ? 'var(--accent)'
                      : step.status === 'error' ? 'var(--danger)' : 'var(--border-light)',
                    animation: step.status === 'in_progress' ? 'pulse 1.5s ease-in-out infinite' : 'none'
                  }}>
                    {step.status === 'completed' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                    {step.status === 'in_progress' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', lineHeight: 1.4 }}>{step.text}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Tool Calls section — matches open-claude-cowork .sidebar-section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
          padding: '16px 20px 12px', flexShrink: 0
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span>Tool Calls</span>
          {coworkToolCalls.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({coworkToolCalls.length})</span>
          )}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          flex: 1, overflowY: 'auto', padding: '0 20px 16px', minHeight: 0
        }}>
          {coworkToolCalls.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No tool calls yet</div>
          ) : (
            coworkToolCalls.map(tc => <ToolCallItem key={tc.id} tc={tc} />)
          )}
        </div>
      </div>
    </aside>
  )
}
