import type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from './types'
import type { RpcTransport } from './client'

export function createWsTransport(url: string): RpcTransport {
  let ws: WebSocket | null = null
  let connected = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const pending = new Map<number, { resolve: (r: JsonRpcResponse) => void; reject: (e: Error) => void }>()
  const notificationCallbacks: ((n: JsonRpcNotification) => void)[] = []
  const pendingMessages: string[] = []

  function connect() {
    ws = new WebSocket(url)

    ws.onopen = () => {
      connected = true
      // Send any messages that queued while disconnected
      for (const msg of pendingMessages) {
        ws!.send(msg)
      }
      pendingMessages.length = 0
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        // Response (has id)
        if (msg.id != null && pending.has(msg.id)) {
          pending.get(msg.id)!.resolve(msg)
          pending.delete(msg.id)
        }
        // Notification (no id, has method)
        else if (msg.id == null && msg.method) {
          for (const cb of notificationCallbacks) {
            cb(msg)
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    }

    ws.onclose = () => {
      connected = false
      // Reject all pending requests
      for (const [id, { reject }] of pending) {
        reject(new Error('WebSocket disconnected'))
      }
      pending.clear()
      // Auto-reconnect after 3 seconds
      reconnectTimer = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  }

  connect()

  return {
    send: (request: JsonRpcRequest): Promise<JsonRpcResponse> => {
      return new Promise((resolve, reject) => {
        pending.set(request.id, { resolve, reject })
        const text = JSON.stringify(request)
        if (connected && ws?.readyState === WebSocket.OPEN) {
          ws.send(text)
        } else {
          pendingMessages.push(text)
        }
      })
    },

    onNotification: (callback: (n: JsonRpcNotification) => void): (() => void) => {
      notificationCallbacks.push(callback)
      return () => {
        const idx = notificationCallbacks.indexOf(callback)
        if (idx >= 0) notificationCallbacks.splice(idx, 1)
      }
    },
  }
}
