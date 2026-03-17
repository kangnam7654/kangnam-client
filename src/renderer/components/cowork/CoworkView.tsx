import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/app-store'
import { ProgressPanel } from './ProgressPanel'
import { InlineToolCall } from './InlineToolCall'
import { ProviderDropdown, ModelDropdown, ThinkingToggle } from '../InputControls'

// ── Types ───────────────────────────────────────────────────
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string }

interface CoworkMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  blocks: ContentBlock[]
}

// ── Minimal Markdown → HTML ─────────────────────────────────
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderMarkdown(raw: string): string {
  let html = raw
    // Strip PLAN/STEP markers
    .replace(/(?:PLAN:|STEP_START:\s*\d+|STEP_COMPLETE:\s*\d+|TASK_COMPLETE)[^\n]*/g, '')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) =>
      `<pre style="background:var(--bg-code);color:var(--text-primary);padding:14px 16px;border-radius:8px;overflow-x:auto;font-size:12px;margin:10px 0;font-family:Monaco,Menlo,monospace;line-height:1.5"><code>${escapeHtml(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`\n]+)`/g, '<code style="background:var(--bg-code-inline);padding:2px 6px;border-radius:4px;font-size:0.85em;font-family:Monaco,Menlo,monospace;color:var(--text-code-inline)">$1</code>')
    // Bold / italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:600;margin:20px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:600;margin:20px 0 8px">$1</h1>')
    // Newlines
    .replace(/\n/g, '<br />')
  return html
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

// ── Main Component ──────────────────────────────────────────
export function CoworkView() {
  const {
    activeProvider, activeModel, activeReasoningEffort,
    coworkIsRunning, setCoworkIsRunning,
    setCoworkSteps, updateCoworkStep,
    addCoworkToolCall, updateCoworkToolCall,
    resetCoworkState, appendCoworkStreamText, resetCoworkStreamText
  } = useAppStore()

  const [messages, setMessages] = useState<CoworkMessage[]>([])
  const [liveBlocks, setLiveBlocks] = useState<ContentBlock[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [title, setTitle] = useState('New task')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)
  const liveBlocksRef = useRef(liveBlocks)
  liveBlocksRef.current = liveBlocks

  const hasStarted = messages.length > 0 || coworkIsRunning || liveBlocks.length > 0

  // ── Auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveBlocks, messages])

  // ── IPC Event Wiring ────────────────────────────────────
  useEffect(() => {
    const unsubStream = window.api.cowork.onStream(({ chunk }) => {
      appendCoworkStreamText(chunk)
      setLiveBlocks(prev => {
        const blocks = [...prev]
        const last = blocks[blocks.length - 1]
        if (last?.type === 'text') {
          blocks[blocks.length - 1] = { type: 'text', text: last.text + chunk }
        } else {
          blocks.push({ type: 'text', text: chunk })
        }
        return blocks
      })
    })

    const unsubPlan = window.api.cowork.onPlan(({ steps }) => {
      setCoworkSteps(steps.map(text => ({ text, status: 'pending' as const })))
    })

    const unsubStepStart = window.api.cowork.onStepStart(({ step }) => {
      updateCoworkStep(step - 1, { status: 'in_progress' })
    })

    const unsubStepComplete = window.api.cowork.onStepComplete(({ step }) => {
      updateCoworkStep(step - 1, { status: 'completed' })
    })

    const unsubToolCall = window.api.cowork.onToolCall(({ id, name, input }) => {
      addCoworkToolCall({ id, name, input, status: 'running' })
      setLiveBlocks(prev => [...prev, { type: 'tool', id }, { type: 'text', text: '' }])
    })

    const unsubToolResult = window.api.cowork.onToolResult(({ id, result, status }) => {
      updateCoworkToolCall(id, { result, status })
    })

    const unsubComplete = window.api.cowork.onComplete(() => {
      const blocks = liveBlocksRef.current.filter(
        b => b.type === 'tool' || (b.type === 'text' && b.text.trim())
      )
      if (blocks.length > 0) {
        setMessages(prev => [...prev, {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          text: '',
          blocks
        }])
      }
      setLiveBlocks([])
      setCoworkIsRunning(false)

      // Mark remaining in_progress steps as completed
      const currentSteps = useAppStore.getState().coworkSteps
      currentSteps.forEach((step, i) => {
        if (step.status === 'in_progress') updateCoworkStep(i, { status: 'completed' })
      })
    })

    const unsubError = window.api.cowork.onError(({ error }) => {
      setCoworkIsRunning(false)
      setLiveBlocks(prev => [...prev, { type: 'text', text: `\n\n**Error:** ${error}` }])
    })

    return () => {
      unsubStream(); unsubPlan(); unsubStepStart(); unsubStepComplete()
      unsubToolCall(); unsubToolResult(); unsubComplete(); unsubError()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ─────────────────────────────────────────────
  const finalizeLiveBlocks = useCallback(() => {
    const blocks = liveBlocksRef.current.filter(
      b => b.type === 'tool' || (b.type === 'text' && b.text.trim())
    )
    if (blocks.length > 0) {
      setMessages(prev => [...prev, {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        text: '',
        blocks
      }])
    }
    setLiveBlocks([])
  }, [])

  // ── Start task from home view ───────────────────────────
  const handleStart = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setTitle(trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed)
    setMessages([{
      id: `user_${Date.now()}`,
      role: 'user',
      text: trimmed,
      blocks: []
    }])
    setLiveBlocks([{ type: 'text', text: '' }])
    resetCoworkState()
    resetCoworkStreamText()
    setCoworkIsRunning(true)
    setInputValue('')

    await window.api.cowork.start(trimmed, activeProvider, activeModel, activeReasoningEffort)
  }, [activeProvider, activeModel, activeReasoningEffort, resetCoworkState, resetCoworkStreamText, setCoworkIsRunning])

  // ── Send from chat input (follow-up or new task) ────────
  const handleSendFromChat = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    finalizeLiveBlocks()

    setMessages(prev => [...prev, {
      id: `user_${Date.now()}`,
      role: 'user',
      text: trimmed,
      blocks: []
    }])
    setLiveBlocks([{ type: 'text', text: '' }])
    setInputValue('')

    if (coworkIsRunning) {
      await window.api.cowork.followUp(trimmed)
    } else {
      // New task — only clear steps, keep tool calls for message history
      setCoworkSteps([])
      resetCoworkStreamText()
      setCoworkIsRunning(true)
      await window.api.cowork.start(trimmed, activeProvider, activeModel, activeReasoningEffort)
    }
  }, [coworkIsRunning, activeProvider, activeModel, activeReasoningEffort, setCoworkSteps, resetCoworkStreamText, setCoworkIsRunning, finalizeLiveBlocks])

  const handleStop = useCallback(async () => {
    await window.api.cowork.stop()
    setCoworkIsRunning(false)
  }, [setCoworkIsRunning])

  // ── Reset everything → back to home view ────────────────
  const handleNewTask = useCallback(() => {
    setMessages([])
    setLiveBlocks([])
    setTitle('New task')
    setInputValue('')
    resetCoworkState()
    resetCoworkStreamText()
  }, [resetCoworkState, resetCoworkStreamText])

  const handleKeyDown = (e: React.KeyboardEvent, isChat: boolean) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      isChat ? handleSendFromChat(inputValue) : handleStart(inputValue)
    }
  }

  // ═══════════════ HOME VIEW ═══════════════
  if (!hasStarted) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', overflow: 'hidden'
      }}>
        {/* Greeting */}
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 4 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l2.5 2.5L16 9" />
          </svg>
          <h1 style={{
            fontFamily: "'Pretendard', -apple-system, sans-serif",
            fontSize: 38, fontWeight: 400,
            color: 'var(--text-primary)', letterSpacing: -0.5
          }}>
            Cowork
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, letterSpacing: 0.3 }}>
            Autonomous task execution powered by MCP tools
          </p>
        </div>

        {/* Input pill — matches open-claude-cowork .input-wrapper */}
        <div style={{ width: '100%', maxWidth: 680 }}>
          <div
            onClick={() => textareaRef.current?.focus()}
            style={{
              background: 'var(--bg-surface)', borderRadius: 24,
              boxShadow: '0 4px 16px var(--shadow-pill)',
              overflow: 'visible', position: 'relative',
              border: '1px solid var(--border-subtle)',
              transition: 'border-color 0.15s'
            }}
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={e => { setInputValue(e.target.value); autoResize(e.target) }}
              onKeyDown={e => handleKeyDown(e, false)}
              placeholder="Describe your task..."
              rows={1}
              style={{
                width: '100%', padding: '20px 24px 12px', border: 'none', outline: 'none',
                fontFamily: 'inherit', fontSize: 16, background: 'transparent',
                color: 'var(--text-primary)', resize: 'none', minHeight: 24,
                maxHeight: 200, overflowY: 'auto', lineHeight: 1.5
              }}
              className="composer-input placeholder-[var(--text-muted)]"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: 'none',
                    background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s'
                  }}
                  className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                  title="Attach file"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <ProviderDropdown />
                <ModelDropdown />
                <ThinkingToggle />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleStart(inputValue) }}
                disabled={!inputValue.trim()}
                style={{
                  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'var(--accent)', borderRadius: 12,
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed', color: 'white',
                  opacity: inputValue.trim() ? 1 : 0.4,
                  transition: 'background 0.15s, opacity 0.15s'
                }}
                className="hover:bg-[var(--accent-hover)]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════ CHAT VIEW ═══════════════
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', height: '100%', position: 'relative' }}>
      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
        {/* Header — matches open-claude-cowork .chat-header */}
        <header style={{
          padding: '12px 24px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid transparent'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8,
            fontSize: 14, fontWeight: 500, color: 'var(--text-primary)'
          }}>
            <span style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </span>
            {coworkIsRunning && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animation: 'spin 1.5s linear infinite', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
            )}
          </div>
          <button
            onClick={handleNewTask}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer',
              color: 'var(--text-secondary)', transition: 'all 0.15s'
            }}
            className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
            title="New task"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </header>

        {/* Messages — matches open-claude-cowork .messages-container */}
        <div style={{
          flex: '1 1 0', overflowY: 'auto', overflowX: 'hidden',
          padding: '24px 24px 16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 24, minHeight: 0
        }}>
          {/* Finalized messages (multi-turn) */}
          {messages.map(msg => (
            msg.role === 'user'
              ? <UserBubble key={msg.id} text={msg.text} />
              : <AssistantBlocks key={msg.id} blocks={msg.blocks} />
          ))}

          {/* Live streaming blocks */}
          {liveBlocks.length > 0 && (
            <AssistantBlocks blocks={liveBlocks} isStreaming={coworkIsRunning} />
          )}

          {/* Loading indicator before first content */}
          {coworkIsRunning && liveBlocks.length === 1 && liveBlocks[0].type === 'text' && !liveBlocks[0].text && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', maxWidth: 680, padding: '8px 0'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"
                style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                <circle cx="12" cy="12" r="10" /><path d="M8 12l2.5 2.5L16 9" />
              </svg>
              <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom input — matches open-claude-cowork .chat-input-wrapper */}
        <div style={{
          padding: '16px 24px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          flexShrink: 0, flexGrow: 0,
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-main)'
        }}>
          <div style={{ width: '100%', maxWidth: 680 }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 24,
              boxShadow: '0 4px 16px var(--shadow-pill)',
              overflow: 'visible', position: 'relative',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <textarea
                ref={chatTextareaRef}
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); autoResize(e.target) }}
                onKeyDown={e => handleKeyDown(e, true)}
                placeholder={coworkIsRunning ? 'Add instructions...' : 'Send a follow-up...'}
                rows={1}
                style={{
                  width: '100%', padding: '16px 20px 8px', border: 'none', outline: 'none',
                  fontFamily: 'inherit', fontSize: 15, background: 'transparent',
                  color: 'var(--text-primary)', resize: 'none', minHeight: 24,
                  maxHeight: 160, overflowY: 'auto', lineHeight: 1.5
                }}
                className="composer-input placeholder-[var(--text-muted)]"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: 'none',
                      background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s'
                    }}
                    className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                    title="Attach file"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  {!coworkIsRunning && (
                    <button
                      onClick={handleNewTask}
                      style={{
                        padding: '5px 10px', border: 'none', background: 'transparent',
                        borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
                        transition: 'background 0.15s'
                      }}
                      className="hover:bg-[var(--bg-hover)]"
                    >
                      New Task
                    </button>
                  )}
                  <ProviderDropdown />
                  <ModelDropdown />
                  <ThinkingToggle />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {coworkIsRunning ? (
                    <button
                      onClick={handleStop}
                      style={{
                        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', background: 'var(--danger)', borderRadius: 10,
                        cursor: 'pointer', color: 'white', transition: 'background 0.15s'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendFromChat(inputValue)}
                      disabled={!inputValue.trim()}
                      style={{
                        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', background: 'var(--accent)', borderRadius: 10,
                        cursor: inputValue.trim() ? 'pointer' : 'not-allowed', color: 'white',
                        opacity: inputValue.trim() ? 1 : 0.4,
                        transition: 'background 0.15s, opacity 0.15s'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Tasks are executed using available MCP tools. Double-check results.
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar expand button (visible when collapsed) */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          title="Expand sidebar"
          style={{
            position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: '8px 0 0 8px',
            background: 'var(--sidebar-bg)', cursor: 'pointer', color: 'var(--text-muted)',
            transition: 'color 0.15s', zIndex: 10
          }}
          className="hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Right sidebar — Progress */}
      <ProgressPanel collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(true)} />
    </div>
  )
}

// ── User message bubble ─────────────────────────────────────
function UserBubble({ text }: { text: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-end',
      width: '100%', maxWidth: 680,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'var(--bg-user-bubble)',
        padding: '12px 16px', borderRadius: 20,
        maxWidth: '85%', fontSize: 15, lineHeight: 1.5,
        whiteSpace: 'pre-wrap', wordWrap: 'break-word',
        color: 'var(--text-primary)'
      }}>
        {text}
      </div>
    </div>
  )
}

// ── Assistant message with interleaved text + tool calls ────
function AssistantBlocks({ blocks, isStreaming }: {
  blocks: ContentBlock[]
  isStreaming?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-start', flexDirection: 'column',
      width: '100%', maxWidth: 680,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)', width: '100%' }}>
        {blocks.map((block, i) => {
          if (block.type === 'text') {
            if (!block.text.trim()) return null
            return (
              <div
                key={i}
                className="selectable"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(block.text) }}
              />
            )
          }
          return <InlineToolCall key={block.id} toolCallId={block.id} />
        })}
        {isStreaming && (
          <span style={{
            display: 'inline-block', width: 2, height: 18, marginLeft: 2,
            background: 'var(--accent)', borderRadius: 1,
            animation: 'pulse 1s ease-in-out infinite'
          }} />
        )}
      </div>
    </div>
  )
}
