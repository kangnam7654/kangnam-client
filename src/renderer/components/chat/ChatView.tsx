import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import type { SessionMeta, TaskState } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'
import { MessageRenderer } from './MessageRenderer'
import { SafetyDialog } from './SafetyDialog'
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

  const handleStop = async () => {
    if (!currentSessionId) return
    try { await cliApi.stopSession(currentSessionId) } catch { /* ignore */ }
    setIsStreaming(false)
  }

  const handleSubmit = async () => {
    if (isStreaming) {
      handleStop()
      return
    }
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
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        <div
          className="relative flex items-end gap-2 rounded-2xl border border-[var(--border-subtle)] px-4 py-3"
          style={{ background: 'var(--bg-composer)', boxShadow: 'var(--composer-shadow)' }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentSessionId ? 'Ask Claude anything…' : 'Starting session…'}
            disabled={!currentSessionId}
            rows={1}
            className="composer-input flex-1 resize-none bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:opacity-40 leading-relaxed"
            style={{ maxHeight: 200 }}
            aria-label="Message input"
          />
          <button
            onClick={handleSubmit}
            disabled={!isStreaming && (!text.trim() || !currentSessionId)}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-white disabled:opacity-30 hover:opacity-85 transition-opacity"
            style={{ background: 'var(--accent)' }}
            aria-label="Send message"
          >
            {isStreaming ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1 py-3">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

function ChatContent() {
  const { messages, addMessage, setPendingPermission, currentSessionId, setCurrentSessionId,
          setIsStreaming, isStreaming, currentProvider, setCurrentWorkingDir,
          setSessionMeta, addTask, updateTask, setRateLimit, setSessionCost } = useAppStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoStarted = useRef(false)

  // Auto-start session on mount if provider is set but no session exists
  useEffect(() => {
    if (autoStarted.current || currentSessionId || !currentProvider) return
    autoStarted.current = true

    const lastDir = localStorage.getItem('kangnam-last-workdir')
    const workingDir = lastDir || (navigator.platform?.includes('Win') ? 'C:\\Users' : '/Users')

    cliApi.startSession(currentProvider, workingDir)
      .then((sessionId) => {
        setCurrentSessionId(sessionId)
        setCurrentWorkingDir(workingDir)
        localStorage.setItem('kangnam-last-workdir', workingDir)
      })
      .catch((e) => {
        console.error('[ChatContent] auto-start session failed:', e)
      })
  }, [currentSessionId, currentProvider, setCurrentSessionId, setCurrentWorkingDir])

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

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <TopBar />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center gap-2 py-32">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: 'var(--accent)' }}>K</div>
              <div className="text-lg font-semibold text-[var(--text-primary)] mt-2">무엇을 도와드릴까요?</div>
              <div className="text-sm text-[var(--text-muted)]">
                {currentSessionId ? 'Claude Code가 준비되었습니다' : '세션을 시작하는 중...'}
              </div>
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

      <SafetyDialog />
    </div>
  )
}

export function ChatView() {
  return <ChatContent />
}
