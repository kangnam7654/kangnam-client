import { useState, useEffect, useCallback, useRef, Component, type ReactNode } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useAppStore } from '../../stores/app-store'
import { useAssistantRuntime } from '../../hooks/use-assistant-runtime'
import { AssistantThread } from './AssistantThread'
import { ChatSearchBar } from './ChatSearchBar'
import { CoworkView } from '../cowork/CoworkView'
import { ProviderDropdown, ModelDropdown, ThinkingToggle } from '../InputControls'

class ChatErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error('ChatContent error:', error) }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, color: '#ef4444', fontSize: 18, fontFamily: 'monospace', userSelect: 'text', WebkitUserSelect: 'text' }}>
        <p style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>Error</p>
        <p style={{ marginBottom: 16 }}>{this.state.error.message}</p>
        <pre style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#f87171' }}>{this.state.error.stack}</pre>
      </div>
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
        {showTitle && activeView === 'chat' && conv ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            <span className="text-[13.5px] text-[var(--text-primary)] font-medium max-w-[280px] truncate">{conv.title}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] shrink-0 mt-px">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        ) : (
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
        )}
      </div>

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
    const msgs = await window.api.conv.getMessages(convId)
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

function Starburst({ size = 36 }: { size?: number }) {
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" style={{ animation: 'starburstPulse 0.8s ease-in-out infinite' }}>
      <path d={d} fill="var(--accent)" />
    </svg>
  )
}

interface Attachment {
  file: File
  preview?: string
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function WelcomeScreen() {
  const { activeProvider, activeModel, activeReasoningEffort, setActiveConversationId, setConversations, setMessages, setIsStreaming, resetStreamingText, prompts, setPrompts, activePromptId, setActivePromptId } = useAppStore()
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.'

  useEffect(() => {
    window.api.prompts.list().then(setPrompts)
  }, [setPrompts])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const newAttachments = files.map(file => {
      const att: Attachment = { file }
      if (file.type.startsWith('image/')) {
        att.preview = URL.createObjectURL(file)
      }
      return att
    })
    setAttachments(prev => [...prev, ...newAttachments])
    e.target.value = '' // reset so same file can be re-selected
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => {
      const removed = prev[idx]
      if (removed.preview) URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const sendingRef = useRef(false)
  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text && attachments.length === 0) return
    if (sendingRef.current) return
    sendingRef.current = true

    // Convert attachments to base64 data URLs
    let attachmentsJson: string | undefined
    if (attachments.length > 0) {
      const attData = await Promise.all(
        attachments.map(async (att) => ({
          type: att.file.type.startsWith('image/') ? 'image' as const : 'file' as const,
          name: att.file.name,
          dataUrl: await fileToDataUrl(att.file)
        }))
      )
      attachmentsJson = JSON.stringify(attData)
    }

    // Create conversation
    const conv = await window.api.conv.create(activeProvider)
    const convs = await window.api.conv.list()
    setConversations(convs)

    // Set optimistic user message so it shows immediately
    const userMsg = {
      id: `temp_${Date.now()}`,
      conversation_id: conv.id,
      role: 'user' as const,
      content: text,
      tool_use_id: null,
      token_count: null,
      attachments: attachmentsJson ?? null,
      created_at: Math.floor(Date.now() / 1000)
    }
    setMessages([userMsg])
    setIsStreaming(true)
    resetStreamingText()

    // Clear attachments
    attachments.forEach(att => { if (att.preview) URL.revokeObjectURL(att.preview) })
    setAttachments([])
    setInputValue('')

    // Activate conversation (switches to ChatContent)
    setActiveConversationId(conv.id)

    // Send message (with optional system prompt)
    await window.api.chat.send(conv.id, text, activeProvider, attachmentsJson, activeModel, activeReasoningEffort, activePromptId ?? undefined)
    setActivePromptId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleComposerClick = () => {
    textareaRef.current?.focus()
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 680 }}>
        {/* Starburst icon + Greeting */}
        <div style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ marginBottom: 4 }}>
            <Starburst size={32} />
          </div>
          <h1 style={{
            fontSize: 42, fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.2, letterSpacing: -0.5
          }}>
            {greeting}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, letterSpacing: 0.3 }}>
            How can I help you today?
          </p>
        </div>

        {/* Real composer input */}
        <div
          onClick={handleComposerClick}
          style={{
            borderRadius: 24,
            background: 'var(--bg-surface)',
            border: `1px solid ${isFocused ? 'var(--border-subtle-hover)' : 'var(--border-subtle)'}`,
            overflow: 'hidden',
            cursor: 'text',
            boxShadow: '0 2px 20px var(--shadow-pill)',
            transition: 'border-color 0.2s'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.csv,.json,.md"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type to start a conversation..."
            rows={1}
            style={{
              width: '100%',
              resize: 'none',
              background: 'transparent',
              padding: '20px 24px 12px',
              fontSize: 16,
              color: 'var(--text-primary)',
              outline: 'none',
              border: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              maxHeight: 160,
              overflowY: 'auto'
            }}
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
                    onClick={(e) => { e.stopPropagation(); removeAttachment(idx) }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 12px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
              className="hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.25)] hover:text-[var(--text-secondary)]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ProviderDropdown />
              <ModelDropdown />
              <ThinkingToggle />
              <button
                onClick={(e) => { e.stopPropagation(); handleSend() }}
                disabled={!inputValue.trim() && attachments.length === 0}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--accent)',
                  opacity: (inputValue.trim() || attachments.length > 0) ? 1 : 0.35,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', border: 'none', cursor: (inputValue.trim() || attachments.length > 0) ? 'pointer' : 'default',
                  transition: 'opacity 0.15s', marginLeft: 6
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Skill chips */}
        {prompts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {prompts.map(prompt => {
              const isSelected = activePromptId === prompt.id
              return (
                <button
                  key={prompt.id}
                  onClick={() => setActivePromptId(isSelected ? null : prompt.id)}
                  title={prompt.description || undefined}
                  style={{
                    padding: '7px 14px', borderRadius: 20,
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: isSelected ? 'var(--accent-soft)' : 'transparent',
                    color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {prompt.name}
                </button>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
