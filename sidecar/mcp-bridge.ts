/**
 * MCP Bridge Sidecar — JSON-RPC over stdin/stdout
 *
 * Receives JSON-RPC requests from the Rust backend via stdin,
 * manages MCP server connections using @modelcontextprotocol/sdk,
 * and sends responses via stdout.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { createInterface } from 'readline'

// ── Types ──

interface ServerConfig {
  name: string
  type: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  headers?: Record<string, string>
  enabled?: boolean
}

interface AggregatedTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverName: string
  originalName: string
}

interface ManagedServer {
  config: ServerConfig
  client: Client
  tools: AggregatedTool[]
  status: 'connected' | 'error' | 'disconnected'
  error?: string
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: unknown
  id: string
}

// ── State ──

const servers = new Map<string, ManagedServer>()

function getConfigPath(): string {
  // Match Electron's userData path
  const platform = process.platform
  if (platform === 'darwin') {
    return join(homedir(), 'Library/Application Support/kangnam-client/mcp-config.json')
  } else if (platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData/Roaming'), 'kangnam-client/mcp-config.json')
  }
  return join(homedir(), '.config/kangnam-client/mcp-config.json')
}

// ── MCP Operations ──

async function connectServer(config: ServerConfig): Promise<void> {
  if (servers.has(config.name)) {
    await disconnectServer(config.name)
  }

  let transport: Transport
  if (config.type === 'stdio') {
    if (!config.command) throw new Error(`Server ${config.name}: 'command' is required for stdio transport`)
    const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/opt/homebrew/sbin']
    const currentPath = process.env.PATH ?? ''
    const fullPath = [...extraPaths, currentPath].join(':')
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: { ...process.env, PATH: fullPath, ...config.env } as Record<string, string>
    })
  } else {
    if (!config.url) throw new Error(`Server ${config.name}: 'url' is required`)
    transport = await createHttpTransport(config.url, config.headers)
  }

  const client = new Client({ name: 'kangnam-client', version: '1.0.0' }, { capabilities: {} })

  try {
    await Promise.race([
      client.connect(transport),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Connection to '${config.name}' timed out after 15s`)), 15000))
    ])

    const { tools } = await client.listTools()
    const aggregatedTools: AggregatedTool[] = tools.map(t => ({
      name: `${config.name}__${t.name}`,
      description: t.description ?? '',
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
      serverName: config.name,
      originalName: t.name
    }))

    servers.set(config.name, { config, client, tools: aggregatedTools, status: 'connected' })
  } catch (err) {
    servers.set(config.name, { config, client, tools: [], status: 'error', error: String(err) })
    throw err
  }
}

async function createHttpTransport(url: string, headers?: Record<string, string>): Promise<Transport> {
  try {
    return new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } })
  } catch {
    return new SSEClientTransport(new URL(url), { requestInit: { headers } })
  }
}

async function disconnectServer(name: string): Promise<void> {
  const server = servers.get(name)
  if (server) {
    try { await server.client.close() } catch { /* ignore */ }
    servers.delete(name)
  }
}

async function disconnectAll(): Promise<void> {
  await Promise.allSettled([...servers.keys()].map(n => disconnectServer(n)))
}

function getAllTools(): AggregatedTool[] {
  const all: AggregatedTool[] = []
  for (const server of servers.values()) {
    if (server.status === 'connected') all.push(...server.tools)
  }
  return all
}

async function callTool(prefixedName: string, args: Record<string, unknown>) {
  const sep = prefixedName.indexOf('__')
  if (sep === -1) throw new Error(`Invalid tool name: ${prefixedName}`)
  const serverName = prefixedName.slice(0, sep)
  const originalName = prefixedName.slice(sep + 2)
  const server = servers.get(serverName)
  if (!server) throw new Error(`Server '${serverName}' not found`)
  if (server.status !== 'connected') throw new Error(`Server '${serverName}' is not connected`)
  const result = await server.client.callTool({ name: originalName, arguments: args })
  return { content: result.content ?? [], isError: result.isError ?? false }
}

