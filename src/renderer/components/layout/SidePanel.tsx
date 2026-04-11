import { useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import type { Conversation } from '../../stores/app-store'
import { ConversationList } from '../sidebar/ConversationList'
import { SkillBrowser } from '../sidebar/SkillBrowser'
import { AgentPanel } from '../sidebar/AgentPanel'

export function SidePanel() {
  const { sidePanelTab, sidePanelVisible, sidePanelWidth, currentSessionId } = useAppStore()

  // Refresh conversation list when chats tab is active or session changes
  useEffect(() => {
    if (sidePanelTab !== 'chats') return
    window.api?.conv?.list?.()
      .then((convs: unknown) => useAppStore.getState().setConversations(convs as Conversation[]))
      .catch(() => {})
  }, [sidePanelTab, currentSessionId])

  if (!sidePanelVisible) return null

  return (
    <div
      style={{
        width: sidePanelWidth,
        minWidth: sidePanelWidth,
        height: '100%',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div className="drag-region" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44 }} />
        <span className="no-drag" style={{ position: 'relative' }}>
          {sidePanelTab === 'chats' && 'Chats'}
          {sidePanelTab === 'files' && 'Explorer'}
          {sidePanelTab === 'skills' && 'Skills & Commands'}
          {sidePanelTab === 'agents' && 'Agents'}
          {sidePanelTab === 'mcp' && 'MCP Servers'}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {sidePanelTab === 'chats' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            <ConversationList />
          </div>
        )}
        {sidePanelTab === 'skills' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <SkillBrowser />
          </div>
        )}
        {sidePanelTab === 'agents' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <AgentPanel />
          </div>
        )}
        {sidePanelTab === 'files' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            File Explorer (Phase 3)
          </div>
        )}
        {sidePanelTab === 'mcp' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            MCP Servers (Phase 3)
          </div>
        )}
      </div>
    </div>
  )
}
