import type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from './types'
import { RpcError } from './types'

export interface RpcTransport {
  send(request: JsonRpcRequest): Promise<JsonRpcResponse>
  onNotification(callback: (notification: JsonRpcNotification) => void): () => void
}

export class RpcClient {
  private transport: RpcTransport
  private nextId = 1

  constructor(transport: RpcTransport) {
    this.transport = transport
  }

  async call<T = unknown>(method: string, params?: unknown): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.nextId++,
      method,
      params,
    }
    const response = await this.transport.send(request)
    if (response.error) {
      throw new RpcError(response.error)
    }
    return response.result as T
  }

  onNotification(callback: (method: string, params: unknown) => void): () => void {
    return this.transport.onNotification((n) => callback(n.method, n.params))
  }
}