function saveConfig(): void {
  const configPath = getConfigPath()
  const mcpServers: Record<string, Omit<ServerConfig, 'name'>> = {}
  for (const [name, server] of servers) {
    const { name: _, ...rest } = server.config
    mcpServers[name] = rest
  }
  writeFileSync(configPath, JSON.stringify({ mcpServers }, null, 2), 'utf-8')
}

function loadConfig(): ServerConfig[] {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return []
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw) as { mcpServers?: Record<string, Omit<ServerConfig, 'name'>> }
    if (!config.mcpServers) return []
    return Object.entries(config.mcpServers).map(([name, rest]) => ({ name, ...rest } as ServerConfig))
  } catch { return [] }
}

function getServerStatus() {
  return [...servers.entries()].map(([name, s]) => ({
    name, status: s.status, toolCount: s.tools.length, error: s.error
  }))
}

function getServerConfigs(): ServerConfig[] {
  return [...servers.values()].map(s => s.config)
}

// ── JSON-RPC Handler ──

async function handleRequest(req: JsonRpcRequest): Promise<unknown> {
  const p = req.params as Record<string, unknown> | undefined

  switch (req.method) {
    case 'mcp:connect':
      await connectServer(p as unknown as ServerConfig)
      return { ok: true }

    case 'mcp:disconnect':
      await disconnectServer(p?.name as string)
      return { ok: true }

    case 'mcp:disconnect-all':
      await disconnectAll()
      return { ok: true }

    case 'mcp:list-tools':
      return getAllTools()

    case 'mcp:call-tool':
      return await callTool(p?.name as string, (p?.arguments ?? {}) as Record<string, unknown>)

    case 'mcp:add-server':
      await connectServer(p as unknown as ServerConfig)
      saveConfig()
      return { ok: true }

    case 'mcp:update-server': {
      const oldName = p?.oldName as string
      const config = p?.config as unknown as ServerConfig
      await disconnectServer(oldName)
      await connectServer(config)
      saveConfig()
      return { ok: true }
    }

    case 'mcp:remove-server':
      await disconnectServer(p?.name as string)
      saveConfig()
      return { ok: true }

    case 'mcp:server-status':
      return getServerStatus()

    case 'mcp:server-configs':
      return getServerConfigs()

    case 'mcp:reconnect':
      const server = servers.get(p?.name as string)
      if (!server) throw new Error(`Server '${p?.name}' not found`)
      await disconnectServer(p?.name as string)
      await connectServer(server.config)
      return { ok: true }

    case 'mcp:load-config': {
      const configs = loadConfig()
      const results = await Promise.allSettled(configs.map(c => connectServer(c)))
      const errors = results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason)
      return { loaded: configs.length, errors: errors.map(String) }
    }

    case 'mcp:save-config':
      saveConfig()
      return { ok: true }

    case 'mcp:ping':
      return { pong: true }

    default:
      throw new Error(`Unknown method: ${req.method}`)
  }
}

// ── Main: stdin/stdout JSON-RPC ──

function sendResponse(id: string, result: unknown) {
  const resp = JSON.stringify({ jsonrpc: '2.0', result, id })
  process.stdout.write(resp + '\n')
}

function sendError(id: string, message: string) {
  const resp = JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id })
  process.stdout.write(resp + '\n')
}

const rl = createInterface({ input: process.stdin, terminal: false })

rl.on('line', async (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return

  let req: JsonRpcRequest
  try {
    req = JSON.parse(trimmed) as JsonRpcRequest
  } catch {
    return // Ignore malformed lines
  }

  try {
    const result = await handleRequest(req)
    sendResponse(req.id, result)
  } catch (err) {
    sendError(req.id, err instanceof Error ? err.message : String(err))
  }
})

// Signal readiness
process.stderr.write('[mcp-bridge] ready\n')
