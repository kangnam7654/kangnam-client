import { create } from 'zustand'

export interface AuthStatus {
  provider: string
  connected: boolean
  expiresAt: number | null
}

export interface Conversation {
  id: string
  title: string
  provider: string
  model: string | null
  created_at: number
  updated_at: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_use_id: string | null
  token_count: number | null
  created_at: number
}

interface AppState {
  // Auth
  authStatuses: AuthStatus[]
  setAuthStatuses: (statuses: AuthStatus[]) => void

  // Provider
  activeProvider: string
  setActiveProvider: (provider: string) => void

  // Conversations
  conversations: Conversation[]
  setConversations: (convs: Conversation[]) => void
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void

  // Messages
  messages: Message[]
  setMessages: (msgs: Message[]) => void

  // Streaming
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  streamingText: string
  appendStreamingText: (text: string) => void
  resetStreamingText: () => void

  // Settings panel
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  settingsTab: 'providers' | 'mcp' | 'general'
  setSettingsTab: (tab: 'providers' | 'mcp' | 'general') => void
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  authStatuses: [],
  setAuthStatuses: (statuses) => set({ authStatuses: statuses }),

  // Provider
  activeProvider: 'codex',
  setActiveProvider: (provider) => set({ activeProvider: provider }),

  // Conversations
  conversations: [],
  setConversations: (convs) => set({ conversations: convs }),
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  // Messages
  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),

  // Streaming
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),
  streamingText: '',
  appendStreamingText: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  resetStreamingText: () => set({ streamingText: '' }),

  // Settings
  showSettings: false,
  setShowSettings: (v) => set({ showSettings: v }),
  settingsTab: 'providers',
  setSettingsTab: (tab) => set({ settingsTab: tab })
}))
