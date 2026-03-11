import { useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useChat } from '../../hooks/use-chat'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'

export function ChatView() {
  const { activeConversationId, activeProvider } = useAppStore()
  const { messages, isStreaming, streamingText, sendMessage, stopGeneration } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
            Kangnam Client
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Select a conversation or create a new one
          </p>
          <div className="flex gap-2 justify-center text-xs text-[var(--text-muted)]">
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">Codex</span>
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">Gemini</span>
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">Antigravity</span>
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">Copilot</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="drag-region h-12 flex items-center px-4 border-b border-[var(--border)]">
        <span className="no-drag text-xs text-[var(--text-muted)] px-2 py-0.5 rounded bg-[var(--bg-tertiary)]">
          {activeProvider}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-4">
          <MessageList messages={messages} streamingText={isStreaming ? streamingText : null} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)]">
        <div className="max-w-3xl mx-auto p-4">
          <InputArea
            onSend={sendMessage}
            onStop={stopGeneration}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  )
}
