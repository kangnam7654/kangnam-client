import { useState, useEffect } from 'react'
import { useAppStore, type Agent } from '../../../stores/app-store'

interface EditingAgent {
  id?: string
  name: string
  description: string
  instructions: string
  model: string
  maxTurns: number
}

const EMPTY_AGENT: EditingAgent = {
  name: '',
  description: '',
  instructions: '',
  model: '',
  maxTurns: 10,
}

export function AgentsTab() {
  const { agents, setAgents } = useAppStore()
  const [editing, setEditing] = useState<EditingAgent | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    const list = await window.api.agents.list() as Agent[]
    setAgents(list)
  }

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return
    const model = editing.model.trim() || undefined
    if (editing.id) {
      await window.api.agents.update(
        editing.id, editing.name.trim(), editing.description.trim(),
        editing.instructions.trim(), model, undefined, editing.maxTurns
      )
    } else {
      await window.api.agents.create(
        editing.name.trim(), editing.description.trim(),
        editing.instructions.trim(), model, undefined, editing.maxTurns
      )
    }
    setEditing(null)
    await loadAgents()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    await window.api.agents.delete(id)
    await loadAgents()
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setEditing(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back
          </button>
          <button
            onClick={handleSave}
            disabled={!editing.name.trim()}
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: editing.name.trim() ? 1 : 0.4 }}
          >
            Save
          </button>
        </div>

        {/* Name */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Name</label>
          <input
            value={editing.name}
            onChange={e => setEditing({ ...editing, name: e.target.value })}
            placeholder="e.g. code-reviewer"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea
            value={editing.description}
            onChange={e => setEditing({ ...editing, description: e.target.value })}
            placeholder="When should this agent be used?"
            rows={2}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {/* Instructions */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Instructions (System Prompt)</label>
          <textarea
            value={editing.instructions}
            onChange={e => setEditing({ ...editing, instructions: e.target.value })}
            placeholder="The agent's full system prompt..."
            rows={12}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5, boxSizing: 'border-box' }}
          />
        </div>

        {/* Model + Max Turns row */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Model Override</label>
            <input
              value={editing.model}
              onChange={e => setEditing({ ...editing, model: e.target.value })}
              placeholder="(inherit from conversation)"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ width: 100 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Max Turns</label>
            <input
              type="number"
              value={editing.maxTurns}
              onChange={e => setEditing({ ...editing, maxTurns: parseInt(e.target.value) || 10 })}
              min={1}
              max={50}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Agents run in isolated contexts with their own system prompt.
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY_AGENT })}
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          + New Agent
        </button>
      </div>

      {agents.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No agents yet. Create one to get started.
        </div>
      )}

      {agents.map(agent => (
        <div
          key={agent.id}
          style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a5 5 0 015 5v3a5 5 0 01-10 0V7a5 5 0 015-5z" />
              <path d="M8 21h8" /><path d="M12 17v4" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.description || '(no description)'}
            </div>
          </div>
          {agent.model && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>
              {agent.model}
            </span>
          )}
          <button
            onClick={() => setEditing({
              id: agent.id,
              name: agent.name,
              description: agent.description,
              instructions: agent.instructions,
              model: agent.model || '',
              maxTurns: agent.maxTurns,
            })}
            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(agent.id)}
            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
