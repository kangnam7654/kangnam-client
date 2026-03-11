import { useAppStore } from '../../stores/app-store'

const PROVIDERS = [
  { name: 'codex', label: 'Codex', color: '#10a37f' },
  { name: 'gemini', label: 'Gemini', color: '#4285f4' },
  { name: 'antigravity', label: 'Antigravity', color: '#ea4335' },
  { name: 'copilot', label: 'Copilot', color: '#6e40c9' }
]

export function ProviderSelector() {
  const { activeProvider, setActiveProvider, authStatuses } = useAppStore()

  return (
    <div className="flex gap-1">
      {PROVIDERS.map(p => {
        const isActive = activeProvider === p.name
        const isConnected = authStatuses.find(s => s.provider === p.name)?.connected
        return (
          <button
            key={p.name}
            onClick={() => setActiveProvider(p.name)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all relative ${
              isActive
                ? 'text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            style={isActive ? { backgroundColor: p.color + '33', color: p.color } : undefined}
            title={`${p.label}${isConnected ? ' (connected)' : ' (not connected)'}`}
          >
            {p.label}
            {isConnected && (
              <span
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--success)' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
