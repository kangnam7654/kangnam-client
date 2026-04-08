import { useEffect, useCallback } from 'react'
import { useAppStore, type Conversation } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'
import { ConversationList } from './ConversationList'
import { AgentPanel } from './AgentPanel'
import { SkillBrowser } from './SkillBrowser'
import { TaskPanel } from './TaskPanel'

export function Sidebar() {
  const {
    setShowSearch, setShowSettings, setSettingsTab,
    setConversations, setActiveConversationId,
    sidebarCollapsed, toggleSidebar
  } = useAppStore()

  const loadConversations = useCallback(async () => {
    try {
      const convs = await window.api.conv.list() as Conversation[]
      setConversations(convs)
    } catch {
      // conv.list may fail if Tauri commands aren't registered — ignore silently
    }
  }, [setConversations])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const handleNewChat = async () => {
    const { currentSessionId, clearMessages, setCurrentSessionId, setIsStreaming, setCurrentWorkingDir } = useAppStore.getState()
    if (currentSessionId) {
      try { await cliApi.stopSession(currentSessionId) } catch { /* ignore */ }
    }
    clearMessages()
    setCurrentSessionId(null)
    setIsStreaming(false)
    setCurrentWorkingDir(null)
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
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onClick={handleNewChat}
            className="no-drag flex items-center gap-2.5 flex-1 px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="New chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] shrink-0">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New chat</span>
          </button>

          <button
            onClick={() => setShowSearch(true)}
            className="no-drag flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
            aria-label="Search conversations"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Collapse button */}
          <button
            onClick={toggleSidebar}
            className="no-drag flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
            aria-label="Toggle sidebar"
            title="Hide sidebar (Cmd+\)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2">
          <ConversationList />
        </div>

        {/* Skills (shown when session is active) */}
        <SkillBrowser />

        {/* Active Agents */}
        <AgentPanel />

        {/* Background Tasks */}
        <TaskPanel />

        {/* Bottom — User + Settings */}
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
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
