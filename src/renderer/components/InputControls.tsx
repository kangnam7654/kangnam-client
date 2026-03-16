import { useState, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../stores/app-store'
import {
  PROVIDERS, PROVIDER_MODELS, DEFAULT_MODELS,
  REASONING_EFFORTS, REASONING_SUPPORTED_PROVIDERS,
  getProviderInfo, getModelLabel
} from '../lib/providers'

// ── Portal-based dropdown ───────────────────────────────────
function DropdownPortal({
  anchorRef,
  open,
  onClose,
  align = 'left',
  children
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  align?: 'left' | 'right' | 'center'
  children: ReactNode
}) {
  if (!open || !anchorRef.current) return null

  // Calculate position synchronously from the anchor's current rect
  const rect = anchorRef.current.getBoundingClientRect()
  const top = rect.top - 6
  let left = rect.left
  if (align === 'right') left = rect.right
  if (align === 'center') left = rect.left + rect.width / 2

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
      <div style={{
        position: 'fixed', top, left,
        transform: `translateY(-100%) ${align === 'right' ? 'translateX(-100%)' : align === 'center' ? 'translateX(-50%)' : ''}`,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 24px var(--shadow-pill)',
        zIndex: 9999,
        animation: 'dropdownIn 0.12s ease-out',
        overflow: 'hidden'
      }}>
        {children}
      </div>
    </>,
    document.body
  )
}

// ── Provider Dropdown ───────────────────────────────────────
export function ProviderDropdown() {
  const { activeProvider, setActiveProvider, setActiveModel, authStatuses } = useAppStore()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const info = getProviderInfo(activeProvider)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', border: 'none', borderRadius: 8,
          background: 'transparent', cursor: 'pointer',
          fontSize: 13, color: 'var(--text-secondary)',
          transition: 'background 0.15s'
        }}
        className="hover:bg-[var(--bg-hover)]"
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: info?.color ?? 'var(--text-muted)', flexShrink: 0
        }} />
        <span style={{ fontWeight: 500 }}>{info?.shortLabel ?? activeProvider}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 15 12 9 18 15" />
        </svg>
      </button>

      <DropdownPortal anchorRef={btnRef} open={open} onClose={close} align="left">
        <div style={{ minWidth: 200 }}>
          {PROVIDERS.filter(p => p.name !== 'mock').map(p => {
            const connected = authStatuses.find(a => a.provider === p.name)?.connected
            const active = p.name === activeProvider
            return (
              <button
                key={p.name}
                onClick={() => {
                  setActiveProvider(p.name)
                  setActiveModel(DEFAULT_MODELS[p.name] ?? '')
                  close()
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', border: 'none',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)',
                  textAlign: 'left', transition: 'background 0.1s'
                }}
                className="hover:bg-[var(--bg-hover)]"
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: p.color, flexShrink: 0
                }} />
                <span style={{ flex: 1, fontWeight: active ? 600 : 400 }}>{p.label}</span>
                {connected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </DropdownPortal>
    </>
  )
}

// ── Model Dropdown ──────────────────────────────────────────
export function ModelDropdown() {
  const { activeProvider, activeModel, setActiveModel } = useAppStore()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const models = PROVIDER_MODELS[activeProvider] ?? []
  const label = getModelLabel(activeProvider, activeModel)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 10px', border: 'none', borderRadius: 8,
          background: 'transparent', cursor: 'pointer',
          fontSize: 13, color: 'var(--text-secondary)',
          transition: 'background 0.15s',
          maxWidth: 180, overflow: 'hidden'
        }}
        className="hover:bg-[var(--bg-hover)]"
      >
        <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 15 12 9 18 15" />
        </svg>
      </button>

      <DropdownPortal anchorRef={btnRef} open={open} onClose={close} align="right">
        <div style={{ minWidth: 240, maxHeight: 320, overflowY: 'auto' }}>
          {models.map(m => {
            const active = m.id === activeModel
            return (
              <button
                key={m.id}
                onClick={() => { setActiveModel(m.id); close() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', border: 'none',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)',
                  textAlign: 'left', transition: 'background 0.1s'
                }}
                className="hover:bg-[var(--bg-hover)]"
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: active ? 600 : 400 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{m.desc}</div>
                </div>
                {active && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </DropdownPortal>
    </>
  )
}

// ── Thinking / Reasoning Toggle ─────────────────────────────
export function ThinkingToggle() {
  const { activeProvider, activeReasoningEffort, setActiveReasoningEffort } = useAppStore()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  if (!REASONING_SUPPORTED_PROVIDERS.has(activeProvider)) return null

  const current = REASONING_EFFORTS.find(e => e.id === activeReasoningEffort) ?? REASONING_EFFORTS[1]

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        title={`Reasoning: ${current.label}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', border: 'none', borderRadius: 8,
          background: activeReasoningEffort !== 'medium' ? 'var(--accent-soft)' : 'transparent',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          color: activeReasoningEffort !== 'medium' ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'background 0.15s, color 0.15s'
        }}
        className="hover:bg-[var(--bg-hover)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>{current.shortLabel}</span>
      </button>

      <DropdownPortal anchorRef={btnRef} open={open} onClose={close} align="center">
        <div style={{ minWidth: 180 }}>
          <div style={{ padding: '10px 14px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Reasoning Effort
          </div>
          {REASONING_EFFORTS.map(e => {
            const active = e.id === activeReasoningEffort
            return (
              <button
                key={e.id}
                onClick={() => { setActiveReasoningEffort(e.id); close() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 14px', border: 'none',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)',
                  textAlign: 'left', transition: 'background 0.1s'
                }}
                className="hover:bg-[var(--bg-hover)]"
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: active ? 600 : 400 }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{e.desc}</div>
                </div>
                {active && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </DropdownPortal>
    </>
  )
}
