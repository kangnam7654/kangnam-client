import { IpcMain } from 'electron'
import { MCPManager, ServerConfig } from '../mcp/mcp-manager'
import { AuthManager } from '../auth/auth-manager'

/**
 * Normalize user input to ServerConfig[].
 * Supports both kangnam-client format and Claude Desktop format:
 *
 * kangnam-client: { name, type, command, args }
 * Claude Desktop: { mcpServers: { name: { command, args } } }
 *                 or just { name: { command, args } }
 */
function normalizeServerInput(raw: unknown): ServerConfig[] {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid server config')

  const obj = raw as Record<string, unknown>

  // kangnam-client format: has 'name' + ('command' or 'url')
  if (typeof obj.name === 'string' && (obj.command || obj.url || obj.type)) {
    const config = obj as ServerConfig
    if (!config.type) {
      config.type = config.command ? 'stdio' : 'http'
    }
    return [config]
  }

  // Claude Desktop format: { mcpServers: { name: { command, args } } }
  const servers = (obj.mcpServers ?? obj) as Record<string, unknown>

  // Check if it looks like { serverName: { command/url } } (not a single ServerConfig)
  const entries = Object.entries(servers).filter(
    ([k, v]) => typeof v === 'object' && v !== null && k !== 'mcpServers'
  )
  if (entries.length === 0) throw new Error('No valid server configs found')

  return entries.map(([name, val]) => {
    const v = val as Record<string, unknown>
    return {
      name,
      type: (v.type as ServerConfig['type']) ?? (v.command ? 'stdio' : 'http'),
      command: v.command as string | undefined,
      args: v.args as string[] | undefined,
      url: v.url as string | undefined,
      env: v.env as Record<string, string> | undefined,
      headers: v.headers as Record<string, string> | undefined,
    }
  })
}

const MCP_AI_SYSTEM = `You are an MCP (Model Context Protocol) server configuration assistant.

Given a user request, generate the correct JSON config for an MCP server.

## Output Format
Return ONLY valid JSON (no markdown fences, no explanation). The JSON must follow this schema:
{
  "name": "server-name",
  "type": "stdio" | "http" | "sse",
  "command": "command-to-run",       // for stdio
  "args": ["arg1", "arg2"],          // for stdio
  "url": "http://...",              // for http/sse
  "env": { "KEY": "YOUR_VALUE" },   // if needed
  "headers": { "Authorization": "Bearer ..." }  // for http if needed
}

## Popular MCP Servers (stdio via uvx/npx)
- fetch: { "name": "fetch", "type": "stdio", "command": "uvx", "args": ["mcp-server-fetch"] }
- filesystem: { "name": "filesystem", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"] }
- github: { "name": "github", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_TOKEN" } }
- postgres: { "name": "postgres", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@localhost/db"] }
- sqlite: { "name": "sqlite", "type": "stdio", "command": "uvx", "args": ["mcp-server-sqlite", "--db-path", "/path/to/db.sqlite"] }
- brave-search: { "name": "brave-search", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-brave-search"], "env": { "BRAVE_API_KEY": "YOUR_KEY" } }
- slack: { "name": "slack", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-slack"], "env": { "SLACK_BOT_TOKEN": "xoxb-..." } }
- memory: { "name": "memory", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] }
- puppeteer: { "name": "puppeteer", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-puppeteer"] }
- google-maps: { "name": "google-maps", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-google-maps"], "env": { "GOOGLE_MAPS_API_KEY": "YOUR_KEY" } }

## Local File Rules
- .py file → { "command": "python", "args": ["path/to/file.py"] } or { "command": "uvx", "args": ["path/to/file.py"] }
- .ts file → { "command": "npx", "args": ["tsx", "path/to/file.ts"] }
- .js file → { "command": "node", "args": ["path/to/file.js"] }
- If user gives a directory, look for main entry (index.ts, index.js, main.py, server.py)

## JSON Fixing
If user pastes malformed JSON, fix it and return valid pretty-printed JSON.
If user pastes Claude Desktop format, convert to the schema above.

## Rules
- name should be short, kebab-case, descriptive
- type is always "stdio" for local commands, "http" for URLs
- Use placeholder values like "YOUR_TOKEN", "YOUR_KEY" for secrets and add a brief comment as a separate "note" field
- Always pretty-print the output JSON`

export function registerMcpHandlers(ipcMain: IpcMain, mcpManager: MCPManager, authManager: AuthManager): void {

  ipcMain.handle('mcp:ai-assist', async (_event, prompt: string, provider: string, model?: string) => {
    const { callLLM, extractJSON } = require('../skills/skill-ai')
    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) throw new Error(`Not connected to ${provider}`)

    const result = await callLLM(provider, accessToken, [
      { role: 'system', content: MCP_AI_SYSTEM },
      { role: 'user', content: prompt }
    ], model)

    // Try to parse and re-prettify
    const jsonStr = extractJSON(result)
    try {
      const parsed = JSON.parse(jsonStr)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return jsonStr
    }
  })
  ipcMain.handle('mcp:list-servers', () => {
    return mcpManager.getServerConfigs()
  })

  ipcMain.handle('mcp:add-server', async (_event, config: unknown) => {
    const configs = normalizeServerInput(config)
    for (const c of configs) {
      await mcpManager.addServer(c)
    }
  })

  ipcMain.handle('mcp:reconnect-server', async (_event, name: string) => {
    await mcpManager.reconnectServer(name)
  })

  ipcMain.handle('mcp:update-server', async (_event, oldName: string, config: unknown) => {
    const configs = normalizeServerInput(config)
    if (configs.length !== 1) throw new Error('Update expects exactly one server config')
    await mcpManager.updateServer(oldName, configs[0])
  })

  ipcMain.handle('mcp:remove-server', async (_event, name: string) => {
    await mcpManager.removeServer(name)
  })

  ipcMain.handle('mcp:get-config', (_event, name: string) => {
    const configs = mcpManager.getServerConfigs()
    return configs.find(c => c.name === name) ?? null
  })

  ipcMain.handle('mcp:list-tools', () => {
    return mcpManager.getAllTools()
  })

  ipcMain.handle('mcp:server-status', () => {
    return mcpManager.getServerStatus()
  })
}
