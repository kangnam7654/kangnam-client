import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/app-store'

interface MCPServerStatus {
  name: string
  status: string
  toolCount: number
  error?: string
}

export function SettingsPanel() {
  const { showSettings, setShowSettings, settingsTab, setSettingsTab, authStatuses, setAuthStatuses } = useAppStore()
  const [mcpServers, setMcpServers] = useState<MCPServerStatus[]>([])
  const [newServerJson, setNewServerJson] = useState('')

  useEffect(() => {
    if (showSettings) {
      loadData()
    }
  }, [showSettings])

  const loadData = async () => {
    const statuses = await window.api.auth.status()
    setAuthStatuses(statuses)
    const servers = await window.api.mcp.serverStatus()
    setMcpServers(servers)
  }

  if (!showSettings) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSettings(false)}>
      <div className="w-[600px] max-h-[80vh] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={() => setShowSettings(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            x
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          {(['providers', 'mcp', 'general'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSettingsTab(tab)}
              className={`px-4 py-2 text-sm capitalize ${
                settingsTab === tab
                  ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {settingsTab === 'providers' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">Connect your LLM providers</p>
              {authStatuses.map(status => (
                <div key={status.provider} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <div>
                    <span className="text-sm font-medium capitalize">{status.provider}</span>
                    <span className={`ml-2 text-xs ${status.connected ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                      {status.connected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      if (status.connected) {
                        await window.api.auth.disconnect(status.provider)
                      } else {
                        await window.api.auth.connect(status.provider)
                      }
                      await loadData()
                    }}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      status.connected
                        ? 'bg-[var(--danger)]/20 text-[var(--danger)] hover:bg-[var(--danger)]/30'
                        : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                    }`}
                  >
                    {status.connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {settingsTab === 'mcp' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">
                MCP Servers — connect tools to your LLM
              </p>

              {/* Server list */}
              {mcpServers.map(server => (
                <div key={server.name} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <div>
                    <span className="text-sm font-medium">{server.name}</span>
                    <span className={`ml-2 text-xs ${
                      server.status === 'connected' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}>
                      {server.status} ({server.toolCount} tools)
                    </span>
                    {server.error && <p className="text-xs text-[var(--danger)] mt-1">{server.error}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      await window.api.mcp.removeServer(server.name)
                      await loadData()
                    }}
                    className="px-3 py-1 rounded text-xs text-[var(--danger)] hover:bg-[var(--danger)]/20"
                  >
                    Remove
                  </button>
                </div>
              ))}

              {/* Add server */}
              <div className="mt-4">
                <label className="text-sm text-[var(--text-secondary)] block mb-2">
                  Add MCP Server (JSON config)
                </label>
                <textarea
                  value={newServerJson}
                  onChange={e => setNewServerJson(e.target.value)}
                  placeholder={'{\n  "name": "filesystem",\n  "type": "stdio",\n  "command": "npx",\n  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home"]\n}'}
                  rows={6}
                  className="w-full rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={async () => {
                    try {
                      const config = JSON.parse(newServerJson)
                      await window.api.mcp.addServer(config)
                      setNewServerJson('')
                      await loadData()
                    } catch (err) {
                      alert(`Invalid JSON: ${err}`)
                    }
                  }}
                  className="mt-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)]"
                >
                  Add Server
                </button>
              </div>
            </div>
          )}

          {settingsTab === 'general' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">General settings</p>
              <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">
                Kangnam Client v1.0.0
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
