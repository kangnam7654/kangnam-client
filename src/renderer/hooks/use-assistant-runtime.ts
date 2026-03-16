import { useMemo, useCallback, useRef, useEffect } from 'react'
import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
  type ExternalStoreAdapter
} from '@assistant-ui/react'
import { useAppStore, type Message, type AttachmentData } from '../stores/app-store'

/**
 * Convert our DB Message format to assistant-ui ThreadMessageLike.
 * Tool messages are skipped — they're folded into the preceding assistant message's tool-call results.
 */
function convertMessage(msg: Message): ThreadMessageLike {
  if (msg.role === 'tool') {
    return {
      role: 'assistant',
      id: msg.id,
      content: [
        {
          type: 'tool-call' as const,
          toolCallId: msg.tool_use_id ?? msg.id,
          toolName: 'tool',
          result: msg.content,
          argsText: ''
        }
      ]
    }
  }

  // Build content parts, including images from attachments
  const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = []

  // Add image attachments first
  if (msg.attachments) {
    try {
      const atts: AttachmentData[] = JSON.parse(msg.attachments)
      for (const att of atts) {
        if (att.type === 'image') {
          contentParts.push({ type: 'image', image: att.dataUrl })
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Add text content
  if (msg.content) {
    contentParts.push({ type: 'text', text: msg.content })
  }

  // If we have mixed content (images + text), use array format
  if (contentParts.length > 1 || contentParts.some(p => p.type === 'image')) {
    return {
      role: msg.role === 'system' ? 'system' : msg.role as 'user' | 'assistant',
      id: msg.id,
      content: contentParts as any,
      createdAt: new Date(msg.created_at * 1000)
    }
  }

  return {
    role: msg.role === 'system' ? 'system' : msg.role as 'user' | 'assistant',
    id: msg.id,
    content: msg.content,
    createdAt: new Date(msg.created_at * 1000)
  }
}

/**
 * Builds assistant-ui ThreadMessageLike[] from our flat Message[] array.
 * Merges consecutive tool messages as tool-call results into the preceding assistant message.
 */
function buildThreadMessages(messages: Message[], streamingText: string, isStreaming: boolean): ThreadMessageLike[] {
  const result: ThreadMessageLike[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (msg.role === 'tool') {
      // Already merged into preceding assistant message
      continue
    }

    if (msg.role === 'assistant') {
      // Check if following messages are tool results
      const toolResults: Array<{
        type: 'tool-call'
        toolCallId: string
        toolName: string
        args: Record<string, unknown>
        argsText: string
        result: string
      }> = []

      let j = i + 1
      while (j < messages.length && messages[j].role === 'tool') {
        const toolMsg = messages[j]
        let parsedArgs: Record<string, unknown> = {}
        try { if (toolMsg.tool_args) parsedArgs = JSON.parse(toolMsg.tool_args) } catch { /* ignore */ }
        toolResults.push({
          type: 'tool-call',
          toolCallId: toolMsg.tool_use_id ?? toolMsg.id,
          toolName: toolMsg.tool_name ?? 'tool',
          args: parsedArgs,
          argsText: toolMsg.tool_args ?? '',
          result: toolMsg.content
        })
        j++
      }

      if (toolResults.length > 0) {
        // Assistant message with tool calls
        const parts: Array<
          { type: 'text'; text: string } |
          {
            type: 'tool-call'
            toolCallId: string
            toolName: string
            args: Record<string, unknown>
            argsText: string
            result: string
          }
        > = []
        if (msg.content && msg.content !== '[tool call]') {
          parts.push({ type: 'text' as const, text: msg.content })
        }
        parts.push(...toolResults)

        result.push({
          role: 'assistant',
          id: msg.id,
          content: parts as any,
          createdAt: new Date(msg.created_at * 1000),
          status: { type: 'complete', reason: 'stop' }
        })
      } else {
        result.push(convertMessage(msg))
      }
    } else {
      result.push(convertMessage(msg))
    }
  }

  // Add streaming message (or "thinking" placeholder when no text yet)
  if (isStreaming) {
    if (streamingText) {
      result.push({
        role: 'assistant',
        id: '__streaming__',
        content: streamingText,
        status: { type: 'running' }
      })
    } else {
      // Show a placeholder while waiting for first token
      result.push({
        role: 'assistant',
        id: '__streaming__',
        content: '',
        status: { type: 'running' }
      })
    }
  }

  return result
}

export function useAssistantRuntime() {
  const {
    activeConversationId,
    activeProvider,
    activeModel,
    activeReasoningEffort,
    messages,
    isStreaming,
    streamingText,
    setIsStreaming,
    resetStreamingText,
    appendStreamingText,
    setMessages
  } = useAppStore()

  const conversationIdRef = useRef(activeConversationId)
  conversationIdRef.current = activeConversationId

  // IPC event subscriptions
  useEffect(() => {
    const unsubStream = window.api.chat.onStream((data) => {
      if (data.conversationId === conversationIdRef.current) {
        // Mark running tool as done when text starts streaming
        const state = useAppStore.getState()
        if (state.activeToolCall) {
          useAppStore.setState({ activeToolCall: null })
          state.markLastToolDone()
        }
        appendStreamingText(data.chunk)
      }
    })

    const unsubToolCall = window.api.chat.onToolCall((data) => {
      if (data.conversationId === conversationIdRef.current) {
        const tc = { name: data.tool, args: data.args }
        useAppStore.setState({ activeToolCall: tc })
        useAppStore.getState().pushToolCall(tc)
      }
    })

    const unsubThinking = window.api.chat.onThinking((data) => {
      if (data.conversationId === conversationIdRef.current) {
        useAppStore.getState().appendThinkingText(data.chunk)
      }
    })

    const unsubComplete = window.api.chat.onComplete(async (data) => {
      if (data.conversationId === conversationIdRef.current) {
        const msgs = await window.api.conv.getMessages(data.conversationId)
        useAppStore.setState({ messages: msgs, isStreaming: false, streamingText: '', activeToolCall: null })
        useAppStore.getState().clearToolCallLog()
        const convs = await window.api.conv.list()
        useAppStore.getState().setConversations(convs)
      }
    })

    const unsubError = window.api.chat.onError(async (data) => {
      if (data.conversationId === conversationIdRef.current) {
        console.error('Chat error:', data.error)
        const msgs = await window.api.conv.getMessages(data.conversationId)
        useAppStore.setState({ messages: msgs, isStreaming: false, streamingText: '', activeToolCall: null, chatError: data.error })
        useAppStore.getState().clearToolCallLog()
      }
    })

    return () => {
      unsubStream()
      unsubToolCall()
      unsubThinking()
      unsubComplete()
      unsubError()
    }
  }, [appendStreamingText, setIsStreaming, resetStreamingText, setMessages])

  const threadMessages = useMemo(
    () => buildThreadMessages(messages, streamingText, isStreaming),
    [messages, streamingText, isStreaming]
  )

  const onNew = useCallback(async (message: AppendMessage) => {
    const convId = conversationIdRef.current

    // ChatContent only renders when activeConversationId is set
    // (WelcomeScreen handles conversation creation for the first message)
    if (!convId) return

    // Extract text content from the AppendMessage
    let text = ''
    if (typeof message.content === 'string') {
      text = message.content
    } else if (Array.isArray(message.content)) {
      text = message.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('\n')
    }

    // Grab pending attachments from store
    const store = useAppStore.getState()
    const pendingAtts = store.pendingAttachments
    const attachmentsJson = pendingAtts.length > 0 ? JSON.stringify(pendingAtts) : undefined
    store.setPendingAttachments([])

    // Strip placeholder text used to bypass assistant-ui empty-send guard
    if (text === '[image]' && attachmentsJson) {
      text = ''
    }

    if (!text.trim() && !attachmentsJson) return

    setIsStreaming(true)
    resetStreamingText()
    useAppStore.getState().resetThinkingText()
    useAppStore.getState().clearToolCallLog()
    useAppStore.getState().setChatError(null)

    // Optimistic user message — show description for image-only messages
    const displayText = text || (attachmentsJson ? '' : '')
    const userMsg: Message = {
      id: `temp_${Date.now()}`,
      conversation_id: convId,
      role: 'user',
      content: displayText,
      tool_use_id: null,
      token_count: null,
      attachments: attachmentsJson ?? null,
      created_at: Math.floor(Date.now() / 1000)
    }
    setMessages([...messages, userMsg])

    await window.api.chat.send(convId, displayText, activeProvider, attachmentsJson, activeModel, activeReasoningEffort)
  }, [messages, activeProvider, activeModel, activeReasoningEffort, setIsStreaming, resetStreamingText, setMessages])

  const onCancel = useCallback(async () => {
    const convId = conversationIdRef.current
    if (convId) {
      window.api.chat.stop(convId)
    }
    // Convert streaming text into a temporary local message to avoid
    // an intermediate render with missing content (causes index out of bounds)
    const state = useAppStore.getState()
    if (state.streamingText.trim()) {
      const partialMsg: Message = {
        id: `partial_${Date.now()}`,
        conversation_id: convId ?? '',
        role: 'assistant',
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
    // Reload from DB after backend saves the partial response
    if (convId) {
      setTimeout(async () => {
        const msgs = await window.api.conv.getMessages(convId)
        useAppStore.getState().setMessages(msgs)
      }, 500)
    }
  }, [])

  const adapter: ExternalStoreAdapter<ThreadMessageLike> = useMemo(() => ({
    isRunning: isStreaming,
    messages: threadMessages,
    convertMessage: (m: ThreadMessageLike) => m,
    onNew,
    onCancel
  }), [isStreaming, threadMessages, onNew, onCancel])

  return useExternalStoreRuntime(adapter)
}
