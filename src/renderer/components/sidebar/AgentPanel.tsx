import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

interface AgentState {
  id: string
  name: string
  description: string
  status: 'running' | 'completed'
  lastMessage: string
}

interface CustomAgent {
  name: string
  description: string
  model: string | null
}

export function AgentPanel() {
  const { messages, sessionMeta, currentSessionId } = useAppStore()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Load custom agents from ~/.claude/agents/
  const loadCustomAgents = useCallback(async () => {
    try {
      const agents = await window.api.agents.listClaude()
      setCustomAgents(agents)
    } catch { setCustomAgents([]) }
  }, [])

  useEffect(() => { loadCustomAgents() }, [loadCustomAgents])

  const activeAgents = useMemo(() => {
    const agentMap = new Map<string, AgentState>()
    for (const msg of messages) {
      if (msg.type === 'agent_start') {
        agentMap.set(msg.id, { id: msg.id, name: msg.name, description: msg.description, status: 'running', lastMessage: '' })
      } else if (msg.type === 'agent_progress') {
        const agent = agentMap.get(msg.id)
        if (agent) agent.lastMessage = msg.message
      } else if (msg.type === 'agent_end') {
        const agent = agentMap.get(msg.id)
        if (agent) { agent.status = 'completed'; agent.lastMessage = msg.result }
      }
    }
    return Array.from(agentMap.values())
  }, [messages])

  const customNames = new Set(customAgents.map(a => a.name))
  const builtinAgents = (sessionMeta?.agents ?? []).filter(n => !customNames.has(n))

  const allAgents = [
    ...customAgents.map(a => ({ name: a.name, description: a.description, isCustom: true })),
    ...builtinAgents.map(n => ({ name: n, description: '', isCustom: false })),
  ]

  const filtered = (search
    ? allAgents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : allAgents
  ).sort((a, b) => a.name.localeCompare(b.name))

  const handleSpawn = async (agentName: string) => {
    if (!currentSessionId) return
    try {
      await cliApi.sendMessage(currentSessionId, `Spawn a ${agentName} agent to help with the current task.`)
      useAppStore.getState().addMessage({ type: 'user_message', text: `@${agentName}` })
      useAppStore.getState().setIsStreaming(true)
    } catch { /* error will appear in chat */ }
  }

  const handleEdit = (name: string) => {
    useAppStore.getState().openStudio('agent', name)
  }

  const handleNew = () => {
    useAppStore.getState().openStudio('agent')
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await window.api.agents.deleteClaude(deleteConfirm)
      await loadCustomAgents()
      setDeleteConfirm(null)
      if (expanded === deleteConfirm) setExpanded(null)
    } catch { /* ignore */ }
  }

  if (!sessionMeta && customAgents.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>
        세션이 시작되면 Agent 목록이 표시됩니다
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header: Search + New */}
      <div style={{ padding: '8px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, overflow: 'hidden' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            flex: 1, minWidth: 0, padding: '4px 8px', fontSize: 11,
            background: 'var(--bg-main)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <button
          onClick={handleNew}
          title="새 에이전트 만들기"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, flexShrink: 0,
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Active agents */}
        {activeAgents.length > 0 && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Active ({activeAgents.filter(a => a.status === 'running').length})
            </div>
            {activeAgents.map(agent => (
              <div key={agent.id} style={{
                padding: '6px 8px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
                background: agent.status === 'running' ? 'rgba(74,222,128,0.05)' : 'transparent',
                borderLeft: `2px solid ${agent.status === 'running' ? 'var(--success)' : 'var(--text-muted)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: agent.status === 'running' ? 'var(--success)' : 'var(--text-muted)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{agent.status}</span>
                </div>
                {agent.lastMessage && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agent.lastMessage.slice(0, 80)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Available agents */}
        <div style={{ padding: '8px 4px' }}>
          <div style={{ padding: '0 8px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Available ({filtered.length})
          </div>
          {filtered.map(({ name, description, isCustom }) => (
            <div key={name} style={{ margin: '0 4px' }}>
              <button
                onClick={() => setExpanded(expanded === name ? null : name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: expanded === name ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.15s',
                }}
                className="hover:bg-[var(--bg-hover)]"
              >
                <span style={{ color: isCustom ? 'var(--accent)' : 'var(--success)', fontSize: 10 }}>
                  {isCustom ? '◆' : '●'}
                </span>
                <span style={{ flex: 1 }}>{name}</span>
                {isCustom && <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>CUSTOM</span>}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: expanded === name ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', opacity: 0.4 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {expanded === name && (
                <div style={{ padding: '4px 8px 8px 28px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <div style={{ marginBottom: 8 }}>
                    {description || (isCustom ? 'Custom agent' : 'Built-in agent')}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSpawn(name)} style={btnAccent}>실행</button>
                    {isCustom && (
                      <>
                        <button onClick={() => handleEdit(name)} style={btnOutline}>편집</button>
                        <button onClick={() => setDeleteConfirm(name)} style={btnDanger}>삭제</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor modal removed — Studio opens in main area */}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: 24, maxWidth: 320, width: '90%',
            border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>에이전트 삭제</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              <strong>{deleteConfirm}</strong> 에이전트를 삭제하시겠습니까?<br />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>~/.claude/agents/{deleteConfirm}.md 파일이 삭제됩니다.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={btnOutline}>취소</button>
              <button onClick={handleDelete} style={{ ...btnDanger, fontWeight: 600 }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnAccent: React.CSSProperties = {
  padding: '4px 12px', fontSize: 11, fontWeight: 600,
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
}
const btnOutline: React.CSSProperties = {
  padding: '4px 12px', fontSize: 11,
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
}
const btnDanger: React.CSSProperties = {
  padding: '4px 12px', fontSize: 11,
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
}
