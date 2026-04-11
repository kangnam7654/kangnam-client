import { useAppStore, type StudioBottomTab } from '../../stores/app-store'
import { CliOutputTab } from './tabs/CliOutputTab'
import { TestsTab } from './tabs/TestsTab'
import { EvalViewerTab } from './tabs/EvalViewerTab'
import { OptimizeTab } from './tabs/OptimizeTab'

const tabs: { id: StudioBottomTab; label: string }[] = [
  { id: 'cli', label: 'CLI Output' },
  { id: 'tests', label: 'Tests' },
  { id: 'viewer', label: 'Eval Viewer' },
  { id: 'optimize', label: 'Optimize' },
]

interface StudioBottomPanelProps {
  activeTab: StudioBottomTab
  height: number
  type: 'skill' | 'agent'
  skillOrAgentName: string
}

export function StudioBottomPanel({ activeTab, height, type, skillOrAgentName }: StudioBottomPanelProps) {
  const { setStudioBottomTab, toggleStudioBottomPanel } = useAppStore()

  return (
    <div style={{
      height, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderTop: '1px solid var(--border)', background: 'var(--bg-surface)',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStudioBottomTab(tab.id)}
            style={{
              padding: '6px 14px', fontSize: 11, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={toggleStudioBottomPanel}
          title="Close panel"
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: '4px 8px', display: 'flex',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'cli' && <CliOutputTab />}
        {activeTab === 'tests' && <TestsTab type={type} name={skillOrAgentName} />}
        {activeTab === 'viewer' && <EvalViewerTab type={type} name={skillOrAgentName} />}
        {activeTab === 'optimize' && <OptimizeTab type={type} name={skillOrAgentName} />}
      </div>
    </div>
  )
}
