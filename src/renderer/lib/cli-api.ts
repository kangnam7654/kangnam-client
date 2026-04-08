import { RpcClient } from './rpc/client'
import { tauriTransport } from './rpc/transport-tauri'
import type { CliStatus, UnifiedMessage } from '../stores/app-store'

export interface ProviderMeta {
  name: string
  display_name: string
  description: string
  install_hint: string
}

// Single RPC client instance — transport can be swapped for web
const rpc = new RpcClient(tauriTransport)

export const cliApi = {
  listProviders: () =>
    rpc.call<ProviderMeta[]>('cli.listProviders'),

  checkInstalled: (provider: string) =>
    rpc.call<CliStatus>('cli.checkInstalled', { provider }),

  install: (provider: string) =>
    rpc.call<void>('cli.install', { provider }),

  startSession: (provider: string, workingDir: string) =>
    rpc.call<string>('cli.startSession', { provider, workingDir }),

  sendMessage: (sessionId: string, message: string) =>
    rpc.call<void>('cli.sendMessage', { sessionId, message }),

  sendPermission: (sessionId: string, requestId: string, allowed: boolean) =>
    rpc.call<void>('cli.sendPermission', { sessionId, requestId, allowed }),

  stopSession: (sessionId: string) =>
    rpc.call<void>('cli.stopSession', { sessionId }),

  /** Subscribe to CLI stream events (JSON-RPC Notifications) */
  onMessage: (callback: (msg: UnifiedMessage) => void): (() => void) =>
    rpc.onNotification((method, params) => {
      if (method === 'cli.stream') {
        callback(params as UnifiedMessage)
      }
    }),
}
