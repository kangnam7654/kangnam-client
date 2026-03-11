import { IpcMain, app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

interface Settings {
  theme: 'light' | 'dark' | 'system'
  defaultProvider: string
  fontSize: number
  sendOnEnter: boolean
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultProvider: 'codex',
  fontSize: 14,
  sendOnEnter: true
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): Settings {
  const path = getSettingsPath()
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS }

  try {
    const raw = readFileSync(path, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: Settings): void {
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:get', () => loadSettings())

  ipcMain.handle('settings:set', (_event, partial: Partial<Settings>) => {
    const current = loadSettings()
    const updated = { ...current, ...partial }
    saveSettings(updated)
    return updated
  })
}
