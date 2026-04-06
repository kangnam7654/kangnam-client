import { create } from 'zustand'

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

export interface Agent {
  id: string
  name: string
  description: string
  instructions: string
  model: string | null
  allowedTools: string[] | null
  maxTurns: number
  sortOrder: number
}

export interface CliStatus {
  provider: string
  installed: boolean
  version: string | null
  path: string | null
  authenticated: boolean
}

export type UnifiedMessage =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: string; is_error: boolean }
  | { type: 'permission_request'; id: string; tool: string; description: string; diff?: string }
  | { type: 'agent_start'; id: string; name: string; description: string }
  | { type: 'agent_progress'; id: string; message: string }
  | { type: 'agent_end'; id: string; result: string }
  | { type: 'skill_invoked'; name: string; args?: string }
  | { type: 'turn_end'; usage?: { input_tokens: number; output_tokens: number } }
  | { type: 'error'; message: string }
  | { type: 'session_init'; session_id: string }

interface AppState {
  // CLI
  cliStatuses: CliStatus[]
  setCliStatuses: (statuses: CliStatus[]) => void
  currentSessionId: string | null
  setCurrentSessionId: (id: string | null) => void
  currentProvider: string | null
  setCurrentProvider: (provider: string | null) => void
  setupComplete: boolean
  setSetupComplete: (complete: boolean) => void

  // Streaming CLI messages
  messages: UnifiedMessage[]
  addMessage: (msg: UnifiedMessage) => void
  clearMessages: () => void
  pendingPermission: UnifiedMessage | null
  setPendingPermission: (msg: UnifiedMessage | null) => void

  // Conversations
  conversations: Conversation[]
  setConversations: (convs: Conversation[]) => void
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void

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

  // Agents
  agents: Agent[]
  setAgents: (agents: Agent[]) => void
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void

  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void

  // Settings panel
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  settingsTab: 'providers' | 'mcp' | 'general' | 'prompts' | 'agents'
  setSettingsTab: (tab: 'providers' | 'mcp' | 'general' | 'prompts' | 'agents') => void

  // Theme
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void

  // Dev mode (shows hidden providers: gemini, antigravity, claude OAT, mock)
  devMode: boolean
  setDevMode: (v: boolean) => void
  toggleDevMode: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // CLI
  cliStatuses: [],
  setCliStatuses: (statuses) => set({ cliStatuses: statuses }),
  currentSessionId: null,
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  currentProvider: null,
  setCurrentProvider: (provider) => set({ currentProvider: provider }),
  setupComplete: false,
  setSetupComplete: (complete) => set({ setupComplete: complete }),

  // Streaming CLI messages
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
  pendingPermission: null,
  setPendingPermission: (msg) => set({ pendingPermission: msg }),

  // Conversations
  conversations: [],
  setConversations: (convs) => set({ conversations: convs }),
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

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
  setActivePromptId: (id) => set({ activePromptId: id, activeAgentId: id ? null : get().activeAgentId }),

  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),
  activeAgentId: null,
  setActiveAgentId: (id) => set({ activeAgentId: id, activePromptId: id ? null : get().activePromptId }),

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
}))
