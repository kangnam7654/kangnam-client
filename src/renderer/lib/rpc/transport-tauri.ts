import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from './types'
import type { RpcTransport } from './client'

export const tauriTransport: RpcTransport = {
  send: (request: JsonRpcRequest): Promise<JsonRpcResponse> =>
    invoke<JsonRpcResponse>('rpc', { request }),

  onNotification: (callback: (notification: JsonRpcNotification) => void): (() => void) => {
    let unlisten: (() => void) | null = null
    listen<JsonRpcNotification>('rpc-notification', (event) => {
      callback(event.payload)
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  },
}
