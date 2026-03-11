import { useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app-store'

export function useChat() {
  const {
    activeConversationId,
    activeProvider,
    isStreaming,
    setIsStreaming,
    streamingText,
    appendStreamingText,
    resetStreamingText,
    messages,
    setMessages,
    conversations,
    setConversations
  } = useAppStore()

  // Listen for streaming events
  useEffect(() => {
    const unsubStream = window.api.chat.onStream((data) => {
      if (data.conversationId === activeConversationId) {
        appendStreamingText(data.chunk)
      }
    })

    const unsubComplete = window.api.chat.onComplete((data) => {
      if (data.conversationId === activeConversationId) {
        setIsStreaming(false)
        resetStreamingText()
        // Reload messages to get the saved version
        loadMessages(data.conversationId)
      }
    })

    const unsubError = window.api.chat.onError((data) => {
      if (data.conversationId === activeConversationId) {
        setIsStreaming(false)
        resetStreamingText()
        console.error('Chat error:', data.error)
      }
    })

    return () => {
      unsubStream()
      unsubComplete()
      unsubError()
    }
  }, [activeConversationId])

  const loadMessages = useCallback(async (convId: string) => {
    const msgs = await window.api.conv.getMessages(convId)
    setMessages(msgs)
  }, [setMessages])

  const loadConversations = useCallback(async () => {
    const convs = await window.api.conv.list()
    setConversations(convs)
  }, [setConversations])

  const sendMessage = useCallback(async (text: string) => {
    if (!activeConversationId || !text.trim() || isStreaming) return

    setIsStreaming(true)
    resetStreamingText()

    // Optimistically add user message to UI
    const userMsg = {
      id: `temp_${Date.now()}`,
      conversation_id: activeConversationId,
      role: 'user' as const,
      content: text,
      tool_use_id: null,
      token_count: null,
      created_at: Math.floor(Date.now() / 1000)
    }
    setMessages([...messages, userMsg])

    await window.api.chat.send(activeConversationId, text, activeProvider)
  }, [activeConversationId, activeProvider, isStreaming, messages, setMessages, setIsStreaming, resetStreamingText])

  const stopGeneration = useCallback(async () => {
    if (activeConversationId) {
      await window.api.chat.stop(activeConversationId)
      setIsStreaming(false)
      resetStreamingText()
    }
  }, [activeConversationId, setIsStreaming, resetStreamingText])

  const createConversation = useCallback(async () => {
    const conv = await window.api.conv.create(activeProvider)
    await loadConversations()
    return conv
  }, [activeProvider, loadConversations])

  const deleteConversation = useCallback(async (id: string) => {
    await window.api.conv.delete(id)
    await loadConversations()
  }, [loadConversations])

  return {
    messages,
    isStreaming,
    streamingText,
    sendMessage,
    stopGeneration,
    createConversation,
    deleteConversation,
    loadMessages,
    loadConversations
  }
}
