import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { getVisibleProviders } from '../../lib/providers'

export function ProviderSelector() {
  const { activeProvider, setActiveProvider, authStatuses, devMode } = useAppStore()
  const PROVIDERS = getVisibleProviders(devMode)
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
