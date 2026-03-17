import { FC, memo, useState, useRef } from 'react'
import { ProviderDropdown, ModelDropdown, ThinkingToggle } from '../InputControls'
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  useMessagePartText,
  useMessagePartImage,
  useComposerRuntime,
  useMessage
} from '@assistant-ui/react'
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown'
import { useAppStore, type AttachmentData } from '../../stores/app-store'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function Starburst({ size = 20, animated = false }: { size?: number; animated?: boolean }) {
  const c = size / 2
  const spokes = 16
  const outerR = c * 0.92
  const innerR = c * 0.38
  let d = ''
  for (let i = 0; i < spokes; i++) {
    const outerAngle = (Math.PI * 2 * i) / spokes - Math.PI / 2
    const innerAngle = (Math.PI * 2 * (i + 0.5)) / spokes - Math.PI / 2
    const ox = c + outerR * Math.cos(outerAngle)
    const oy = c + outerR * Math.sin(outerAngle)
    const ix = c + innerR * Math.cos(innerAngle)
    const iy = c + innerR * Math.sin(innerAngle)
    d += (i === 0 ? 'M' : 'L') + `${ox.toFixed(1)},${oy.toFixed(1)}L${ix.toFixed(1)},${iy.toFixed(1)}`
  }
  d += 'Z'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none"
      style={animated ? { animation: 'starburstPulse 0.8s ease-in-out infinite' } : undefined}>
      <path d={d} fill="var(--accent)" />
    </svg>
  )
}

// ── User Message ──────────────────────────────────────────────
const UserMessage: FC = () => (
  <MessagePrimitive.Root style={{ padding: '12px 24px' }}>
    <div style={{ maxWidth: 680, marginLeft: 'auto', marginRight: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        maxWidth: '85%',
        padding: '12px 16px',
        borderRadius: 20,
        background: 'var(--bg-user-bubble)',
        color: 'var(--text-primary)'
      }}>
        <div className="text-[15px] leading-[1.5] whitespace-pre-wrap" style={{ wordWrap: 'break-word' }}>
          <MessagePrimitive.Content components={{ Text: UserTextPart, Image: UserImagePart }} />
        </div>
      </div>
    </div>
  </MessagePrimitive.Root>
)

const UserTextPart: FC = () => {
  const { text } = useMessagePartText()
  return <>{text}</>
}

const UserImagePart: FC = () => {
  const { image } = useMessagePartImage()
  return (
    <img
      src={image}
      alt="Attached image"
      style={{
        maxWidth: '100%',
        maxHeight: 300,
        borderRadius: 10,
        marginBottom: 6,
        border: '1px solid rgba(255,255,255,0.15)'
      }}
    />
  )
}

// ── Assistant Message ─────────────────────────────────────────
const AssistantMessage: FC = () => {
  const message = useMessage()
  const { messages } = useAppStore()

  // Find tool messages that follow this assistant message in the DB
  const msgId = message.id
  const msgIdx = messages.findIndex(m => m.id === msgId)
  const toolMsgs: Array<{ tool_name: string | null; tool_args: string | null; content: string }> = []
  if (msgIdx >= 0) {
    for (let j = msgIdx + 1; j < messages.length && messages[j].role === 'tool'; j++) {
      toolMsgs.push(messages[j])
    }
  }

  return (
  <MessagePrimitive.Root className="group" style={{ padding: '12px 24px' }}>
    <div style={{ maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Tool calls (rendered from DB, persistent) */}
      {toolMsgs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {toolMsgs.map((tm, i) => (
            <ToolCallBlock
              key={i}
              toolName={tm.tool_name}
              toolArgs={tm.tool_args}
              result={tm.content}
            />
          ))}
        </div>
      )}
      <div className="text-[15px] text-[var(--text-primary)] leading-[1.7]">
        <MessagePrimitive.Content
          components={{
            Text: AssistantTextPart
          } as any}
        />
      </div>
      <AssistantActionBar />
    </div>
  </MessagePrimitive.Root>
  )
}

const AssistantTextPart: FC = () => (
  <MarkdownTextPrimitive
    className="aui-markdown"
    smooth
    components={{
      SyntaxHighlighter: CodeBlock,
      CodeHeader: CodeBlockHeader
    }}
  />
)

