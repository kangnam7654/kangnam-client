import { useState, useRef, useEffect } from 'react'
import { useAppStore, type Prompt, type Agent, type Conversation, type Message } from '../../stores/app-store'
import { fileToDataUrl } from '../../lib/utils'
import { Starburst } from '../shared/Starburst'
import { ProviderDropdown, ModelDropdown, ThinkingToggle } from '../InputControls'

interface Attachment {
  file: File
  preview?: string
}

export function WelcomeScreen() {
  const {
    activeProvider, activeModel, activeReasoningEffort,
    setActiveConversationId, setConversations, setMessages,
    setIsStreaming, resetStreamingText,
    prompts, setPrompts, activePromptId, setActivePromptId,
    agents, setAgents, activeAgentId, setActiveAgentId, setAgentRunStatus
  } = useAppStore()
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.'

  const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

  useEffect(() => {
    window.api.prompts.list().then(r => setPrompts(r as Prompt[]))
    window.api.agents.list().then(r => setAgents(r as Agent[]))
  }, [setPrompts, setAgents])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const validFiles = files.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        console.warn(`File ${f.name} exceeds 25MB limit`)
        return false
      }
      return true
    })
    const newAttachments = validFiles.map(file => {
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
    try {

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
    const conv = await window.api.conv.create(activeProvider) as Conversation
    const convs = await window.api.conv.list() as Conversation[]
    setConversations(convs)

    // Set optimistic user message so it shows immediately
    const userMsg: Message = {
      id: `temp_${Date.now()}`,
      conversation_id: conv.id,
      role: 'user' as const,
      content: text,
      tool_use_id: null,
      tool_name: null,
      tool_args: null,
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

    // Activate conversation (switches to ChatContent which sets up event listeners)
    setActiveConversationId(conv.id)

    // Wait for ChatContent to mount and set up event listeners before sending
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)))

    // Send message: agent mode or normal/skill mode
    try {
      if (activeAgentId) {
        const agent = agents.find(a => a.id === activeAgentId)
        if (agent) {
          setAgentRunStatus({ runId: '', agentName: agent.name, conversationId: conv.id, status: 'running' })
        }
        await window.api.agents.execute(activeAgentId, conv.id, text, activeProvider, activeModel ?? undefined)
        setAgentRunStatus(null)
        setActiveAgentId(null)
      } else {
        await window.api.chat.send(conv.id, text, activeProvider, attachmentsJson, activeModel, activeReasoningEffort, activePromptId ?? undefined)
        setActivePromptId(null)
      }
    } catch (e) {
      console.error('Chat send error:', e)
      setIsStreaming(false)
      setAgentRunStatus(null)
    }
    } finally {
      sendingRef.current = false
    }
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

  const canSend = inputValue.trim().length > 0 || attachments.length > 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 680 }}>
        {/* Starburst icon + Greeting */}
        <div style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ marginBottom: 4 }}>
            <Starburst size={32} animated />
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
            aria-label="Attach file"
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
            aria-label="Message input"
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
                    <img src={att.preview} alt={att.file.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 9 }} />
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }} aria-hidden="true">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file.name}</span>
                    </>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAttachment(idx) }}
                    aria-label={`Remove ${att.file.name}`}
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'white', fontSize: 10, lineHeight: 1
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s'
                }}
                className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                aria-label="Attach file"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <ProviderDropdown />
              <ModelDropdown />
              <ThinkingToggle />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleSend() }}
              disabled={!canSend}
              aria-label="Send message"
              style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none',
                background: canSend ? 'var(--accent)' : 'var(--bg-hover)',
                borderRadius: 10,
                cursor: canSend ? 'pointer' : 'not-allowed',
                color: 'white',
                opacity: canSend ? 1 : 0.4,
                transition: 'background 0.15s, opacity 0.15s'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }} aria-hidden="true">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {prompt.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Agent chips */}
        {agents.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {agents.map(agent => {
              const isSelected = activeAgentId === agent.id
              return (
                <button
                  key={agent.id}
                  onClick={() => setActiveAgentId(isSelected ? null : agent.id)}
                  title={agent.description || undefined}
                  style={{
                    padding: '7px 14px', borderRadius: 20,
                    border: `1px solid ${isSelected ? '#8b5cf6' : 'var(--border-subtle)'}`,
                    background: isSelected ? 'rgba(139,92,246,0.08)' : 'transparent',
                    color: isSelected ? '#8b5cf6' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }} aria-hidden="true">
                    <path d="M12 2a5 5 0 015 5v3a5 5 0 01-10 0V7a5 5 0 015-5z" />
                    <path d="M8 21h8" /><path d="M12 17v4" />
                  </svg>
                  {agent.name}
                </button>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
