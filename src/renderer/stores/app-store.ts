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
  pinned: number
  created_at: number
  updated_at: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_use_id: string | null
  tool_name: string | null
  tool_args: string | null
  token_count: number | null
  attachments: string | null
  created_at: number
}

export interface AttachmentData {
  type: 'image' | 'file'
  name: string
  dataUrl: string
}

export interface SkillReference {
  id: string
  skillId: string
  name: string
  content: string
  sortOrder: number
}

export interface Prompt {
  id: string
  name: string
  description: string
  instructions: string
  argumentHint: string | null
  model: string | null
  userInvocable: boolean
  references: SkillReference[]
}

export interface CoworkToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'running' | 'success' | 'error'
  result?: string
}

export interface CoworkStep {
  text: string
  status: 'pending' | 'in_progress' | 'completed' | 'error'
}

interface AppState {
  // Auth
  authStatuses: AuthStatus[]
  setAuthStatuses: (statuses: AuthStatus[]) => void

  // Provider + Model
  activeProvider: string
  setActiveProvider: (provider: string) => void
  activeModel: string
  setActiveModel: (model: string) => void
  activeReasoningEffort: 'low' | 'medium' | 'high'
  setActiveReasoningEffort: (effort: 'low' | 'medium' | 'high') => void

  // View mode
  activeView: 'chat' | 'cowork'
  setActiveView: (view: 'chat' | 'cowork') => void

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
  thinkingText: string
  appendThinkingText: (text: string) => void
  resetThinkingText: () => void
  chatError: string | null
  setChatError: (err: string | null) => void
  contextUsage: { used: number; max: number } | null
  setContextUsage: (usage: { used: number; max: number } | null) => void

  // Tool call log (accumulated during streaming turn)
  activeToolCall: { name: string; args: unknown } | null
  setActiveToolCall: (tc: { name: string; args: unknown } | null) => void
  toolCallLog: Array<{ name: string; args: unknown; status: 'running' | 'done' }>
  pushToolCall: (tc: { name: string; args: unknown }) => void
  markLastToolDone: () => void
  clearToolCallLog: () => void

  // Pending attachments (for passing from Composer to onNew)
  pendingAttachments: AttachmentData[]
  setPendingAttachments: (atts: AttachmentData[]) => void

  // Search overlay
  showSearch: boolean
  setShowSearch: (v: boolean) => void

  // Prompts
  prompts: Prompt[]
  setPrompts: (prompts: Prompt[]) => void
  activePromptId: string | null
  setActivePromptId: (id: string | null) => void

  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void

  // Settings panel
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  settingsTab: 'providers' | 'mcp' | 'general' | 'prompts'
  setSettingsTab: (tab: 'providers' | 'mcp' | 'general' | 'prompts') => void

  // Theme
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void

  // Dev mode (shows hidden providers: gemini, antigravity, claude OAT, mock)
  devMode: boolean
  setDevMode: (v: boolean) => void
  toggleDevMode: () => void

  // Eval state
  showEval: boolean
  setShowEval: (v: boolean) => void
  evalSelectedSkillId: string | null
  setEvalSelectedSkillId: (id: string | null) => void
  evalActiveTab: 'editor' | 'history' | 'optimize'
  setEvalActiveTab: (tab: 'editor' | 'history' | 'optimize') => void
  evalActiveRunId: string | null
  setEvalActiveRunId: (id: string | null) => void
  evalIsRunning: boolean
  setEvalIsRunning: (v: boolean) => void
  evalProgress: { caseIndex: number; totalCases: number } | null
  setEvalProgress: (p: { caseIndex: number; totalCases: number } | null) => void

  // Cowork state
  coworkIsRunning: boolean
  setCoworkIsRunning: (v: boolean) => void
  coworkStreamText: string
  appendCoworkStreamText: (text: string) => void
  resetCoworkStreamText: () => void
  coworkSteps: CoworkStep[]
  setCoworkSteps: (steps: CoworkStep[]) => void
  updateCoworkStep: (index: number, update: Partial<CoworkStep>) => void
  coworkToolCalls: CoworkToolCall[]
  addCoworkToolCall: (tc: CoworkToolCall) => void
  updateCoworkToolCall: (id: string, update: Partial<CoworkToolCall>) => void
  resetCoworkState: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  authStatuses: [],
  setAuthStatuses: (statuses) => set({ authStatuses: statuses }),

  // Provider + Model
  activeProvider: 'codex',
  setActiveProvider: (provider) => set({ activeProvider: provider }),
  activeModel: 'gpt-5.4',
  setActiveModel: (model) => set({ activeModel: model }),
  activeReasoningEffort: 'high',
  setActiveReasoningEffort: (effort) => set({ activeReasoningEffort: effort }),

