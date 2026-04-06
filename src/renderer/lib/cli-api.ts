import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { CliStatus, UnifiedMessage } from '../stores/app-store'

export interface ProviderMeta {
  name: string
  display_name: string
  description: string
  install_hint: string
}

export const cliApi = {
  listProviders: () =>
    invoke<ProviderMeta[]>('cli_list_providers'),

  checkInstalled: (provider: string) =>
    invoke<CliStatus>('cli_check_installed', { provider }),

  install: (provider: string) =>
    invoke<void>('cli_install', { provider }),

  startSession: (provider: string, workingDir: string) =>
    invoke<string>('cli_start_session', { provider, workingDir }),

  sendMessage: (sessionId: string, message: string) =>
    invoke<void>('cli_send_message', { sessionId, message }),

  sendPermission: (sessionId: string, requestId: string, allowed: boolean) =>
    invoke<void>('cli_send_permission', { sessionId, requestId, allowed }),

  stopSession: (sessionId: string) =>
    invoke<void>('cli_stop_session', { sessionId }),

  onMessage: (callback: (msg: UnifiedMessage) => void): Promise<UnlistenFn> =>
    listen<UnifiedMessage>('cli-stream', (event) => callback(event.payload)),
}
