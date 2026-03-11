import type { Message } from '../../stores/app-store'

interface MessageListProps {
  messages: Message[]
  streamingText: string | null
}

export function MessageList({ messages, streamingText }: MessageListProps) {
  return (
    <div className="flex flex-col gap-4 px-4">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Streaming message */}
      {streamingText !== null && (
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
            AI
          </div>
          <div className="message-content text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap flex-1 min-w-0">
            {streamingText}
            <span className="inline-block w-2 h-4 bg-[var(--accent)] animate-pulse ml-0.5" />
          </div>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex gap-3 justify-end">
        <div className="message-content max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[var(--accent)] text-white text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.role === 'tool') {
    return (
      <div className="flex gap-3">
        <div className="w-7 h-7 shrink-0" />
        <div className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs text-[var(--text-muted)] font-mono max-w-[80%] overflow-x-auto">
          <span className="text-[var(--text-secondary)]">Tool result:</span>
          <pre className="mt-1 whitespace-pre-wrap">{message.content}</pre>
        </div>
      </div>
    )
  }

  // Assistant
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
        AI
      </div>
      <div className="message-content text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap flex-1 min-w-0">
        {message.content}
      </div>
    </div>
  )
}
