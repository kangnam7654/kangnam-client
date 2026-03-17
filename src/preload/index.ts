import { contextBridge, ipcRenderer } from 'electron'

export type StreamCallback = (chunk: string) => void

const api = {
  // Auth
  auth: {
    connect: (provider: string, options?: { setupToken?: string }) => ipcRenderer.invoke('auth:connect', provider, options),
    disconnect: (provider: string) => ipcRenderer.invoke('auth:disconnect', provider),
    status: () => ipcRenderer.invoke('auth:status'),
    onConnected: (callback: (provider: string) => void) => {
      const handler = (_: unknown, provider: string) => callback(provider)
      ipcRenderer.on('auth:on-connected', handler)
      return () => ipcRenderer.removeListener('auth:on-connected', handler)
    },
    onDisconnected: (callback: (provider: string) => void) => {
      const handler = (_: unknown, provider: string) => callback(provider)
      ipcRenderer.on('auth:on-disconnected', handler)
      return () => ipcRenderer.removeListener('auth:on-disconnected', handler)
    },
    onCopilotDeviceCode: (callback: (data: { userCode: string; verificationUri: string }) => void) => {
      const handler = (_: unknown, data: { userCode: string; verificationUri: string }) => callback(data)
      ipcRenderer.on('auth:copilot-device-code', handler)
      return () => ipcRenderer.removeListener('auth:copilot-device-code', handler)
    }
  },

  // Chat
  chat: {
    send: (conversationId: string, message: string, provider: string, attachments?: string, model?: string, reasoningEffort?: string, promptId?: string) =>
      ipcRenderer.invoke('chat:send', conversationId, message, provider, attachments, model, reasoningEffort, promptId),
    stop: (conversationId: string) =>
      ipcRenderer.invoke('chat:stop', conversationId),
    onStream: (callback: (data: { conversationId: string; chunk: string }) => void) => {
      const handler = (_: unknown, data: { conversationId: string; chunk: string }) => callback(data)
      ipcRenderer.on('chat:stream', handler)
      return () => ipcRenderer.removeListener('chat:stream', handler)
    },
    onComplete: (callback: (data: { conversationId: string }) => void) => {
      const handler = (_: unknown, data: { conversationId: string }) => callback(data)
      ipcRenderer.on('chat:complete', handler)
      return () => ipcRenderer.removeListener('chat:complete', handler)
    },
    onError: (callback: (data: { conversationId: string; error: string }) => void) => {
      const handler = (_: unknown, data: { conversationId: string; error: string }) => callback(data)
      ipcRenderer.on('chat:error', handler)
      return () => ipcRenderer.removeListener('chat:error', handler)
    },
    onToolCall: (callback: (data: { conversationId: string; tool: string; args: unknown }) => void) => {
      const handler = (_: unknown, data: { conversationId: string; tool: string; args: unknown }) => callback(data)
      ipcRenderer.on('chat:tool-call', handler)
      return () => ipcRenderer.removeListener('chat:tool-call', handler)
    },
    onThinking: (callback: (data: { conversationId: string; chunk: string }) => void) => {
      const handler = (_: unknown, data: { conversationId: string; chunk: string }) => callback(data)
      ipcRenderer.on('chat:thinking', handler)
      return () => ipcRenderer.removeListener('chat:thinking', handler)
    },
    onContextUsage: (callback: (data: { conversationId: string; used: number; max: number }) => void) => {
      const handler = (_: unknown, data: { conversationId: string; used: number; max: number }) => callback(data)
      ipcRenderer.on('chat:context-usage', handler)
      return () => ipcRenderer.removeListener('chat:context-usage', handler)
    }
  },

  // Conversations
  conv: {
    list: () => ipcRenderer.invoke('conv:list'),
    create: (provider: string) => ipcRenderer.invoke('conv:create', provider),
    delete: (id: string) => ipcRenderer.invoke('conv:delete', id),
    getMessages: (id: string) => ipcRenderer.invoke('conv:get-messages', id),
    updateTitle: (id: string, title: string) => ipcRenderer.invoke('conv:update-title', id, title),
    togglePin: (id: string) => ipcRenderer.invoke('conv:toggle-pin', id),
    deleteAll: () => ipcRenderer.invoke('conv:delete-all'),
    search: (query: string) => ipcRenderer.invoke('conv:search', query),
    onTitleUpdated: (callback: (data: { conversationId: string; title: string }) => void) => {
      const handler = (_: unknown, data: { conversationId: string; title: string }) => callback(data)
      ipcRenderer.on('conv:title-updated', handler)
      return () => ipcRenderer.removeListener('conv:title-updated', handler)
    }
  },

  // MCP
  mcp: {
    listServers: () => ipcRenderer.invoke('mcp:list-servers'),
    aiAssist: (prompt: string, provider: string, model?: string) => ipcRenderer.invoke('mcp:ai-assist', prompt, provider, model),
    getConfig: (name: string) => ipcRenderer.invoke('mcp:get-config', name),
    addServer: (config: unknown) => ipcRenderer.invoke('mcp:add-server', config),
    reconnectServer: (name: string) => ipcRenderer.invoke('mcp:reconnect-server', name),
    updateServer: (oldName: string, config: unknown) => ipcRenderer.invoke('mcp:update-server', oldName, config),
    removeServer: (name: string) => ipcRenderer.invoke('mcp:remove-server', name),
    listTools: () => ipcRenderer.invoke('mcp:list-tools'),
    serverStatus: () => ipcRenderer.invoke('mcp:server-status')
  },

  // Skills (prompts)
  prompts: {
    list: () => ipcRenderer.invoke('prompts:list'),
    get: (id: string) => ipcRenderer.invoke('prompts:get', id),
    getInstructions: (id: string) => ipcRenderer.invoke('prompts:get-instructions', id),
    create: (name: string, description: string, instructions: string, argumentHint?: string, model?: string, userInvocable?: boolean) =>
      ipcRenderer.invoke('prompts:create', name, description, instructions, argumentHint, model, userInvocable),
    update: (id: string, name: string, description: string, instructions: string, argumentHint?: string, model?: string, userInvocable?: boolean) =>
      ipcRenderer.invoke('prompts:update', id, name, description, instructions, argumentHint, model, userInvocable),
    delete: (id: string) => ipcRenderer.invoke('prompts:delete', id),
    // References
    refList: (skillId: string) => ipcRenderer.invoke('prompts:ref:list', skillId),
    refAdd: (skillId: string, name: string, content: string) => ipcRenderer.invoke('prompts:ref:add', skillId, name, content),
    refUpdate: (id: string, name: string, content: string) => ipcRenderer.invoke('prompts:ref:update', id, name, content),
    refDelete: (id: string) => ipcRenderer.invoke('prompts:ref:delete', id),
    // AI Assist
    aiGenerate: (userRequest: string, provider: string, model?: string) => ipcRenderer.invoke('prompts:ai:generate', userRequest, provider, model),
    aiImprove: (currentSkill: { name: string; description: string; instructions: string }, feedback: string, provider: string, model?: string) => ipcRenderer.invoke('prompts:ai:improve', currentSkill, feedback, provider, model),
    aiGenerateRef: (skillInstructions: string, userRequest: string, provider: string, model?: string) => ipcRenderer.invoke('prompts:ai:generate-ref', skillInstructions, userRequest, provider, model),
    aiGenerateEvals: (skill: { name: string; description: string; instructions: string }, provider: string, model?: string) => ipcRenderer.invoke('prompts:ai:generate-evals', skill, provider, model),
    // Sub-Agents
    aiGrade: (skill: { name: string; description: string; instructions: string }, criteria: string[], provider: string, model?: string) => ipcRenderer.invoke('prompts:ai:grade', skill, criteria, provider, model),
    aiCompare: (skillA: { name: string; description: string; instructions: string }, skillB: { name: string; description: string; instructions: string }, provider: string, model?: string) => ipcRenderer.invoke('prompts:ai:compare', skillA, skillB, provider, model),
    aiAnalyze: (comparisonResult: unknown, winnerSkill: { name: string; description: string; instructions: string }, loserSkill: { name: string; description: string; instructions: string }, provider: string, model?: string) => ipcRenderer.invoke('prompts:ai:analyze', comparisonResult, winnerSkill, loserSkill, provider, model)
  },

  // Eval
  eval: {
    // Sets
    setCreate: (skillId: string, name?: string) => ipcRenderer.invoke('eval:set:create', skillId, name),
    setList: (skillId: string) => ipcRenderer.invoke('eval:set:list', skillId),
    setDelete: (id: string) => ipcRenderer.invoke('eval:set:delete', id),
    // Cases
    caseAdd: (evalSetId: string, prompt: string, expected: string, shouldTrigger: boolean) =>
      ipcRenderer.invoke('eval:case:add', evalSetId, prompt, expected, shouldTrigger),
    caseBulkAdd: (evalSetId: string, cases: Array<{ prompt: string; expected: string; shouldTrigger: boolean }>) =>
      ipcRenderer.invoke('eval:case:bulk-add', evalSetId, cases),
    caseUpdate: (id: string, prompt: string, expected: string, shouldTrigger: boolean) =>
      ipcRenderer.invoke('eval:case:update', id, prompt, expected, shouldTrigger),
    caseDelete: (id: string) => ipcRenderer.invoke('eval:case:delete', id),
    caseList: (evalSetId: string) => ipcRenderer.invoke('eval:case:list', evalSetId),
    // Runs
    runStart: (evalSetId: string, skillId: string, provider: string, model?: string) =>
      ipcRenderer.invoke('eval:run:start', evalSetId, skillId, provider, model),
    runStop: (runId: string) => ipcRenderer.invoke('eval:run:stop', runId),
    runList: (evalSetId: string) => ipcRenderer.invoke('eval:run:list', evalSetId),
    runGet: (runId: string) => ipcRenderer.invoke('eval:run:get', runId),
    runResults: (runId: string) => ipcRenderer.invoke('eval:run:results', runId),
    runStats: (runId: string) => ipcRenderer.invoke('eval:run:stats', runId),
    runDelete: (runId: string) => ipcRenderer.invoke('eval:run:delete', runId),
    // Result feedback
    resultFeedback: (resultId: string, feedback: string, rating: number) =>
      ipcRenderer.invoke('eval:result:feedback', resultId, feedback, rating),
    // AI
    aiGenerate: (skill: { name: string; description: string; instructions: string }, provider: string, model?: string) =>
      ipcRenderer.invoke('eval:ai:generate', skill, provider, model),
    // Optimize
    optimizeStart: (skillId: string, evalSetId: string, provider: string, model?: string) =>
      ipcRenderer.invoke('eval:optimize:start', skillId, evalSetId, provider, model),
    // Events
    onProgress: (callback: (data: { runId: string; caseIndex: number; totalCases: number; result: unknown }) => void) => {
      const handler = (_: unknown, data: { runId: string; caseIndex: number; totalCases: number; result: unknown }) => callback(data)
      ipcRenderer.on('eval:progress', handler)
      return () => ipcRenderer.removeListener('eval:progress', handler)
    },
    onRunComplete: (callback: (data: { runId: string; stats: unknown }) => void) => {
      const handler = (_: unknown, data: { runId: string; stats: unknown }) => callback(data)
      ipcRenderer.on('eval:run-complete', handler)
      return () => ipcRenderer.removeListener('eval:run-complete', handler)
    },
    onRunError: (callback: (data: { runId: string; error: string }) => void) => {
      const handler = (_: unknown, data: { runId: string; error: string }) => callback(data)
      ipcRenderer.on('eval:run-error', handler)
      return () => ipcRenderer.removeListener('eval:run-error', handler)
    },
    onOptimizeProgress: (callback: (data: { step: string; [key: string]: unknown }) => void) => {
      const handler = (_: unknown, data: { step: string; [key: string]: unknown }) => callback(data)
      ipcRenderer.on('eval:optimize-progress', handler)
      return () => ipcRenderer.removeListener('eval:optimize-progress', handler)
    },
    onOptimizeComplete: (callback: (data: { candidates: unknown[] }) => void) => {
      const handler = (_: unknown, data: { candidates: unknown[] }) => callback(data)
      ipcRenderer.on('eval:optimize-complete', handler)
      return () => ipcRenderer.removeListener('eval:optimize-complete', handler)
    }
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: unknown) => ipcRenderer.invoke('settings:set', settings)
  },

  // Cowork
  cowork: {
    start: (task: string, provider: string, model?: string, reasoningEffort?: string) =>
      ipcRenderer.invoke('cowork:start', task, provider, model, reasoningEffort),
    stop: () => ipcRenderer.invoke('cowork:stop'),
    followUp: (instruction: string) => ipcRenderer.invoke('cowork:follow-up', instruction),
    onPlan: (callback: (data: { steps: string[] }) => void) => {
      const handler = (_: unknown, data: { steps: string[] }) => callback(data)
      ipcRenderer.on('cowork:plan', handler)
      return () => ipcRenderer.removeListener('cowork:plan', handler)
    },
    onStepStart: (callback: (data: { step: number }) => void) => {
      const handler = (_: unknown, data: { step: number }) => callback(data)
      ipcRenderer.on('cowork:step-start', handler)
      return () => ipcRenderer.removeListener('cowork:step-start', handler)
    },
    onStream: (callback: (data: { chunk: string }) => void) => {
      const handler = (_: unknown, data: { chunk: string }) => callback(data)
      ipcRenderer.on('cowork:stream', handler)
      return () => ipcRenderer.removeListener('cowork:stream', handler)
    },
    onToolCall: (callback: (data: { id: string; name: string; input: Record<string, unknown> }) => void) => {
      const handler = (_: unknown, data: { id: string; name: string; input: Record<string, unknown> }) => callback(data)
      ipcRenderer.on('cowork:tool-call', handler)
      return () => ipcRenderer.removeListener('cowork:tool-call', handler)
    },
    onToolResult: (callback: (data: { id: string; result: string; status: 'success' | 'error' }) => void) => {
      const handler = (_: unknown, data: { id: string; result: string; status: 'success' | 'error' }) => callback(data)
      ipcRenderer.on('cowork:tool-result', handler)
      return () => ipcRenderer.removeListener('cowork:tool-result', handler)
    },
    onStepComplete: (callback: (data: { step: number }) => void) => {
      const handler = (_: unknown, data: { step: number }) => callback(data)
      ipcRenderer.on('cowork:step-complete', handler)
      return () => ipcRenderer.removeListener('cowork:step-complete', handler)
    },
    onComplete: (callback: (data: { summary: string }) => void) => {
      const handler = (_: unknown, data: { summary: string }) => callback(data)
      ipcRenderer.on('cowork:complete', handler)
      return () => ipcRenderer.removeListener('cowork:complete', handler)
    },
    onError: (callback: (data: { error: string }) => void) => {
      const handler = (_: unknown, data: { error: string }) => callback(data)
      ipcRenderer.on('cowork:error', handler)
      return () => ipcRenderer.removeListener('cowork:error', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