  // View mode
  activeView: 'chat',
  setActiveView: (view) => set({ activeView: view }),

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
  thinkingText: '',
  appendThinkingText: (text) => set((s) => ({ thinkingText: s.thinkingText + text })),
  resetThinkingText: () => set({ thinkingText: '' }),
  chatError: null,
  setChatError: (err) => set({ chatError: err }),
  contextUsage: null,
  setContextUsage: (usage) => set({ contextUsage: usage }),

  // Tool call log
  activeToolCall: null,
  setActiveToolCall: (tc) => set({ activeToolCall: tc }),
  toolCallLog: [],
  pushToolCall: (tc) => set((s) => {
    // Mark any running tool as done before adding new one
    const updated = s.toolCallLog.map(t => t.status === 'running' ? { ...t, status: 'done' as const } : t)
    return { toolCallLog: [...updated, { name: tc.name, args: tc.args, status: 'running' }] }
  }),
  markLastToolDone: () => set((s) => ({
    toolCallLog: s.toolCallLog.map(t => t.status === 'running' ? { ...t, status: 'done' as const } : t)
  })),
  clearToolCallLog: () => set({ toolCallLog: [] }),

  // Pending attachments
  pendingAttachments: [],
  setPendingAttachments: (atts) => set({ pendingAttachments: atts }),

  // Search overlay
  showSearch: false,
  setShowSearch: (v) => set({ showSearch: v }),

  // Prompts
  prompts: [],
  setPrompts: (prompts) => set({ prompts }),
  activePromptId: null,
  setActivePromptId: (id) => set({ activePromptId: id }),

  // Sidebar
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Settings
  showSettings: false,
  setShowSettings: (v) => set({ showSettings: v }),
  settingsTab: 'providers',
  setSettingsTab: (tab) => set({ settingsTab: tab }),

  // Theme
  theme: (localStorage.getItem('kangnam-theme') as 'light' | 'dark') || 'dark',
  setTheme: (t) => {
    localStorage.setItem('kangnam-theme', t)
    set({ theme: t })
  },

  // Dev mode — persisted in localStorage, activated via Ctrl+Shift+D
  devMode: localStorage.getItem('kangnam-dev-mode') === 'true',
  setDevMode: (v) => {
    localStorage.setItem('kangnam-dev-mode', v ? 'true' : 'false')
    set({ devMode: v })
  },
  toggleDevMode: () => set((s) => {
    const next = !s.devMode
    localStorage.setItem('kangnam-dev-mode', next ? 'true' : 'false')
    return { devMode: next }
  }),

  // Eval
  showEval: false,
  setShowEval: (v) => set({ showEval: v }),
  evalSelectedSkillId: null,
  setEvalSelectedSkillId: (id) => set({ evalSelectedSkillId: id }),
  evalActiveTab: 'editor',
  setEvalActiveTab: (tab) => set({ evalActiveTab: tab }),
  evalActiveRunId: null,
  setEvalActiveRunId: (id) => set({ evalActiveRunId: id }),
  evalIsRunning: false,
  setEvalIsRunning: (v) => set({ evalIsRunning: v }),
  evalProgress: null,
  setEvalProgress: (p) => set({ evalProgress: p }),

  // Cowork
  coworkIsRunning: false,
  setCoworkIsRunning: (v) => set({ coworkIsRunning: v }),
  coworkStreamText: '',
  appendCoworkStreamText: (text) => set((s) => ({ coworkStreamText: s.coworkStreamText + text })),
  resetCoworkStreamText: () => set({ coworkStreamText: '' }),
  coworkSteps: [],
  setCoworkSteps: (steps) => set({ coworkSteps: steps }),
  updateCoworkStep: (index, update) => set((s) => {
    const steps = [...s.coworkSteps]
    if (steps[index]) steps[index] = { ...steps[index], ...update }
    return { coworkSteps: steps }
  }),
  coworkToolCalls: [],
  addCoworkToolCall: (tc) => set((s) => ({ coworkToolCalls: [...s.coworkToolCalls, tc] })),
  updateCoworkToolCall: (id, update) => set((s) => ({
    coworkToolCalls: s.coworkToolCalls.map(tc => tc.id === id ? { ...tc, ...update } : tc)
  })),
  resetCoworkState: () => set({
    coworkIsRunning: false,
    coworkStreamText: '',
    coworkSteps: [],
    coworkToolCalls: []
  })
}))
