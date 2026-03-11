import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/app-store'

interface MCPServerStatus {
  name: string
  status: string
  toolCount: number
  error?: string
}

const PROVIDER_INFO: Record<string, { label: string; description: string; color: string }> = {
  codex: { label: 'OpenAI Codex', description: 'ChatGPT Plus/Pro subscription', color: '#10a37f' },
  gemini: { label: 'Google Gemini', description: 'Google AI Pro subscription', color: '#4285f4' },
  antigravity: { label: 'Antigravity', description: 'Google Antigravity (Gemini + Claude)', color: '#ea4335' },
  copilot: { label: 'GitHub Copilot', description: 'Copilot subscription (device flow)', color: '#6e40c9' }
}

export function SettingsPanel() {
  const { showSettings, setShowSettings, settingsTab, setSettingsTab, authStatuses, setAuthStatuses } = useAppStore()
  const [mcpServers, setMcpServers] = useState<MCPServerStatus[]>([])
  const [newServerJson, setNewServerJson] = useState('')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [copilotCode, setCopilotCode] = useState<{ userCode: string; verificationUri: string } | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  useEffect(() => {
    if (showSettings) {
      loadData()
    }
  }, [showSettings])

  // Listen for Copilot device code
  useEffect(() => {
    const unsub = window.api.auth.onCopilotDeviceCode((data) => {
      setCopilotCode(data)
    })
    return () => { unsub() }
  }, [])

  // Listen for auth connected events to clear connecting state
  useEffect(() => {
    const unsub = window.api.auth.onConnected(async () => {
      setConnecting(null)
      setCopilotCode(null)
      setConnectError(null)
      const statuses = await window.api.auth.status()
      setAuthStatuses(statuses)
    })
    return () => { unsub() }
  }, [setAuthStatuses])

  const loadData = async () => {
    const statuses = await window.api.auth.status()
    setAuthStatuses(statuses)
    const servers = await window.api.mcp.serverStatus()
    setMcpServers(servers)
  }

  const handleConnect = async (provider: string) => {
    setConnecting(provider)
    setConnectError(null)
    setCopilotCode(null)
    try {
      await window.api.auth.connect(provider)
      await loadData()
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err))
    } finally {
      setConnecting(null)
    }
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
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)] mb-4">Connect your LLM providers via OAuth</p>

              {connectError && (
                <div className="px-3 py-2 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-xs">
                  {connectError}
                </div>
              )}

              {/* Copilot device code modal */}
              {copilotCode && (
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--accent)] space-y-2">
                  <p className="text-sm font-medium">Enter this code on GitHub:</p>
                  <div className="text-2xl font-mono font-bold text-center py-2 tracking-widest text-[var(--accent)]">
                    {copilotCode.userCode}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] text-center">
                    A browser window should have opened. If not, visit github.com/login/device
                  </p>
                  <p className="text-xs text-[var(--text-muted)] text-center animate-pulse">
                    Waiting for authorization...
                  </p>
                </div>
              )}

              {authStatuses.map(status => {
                const info = PROVIDER_INFO[status.provider]
                if (!info) return null
                const isConnecting = connecting === status.provider
                return (
                  <div key={status.provider} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: status.connected ? 'var(--success)' : info.color }}
                        />
                        <span className="text-sm font-medium">{info.label}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] ml-4 mt-0.5">{info.description}</p>
                    </div>
                    <button
                      disabled={isConnecting}
                      onClick={async () => {
                        if (status.connected) {
                          await window.api.auth.disconnect(status.provider)
                          await loadData()
                        } else {
                          handleConnect(status.provider)
                        }
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        isConnecting
                          ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-wait'
                          : status.connected
                            ? 'bg-[var(--danger)]/20 text-[var(--danger)] hover:bg-[var(--danger)]/30'
                            : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                      }`}
                    >
                      {isConnecting ? 'Connecting...' : status.connected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {settingsTab === 'mcp' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">
                MCP Servers — connect tools to your LLM
              </p>

              {mcpServers.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] py-4 text-center">No MCP servers configured</p>
              )}

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

              <div className="mt-4">
                <label className="text-sm text-[var(--text-secondary)] block mb-2">
                  Add MCP Server (JSON)
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
