import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import type { SessionMeta, TaskState } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'
import { MessageRenderer } from './MessageRenderer'
import { SafetyDialog } from './SafetyDialog'
import { WorkdirSelector } from './WorkdirSelector'
import { StatusBar } from './StatusBar'

function TopBar() {
  const { currentProvider, currentWorkingDir, currentSessionId, clearMessages, setCurrentSessionId, isStreaming, sessionMeta } = useAppStore()

  const handleNewChat = async () => {
    if (currentSessionId) {
      try { await cliApi.stopSession(currentSessionId) } catch { /* ignore */ }
    }
    clearMessages()
    setCurrentSessionId(null)
    useAppStore.getState().setIsStreaming(false)
    useAppStore.getState().setCurrentWorkingDir(null)
  }

  const dirName = currentWorkingDir?.split('/').pop() || currentWorkingDir

  return (
    <div className="drag-region h-12 flex items-center justify-between shrink-0 relative px-4">
      {/* Left: New Chat */}
      <button
        onClick={handleNewChat}
        className="no-drag flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        aria-label="New chat"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New
      </button>

      {/* Center: Provider + Dir */}
      <div className="no-drag flex items-center gap-2 cursor-default">
        {currentProvider && (
          <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase">{currentProvider}</span>
        )}
        {sessionMeta?.model && (
          <>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-xs text-[var(--text-tertiary)]">{sessionMeta.model}</span>
          </>
        )}
        {dirName && (
          <>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-xs text-[var(--text-secondary)]" title={currentWorkingDir ?? ''}>{dirName}</span>
          </>
        )}
        {isStreaming && (
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" title="Streaming" />
        )}
      </div>

      {/* Right: Settings */}
      <button
        onClick={() => useAppStore.getState().setShowSettings(true)}
        className="no-drag w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[11px] font-semibold cursor-pointer hover:opacity-85 transition-opacity border-none"
        aria-label="Settings"
      >
        U
      </button>
    </div>
  )
}

function MessageInput() {
  const [text, setText] = useState('')
  const { currentSessionId, addMessage, isStreaming, setIsStreaming } = useAppStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed || !currentSessionId) return
    setText('')

    // Show user message immediately
    addMessage({ type: 'user_message', text: trimmed })
    setIsStreaming(true)

    try {
      await cliApi.sendMessage(currentSessionId, trimmed)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      addMessage({ type: 'error', message: `메시지 전송 실패: ${msg}` })
      setIsStreaming(false)
    }
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
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 hover:opacity-85 transition-opacity"
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

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-[var(--text-tertiary)]">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
      응답 중...
    </div>
  )
}

function ChatContent() {
  const { messages, addMessage, setPendingPermission, currentSessionId, setIsStreaming, isStreaming,
          setSessionMeta, addTask, updateTask, setRateLimit, setSessionCost } = useAppStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionActive, setSessionActive] = useState(!!currentSessionId)

  useEffect(() => {
    const unlisten = cliApi.onMessage((msg) => {
      if (msg.type === 'turn_end') {
        setIsStreaming(false)
        addMessage(msg)
      } else if (msg.type === 'error') {
        setIsStreaming(false)
        addMessage(msg)
      } else {
        addMessage(msg)
      }
    })
    return unlisten
  }, [addMessage, setIsStreaming])

  useEffect(() => {
    const unlisten = cliApi.onPermissionRequest((req) => {
      setPendingPermission({
        type: 'permission_request',
        id: req.id,
        tool: req.tool,
        description: req.description,
      })
    })
    return unlisten
  }, [setPendingPermission])

  useEffect(() => {
    const unlisten = cliApi.onEnhanced((event) => {
      const type = event.type as string
      switch (type) {
        case 'session_meta':
          setSessionMeta(event as unknown as SessionMeta)
          break
        case 'task_started':
          addTask({
            task_id: event.task_id as string,
            description: event.description as string,
            task_type: event.task_type as string,
            status: 'running',
          })
          break
        case 'task_progress':
          updateTask(event.task_id as string, {
            description: event.description as string,
          })
          break
        case 'task_notification':
          updateTask(event.task_id as string, {
            status: event.status as TaskState['status'],
            summary: event.summary as string | undefined,
          })
          break
        case 'result_summary':
          setSessionCost({
            cost_usd: event.cost_usd as number | null,
            duration_ms: event.duration_ms as number | null,
            num_turns: event.num_turns as number | null,
          })
          break
        case 'rate_limit':
          setRateLimit({
            status: event.status as string,
            utilization: event.utilization as number | null,
            rate_limit_type: event.rate_limit_type as string,
          })
          break
      }
    })
    return unlisten
  }, [setSessionMeta, addTask, updateTask, setRateLimit, setSessionCost])

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
              {messages.length === 0 && !isStreaming ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)] py-20">
                  메시지를 입력하세요
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => <MessageRenderer key={i} message={msg} />)}
                  {isStreaming && messages[messages.length - 1]?.type !== 'text_delta' && messages[messages.length - 1]?.type !== 'agent_progress' && (
                    <StreamingIndicator />
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <MessageInput />
          <StatusBar />
        </>
      )}

      <SafetyDialog />
    </div>
  )
}

export function ChatView() {
  return <ChatContent />
}
