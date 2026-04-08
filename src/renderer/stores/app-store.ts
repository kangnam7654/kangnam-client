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
  | { type: 'user_message'; text: string }
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

export interface SessionMeta {
  session_id: string
  tools: string[]
  skills: string[]
  slash_commands: string[]
  mcp_servers: { name: string; status: string }[]
  model: string
  permission_mode: string
  cwd: string
  claude_code_version: string
}

export interface TaskState {
  task_id: string
  description: string
  task_type: string
  status: 'running' | 'completed' | 'failed' | 'stopped'
  summary?: string
}

export interface RateLimitInfo {
  status: string
  utilization: number | null
  rate_limit_type: string
}

export interface ResultSummary {
  cost_usd: number | null
  duration_ms: number | null
  num_turns: number | null
}

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
  currentWorkingDir: string | null
  setCurrentWorkingDir: (dir: string | null) => void
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void

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

  // Enhanced (Claude-specific)
  sessionMeta: SessionMeta | null
  setSessionMeta: (meta: SessionMeta | null) => void
  activeTasks: TaskState[]
  addTask: (task: TaskState) => void
  updateTask: (taskId: string, updates: Partial<TaskState>) => void
  rateLimit: RateLimitInfo | null
  setRateLimit: (info: RateLimitInfo | null) => void
  sessionCost: ResultSummary | null
  setSessionCost: (cost: ResultSummary | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // CLI
  cliStatuses: [],
  setCliStatuses: (statuses) => set({ cliStatuses: statuses }),
  currentSessionId: null,
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  currentProvider: localStorage.getItem('kangnam-provider'),
  setCurrentProvider: (provider) => {
    if (provider) localStorage.setItem('kangnam-provider', provider)
    else localStorage.removeItem('kangnam-provider')
    set({ currentProvider: provider })
  },
  setupComplete: localStorage.getItem('kangnam-setup-complete') === 'true',
  setSetupComplete: (complete) => {
    localStorage.setItem('kangnam-setup-complete', complete ? 'true' : 'false')
    set({ setupComplete: complete })
  },
  currentWorkingDir: null,
  setCurrentWorkingDir: (dir) => set({ currentWorkingDir: dir }),
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  // Streaming CLI messages
  messages: [],
  addMessage: (msg) => set((s) => {
    const last = s.messages[s.messages.length - 1]
    // Accumulate consecutive text_deltas into one message
    if (msg.type === 'text_delta' && last?.type === 'text_delta') {
      const updated = [...s.messages]
      updated[updated.length - 1] = { ...last, text: last.text + msg.text }
      return { messages: updated }
    }
    // Accumulate consecutive agent_progress from same agent
    if (msg.type === 'agent_progress' && last?.type === 'agent_progress' && last.id === msg.id) {
      const updated = [...s.messages]
      updated[updated.length - 1] = { ...last, message: last.message + msg.message }
      return { messages: updated }
    }
    return { messages: [...s.messages, msg] }
  }),
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

  // Enhanced
  sessionMeta: null,
  setSessionMeta: (meta) => set({ sessionMeta: meta }),
  activeTasks: [],
  addTask: (task) => set((s) => ({ activeTasks: [...s.activeTasks, task] })),
  updateTask: (taskId, updates) => set((s) => ({
    activeTasks: s.activeTasks.map((t) =>
      t.task_id === taskId ? { ...t, ...updates } : t
    ),
  })),
  rateLimit: null,
  setRateLimit: (info) => set({ rateLimit: info }),
  sessionCost: null,
  setSessionCost: (cost) => set({ sessionCost: cost }),
}))
