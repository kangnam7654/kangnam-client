import { IpcMain } from 'electron'
import { MCPManager, ServerConfig } from '../mcp/mcp-manager'

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

export function registerMcpHandlers(ipcMain: IpcMain, mcpManager: MCPManager): void {
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
