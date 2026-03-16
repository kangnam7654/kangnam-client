import { IpcMain } from 'electron'
import { AuthManager, ConnectOptions } from '../auth/auth-manager'

export function registerAuthHandlers(ipcMain: IpcMain, authManager: AuthManager): void {
  ipcMain.handle('auth:connect', async (_event, provider: string, options?: ConnectOptions) => {
    await authManager.connect(provider, options)
  })

  ipcMain.handle('auth:disconnect', async (_event, provider: string) => {
    await authManager.disconnect(provider)
  })

  ipcMain.handle('auth:status', async () => {
    return authManager.getStatus()
  })
}
