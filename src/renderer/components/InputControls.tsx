import { useAppStore } from '../stores/app-store'

// ── Provider selector (shows current CLI provider) ──────────
export function ProviderSelector() {
  const { currentProvider } = useAppStore()

  if (!currentProvider) return null

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 8,
        fontSize: 13, color: 'var(--text-secondary)',
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: 'var(--accent)', flexShrink: 0
      }} />
      <span style={{ fontWeight: 500 }}>{currentProvider}</span>
    </div>
  )
}
