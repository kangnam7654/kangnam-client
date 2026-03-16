import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { app } from 'electron'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface ServerConfig {
  name: string
  type: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  headers?: Record<string, string>
  enabled?: boolean
}

export interface AggregatedTool {
  name: string          // prefixed: serverName__toolName
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

export class MCPManager {
  private servers = new Map<string, ManagedServer>()

  private getConfigPath(): string {
    return join(app.getPath('userData'), 'mcp-config.json')
  }

  async loadFromConfig(): Promise<void> {
    const configPath = this.getConfigPath()
    if (!existsSync(configPath)) return

    try {
      const raw = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(raw) as { mcpServers?: Record<string, Omit<ServerConfig, 'name'>> }

      if (!config.mcpServers) return

      const results = await Promise.allSettled(
        Object.entries(config.mcpServers).map(([name, serverConfig]) =>
          this.connect({ name, ...serverConfig } as ServerConfig)
        )
      )

      for (const result of results) {
        if (result.status === 'rejected') {
          console.warn('MCP server failed to connect:', result.reason)
        }
      }
    } catch (err) {
      console.error('Failed to load MCP config:', err)
    }
  }

  private saveConfig(): void {
    const configPath = this.getConfigPath()
    const mcpServers: Record<string, Omit<ServerConfig, 'name'>> = {}

    for (const [name, server] of this.servers) {
      const { name: _, ...rest } = server.config
      mcpServers[name] = rest
    }

    writeFileSync(configPath, JSON.stringify({ mcpServers }, null, 2), 'utf-8')
  }

  async connect(config: ServerConfig): Promise<void> {
    // Disconnect existing if any
    if (this.servers.has(config.name)) {
      await this.disconnect(config.name)
    }

    let transport: Transport

    if (config.type === 'stdio') {
      if (!config.command) throw new Error(`Server ${config.name}: 'command' is required for stdio transport`)

      // Ensure homebrew/local paths are in PATH (Electron apps may not inherit shell PATH)
      const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/opt/homebrew/sbin']
      const currentPath = process.env.PATH ?? ''
      const fullPath = [...extraPaths, currentPath].join(':')

      transport = new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        env: { ...process.env, PATH: fullPath, ...config.env } as Record<string, string>
      })
    } else {
      if (!config.url) throw new Error(`Server ${config.name}: 'url' is required for http/sse transport`)

      // Try Streamable HTTP first, fall back to SSE
      transport = await this.createHttpTransport(config.url, config.headers)
    }

    const client = new Client(
      { name: 'kangnam-client', version: '1.0.0' },
      { capabilities: {} }
    )

    try {
      // 15-second timeout to prevent hanging on unresponsive servers
      await Promise.race([
        client.connect(transport),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Connection to '${config.name}' timed out after 15s`)), 15_000)
        )
      ])

      const { tools } = await client.listTools()
      const aggregatedTools: AggregatedTool[] = tools.map(t => ({
        name: `${config.name}__${t.name}`,
        description: t.description ?? '',
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
        serverName: config.name,
        originalName: t.name
      }))

      this.servers.set(config.name, {
        config,
        client,
        tools: aggregatedTools,
        status: 'connected'
      })
    } catch (err) {
      this.servers.set(config.name, {
        config,
        client,
        tools: [],
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  private async createHttpTransport(url: string, headers?: Record<string, string>): Promise<Transport> {
    try {
      return new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers }
      })
    } catch {
      // Fall back to SSE
      return new SSEClientTransport(new URL(url), {
        requestInit: { headers }
      })
    }
  }

  async disconnect(name: string): Promise<void> {
    const server = this.servers.get(name)
    if (server) {
      try {
        await server.client.close()
      } catch {
        // Ignore close errors
      }
      this.servers.delete(name)
    }
  }

  async disconnectAll(): Promise<void> {
    const names = [...this.servers.keys()]
    await Promise.allSettled(names.map(n => this.disconnect(n)))
  }

  getAllTools(): AggregatedTool[] {
    const all: AggregatedTool[] = []
    for (const server of this.servers.values()) {
      if (server.status === 'connected') {
        all.push(...server.tools)
      }
    }
    return all
  }

  async callTool(prefixedName: string, args: Record<string, unknown>): Promise<{
    content: Array<{ type: string; text?: string }>
    isError: boolean
  }> {
    const separatorIndex = prefixedName.indexOf('__')
    if (separatorIndex === -1) {
      throw new Error(`Invalid tool name format: ${prefixedName}. Expected serverName__toolName`)
    }

    const serverName = prefixedName.slice(0, separatorIndex)
    const originalName = prefixedName.slice(separatorIndex + 2)

    const server = this.servers.get(serverName)
    if (!server) throw new Error(`MCP server '${serverName}' not found`)
    if (server.status !== 'connected') throw new Error(`MCP server '${serverName}' is not connected`)

    const result = await server.client.callTool({ name: originalName, arguments: args })
    return {
      content: (result.content as Array<{ type: string; text?: string }>) ?? [],
      isError: (result.isError as boolean) ?? false
    }
  }

  async addServer(config: ServerConfig): Promise<void> {
    await this.connect(config)
    this.saveConfig()
  }

  async removeServer(name: string): Promise<void> {
    await this.disconnect(name)
    this.saveConfig()
  }

  getServerStatus(): Array<{ name: string; status: string; toolCount: number; error?: string }> {
    return [...this.servers.entries()].map(([name, server]) => ({
      name,
      status: server.status,
      toolCount: server.tools.length,
      error: server.error
    }))
  }

  getServerConfigs(): ServerConfig[] {
    return [...this.servers.values()].map(s => s.config)
  }
}
