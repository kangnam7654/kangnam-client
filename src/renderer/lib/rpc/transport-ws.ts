// WebSocket transport — stub for future web app support
// Implements the same RpcTransport interface as transport-tauri.ts

import type { RpcTransport } from './client'

export function createWsTransport(_url: string): RpcTransport {
  throw new Error('WebSocket transport not yet implemented')
}