// ── Tool Call Block (persistent, reads from DB) ──────────────
function ToolCallBlock({ toolName, toolArgs, result }: {
  toolName: string | null
  toolArgs: string | null
  result: string
}) {
  const [open, setOpen] = useState(false)

  const displayName = formatToolName(toolName ?? 'tool')
  const isError = result.startsWith('Error:')

  // Pretty-print args
  let argsDisplay = ''
  if (toolArgs) {
    try {
      const parsed = JSON.parse(toolArgs)
      argsDisplay = JSON.stringify(parsed, null, 2)
    } catch {
      argsDisplay = toolArgs
    }
  }

  // Truncate long results
  const MAX_RESULT = 800
  const truncated = result.length > MAX_RESULT
  const displayResult = truncated ? result.slice(0, MAX_RESULT) + '...' : result

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontSize: 13, textAlign: 'left'
        }}
        className="hover:bg-[rgba(255,255,255,0.03)]"
      >
        {isError ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span style={{
          fontFamily: "'SF Mono', Monaco, Menlo, monospace",
          fontSize: 12, fontWeight: 500,
          color: isError ? '#f87171' : 'var(--text-secondary)'
        }}>
          {displayName}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ marginLeft: 'auto', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Collapsible detail */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', fontSize: 12 }}>
          {argsDisplay && argsDisplay !== '{}' && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Arguments</div>
              <pre style={{
                margin: 0, padding: '6px 8px', borderRadius: 6,
                background: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)',
                fontFamily: "'SF Mono', Monaco, Menlo, monospace",
                fontSize: 11.5, lineHeight: 1.5, overflowX: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all'
              }}>
                {argsDisplay}
              </pre>
            </div>
          )}
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Result</div>
            <pre style={{
              margin: 0, padding: '6px 8px', borderRadius: 6,
              background: isError ? 'rgba(239,68,68,0.06)' : 'rgba(0,0,0,0.2)',
              color: isError ? '#f87171' : 'var(--text-secondary)',
              fontFamily: "'SF Mono', Monaco, Menlo, monospace",
              fontSize: 11.5, lineHeight: 1.5, overflowX: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: 300, overflowY: 'auto'
            }}>
              {displayResult || '(empty)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tool name formatter ─────────────────────────────────────
function formatToolName(name: string): string {
  // "fetch__fetch" → "fetch", "server__tool_name" → "tool_name"
  return name.includes('__') ? name.split('__').pop()! : name
}

// ── Streaming Status Indicator ───────────────────────────────
const StreamingStatus: FC = () => {
  const { isStreaming, activeToolCall, streamingText, thinkingText, toolCallLog } = useAppStore()
  const [showThinking, setShowThinking] = useState(false)

  if (!isStreaming) return null

  const hasLog = toolCallLog.length > 0
  const hasThinking = thinkingText.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
      {/* Thinking block — collapsible */}
      {hasThinking && (
        <div style={{
          borderRadius: 10, border: '1px solid rgba(168,85,247,0.15)',
          background: 'rgba(168,85,247,0.04)', overflow: 'hidden'
        }}>
          <button
            onClick={() => setShowThinking(!showThinking)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 12, textAlign: 'left',
              color: 'rgba(168,85,247,0.7)'
            }}
            className="hover:bg-[rgba(168,85,247,0.06)]"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, animation: !streamingText ? 'pulse 2s ease-in-out infinite' : undefined }}>
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
            <span style={{ fontWeight: 500 }}>Thinking</span>
            <svg
              width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginLeft: 'auto', transform: showThinking ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showThinking && (
            <div style={{
              padding: '6px 10px 8px', borderTop: '1px solid rgba(168,85,247,0.1)',
              maxHeight: 200, overflowY: 'auto'
            }}>
              <pre style={{
                margin: 0, fontSize: 11.5, lineHeight: 1.5,
                color: 'var(--text-muted)',
                fontFamily: "'SF Mono', Monaco, Menlo, monospace",
                whiteSpace: 'pre-wrap', wordBreak: 'break-word'
              }}>
                {thinkingText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Tool call log */}
      {hasLog && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)',
          fontSize: 13
        }}>
          {toolCallLog.map((tc, i) => {
            const toolName = formatToolName(tc.name)
            const isRunning = tc.status === 'running'
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 0',
                opacity: isRunning ? 1 : 0.6
              }}>
                {isRunning ? (
                  <div style={{ animation: 'spin 1s linear infinite', width: 14, height: 14, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 11-6.22-8.56" />
                    </svg>
                  </div>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <span style={{ color: 'var(--text-secondary)' }}>
                  <span style={{
                    color: isRunning ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: 500,
                    fontFamily: "'SF Mono', Monaco, Menlo, monospace",
                    fontSize: 12
                  }}>{toolName}</span>
                  {isRunning && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>running...</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Waiting indicator — matches Cowork style */}
      {!activeToolCall && !streamingText && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 0'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
            <circle cx="12" cy="12" r="10" /><path d="M8 12l2.5 2.5L16 9" />
          </svg>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {hasThinking ? 'Writing...' : hasLog ? 'Generating response...' : 'Thinking...'}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Chat Error Banner ─────────────────────────────────────────
const ChatErrorBanner: FC = () => {
  const { chatError, setChatError } = useAppStore()
  if (!chatError) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '10px 12px', margin: '8px 0',
      borderRadius: 10, background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.15)',
      fontSize: 13, color: '#f87171', lineHeight: 1.5
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{chatError}</span>
      <button
        onClick={() => setChatError(null)}
        style={{ flexShrink: 0, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2, opacity: 0.6 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ── Context Bar ───────────────────────────────────────────────
const ContextBar: FC = () => {
  const { contextUsage } = useAppStore()
  if (!contextUsage || contextUsage.max === 0) return null

  const pct = Math.min(100, Math.round((contextUsage.used / contextUsage.max) * 100))
  if (pct < 5) return null // Don't show when nearly empty

  const color = pct >= 80 ? '#f87171' : pct >= 60 ? '#fbbf24' : 'var(--accent)'
  const usedK = contextUsage.used >= 1000 ? `${(contextUsage.used / 1000).toFixed(0)}K` : String(contextUsage.used)
  const maxK = contextUsage.max >= 1000 ? `${(contextUsage.max / 1000).toFixed(0)}K` : String(contextUsage.max)

  return (
    <div style={{ padding: '0 24px', flexShrink: 0 }}>
      <div style={{ maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 0', fontSize: 11, color: 'var(--text-muted)'
        }}>
          <div style={{
            flex: 1, height: 3, borderRadius: 2,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: color,
              width: `${pct}%`, transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{ flexShrink: 0, color: pct >= 80 ? color : undefined }}>
            {usedK}/{maxK}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Code Block ────────────────────────────────────────────────
interface SyntaxHighlighterProps {
  language?: string
  code: string
}

const CodeBlock: FC<SyntaxHighlighterProps> = ({ language, code }) => (
  <pre className="my-4 rounded-xl bg-[#1a1a1a] border border-[var(--border)] overflow-x-auto">
    <code className={`block p-5 text-[13px] leading-[1.7] font-mono text-[var(--text-primary)] ${language ? `language-${language}` : ''}`}>
      {code}
    </code>
  </pre>
)

interface CodeHeaderProps {
  language?: string
  code?: string
}

const CodeBlockHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  if (!language) return null
  const handleCopy = () => { if (code) navigator.clipboard.writeText(code) }
  return (
    <div className="flex items-center justify-between px-5 py-2 bg-[rgba(255,255,255,0.04)] rounded-t-xl border border-b-0 border-[var(--border)] text-[12px] text-[var(--text-muted)]">
      <span className="font-mono">{language}</span>
      <button onClick={handleCopy} className="hover:text-[var(--text-secondary)] transition-colors px-2 py-0.5 rounded hover:bg-[rgba(255,255,255,0.06)]">Copy</button>
    </div>
  )
}

// ── Action Bar ────────────────────────────────────────────────
const CopyButton: FC = () => {
  const [copied, setCopied] = useState(false)

  return (
    <ActionBarPrimitive.Copy asChild>
      <button
        onClick={() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] transition-colors"
        style={{ color: copied ? 'var(--success)' : 'var(--text-muted)' }}
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </ActionBarPrimitive.Copy>
  )
}

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    autohide="not-last"
    className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
  >
    <CopyButton />
  </ActionBarPrimitive.Root>
)

// ── Composer ──────────────────────────────────────────────────
interface ComposerAttachment {
  file: File
  dataUrl: string
  preview?: string
}

const StopButton: FC = () => {
  const handleStop = async () => {
    const state = useAppStore.getState()
    const convId = state.activeConversationId
    if (convId) {
      window.api.chat.stop(convId)
    }
    // Batch state update: convert streaming text to a local message to avoid
    // intermediate render with missing content (assistant-ui index out of bounds)
    if (state.streamingText.trim()) {
      const partialMsg = {
        id: `partial_${Date.now()}`,
        conversation_id: convId ?? '',
        role: 'assistant' as const,
        content: state.streamingText,
        tool_use_id: null,
        token_count: null,
        attachments: null,
        created_at: Math.floor(Date.now() / 1000)
      }
      useAppStore.setState({
        messages: [...state.messages, partialMsg],
        isStreaming: false,
        streamingText: ''
      })
    } else {
      useAppStore.setState({ isStreaming: false, streamingText: '' })
    }
    // Reload from DB after backend saves partial response
    if (convId) {
      setTimeout(async () => {
        const msgs = await window.api.conv.getMessages(convId)
        useAppStore.getState().setMessages(msgs)
      }, 500)
    }
  }

  return (
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
  )
}

const Composer: FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const { isStreaming } = useAppStore()
  const composerRuntime = useComposerRuntime()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file)
      const att: ComposerAttachment = {
        file,
        dataUrl,
        preview: file.type.startsWith('image/') ? dataUrl : undefined
      }
      setAttachments(prev => [...prev, att])
    }
    e.target.value = ''
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSendClick = () => {
    if (attachments.length > 0) {
      const attData: AttachmentData[] = attachments.map(att => ({
        type: att.file.type.startsWith('image/') ? 'image' : 'file',
        name: att.file.name,
        dataUrl: att.dataUrl
      }))
      useAppStore.getState().setPendingAttachments(attData)
      setAttachments([])
    }
  }

  // Direct send for image-only messages (no text required)
  const handleImageOnlySend = () => {
    if (attachments.length === 0) return
    const attData: AttachmentData[] = attachments.map(att => ({
      type: att.file.type.startsWith('image/') ? 'image' : 'file',
      name: att.file.name,
      dataUrl: att.dataUrl
    }))
    useAppStore.getState().setPendingAttachments(attData)
    setAttachments([])
    // Inject placeholder text so assistant-ui processes the send
    const currentText = composerRuntime.getState().text
    if (!currentText.trim()) {
      composerRuntime.setText('[image]')
    }
    composerRuntime.send()
  }

  const hasAttachments = attachments.length > 0

  return (
    <ComposerPrimitive.Root style={{ padding: '16px 24px 24px', flexShrink: 0, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-main)' }}>
      <div style={{ maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ position: 'relative', borderRadius: 24, background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px var(--shadow-pill)', transition: 'border-color 0.15s' }} className="focus-within:border-[var(--border-light)]">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.csv,.json,.md"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <ComposerPrimitive.Input
            placeholder="Send a message..."
            rows={1}
            maxRows={8}
            submitMode="enter"
            style={{ width: '100%', resize: 'none', background: 'transparent', padding: '20px 24px 12px', fontSize: 16, color: 'var(--text-primary)', outline: 'none', lineHeight: 1.5 }}
            className="composer-input placeholder-[var(--text-muted)]"
          />
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', gap: 8, padding: '4px 20px 8px', flexWrap: 'wrap' }}>
              {attachments.map((att, idx) => (
                <div key={idx} style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: att.preview ? 0 : '6px 10px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 12, color: 'var(--text-secondary)',
                  overflow: 'hidden'
                }}>
                  {att.preview ? (
                    <img src={att.preview} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 9 }} />
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file.name}</span>
                    </>
                  )}
                  <button
                    onClick={() => removeAttachment(idx)}
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'white', fontSize: 10, lineHeight: 1
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isStreaming ? (
                <StopButton />
              ) : hasAttachments ? (
                <button onClick={handleImageOnlySend} style={{
                  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'var(--accent)', borderRadius: 10,
                  cursor: 'pointer', color: 'white', transition: 'background 0.15s'
                }} className="hover:bg-[var(--accent-hover)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              ) : (
                <ComposerPrimitive.Send asChild>
                  <button onClick={handleSendClick} style={{
                    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', background: 'var(--accent)', borderRadius: 10,
                    cursor: 'pointer', color: 'white',
                    transition: 'background 0.15s, opacity 0.15s'
                  }} className="disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </ComposerPrimitive.Send>
              )}
            </div>
          </div>
        </div>
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          LLM can make mistakes. Please double-check responses.
        </p>
      </div>
    </ComposerPrimitive.Root>
  )
}

// ── Thread ────────────────────────────────────────────────────
export const AssistantThread: FC = memo(() => (
  <ThreadPrimitive.Root style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
    <ThreadPrimitive.Viewport className="aui-thread-viewport" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <ThreadPrimitive.Empty>
        <EmptyState />
      </ThreadPrimitive.Empty>

      <ThreadPrimitive.Messages
        components={{ UserMessage, AssistantMessage }}
      />

      {/* Tool call / thinking indicator */}
      <div style={{ paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
          <StreamingStatus />
          <ChatErrorBanner />
        </div>
      </div>

      <div className="min-h-8" />
    </ThreadPrimitive.Viewport>

    <ContextBar />
    <Composer />
  </ThreadPrimitive.Root>
))

AssistantThread.displayName = 'AssistantThread'

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center -mt-16">
        <div className="mb-4 flex justify-center opacity-50">
          <Starburst size={28} />
        </div>
        <p className="text-[15px] text-[var(--text-muted)]">How can I help you?</p>
      </div>
    </div>
  )
}
