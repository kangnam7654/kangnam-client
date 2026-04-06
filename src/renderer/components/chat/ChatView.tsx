import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'
import { MessageRenderer } from './MessageRenderer'
import { SafetyDialog } from './SafetyDialog'
import { WorkdirSelector } from './WorkdirSelector'

function TopBar() {
  return (
    <div className="drag-region h-12 flex items-center justify-center shrink-0 relative">
      <div className="no-drag flex items-center cursor-default">
        <span className="text-sm font-medium text-[var(--text-secondary)]">kangnam</span>
      </div>
      <div className="absolute right-4 no-drag">
        <button
          onClick={() => useAppStore.getState().setShowSettings(true)}
          className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[11px] font-semibold cursor-pointer hover:opacity-85 transition-opacity border-none"
          aria-label="Settings"
        >
          U
        </button>
      </div>
    </div>
  )
}

function MessageInput() {
  const [text, setText] = useState('')
  const { currentSessionId } = useAppStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed || !currentSessionId) return
    setText('')
    await cliApi.sendMessage(currentSessionId, trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  return (
    <div className="shrink-0 border-t border-[var(--border-subtle)] p-4">
      <div className="relative flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentSessionId ? 'Message…' : 'Select a working directory to start'}
          disabled={!currentSessionId}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:opacity-40"
          aria-label="Message input"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || !currentSessionId}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white disabled:opacity-40 hover:opacity-85 transition-opacity"
          aria-label="Send message"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function ChatContent() {
  const { messages, addMessage, setPendingPermission, currentSessionId } = useAppStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionActive, setSessionActive] = useState(!!currentSessionId)

  useEffect(() => {
    const unlisten = cliApi.onMessage((msg) => {
      if (msg.type === 'permission_request') {
        setPendingPermission(msg)
      } else {
        addMessage(msg)
      }
    })
    return () => { unlisten.then(fn => fn()) }
  }, [addMessage, setPendingPermission])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setSessionActive(!!currentSessionId)
  }, [currentSessionId])

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <TopBar />

      {!sessionActive ? (
        <WorkdirSelector onSessionStarted={() => setSessionActive(true)} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-3xl">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">
                  세션이 시작되었습니다. 메시지를 입력하세요.
                </div>
              ) : (
                messages.map((msg, i) => <MessageRenderer key={i} message={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <MessageInput />
        </>
      )}

      <SafetyDialog />
    </div>
  )
}

export function ChatView() {
  return <ChatContent />
}
