import { IpcMain } from 'electron'
import { AuthManager } from '../auth/auth-manager'

export function registerAuthHandlers(ipcMain: IpcMain, authManager: AuthManager): void {
  ipcMain.handle('auth:connect', async (_event, provider: string) => {
    await authManager.connect(provider)
  })

  ipcMain.handle('auth:disconnect', async (_event, provider: string) => {
    await authManager.disconnect(provider)
  })

  ipcMain.handle('auth:status', () => {
    return authManager.getStatus()
  })
}
