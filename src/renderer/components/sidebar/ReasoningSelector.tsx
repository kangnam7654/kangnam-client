import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'

const EFFORTS = [
  { id: 'low' as const, label: 'Low', desc: 'Fast, minimal thinking' },
  { id: 'medium' as const, label: 'Medium', desc: 'Balanced (default)' },
  { id: 'high' as const, label: 'High', desc: 'Deep reasoning' }
]

// Providers that support reasoning effort
const SUPPORTED_PROVIDERS = new Set(['codex', 'gemini', 'antigravity', 'claude'])

export function ReasoningSelector() {
  const { activeProvider, activeReasoningEffort, setActiveReasoningEffort } = useAppStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!SUPPORTED_PROVIDERS.has(activeProvider)) return null

  const current = EFFORTS.find(e => e.id === activeReasoningEffort) ?? EFFORTS[1]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-item w-full"
        style={{ gap: 10 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>Thinking: {current.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          top: '100%',
          marginTop: 4,
          zIndex: 50,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
          padding: 5,
          overflow: 'hidden'
        }}>
          {EFFORTS.map(e => {
            const selected = activeReasoningEffort === e.id
            return (
              <button
                key={e.id}
                onClick={() => { setActiveReasoningEffort(e.id); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 12px', borderRadius: 8, border: 'none', textAlign: 'left',
                  background: selected ? 'rgba(255,255,255,0.07)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.12s'
                }}
                className={selected ? '' : 'hover:bg-[rgba(255,255,255,0.04)]'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: selected ? 500 : 400, color: selected ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.3 }}>
                    {e.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 1 }}>
                    {e.desc}
                  </div>
                </div>
                {selected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
