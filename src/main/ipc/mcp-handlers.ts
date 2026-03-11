import { IpcMain } from 'electron'
import { MCPManager, ServerConfig } from '../mcp/mcp-manager'

export function registerMcpHandlers(ipcMain: IpcMain, mcpManager: MCPManager): void {
  ipcMain.handle('mcp:list-servers', () => {
    return mcpManager.getServerConfigs()
  })

  ipcMain.handle('mcp:add-server', async (_event, config: ServerConfig) => {
    await mcpManager.addServer(config)
  })

  ipcMain.handle('mcp:remove-server', async (_event, name: string) => {
    await mcpManager.removeServer(name)
  })

  ipcMain.handle('mcp:list-tools', () => {
    return mcpManager.getAllTools()
  })

  ipcMain.handle('mcp:server-status', () => {
    return mcpManager.getServerStatus()
  })
}
