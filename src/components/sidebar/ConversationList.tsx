import { useAppStore } from '../../stores/app-store'
import { useChat } from '../../hooks/use-chat'

export function ConversationList() {
  const { conversations, activeConversationId, setActiveConversationId } = useAppStore()
  const { loadMessages, deleteConversation } = useChat()

  const handleSelect = async (id: string) => {
    setActiveConversationId(id)
    await loadMessages(id)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteConversation(id)
    if (activeConversationId === id) {
      setActiveConversationId(null)
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-[var(--text-muted)] text-xs">
        No conversations yet
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {conversations.map(conv => (
        <button
          key={conv.id}
          onClick={() => handleSelect(conv.id)}
          className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
            activeConversationId === conv.id
              ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <span className="flex-1 truncate">{conv.title}</span>
          <span
            onClick={(e) => handleDelete(e, conv.id)}
            className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] transition-opacity text-xs"
          >
            x
          </span>
        </button>
      ))}
    </div>
  )
}
