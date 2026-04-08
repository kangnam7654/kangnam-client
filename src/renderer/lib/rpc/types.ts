// JSON-RPC 2.0 Types

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | null
  result?: unknown
  error?: JsonRpcError
}

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

/** Server → Client notification (no id) */
export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export class RpcError extends Error {
  code: number
  data?: unknown

  constructor(err: JsonRpcError) {
    super(err.message)
    this.name = 'RpcError'
    this.code = err.code
    this.data = err.data
  }
}

// Standard JSON-RPC 2.0 error codes
export const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // App-specific
  PROVIDER_NOT_FOUND: -32001,
  SESSION_NOT_FOUND: -32002,
  CLI_NOT_INSTALLED: -32003,
  INSTALL_FAILED: -32004,
  DIR_NOT_FOUND: -32005,
} as const
