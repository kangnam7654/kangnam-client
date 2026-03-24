import { useState, useEffect, useCallback, Component, type ReactNode } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useAppStore, type Message } from '../../stores/app-store'
import { useAssistantRuntime } from '../../hooks/use-assistant-runtime'
import { AssistantThread } from './AssistantThread'
import { ChatSearchBar } from './ChatSearchBar'
import { CoworkView } from '../cowork/CoworkView'
import { WelcomeScreen } from './WelcomeScreen'

class ChatErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error('ChatContent error:', error) }
  render() {
    if (this.state.error) {
      console.error('ChatContent error:', this.state.error)
      return (
        <div style={{ padding: 40, color: 'var(--danger, #ef4444)', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Please start a new conversation or restart the app.</p>
        </div>
      )
    }
    return this.props.children
  }
}

function ChatContent() {
  const runtime = useAssistantRuntime()
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <ChatErrorBoundary>
      <AssistantRuntimeProvider runtime={runtime}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, position: 'relative' }}>
          <ChatHeader />
          {showSearch && (
            <div style={{ position: 'absolute', top: 48, right: 16, zIndex: 40 }}>
              <ChatSearchBar onClose={() => setShowSearch(false)} />
            </div>
          )}
          <AssistantThread />
        </div>
      </AssistantRuntimeProvider>
    </ChatErrorBoundary>
  )
}

function TopBar({ showTitle = false }: { showTitle?: boolean }) {
  const { conversations, activeConversationId, activeView, setActiveView } = useAppStore()
  const conv = conversations.find(c => c.id === activeConversationId)

  const tabs = [
    { id: 'chat' as const, label: 'Chat' },
    { id: 'cowork' as const, label: 'Cowork' }
  ]

  return (
    <div className="drag-region h-12 flex items-center justify-center shrink-0 relative">
      <div className="no-drag flex items-center cursor-default">
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--overlay-soft)', borderRadius: 10, padding: 3 }}>
          {tabs.map(tab => (
            <span
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              style={{
                padding: '5px 14px',
                borderRadius: 7,
                background: activeView === tab.id ? 'var(--bg-hover)' : 'transparent',
                fontSize: 13,
                color: activeView === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: activeView === tab.id ? 500 : 400,
                cursor: 'pointer',
                lineHeight: 1,
                transition: 'all 0.15s'
              }}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      {showTitle && activeView === 'chat' && conv && (
        <div className="absolute left-6 no-drag" style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {conv.title}
        </div>
      )}

      <div className="absolute right-4 no-drag">
        <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[11px] font-semibold cursor-pointer hover:opacity-85 transition-opacity">
          U
        </div>
      </div>
    </div>
  )
}

function ChatHeader() {
  return <TopBar showTitle />
}

export function ChatView() {
  const { activeConversationId, activeView, setMessages } = useAppStore()

  const loadMessages = useCallback(async (convId: string) => {
    const msgs = await window.api.conv.getMessages(convId) as Message[]
    setMessages(msgs)
  }, [setMessages])

  useEffect(() => {
    if (activeConversationId) {
      // Skip DB reload if we're already streaming (optimistic message is set)
      const { isStreaming } = useAppStore.getState()
      if (!isStreaming) {
        loadMessages(activeConversationId)
      }
    } else {
      setMessages([])
    }
  }, [activeConversationId, loadMessages, setMessages])

  // Cowork view
  if (activeView === 'cowork') {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <CoworkView />
      </div>
    )
  }

  // Chat view
  if (!activeConversationId) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <WelcomeScreen />
      </div>
    )
  }

  return <ChatContent />
}

