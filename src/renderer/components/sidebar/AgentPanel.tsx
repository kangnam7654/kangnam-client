import { useAppStore, type UnifiedMessage } from '../../stores/app-store'
import { useMemo } from 'react'

interface AgentState {
  id: string
  name: string
  description: string
  status: 'running' | 'completed'
  lastMessage: string
}

export function AgentPanel() {
  const { messages } = useAppStore()

  const agents = useMemo(() => {
    const agentMap = new Map<string, AgentState>()

    for (const msg of messages) {
      if (msg.type === 'agent_start') {
        agentMap.set(msg.id, {
          id: msg.id,
          name: msg.name,
          description: msg.description,
          status: 'running',
          lastMessage: '',
        })
      } else if (msg.type === 'agent_progress') {
        const agent = agentMap.get(msg.id)
        if (agent) agent.lastMessage = msg.message
      } else if (msg.type === 'agent_end') {
        const agent = agentMap.get(msg.id)
        if (agent) {
          agent.status = 'completed'
          agent.lastMessage = msg.result
        }
      }
    }

    return Array.from(agentMap.values())
  }, [messages])

  if (agents.length === 0) return null

  return (
    <div className="border-t border-[var(--border-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-secondary)]">Agents</span>
        <span className="text-xs text-[var(--text-tertiary)]">{agents.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)]">{agent.name}</span>
              <span
                className={`text-[10px] ${
                  agent.status === 'running' ? 'text-green-400' : 'text-[var(--text-tertiary)]'
                }`}
              >
                {agent.status === 'running' ? 'running' : 'done'}
              </span>
            </div>
            {agent.lastMessage && (
              <p className="mt-1 truncate text-[11px] text-[var(--text-tertiary)]">{agent.lastMessage}</p>
            )}
            {agent.status === 'running' && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-main)]">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-green-400" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
