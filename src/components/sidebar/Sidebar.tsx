import { useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useChat } from '../../hooks/use-chat'
import { ConversationList } from './ConversationList'
import { ProviderSelector } from './ProviderSelector'

export function Sidebar() {
  const { setShowSettings, setSettingsTab } = useAppStore()
  const { createConversation, loadConversations } = useChat()

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const handleNewChat = async () => {
    const conv = await createConversation()
    useAppStore.getState().setActiveConversationId(conv.id)
  }

  return (
    <div className="flex flex-col h-full w-64 bg-[var(--bg-secondary)] border-r border-[var(--border)]">
      {/* Drag region + New Chat */}
      <div className="drag-region pt-8 px-3 pb-2">
        <button
          onClick={handleNewChat}
          className="no-drag w-full px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
        >
          + New Chat
        </button>
      </div>

      {/* Provider Selector */}
      <div className="px-3 pb-2">
        <ProviderSelector />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        <ConversationList />
      </div>

      {/* Bottom Bar */}
      <div className="p-3 border-t border-[var(--border)]">
        <button
          onClick={() => { setSettingsTab('providers'); setShowSettings(true) }}
          className="w-full px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
        >
          Settings
        </button>
      </div>
    </div>
  )
}
