import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import type { MCPServerStatus } from './types'
import { ProvidersTab } from './tabs/ProvidersTab'
import { MCPTab } from './tabs/MCPTab'
import { GeneralTab } from './tabs/GeneralTab'

const TABS = [
  { id: 'providers', label: 'Providers', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'mcp', label: 'MCP Servers', icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  { id: 'general', label: 'General', icon: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z' }
] as const

type TabId = typeof TABS[number]['id']

export function SettingsPanel() {
  const { showSettings, setShowSettings, settingsTab, setSettingsTab } = useAppStore()
  const [mcpServers, setMcpServers] = useState<MCPServerStatus[]>([])
  const [newServerJson, setNewServerJson] = useState('')

  useEffect(() => {
    if (showSettings) loadData()
  }, [showSettings])

  useEffect(() => {
    if (!showSettings) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSettings, setShowSettings])

  const loadData = async () => {
    try {
      const servers = await window.api.mcp.serverStatus() as MCPServerStatus[]
      setMcpServers(servers)
    } catch (err) {
      console.error('Failed to load settings data:', err)
    }
  }

  if (!showSettings) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={() => setShowSettings(false)}
    >
      <div
        style={{ width: 'min(90vw, 720px)', maxHeight: '85vh', background: 'var(--bg-sidebar)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowSettings(false)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}
              className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Settings</h2>
          </div>
          <button
            onClick={() => setShowSettings(false)}
            aria-label="Close settings"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}
            className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body: Sidebar + Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left sidebar tabs */}
          <div style={{ width: 180, padding: '16px 12px', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TABS.map(tab => {
                const isActive = settingsTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id as TabId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8, border: 'none',
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 13.5, fontWeight: isActive ? 500 : 400,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'all 0.12s'
                    }}
                    className={isActive ? '' : 'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]'}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isActive ? 0.9 : 0.5, flexShrink: 0 }}>
                      <path d={tab.icon} />
                    </svg>
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right content */}
          <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
            {settingsTab === 'providers' && <ProvidersTab />}
            {settingsTab === 'mcp' && <MCPTab
              servers={mcpServers}
              newServerJson={newServerJson}
              setNewServerJson={setNewServerJson}
              onAdd={async () => {
                let config
                try { config = JSON.parse(newServerJson) }
                catch { alert('Invalid JSON format'); return }
                await window.api.mcp.addServer(config)
                setNewServerJson('')
                await loadData()
              }}
              onRemove={async (name) => { await window.api.mcp.removeServer(name); await loadData() }}
              onUpdate={async () => { await loadData() }}
            />}
            {settingsTab === 'general' && <GeneralTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
