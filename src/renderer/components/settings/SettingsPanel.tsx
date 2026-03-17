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
  copilot: { label: 'GitHub Copilot', description: 'Copilot subscription (device flow)', color: '#6e40c9' },
  claude: { label: 'Anthropic Claude', description: 'Setup token or API key', color: '#d97706' }
}

const TABS = [
  { id: 'providers', label: 'Providers', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'mcp', label: 'MCP Servers', icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  { id: 'prompts', label: 'Skills', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  { id: 'general', label: 'General', icon: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z' }
] as const

type TabId = typeof TABS[number]['id']

export function SettingsPanel() {
  const { showSettings, setShowSettings, settingsTab, setSettingsTab, authStatuses, setAuthStatuses } = useAppStore()
  const [mcpServers, setMcpServers] = useState<MCPServerStatus[]>([])
  const [newServerJson, setNewServerJson] = useState('')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [copilotCode, setCopilotCode] = useState<{ userCode: string; verificationUri: string } | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [claudeSetupToken, setClaudeSetupToken] = useState('')

  useEffect(() => {
    if (showSettings) loadData()
  }, [showSettings])

  useEffect(() => {
    const unsub = window.api.auth.onCopilotDeviceCode((data) => setCopilotCode(data))
    return () => { unsub() }
  }, [])

  useEffect(() => {
    const unsub = window.api.auth.onConnected(async (provider) => {
      setConnecting(null)
      setCopilotCode(null)
      setConnectError(null)
      if (provider === 'claude') {
        setClaudeSetupToken('')
      }
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

  const handleConnect = async (provider: string, options?: { setupToken?: string }) => {
    setConnecting(provider)
    setConnectError(null)
    setCopilotCode(null)
    try {
      await window.api.auth.connect(provider, options)
      await loadData()
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err))
    } finally {
      setConnecting(null)
    }
  }

  if (!showSettings) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={() => setShowSettings(false)}
    >
      <div
        style={{ width: 720, maxHeight: '85vh', background: 'var(--bg-sidebar)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
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
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}
            className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            {settingsTab === 'providers' && <ProvidersTab
              authStatuses={authStatuses}
              connecting={connecting}
              connectError={connectError}
              copilotCode={copilotCode}
              claudeSetupToken={claudeSetupToken}
              onConnect={handleConnect}
              onClaudeSetupTokenChange={setClaudeSetupToken}
              onCancel={() => { setConnecting(null); setCopilotCode(null) }}
              onDisconnect={async (provider) => { await window.api.auth.disconnect(provider); await loadData() }}
            />}
            {settingsTab === 'mcp' && <MCPTab
              servers={mcpServers}
              newServerJson={newServerJson}
              setNewServerJson={setNewServerJson}
              onAdd={async () => {
                const config = JSON.parse(newServerJson)
                await window.api.mcp.addServer(config)
                setNewServerJson('')
                await loadData()
              }}
              onRemove={async (name) => { await window.api.mcp.removeServer(name); await loadData() }}
              onUpdate={async () => { await loadData() }}
            />}
            {settingsTab === 'prompts' && <PromptsTab />}
            {settingsTab === 'general' && <GeneralTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Providers Tab ─────────────────────────────── */
function ProvidersTab({ authStatuses, connecting, connectError, copilotCode, claudeSetupToken, onConnect, onClaudeSetupTokenChange, onCancel, onDisconnect }: {
  authStatuses: Array<{ provider: string; connected: boolean }>
  connecting: string | null
  connectError: string | null
  copilotCode: { userCode: string; verificationUri: string } | null
  claudeSetupToken: string
  onConnect: (provider: string, options?: { setupToken?: string }) => void
  onClaudeSetupTokenChange: (value: string) => void
  onCancel: () => void
  onDisconnect: (provider: string) => void
}) {
  return (
    <div>
      <SectionTitle>LLM Providers</SectionTitle>
      <SectionDesc>Connect your providers via OAuth or native auth to start chatting.</SectionDesc>

      {connectError && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>
          {connectError}
        </div>
      )}

      {copilotCode && (
        <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--accent)', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Enter this code on GitHub:</p>
          <div style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: 700, textAlign: 'center', padding: '12px 0', letterSpacing: '0.15em', color: 'var(--accent)' }}>
            {copilotCode.userCode}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            A browser window should have opened. If not, visit github.com/login/device
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {authStatuses.map(status => {
          const info = PROVIDER_INFO[status.provider]
          if (!info) return null
          const isConnecting = connecting === status.provider
          const isClaude = status.provider === 'claude'
          return (
            <div key={status.provider} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.connected ? 'var(--success)' : info.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{info.label}</span>
                  {status.connected && (
                    <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)' }}>Connected</span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginLeft: 18, marginTop: 3 }}>{info.description}</p>
                {isClaude && !status.connected && (
                  <div style={{ marginLeft: 18, marginTop: 12 }}>
                    <input
                      type="password"
                      value={claudeSetupToken}
                      onChange={(event) => onClaudeSetupTokenChange(event.target.value)}
                      placeholder="Paste sk-ant-oat... or sk-ant-api03-..."
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        maxWidth: 360,
                        padding: '10px 12px',
                        borderRadius: 9,
                        border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                        fontSize: 12.5
                      }}
                    />
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 7 }}>
                      <code>claude setup-token</code> or API key from <code>console.anthropic.com</code>
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (isConnecting) { onCancel() }
                  else if (status.connected) { onDisconnect(status.provider) }
                  else if (isClaude) { onConnect(status.provider, { setupToken: claudeSetupToken }) }
                  else { onConnect(status.provider) }
                }}
                style={{
                  padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                  ...(isConnecting
                    ? { background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }
                    : status.connected
                      ? { background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }
                      : { background: 'var(--accent)', color: 'white' }
                  )
                }}
                className={isConnecting ? 'hover:bg-[rgba(239,68,68,0.2)]' : status.connected ? 'hover:bg-[rgba(239,68,68,0.2)]' : 'hover:opacity-85'}
              >
                {isConnecting ? 'Cancel' : status.connected ? 'Disconnect' : isClaude ? 'Save token' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── MCP Tab ───────────────────────────────────── */
function MCPTab({ servers, newServerJson, setNewServerJson, onAdd, onRemove, onUpdate }: {
  servers: MCPServerStatus[]
  newServerJson: string
  setNewServerJson: (v: string) => void
  onAdd: () => Promise<void>
  onRemove: (name: string) => void
  onUpdate: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editingServer, setEditingServer] = useState<{ name: string; json: string } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reconnecting, setReconnecting] = useState<string | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const { activeProvider, activeModel } = useAppStore()

  const handleAiAssist = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await window.api.mcp.aiAssist(aiPrompt.trim(), activeProvider, activeModel)
      setNewServerJson(result)
      setAiPrompt('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(false)
    }
  }

  const prettify = (json: string): string => {
    try { return JSON.stringify(JSON.parse(json), null, 2) } catch { return json }
  }

  const handleReconnect = async (name: string) => {
    setReconnecting(name)
    try {
      await window.api.mcp.reconnectServer(name)
      onUpdate()
    } catch { /* error shown in server status */ }
    finally { setReconnecting(null) }
  }

  const handleAdd = async () => {
    setAdding(true)
    setAddError(null)
    try {
      await onAdd()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  const handleEdit = async (name: string) => {
    const config = await window.api.mcp.getConfig(name)
    if (config) {
      setEditingServer({ name, json: JSON.stringify(config, null, 2) })
      setEditError(null)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingServer) return
    setSaving(true)
    setEditError(null)
    try {
      const parsed = JSON.parse(editingServer.json)
      await window.api.mcp.updateServer(editingServer.name, parsed)
      setEditingServer(null)
      onUpdate()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionTitle>MCP Servers</SectionTitle>
      <SectionDesc>Connect external tools to your LLM via Model Context Protocol.</SectionDesc>

      {/* Edit modal */}
      {editingServer && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)'
          }}
          onClick={() => setEditingServer(null)}
        >
          <div
            style={{
              width: 560, background: 'var(--bg-sidebar)', borderRadius: 16,
              border: '1px solid var(--border)', overflow: 'hidden',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                Edit: {editingServer.name}
              </span>
              <button
                onClick={() => setEditingServer(null)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <textarea
                value={editingServer.json}
                onChange={e => setEditingServer({ ...editingServer, json: e.target.value })}
                rows={12}
                style={{
                  width: '100%', borderRadius: 10, background: 'var(--bg-main)', border: '1px solid var(--border)',
                  padding: '12px 14px', fontSize: 13, fontFamily: "'SF Mono', Monaco, Menlo, monospace",
                  color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6
                }}
                className="focus:border-[var(--accent)]"
              />
              {editError && (
                <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 13 }}>
                  {editError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <button
                  onClick={() => setEditingServer({ ...editingServer!, json: prettify(editingServer!.json) })}
                  style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: "'SF Mono', Monaco, Menlo, monospace" }}
                  className="hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text-secondary)]"
                >
                  { } Prettify
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setEditingServer(null)}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  className="hover:bg-[rgba(255,255,255,0.1)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  style={{
                    padding: '9px 20px', borderRadius: 8, border: 'none',
                    background: 'var(--accent)', color: 'white',
                    fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer',
                    opacity: saving ? 0.6 : 1
                  }}
                  className="hover:opacity-85"
                >
                  {saving ? 'Saving...' : 'Save & Reconnect'}
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {servers.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No MCP servers configured
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {servers.map(server => (
            <div key={server.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 12,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              cursor: 'pointer', transition: 'background 0.12s'
            }}
              className="hover:bg-[rgba(255,255,255,0.03)]"
              onClick={() => handleEdit(server.name)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: server.status === 'connected' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{server.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {server.toolCount} tools
                  </span>
                </div>
                {server.error && <p style={{ fontSize: 12, color: 'var(--danger)', marginLeft: 18, marginTop: 4 }}>{server.error}</p>}
              </div>
              <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handleReconnect(server.name)}
                  disabled={reconnecting === server.name}
                  title="Reconnect"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: 'none',
                    background: 'transparent', color: reconnecting === server.name ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--accent)]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={reconnecting === server.name ? { animation: 'spin 1s linear infinite' } : undefined}>
                    <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0115-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 01-15 6.7L3 16" />
                  </svg>
                </button>
                <button
                  onClick={() => onRemove(server.name)}
                  title="Remove"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger)]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Assist */}
      <div style={{
        padding: '12px 14px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.06))',
        border: '1px solid rgba(139,92,246,0.12)',
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <SparkleIcon size={13} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>AI Assist</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="e.g. fetch 서버 추가해줘, /path/to/server.py, 깨진 JSON 붙여넣기..."
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 8,
              background: 'var(--bg-main)', border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-primary)', outline: 'none',
              fontFamily: 'inherit'
            }}
            className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
            onKeyDown={e => { if (e.key === 'Enter') handleAiAssist() }}
          />
          <button
            onClick={handleAiAssist}
            disabled={!aiPrompt.trim() || aiLoading}
            style={{
              padding: '9px 16px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
              fontSize: 13, fontWeight: 500, cursor: aiLoading ? 'wait' : 'pointer',
              opacity: (!aiPrompt.trim() || aiLoading) ? 0.5 : 1, whiteSpace: 'nowrap'
            }}
          >
            {aiLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {aiError && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{aiError}</div>
        )}
      </div>

      {/* Add server */}
      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>
          Add MCP Server (JSON)
        </label>
        <textarea
          value={newServerJson}
          onChange={e => setNewServerJson(e.target.value)}
          placeholder={'{\n  "name": "fetch",\n  "type": "stdio",\n  "command": "uvx",\n  "args": ["mcp-server-fetch"]\n}\n\nClaude Desktop format also supported:\n{\n  "mcpServers": {\n    "fetch": { "command": "uvx", "args": ["mcp-server-fetch"] }\n  }\n}'}
          rows={6}
          style={{
            width: '100%', borderRadius: 10, background: 'var(--bg-main)', border: '1px solid var(--border)',
            padding: '12px 14px', fontSize: 13, fontFamily: "'SF Mono', Monaco, Menlo, monospace",
            color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6,
            transition: 'border-color 0.15s'
          }}
          className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
        />
        {addError && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 13 }}>
            {addError}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <button
            onClick={() => setNewServerJson(prettify(newServerJson))}
            disabled={!newServerJson.trim()}
            style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: "'SF Mono', Monaco, Menlo, monospace", opacity: newServerJson.trim() ? 1 : 0.4 }}
            className="hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text-secondary)]"
          >
            { } Prettify
          </button>
          <button
            onClick={handleAdd}
            disabled={adding || !newServerJson.trim()}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 500,
              cursor: adding ? 'wait' : 'pointer', transition: 'all 0.15s',
              opacity: (adding || !newServerJson.trim()) ? 0.6 : 1
            }}
            className="hover:opacity-85"
          >
            {adding ? 'Connecting...' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Skills Tab ──────────────────────────────── */
interface EditingRef {
  id?: string
  name: string
  content: string
}

interface EditingSkill {
  id?: string
  name: string
  description: string
  instructions: string
  references: EditingRef[]
}

/** File tree view for references — groups by directory */
function RefTree({ refs, updateRef, removeRef }: {
  refs: EditingRef[]
  updateRef: (idx: number, field: 'name' | 'content', value: string) => void
  removeRef: (idx: number) => void
}) {
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set())
  const [openFile, setOpenFile] = useState<number | null>(null)

  // Group refs by directory
  const tree = new Map<string, Array<{ ref: EditingRef; idx: number }>>()
  refs.forEach((ref, idx) => {
    const slash = ref.name.lastIndexOf('/')
    const dir = slash > 0 ? ref.name.slice(0, slash) : ''
    const list = tree.get(dir) ?? []
    list.push({ ref, idx })
    tree.set(dir, list)
  })

  const toggleDir = (dir: string) => {
    const next = new Set(openDirs)
    next.has(dir) ? next.delete(dir) : next.add(dir)
    setOpenDirs(next)
  }

  const fileName = (name: string) => {
    const slash = name.lastIndexOf('/')
    return slash > 0 ? name.slice(slash + 1) : name
  }

  const dirEntries = Array.from(tree.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div style={{
      borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border)',
      overflow: 'hidden', fontSize: 12.5
    }}>
      {dirEntries.map(([dir, files]) => {
        const isRoot = dir === ''
        const dirOpen = isRoot || openDirs.has(dir)
        return (
          <div key={dir}>
            {/* Directory header */}
            {!isRoot && (
              <div
                onClick={() => toggleDir(dir)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', cursor: 'pointer', userSelect: 'none',
                  borderTop: '1px solid var(--border)'
                }}
                className="hover:bg-[rgba(255,255,255,0.03)]"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: dirOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" fill={dirOpen ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)'} />
                </svg>
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{dir}/</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{files.length}</span>
              </div>
            )}
            {/* Files */}
            {dirOpen && files.map(({ ref, idx }) => {
              const isOpen = openFile === idx
              const lines = ref.content ? ref.content.split('\n').length : 0
              return (
                <div key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                  <div
                    onClick={() => setOpenFile(isOpen ? null : idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', paddingLeft: isRoot ? 10 : 28,
                      cursor: 'pointer', userSelect: 'none'
                    }}
                    className="hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="rgba(255,255,255,0.04)" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileName(ref.name) || 'untitled'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {lines > 0 ? `${lines}L` : ''}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); removeRef(idx) }}
                      style={{
                        width: 18, height: 18, borderRadius: 4, border: 'none',
                        background: 'transparent', color: 'var(--text-muted)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, opacity: 0.6
                      }}
                      className="hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger)] hover:opacity-100"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 10px 8px', paddingLeft: isRoot ? 10 : 28 }}>
                      <input
                        value={ref.name}
                        onChange={e => updateRef(idx, 'name', e.target.value)}
                        placeholder="path/to/file.md"
                        style={{
                          width: '100%', padding: '4px 0', marginBottom: 4,
                          background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                          fontSize: 12, color: 'var(--text-secondary)', outline: 'none',
                          fontFamily: "'SF Mono', Monaco, Menlo, monospace"
                        }}
                        className="placeholder-[var(--text-muted)]"
                      />
                      <textarea
                        value={ref.content}
                        onChange={e => updateRef(idx, 'content', e.target.value)}
                        placeholder="File content..."
                        rows={8}
                        style={{
                          width: '100%', padding: '6px 0',
                          background: 'transparent', border: 'none',
                          fontSize: 11.5, color: 'var(--text-primary)', outline: 'none',
                          fontFamily: "'SF Mono', Monaco, Menlo, monospace",
                          resize: 'vertical', lineHeight: 1.5
                        }}
                        className="placeholder-[var(--text-muted)]"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** Sparkle icon for AI buttons */
function SparkleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  )
}

interface GradeExpectation { text: string; passed: boolean; evidence: string }
interface GradeResult {
  expectations: GradeExpectation[]
  summary: { passed: number; failed: number; total: number; pass_rate: number }
  claims: Array<{ claim: string; type: string; verified: boolean; evidence: string }>
  eval_feedback: { suggestions: Array<{ reason: string; assertion?: string }>; overall: string }
}

interface CompareResult {
  winner: 'A' | 'B' | 'TIE'
  reasoning: string
  rubric: Record<string, { content_score: number; structure_score: number; effectiveness_score: number; overall_score: number }>
  output_quality: Record<string, { strengths: string[]; weaknesses: string[] }>
  mapping: { A: 'first' | 'second'; B: 'first' | 'second' }
}

interface AnalyzeResult {
  winner_analysis: { key_strengths: string[]; what_worked: string }
  loser_analysis: { key_weaknesses: string[]; what_failed: string }
  improvements: Array<{ category: string; suggestion: string; priority: string }>
  summary: string
}

function PromptsTab() {
  const { prompts, setPrompts, activeProvider, activeModel, setEvalSelectedSkillId, setShowEval } = useAppStore()
  const [editing, setEditing] = useState<EditingSkill | null>(null)
  const [aiLoading, setAiLoading] = useState<string | null>(null) // 'generate' | 'improve' | 'ref' | 'grade' | 'compare' | 'analyze' | null
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showImprove, setShowImprove] = useState(false)
  const [improveFeedback, setImproveFeedback] = useState('')
  const [showAiRef, setShowAiRef] = useState(false)
  const [aiRefPrompt, setAiRefPrompt] = useState('')
  // Sub-agent state
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [showGrade, setShowGrade] = useState(false)
  const [gradeCriteria, setGradeCriteria] = useState('Clear instructions\nGood examples\nEdge case coverage\nAppropriate scope\nEffective description')
  const [showCompare, setShowCompare] = useState(false)

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    const list = await window.api.prompts.list()
    setPrompts(list)
  }

  const handleSave = async () => {
    if (!editing) return
    const { name, description, instructions } = editing
    if (!name.trim() || !instructions.trim()) return

    if (editing.id) {
      await window.api.prompts.update(editing.id, name.trim(), description.trim(), instructions.trim())
      const existing = await window.api.prompts.refList(editing.id)
      const existingIds = new Set(existing.map((r: { id: string }) => r.id))
      const editingIds = new Set(editing.references.filter(r => r.id).map(r => r.id))
      for (const r of existing) {
        if (!editingIds.has(r.id)) await window.api.prompts.refDelete(r.id)
      }
      for (const r of editing.references) {
        if (r.id && existingIds.has(r.id)) {
          await window.api.prompts.refUpdate(r.id, r.name.trim(), r.content.trim())
        } else if (r.name.trim() && r.content.trim()) {
          await window.api.prompts.refAdd(editing.id, r.name.trim(), r.content.trim())
        }
      }
    } else {
      const created = await window.api.prompts.create(name.trim(), description.trim(), instructions.trim())
      for (const r of editing.references) {
        if (r.name.trim() && r.content.trim()) {
          await window.api.prompts.refAdd(created.id, r.name.trim(), r.content.trim())
        }
      }
    }
    setEditing(null)
    await loadPrompts()
  }

  const handleDelete = async (id: string) => {
    await window.api.prompts.delete(id)
    await loadPrompts()
  }

  const addRef = () => {
    if (!editing) return
    setEditing({ ...editing, references: [...editing.references, { name: '', content: '' }] })
  }

  const updateRef = (idx: number, field: 'name' | 'content', value: string) => {
    if (!editing) return
    const refs = [...editing.references]
    refs[idx] = { ...refs[idx], [field]: value }
    setEditing({ ...editing, references: refs })
  }

  const removeRef = (idx: number) => {
    if (!editing) return
    setEditing({ ...editing, references: editing.references.filter((_, i) => i !== idx) })
  }

  // ── AI Actions ──

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading('generate')
    setAiError(null)
    try {
      const result = await window.api.prompts.aiGenerate(aiPrompt.trim(), activeProvider, activeModel)
      setEditing({ name: result.name, description: result.description, instructions: result.instructions, references: [] })
      setShowAiGenerate(false)
      setAiPrompt('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const handleAiImprove = async () => {
    if (!editing || !improveFeedback.trim()) return
    setAiLoading('improve')
    setAiError(null)
    try {
      const result = await window.api.prompts.aiImprove(
        { name: editing.name, description: editing.description, instructions: editing.instructions },
        improveFeedback.trim(), activeProvider, activeModel
      )
      setEditing({ ...editing, name: result.name, description: result.description, instructions: result.instructions })
      setShowImprove(false)
      setImproveFeedback('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const handleAiRef = async () => {
    if (!editing || !aiRefPrompt.trim()) return
    setAiLoading('ref')
    setAiError(null)
    try {
      const result = await window.api.prompts.aiGenerateRef(editing.instructions, aiRefPrompt.trim(), activeProvider, activeModel)
      setEditing({ ...editing, references: [...editing.references, { name: result.name, content: result.content }] })
      setShowAiRef(false)
      setAiRefPrompt('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  // ── Sub-Agent Actions ──

  const handleGrade = async () => {
    if (!editing) return
    const criteria = gradeCriteria.split('\n').map(c => c.trim()).filter(Boolean)
    if (criteria.length === 0) return
    setAiLoading('grade')
    setAiError(null)
    setGradeResult(null)
    try {
      const result = await window.api.prompts.aiGrade(
        { name: editing.name, description: editing.description, instructions: editing.instructions },
        criteria, activeProvider, activeModel
      )
      setGradeResult(result)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const handleCompare = async () => {
    if (!editing || !editing.id) return
    const saved = prompts.find(p => p.id === editing.id)
    if (!saved) return
    setAiLoading('compare')
    setAiError(null)
    setCompareResult(null)
    setAnalyzeResult(null)
    try {
      const result = await window.api.prompts.aiCompare(
        { name: saved.name, description: saved.description || '', instructions: saved.instructions },
        { name: editing.name, description: editing.description, instructions: editing.instructions },
        activeProvider, activeModel
      )
      setCompareResult(result)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const handleAnalyze = async () => {
    if (!editing || !editing.id || !compareResult) return
    const saved = prompts.find(p => p.id === editing.id)
    if (!saved) return
    setAiLoading('analyze')
    setAiError(null)
    try {
      // Determine winner/loser from mapping
      const savedIsFirst = true // saved is always passed as first arg to compare
      const winnerIsFirst = compareResult.mapping[compareResult.winner as 'A' | 'B'] === 'first'
      const winnerSkill = (compareResult.winner === 'TIE')
        ? { name: editing.name, description: editing.description, instructions: editing.instructions }
        : winnerIsFirst
          ? { name: saved.name, description: saved.description || '', instructions: saved.instructions }
          : { name: editing.name, description: editing.description, instructions: editing.instructions }
      const loserSkill = (compareResult.winner === 'TIE')
        ? { name: saved.name, description: saved.description || '', instructions: saved.instructions }
        : winnerIsFirst
          ? { name: editing.name, description: editing.description, instructions: editing.instructions }
          : { name: saved.name, description: saved.description || '', instructions: saved.instructions }
      const result = await window.api.prompts.aiAnalyze(
        compareResult, winnerSkill, loserSkill, activeProvider, activeModel
      )
      setAnalyzeResult(result)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  // ── AI Generate overlay (shown before editing) ──
  if (showAiGenerate && !editing) {
    return (
      <div>
        <SectionTitle>AI Skill Generator</SectionTitle>
        <SectionDesc>Describe what you want the skill to do and AI will create a draft.</SectionDesc>

        {aiError && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
            {aiError}
          </div>
        )}

        <textarea
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="e.g. A skill for reviewing Python code with focus on PEP 8, type hints, security vulnerabilities, and performance. Should output a structured review with severity levels."
          rows={5}
          autoFocus
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            background: 'var(--bg-main)', border: '1px solid var(--border)',
            fontSize: 13, color: 'var(--text-primary)', outline: 'none',
            fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6,
            transition: 'border-color 0.15s'
          }}
          className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiGenerate() }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => { setShowAiGenerate(false); setAiPrompt(''); setAiError(null) }}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            className="hover:bg-[rgba(255,255,255,0.1)]"
          >
            Cancel
          </button>
          <button
            onClick={handleAiGenerate}
            disabled={!aiPrompt.trim() || aiLoading === 'generate'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
              fontSize: 13, fontWeight: 500, cursor: aiLoading ? 'wait' : 'pointer', transition: 'all 0.15s',
              opacity: (!aiPrompt.trim() || aiLoading === 'generate') ? 0.5 : 1
            }}
          >
            {aiLoading === 'generate' ? (
              <>
                <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                Generating...
              </>
            ) : (
              <>
                <SparkleIcon />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Skill list (compact) + Edit modal ──
  return (
    <div>
      {/* Edit modal overlay */}
      {editing && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)'
          }}
          onClick={() => { setEditing(null); setAiError(null); setShowImprove(false); setShowAiRef(false); setShowGrade(false); setShowCompare(false); setGradeResult(null); setCompareResult(null); setAnalyzeResult(null) }}
        >
          <div
            style={{
              width: 720, maxHeight: '90vh',
              background: 'var(--bg-sidebar)', borderRadius: 16,
              border: '1px solid var(--border)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editing.id ? 'Edit Skill' : 'New Skill'}
              </span>
              <button
                onClick={() => { setEditing(null); setAiError(null); setShowImprove(false); setShowAiRef(false); setShowGrade(false); setShowCompare(false); setGradeResult(null); setCompareResult(null); setAnalyzeResult(null) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer'
                }}
                className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div>
        <SectionDesc>Define a skill that shapes the assistant's behavior for specific tasks.</SectionDesc>

        {aiError && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
            {aiError}
            <button onClick={() => setAiError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>dismiss</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Name
            </label>
            <input
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Code Review"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg-main)', border: '1px solid var(--border)',
                fontSize: 14, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', transition: 'border-color 0.15s'
              }}
              className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Description
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>— when to use this skill</span>
            </label>
            <input
              value={editing.description}
              onChange={e => setEditing({ ...editing, description: e.target.value })}
              placeholder="e.g. Use when reviewing code for bugs, performance, and best practices"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg-main)', border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', transition: 'border-color 0.15s'
              }}
              className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Instructions
              </label>
              <button
                onClick={() => { setShowImprove(!showImprove); setAiError(null) }}
                disabled={!editing.instructions.trim() || !!aiLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  background: showImprove ? 'rgba(139,92,246,0.15)' : 'transparent',
                  color: showImprove ? '#a78bfa' : 'var(--text-muted)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                  opacity: (!editing.instructions.trim() || !!aiLoading) ? 0.4 : 1
                }}
                className="hover:bg-[rgba(139,92,246,0.1)] hover:text-[#a78bfa]"
              >
                <SparkleIcon size={11} />
                AI Improve
              </button>
            </div>
            {showImprove && (
              <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <input
                  value={improveFeedback}
                  onChange={e => setImproveFeedback(e.target.value)}
                  placeholder="What should be improved? e.g. Add more edge cases, make output format clearer..."
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
                    fontSize: 12.5, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit'
                  }}
                  className="placeholder-[var(--text-muted)]"
                  onKeyDown={e => { if (e.key === 'Enter') handleAiImprove() }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                  <button onClick={() => { setShowImprove(false); setImproveFeedback('') }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={handleAiImprove}
                    disabled={!improveFeedback.trim() || aiLoading === 'improve'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', borderRadius: 6, border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
                      fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                      opacity: (!improveFeedback.trim() || aiLoading === 'improve') ? 0.5 : 1
                    }}
                  >
                    {aiLoading === 'improve' ? 'Improving...' : 'Apply'}
                  </button>
                </div>
              </div>
            )}
            <textarea
              value={editing.instructions}
              onChange={e => setEditing({ ...editing, instructions: e.target.value })}
              placeholder="You are an expert..."
              rows={10}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                background: 'var(--bg-main)', border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6,
                transition: 'border-color 0.15s'
              }}
              className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
            />
          </div>

          {/* References section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                References
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>— API docs, examples, etc.</span>
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => { setShowAiRef(!showAiRef); setAiError(null) }}
                  disabled={!editing.instructions.trim() || !!aiLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: showAiRef ? 'rgba(139,92,246,0.15)' : 'transparent',
                    color: showAiRef ? '#a78bfa' : 'var(--text-muted)',
                    fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                    opacity: (!editing.instructions.trim() || !!aiLoading) ? 0.4 : 1
                  }}
                  className="hover:bg-[rgba(139,92,246,0.1)] hover:text-[#a78bfa]"
                >
                  <SparkleIcon size={11} />
                  AI
                </button>
                <button
                  onClick={addRef}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                    fontSize: 12, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                  className="hover:bg-[rgba(255,255,255,0.1)] hover:text-[var(--text-primary)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add
                </button>
              </div>
            </div>
            {showAiRef && (
              <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <input
                  value={aiRefPrompt}
                  onChange={e => setAiRefPrompt(e.target.value)}
                  placeholder="What reference to generate? e.g. REST API schema for user endpoints, React component patterns..."
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
                    fontSize: 12.5, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit'
                  }}
                  className="placeholder-[var(--text-muted)]"
                  onKeyDown={e => { if (e.key === 'Enter') handleAiRef() }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                  <button onClick={() => { setShowAiRef(false); setAiRefPrompt('') }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={handleAiRef}
                    disabled={!aiRefPrompt.trim() || aiLoading === 'ref'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', borderRadius: 6, border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
                      fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                      opacity: (!aiRefPrompt.trim() || aiLoading === 'ref') ? 0.5 : 1
                    }}
                  >
                    {aiLoading === 'ref' ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>
            )}
            {editing.references.length === 0 && !showAiRef ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                No references yet.
              </div>
            ) : (
              <RefTree refs={editing.references} updateRef={updateRef} removeRef={removeRef} />
            )}
          </div>

          {/* Sub-Agent: Grade & Compare */}
          {editing.instructions.trim() && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Quality Check</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => { setShowGrade(!showGrade); setShowCompare(false); setGradeResult(null) }}
                    disabled={!!aiLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6, border: 'none',
                      background: showGrade ? 'rgba(16,185,129,0.15)' : 'transparent',
                      color: showGrade ? '#34d399' : 'var(--text-muted)',
                      fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                      opacity: aiLoading ? 0.4 : 1
                    }}
                    className="hover:bg-[rgba(16,185,129,0.1)] hover:text-[#34d399]"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                    Grade
                  </button>
                  {editing.id && (
                    <button
                      onClick={() => { setShowCompare(!showCompare); setShowGrade(false); setCompareResult(null); setAnalyzeResult(null) }}
                      disabled={!!aiLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6, border: 'none',
                        background: showCompare ? 'rgba(59,130,246,0.15)' : 'transparent',
                        color: showCompare ? '#60a5fa' : 'var(--text-muted)',
                        fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                        opacity: aiLoading ? 0.4 : 1
                      }}
                      className="hover:bg-[rgba(59,130,246,0.1)] hover:text-[#60a5fa]"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      Compare
                    </button>
                  )}
                </div>
              </div>

              {/* Grade panel */}
              {showGrade && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                    Criteria (one per line)
                  </label>
                  <textarea
                    value={gradeCriteria}
                    onChange={e => setGradeCriteria(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
                      fontSize: 12.5, color: 'var(--text-primary)', outline: 'none',
                      fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6
                    }}
                    className="placeholder-[var(--text-muted)]"
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                    <button onClick={() => { setShowGrade(false); setGradeResult(null) }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    <button
                      onClick={handleGrade}
                      disabled={!gradeCriteria.trim() || aiLoading === 'grade'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 12px', borderRadius: 6, border: 'none',
                        background: '#10b981', color: 'white',
                        fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                        opacity: (!gradeCriteria.trim() || aiLoading === 'grade') ? 0.5 : 1
                      }}
                    >
                      {aiLoading === 'grade' ? 'Grading...' : 'Run Grade'}
                    </button>
                  </div>

                  {/* Grade results */}
                  {gradeResult && (
                    <div style={{ marginTop: 12, borderTop: '1px solid rgba(16,185,129,0.12)', paddingTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: gradeResult.summary.pass_rate >= 0.8 ? '#34d399' : gradeResult.summary.pass_rate >= 0.5 ? '#fbbf24' : '#f87171' }}>
                          {Math.round(gradeResult.summary.pass_rate * 100)}% pass rate
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          ({gradeResult.summary.passed}/{gradeResult.summary.total})
                        </span>
                      </div>
                      {gradeResult.expectations.map((exp, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < gradeResult.expectations.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <span style={{ fontSize: 12, flexShrink: 0, color: exp.passed ? '#34d399' : '#f87171' }}>
                            {exp.passed ? 'PASS' : 'FAIL'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{exp.text}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{exp.evidence}</div>
                          </div>
                        </div>
                      ))}
                      {gradeResult.eval_feedback.overall && (
                        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {gradeResult.eval_feedback.overall}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Compare panel */}
              {showCompare && editing.id && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)', marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
                    Compare the saved version against your current edits using a blind A/B test.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button onClick={() => { setShowCompare(false); setCompareResult(null); setAnalyzeResult(null) }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    <button
                      onClick={handleCompare}
                      disabled={aiLoading === 'compare'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 12px', borderRadius: 6, border: 'none',
                        background: '#3b82f6', color: 'white',
                        fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                        opacity: aiLoading === 'compare' ? 0.5 : 1
                      }}
                    >
                      {aiLoading === 'compare' ? 'Comparing...' : 'Run Compare'}
                    </button>
                  </div>

                  {/* Compare results */}
                  {compareResult && (
                    <div style={{ marginTop: 12, borderTop: '1px solid rgba(59,130,246,0.12)', paddingTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: compareResult.winner === 'TIE' ? '#fbbf24' : '#60a5fa' }}>
                          {compareResult.winner === 'TIE' ? 'Tie' : `Winner: ${compareResult.mapping[compareResult.winner] === 'first' ? 'Saved' : 'Current Edit'}`}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                        {compareResult.reasoning}
                      </div>

                      {/* Rubric scores */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        {['A', 'B'].map(label => {
                          const scores = compareResult.rubric[label]
                          const who = compareResult.mapping[label as 'A' | 'B'] === 'first' ? 'Saved' : 'Current'
                          return (
                            <div key={label} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{who}</div>
                              {scores && ['content_score', 'structure_score', 'effectiveness_score'].map(key => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', padding: '1px 0' }}>
                                  <span>{key.replace('_score', '').replace('_', ' ')}</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>{scores[key as keyof typeof scores]}/5</span>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>

                      {/* Analyze button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleAnalyze}
                          disabled={aiLoading === 'analyze'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '4px 12px', borderRadius: 6, border: 'none',
                            background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                            fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                            opacity: aiLoading === 'analyze' ? 0.5 : 1
                          }}
                        >
                          {aiLoading === 'analyze' ? 'Analyzing...' : 'Analyze & Get Suggestions'}
                        </button>
                      </div>

                      {/* Analyze results */}
                      {analyzeResult && (
                        <div style={{ marginTop: 10, borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 10 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                            {analyzeResult.summary}
                          </div>
                          {analyzeResult.improvements.length > 0 && (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Suggestions</div>
                              {analyzeResult.improvements.map((imp, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < analyzeResult.improvements.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 600, flexShrink: 0, padding: '1px 5px', borderRadius: 4,
                                    background: imp.priority === 'high' ? 'rgba(239,68,68,0.12)' : imp.priority === 'medium' ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)',
                                    color: imp.priority === 'high' ? '#f87171' : imp.priority === 'medium' ? '#fbbf24' : 'var(--text-muted)',
                                    textTransform: 'uppercase'
                                  }}>
                                    {imp.priority}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>[{imp.category}]</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{imp.suggestion}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setEditing(null); setAiError(null); setShowImprove(false); setShowAiRef(false); setShowGrade(false); setShowCompare(false); setGradeResult(null); setCompareResult(null); setAnalyzeResult(null) }}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
              }}
              className="hover:bg-[rgba(255,255,255,0.1)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!editing.name.trim() || !editing.instructions.trim()}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: 'white',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                opacity: (!editing.name.trim() || !editing.instructions.trim()) ? 0.4 : 1
              }}
              className="hover:opacity-85"
            >
              Save
            </button>
          </div>
        </div>
      </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <SectionTitle>Skills</SectionTitle>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setShowAiGenerate(true); setAiError(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
            }}
            className="hover:opacity-85"
          >
            <SparkleIcon size={13} />
            AI Generate
          </button>
          <button
            onClick={() => setEditing({ name: '', description: '', instructions: '', references: [] })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'white',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
            }}
            className="hover:opacity-85"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>
      </div>
      <SectionDesc>Skills shape the assistant's behavior — select one before starting a conversation.</SectionDesc>

      {prompts.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No skills yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {prompts.map(prompt => (
            <div key={prompt.id} style={{
              padding: '8px 12px', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              cursor: 'pointer', transition: 'background 0.12s'
            }}
              className="hover:bg-[rgba(255,255,255,0.04)]"
              onClick={() => setEditing({
                id: prompt.id,
                name: prompt.name,
                description: prompt.description || '',
                instructions: prompt.instructions,
                references: prompt.references.map(r => ({ id: r.id, name: r.name, content: r.content }))
              })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" />
                </svg>
                <span style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prompt.name}
                </span>
                {prompt.references.length > 0 && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {prompt.references.length} ref
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setEvalSelectedSkillId(prompt.id)
                    setShowEval(true)
                  }}
                  title="Eval"
                  style={{
                    width: 26, height: 26, borderRadius: 5, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-[rgba(16,185,129,0.1)] hover:text-[#34d399]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(prompt.id)}
                  title="Delete"
                  style={{
                    width: 26, height: 26, borderRadius: 5, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── General Tab ───────────────────────────────── */
function GeneralTab() {
  const { setConversations, setActiveConversationId, conversations, theme, setTheme } = useAppStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDeleteAll = async () => {
    await window.api.conv.deleteAll()
    setConversations([])
    setActiveConversationId(null)
    setConfirmDelete(false)
  }

  return (
    <div>
      <SectionTitle>General</SectionTitle>
      <SectionDesc>Application info and preferences.</SectionDesc>

      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Kangnam Client</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>Desktop LLM chat client</p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}>v1.0.0</span>
        </div>
      </div>

      {/* Theme */}
      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Theme</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>Switch between light and dark mode</p>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'var(--bg-hover)' }}>
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500,
                  background: theme === t ? 'var(--accent)' : 'transparent',
                  color: theme === t ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data management */}
      <SectionTitle>Data</SectionTitle>
      <SectionDesc>Manage your conversation history.</SectionDesc>

      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Delete all conversations</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{conversations.length} conversations</p>
          </div>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={conversations.length === 0}
              style={{
                padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500,
                background: 'rgba(239,68,68,0.1)', color: conversations.length === 0 ? 'var(--text-muted)' : 'var(--danger)',
                cursor: conversations.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                opacity: conversations.length === 0 ? 0.5 : 1
              }}
              className={conversations.length > 0 ? 'hover:bg-[rgba(239,68,68,0.2)]' : ''}
            >
              Delete all
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                className="hover:bg-[rgba(255,255,255,0.1)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, background: 'var(--danger)', color: 'white', cursor: 'pointer', transition: 'all 0.15s' }}
                className="hover:opacity-85"
              >
                Confirm delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Shared ─────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>{children}</h3>
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>{children}</p>
}
