import { useState, useRef, useCallback } from 'react'

interface InputAreaProps {
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
}

export function InputArea({ onSend, onStop, isStreaming }: InputAreaProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    if (!text.trim() || isStreaming) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, isStreaming, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    // Auto-resize textarea
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Send a message..."
        rows={1}
        className="flex-1 resize-none rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        style={{ maxHeight: 200 }}
      />
      {isStreaming ? (
        <button
          onClick={onStop}
          className="px-4 py-3 rounded-xl bg-[var(--danger)] hover:opacity-90 text-white text-sm font-medium transition-opacity shrink-0"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="px-4 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shrink-0"
        >
          Send
        </button>
      )}
    </div>
  )
}
