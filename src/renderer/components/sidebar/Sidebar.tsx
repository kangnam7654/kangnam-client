import { useEffect, useCallback } from 'react'
import { useAppStore, type Conversation } from '../../stores/app-store'
import { ConversationList } from './ConversationList'

export function Sidebar() {
  const {
    setShowSearch, setShowSettings, setSettingsTab,
    setConversations, setActiveConversationId,
    sidebarCollapsed, toggleSidebar
  } = useAppStore()

  const loadConversations = useCallback(async () => {
    const convs = await window.api.conv.list() as Conversation[]
    setConversations(convs)
  }, [setConversations])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const handleNewChat = () => {
    setActiveConversationId(null)
  }

  return (
    <>
      {/* Sidebar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: sidebarCollapsed ? 0 : 260,
          minWidth: sidebarCollapsed ? 0 : 260,
          overflow: 'hidden',
          background: 'var(--bg-sidebar)',
          borderRight: sidebarCollapsed ? 'none' : '1px solid var(--border-subtle)',
          transition: 'width 0.2s ease, min-width 0.2s ease, border 0.2s ease',
        }}
      >
        {/* Drag region */}
        <div className="drag-region h-12 shrink-0" />

        {/* Header — New Chat + Search */}
        <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleNewChat}
            className="no-drag hover:bg-[var(--bg-hover)]"
            aria-label="New chat"
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              background: 'transparent',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
              color: 'var(--text-primary)',
              transition: 'all 0.15s'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>New chat</span>
          </button>

          <button
            onClick={() => setShowSearch(true)}
            className="no-drag hover:bg-[var(--bg-hover)]"
            aria-label="Search conversations"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40,
              border: '1px solid var(--border)',
              background: 'transparent',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s',
              flexShrink: 0
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Collapse button */}
          <button
            onClick={toggleSidebar}
            className="no-drag hover:bg-[var(--bg-hover)]"
            aria-label="Toggle sidebar"
            title="Hide sidebar (Cmd+\)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40,
              border: '1px solid var(--border)',
              background: 'transparent',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s',
              flexShrink: 0
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 8 }}>
          <ConversationList />
        </div>

        {/* Bottom — User + Settings */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 16px' }}>
          <button
            onClick={() => { setSettingsTab('providers'); setShowSettings(true) }}
            className="sidebar-item w-full"
            aria-label="Settings"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
              U
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-[var(--text-primary)] font-medium truncate leading-tight">Settings</div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] shrink-0">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expand button — shown when sidebar is collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          title="Show sidebar (Cmd+\)"
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36,
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            borderRadius: 10,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.15s',
          }}
          className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      )}
    </>
  )
}
