import { contextBridge, ipcRenderer } from 'electron'

export type StreamCallback = (chunk: string) => void

const api = {
  // Auth
  auth: {
    connect: (provider: string) => ipcRenderer.invoke('auth:connect', provider),
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
    send: (conversationId: string, message: string, provider: string) =>
      ipcRenderer.invoke('chat:send', conversationId, message, provider),
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
    }
  },

  // Conversations
  conv: {
    list: () => ipcRenderer.invoke('conv:list'),
    create: (provider: string) => ipcRenderer.invoke('conv:create', provider),
    delete: (id: string) => ipcRenderer.invoke('conv:delete', id),
    getMessages: (id: string) => ipcRenderer.invoke('conv:get-messages', id),
    updateTitle: (id: string, title: string) => ipcRenderer.invoke('conv:update-title', id, title)
  },

  // MCP
  mcp: {
    listServers: () => ipcRenderer.invoke('mcp:list-servers'),
    addServer: (config: unknown) => ipcRenderer.invoke('mcp:add-server', config),
    removeServer: (name: string) => ipcRenderer.invoke('mcp:remove-server', name),
    listTools: () => ipcRenderer.invoke('mcp:list-tools'),
    serverStatus: () => ipcRenderer.invoke('mcp:server-status')
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: unknown) => ipcRenderer.invoke('settings:set', settings)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
