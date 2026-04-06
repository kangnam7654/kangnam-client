import { useState } from 'react'
import type { MCPServerStatus } from '../types'

interface MCPTabProps {
  servers: MCPServerStatus[]
  newServerJson: string
  setNewServerJson: (v: string) => void
  onAdd: () => Promise<void>
  onRemove: (name: string) => void
  onUpdate: () => void
}

export function MCPTab({ servers, newServerJson, setNewServerJson, onAdd, onRemove, onUpdate }: MCPTabProps) {
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editingServer, setEditingServer] = useState<{ name: string; json: string } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reconnecting, setReconnecting] = useState<string | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const handleAiAssist = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await window.api.mcp.aiAssist(aiPrompt.trim(), '', '') as string
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
                  {'{ }'} Prettify
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
            {'{ }'} Prettify
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

function SparkleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>{children}</h3>
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>{children}</p>
}
