import { createServer, Server, IncomingMessage, ServerResponse } from 'http'

interface OAuthCallbackResult {
  code: string
  state: string
}

/**
 * Starts a temporary local HTTP server to receive OAuth callbacks.
 * Returns a promise that resolves when the callback is received.
 */
export function waitForOAuthCallback(
  port: number,
  path: string,
  timeoutMs: number = 300_000 // 5 minutes
): { promise: Promise<OAuthCallbackResult>; server: Server } {
  let server: Server

  const promise = new Promise<OAuthCallbackResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server?.close()
      reject(new Error('OAuth callback timed out'))
    }, timeoutMs)

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`)

      if (url.pathname !== path) {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(errorPage(error))
        clearTimeout(timeout)
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (!code || !state) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(errorPage('Missing code or state parameter'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(successPage())
      clearTimeout(timeout)
      server.close()
      resolve({ code, state })
    })

    server.listen(port, '127.0.0.1')
    server.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })

  return { promise, server: server! }
}

/**
 * For dynamic port allocation (used by Gemini).
 * Returns the actual port assigned.
 */
export function startOAuthServer(
  path: string,
  timeoutMs: number = 300_000
): { promise: Promise<OAuthCallbackResult>; server: Server; getPort: () => number } {
  let server: Server
  let resolvedPort = 0

  const promise = new Promise<OAuthCallbackResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server?.close()
      reject(new Error('OAuth callback timed out'))
    }, timeoutMs)

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:${resolvedPort}`)

      if (url.pathname !== path) {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(errorPage(error))
        clearTimeout(timeout)
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (!code || !state) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(errorPage('Missing code or state parameter'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(successPage())
      clearTimeout(timeout)
      server.close()
      resolve({ code, state })
    })

    // Port 0 = OS assigns a free port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        resolvedPort = addr.port
      }
    })

    server.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })

  return {
    promise,
    server: server!,
    getPort: () => resolvedPort
  }
}

function successPage(): string {
  return `<!DOCTYPE html>
<html>
<head><title>Kangnam Client</title></head>
<body style="background:#0a0a0a;color:#e5e5e5;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <h1 style="color:#22c55e">Connected!</h1>
    <p>You can close this window and return to Kangnam Client.</p>
  </div>
</body>
</html>`
}

function errorPage(error: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Kangnam Client - Error</title></head>
<body style="background:#0a0a0a;color:#e5e5e5;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <h1 style="color:#ef4444">Authentication Failed</h1>
    <p>${error}</p>
    <p>Please close this window and try again.</p>
  </div>
</body>
</html>`
}
