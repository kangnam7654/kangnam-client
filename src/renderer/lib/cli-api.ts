import { RpcClient } from './rpc/client'
import { createWsTransport } from './rpc/transport-ws'
import type { CliStatus, UnifiedMessage } from '../stores/app-store'

export interface ProviderMeta {
  name: string
  display_name: string
  description: string
  install_hint: string
}

// Connect to Axum WebSocket server
const WS_PORT = (globalThis as Record<string, unknown>).__KANGNAM_PORT ?? '3001'
const WS_URL = `ws://localhost:${WS_PORT}/ws`
const transport = createWsTransport(WS_URL)
const rpc = new RpcClient(transport)

export const cliApi = {
  listProviders: () =>
    rpc.call<ProviderMeta[]>('cli.listProviders'),

  checkInstalled: (provider: string) =>
    rpc.call<CliStatus>('cli.checkInstalled', { provider }),

  install: (provider: string) =>
    rpc.call<void>('cli.install', { provider }),

  startSession: (provider: string, workingDir?: string, model?: string | null) =>
    rpc.call<string>('cli.startSession', {
      provider,
      ...(workingDir && { workingDir }),
      ...(model && { model }),
    }),

  sendMessage: (sessionId: string, message: string) =>
    rpc.call<void>('cli.sendMessage', { sessionId, message }),

  permissionResponse: (id: string, allowed: boolean) =>
    rpc.call<void>('cli.permissionResponse', { id, allowed }),

  stopSession: (sessionId: string) =>
    rpc.call<void>('cli.stopSession', { sessionId }),

  /** Subscribe to CLI stream events (JSON-RPC Notifications) */
  onMessage: (callback: (msg: UnifiedMessage) => void): (() => void) =>
    rpc.onNotification((method, params) => {
      if (method === 'cli.stream') {
        callback(params as UnifiedMessage)
      }
    }),

  /** Subscribe to MCP permission request notifications */
  onPermissionRequest: (callback: (req: { id: string; tool: string; description: string; input?: unknown }) => void): (() => void) =>
    rpc.onNotification((method, params) => {
      if (method === 'cli.permissionRequest') {
        callback(params as { id: string; tool: string; description: string; input?: unknown })
      }
    }),

  /** Subscribe to Claude-enhanced events (JSON-RPC Notifications) */
  onEnhanced: (callback: (event: Record<string, unknown>) => void): (() => void) =>
    rpc.onNotification((method, params) => {
      if (method === 'cli.enhanced') {
        callback(params as Record<string, unknown>)
      }
    }),
}
