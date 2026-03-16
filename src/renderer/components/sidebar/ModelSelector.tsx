import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'

const PROVIDER_MODELS: Record<string, Array<{ id: string; label: string; desc: string }>> = {
  codex: [
    { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'Latest flagship' },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', desc: 'Coding optimized' },
    { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', desc: 'Coding optimized' },
    { id: 'gpt-5.2', label: 'GPT-5.2', desc: 'General purpose' },
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', desc: 'Coding' },
    { id: 'gpt-5.1', label: 'GPT-5.1', desc: 'General purpose' },
    { id: 'gpt-5-codex', label: 'GPT-5 Codex', desc: 'Legacy' },
    { id: 'gpt-5', label: 'GPT-5', desc: 'Legacy' }
  ],
  gemini: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', desc: 'Frontier reasoning (preview)' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', desc: 'Fast reasoning (preview)' }
  ],
  antigravity: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', desc: 'Frontier reasoning (preview)' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', desc: 'Fast reasoning (preview)' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: 'Anthropic coding' },
    { id: 'claude-sonnet-4-6-thinking', label: 'Claude Sonnet 4.6 Thinking', desc: 'Extended thinking' },
    { id: 'claude-opus-4-6-thinking', label: 'Claude Opus 4.6 Thinking', desc: 'Highest capability' }
  ],
  copilot: [
    // Default (included)
    { id: 'gpt-4.1', label: 'GPT-4.1', desc: 'Default' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini', desc: 'Fast, included' },
    // OpenAI premium
    { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'Latest flagship' },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', desc: 'Coding optimized' },
    { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', desc: 'Best coding' },
    { id: 'gpt-5.2', label: 'GPT-5.2', desc: 'General purpose' },
    { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', desc: 'Max coding' },
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', desc: 'Coding' },
    { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini', desc: 'Light coding' },
    { id: 'gpt-5.1', label: 'GPT-5.1', desc: 'General purpose' },
    // Claude premium
    { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', desc: 'Highest capability' },
    { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', desc: 'Best value coding' },
    { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', desc: 'Fast, lightweight' },
    // Google premium
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', desc: 'Frontier reasoning (preview)' },
    { id: 'gemini-3-pro', label: 'Gemini 3 Pro', desc: 'Reasoning (preview)' },
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: 'Fast reasoning (preview)' },
    // xAI
    { id: 'grok-code-fast-1', label: 'Grok Code Fast 1', desc: 'xAI fast coding' },
  ],
  claude: [
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: 'Highest capability' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: 'Best value coding' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: 'Fast, lightweight' }
  ],
  mock: [
    { id: 'mock', label: 'Mock', desc: 'UI testing' }
  ]
}

const DEFAULT_MODELS: Record<string, string> = {
  codex: 'gpt-5.4',
  gemini: 'gemini-3.1-pro-preview',
  antigravity: 'gemini-3.1-pro-preview',
  copilot: 'gpt-4.1',
  claude: 'claude-sonnet-4-6',
  mock: 'mock'
}

export function ModelSelector() {
  const { activeProvider, activeModel, setActiveModel } = useAppStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const models = PROVIDER_MODELS[activeProvider] ?? []
  const current = models.find(m => m.id === activeModel) ?? models[0]

  // Reset model when provider changes
  useEffect(() => {
    const defaultModel = DEFAULT_MODELS[activeProvider]
    if (defaultModel && !models.find(m => m.id === activeModel)) {
      setActiveModel(defaultModel)
    }
  }, [activeProvider, activeModel, models, setActiveModel])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (models.length <= 1) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-item w-full"
        style={{ gap: 10 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{current?.label ?? 'Select model'}</span>
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
          {models.map(m => {
            const selected = activeModel === m.id
            return (
              <button
                key={m.id}
                onClick={() => { setActiveModel(m.id); setOpen(false) }}
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
                    {m.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 1 }}>
                    {m.desc}
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

export { DEFAULT_MODELS }
