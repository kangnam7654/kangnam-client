import { useState } from 'react'
import { useAppStore } from '../../stores/app-store'

function formatToolPreview(input: Record<string, unknown>): string {
  const previewKeys = ['pattern', 'command', 'file_path', 'path', 'query', 'content', 'description']
  const keys = Object.keys(input)
  if (keys.length === 0) return ''
  const key = previewKeys.find(k => input[k]) || keys[0]
  const value = input[key]
  if (typeof value === 'string') return `${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`
  if (Array.isArray(value)) return `${key}: [${value.length} items]`
  if (typeof value === 'object') return `${key}: {...}`
  return `${key}: ${String(value).substring(0, 30)}`
}

export function InlineToolCall({ toolCallId }: { toolCallId: string }) {
  const tc = useAppStore(s => s.coworkToolCalls.find(t => t.id === toolCallId))
  const [expanded, setExpanded] = useState(false)

  if (!tc) return null
  const { name, input, status, result } = tc

  return (
    <div style={{
      background: 'var(--overlay-soft)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 10,
      margin: '12px 0',
      overflow: 'hidden'
    }}>
      {/* Header — matches open-claude-cowork .inline-tool-header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', cursor: 'pointer',
          fontSize: 13, color: 'var(--text-secondary)',
          transition: 'background 0.15s'
        }}
        className="hover:bg-[var(--overlay-soft)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
        {status === 'running' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animation: 'spin 1.5s linear infinite', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
          </svg>
        )}
        {status === 'success' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status === 'error' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
        <span style={{
          color: 'var(--text-muted)', fontSize: 12,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: 350, fontFamily: "'Monaco','Menlo',monospace"
        }}>{formatToolPreview(input)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
          style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Details — matches open-claude-cowork .inline-tool-result */}
      {expanded && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--overlay-soft)',
          borderTop: '1px solid var(--border-subtle)',
          maxHeight: 280, overflowY: 'auto'
        }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Input</div>
            <pre style={{
              background: 'var(--bg-code)', color: 'var(--text-primary)',
              padding: '12px 14px', borderRadius: 8, fontSize: 12,
              overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
              fontFamily: "'Monaco','Menlo',monospace"
            }}>{JSON.stringify(input, null, 2)}</pre>
          </div>
          {result && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Output</div>
              <pre style={{
                background: status === 'error' ? 'var(--bg-tool-result-err)' : 'var(--bg-tool-result-ok)',
                color: status === 'error' ? 'var(--text-tool-result-err)' : 'var(--text-tool-result-ok)',
                borderLeft: `3px solid ${status === 'error' ? 'var(--danger)' : 'var(--success)'}`,
                padding: '12px 14px', borderRadius: 8, fontSize: 12,
                overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
                fontFamily: "'Monaco','Menlo',monospace"
              }}>{result.substring(0, 2000)}{result.length > 2000 ? '...' : ''}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
