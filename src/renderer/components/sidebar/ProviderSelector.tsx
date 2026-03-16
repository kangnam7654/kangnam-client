import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'

const PROVIDERS = [
  { name: 'codex', label: 'OpenAI Codex', shortLabel: 'Codex', color: '#10a37f', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { name: 'gemini', label: 'Google Gemini', shortLabel: 'Gemini', color: '#4285f4', icon: 'M12 3v18m0-18c4.97 0 9 2.69 9 6s-4.03 6-9 6-9-2.69-9-6 4.03-6 9-6z' },
  { name: 'antigravity', label: 'Antigravity', shortLabel: 'Antigravity', color: '#ea4335', icon: 'M12 2L2 19.5h20L12 2zm0 4l7 12H5l7-12z' },
  { name: 'copilot', label: 'GitHub Copilot', shortLabel: 'Copilot', color: '#6e40c9', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm4 0h-2v-2h2v2zm1.5-4.5c-.4.5-1 .9-1.5 1.2V13h-2v-.8c0-.7.4-1.3 1-1.7.5-.3.8-.6 1-1 .2-.4.2-.8 0-1.2-.3-.5-.9-.8-1.5-.8-.8 0-1.5.5-1.7 1.2L10 8.3C10.5 6.9 11.8 6 13.3 6c1.1 0 2.1.5 2.7 1.4.6.9.7 2 .2 3z' },
  { name: 'claude', label: 'Anthropic Claude', shortLabel: 'Claude', color: '#d97706', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 2.3L6 8.5v7L12 18.7l6-3.2v-7L12 5.3z' },
  { name: 'mock', label: 'Mock (UI Test)', shortLabel: 'Mock', color: '#f59e0b', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' }
]

export function ProviderSelector() {
  const { activeProvider, setActiveProvider, authStatuses } = useAppStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const active = PROVIDERS.find(p => p.name === activeProvider) ?? PROVIDERS[0]
  const isConnected = (name: string) => name === 'mock' || authStatuses.find(s => s.provider === name)?.connected

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-item w-full"
        style={{ gap: 10 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: active.color, flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{active.shortLabel}</span>
        {isConnected(active.name) && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
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
          {PROVIDERS.map(p => {
            const selected = activeProvider === p.name
            const connected = isConnected(p.name)
            return (
              <button
                key={p.name}
                onClick={() => { setActiveProvider(p.name); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 12px', borderRadius: 8, border: 'none', textAlign: 'left',
                  background: selected ? 'rgba(255,255,255,0.07)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.12s'
                }}
                className={selected ? '' : 'hover:bg-[rgba(255,255,255,0.04)]'}
              >
                {/* Provider color dot */}
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color, flexShrink: 0, boxShadow: `0 0 6px ${p.color}40` }} />

                {/* Label + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: selected ? 500 : 400, color: selected ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.3 }}>
                    {p.label}
                  </div>
                </div>

                {/* Status */}
                {connected ? (
                  <span style={{ fontSize: 10.5, color: 'var(--success)', fontWeight: 500, padding: '2px 7px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', flexShrink: 0 }}>
                    Connected
                  </span>
                ) : (
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                    Not connected
                  </span>
                )}

                {/* Checkmark for selected */}
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
