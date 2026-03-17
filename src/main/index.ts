import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { appendFileSync } from 'fs'
const isDev = !app.isPackaged
import { initDatabase } from './db/database'
import { registerAuthHandlers } from './ipc/auth-handlers'
import { registerChatHandlers } from './ipc/chat-handlers'
import { registerMcpHandlers } from './ipc/mcp-handlers'
import { registerSettingsHandlers } from './ipc/settings-handlers'
import { registerCoworkHandlers } from './ipc/cowork-handlers'
import { registerPromptHandlers } from './ipc/prompt-handlers'
import { registerEvalHandlers } from './ipc/eval-handlers'
import { MCPManager } from './mcp/mcp-manager'
import { AuthManager } from './auth/auth-manager'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

/** Check if mainWindow exists and is not destroyed */
function isWindowAlive(): boolean {
  return mainWindow !== null && !mainWindow.isDestroyed()
}

// Global safety net — prevent "Object has been destroyed" from crashing the app
process.on('uncaughtException', (err) => {
  if (err.message.includes('Object has been destroyed')) {
    console.warn('[ignored] Destroyed object access:', err.message)
    return
  }
  console.error('Uncaught exception:', err)
  // Re-throw non-destroyed errors so they crash as expected
  throw err
})

const mcpManager = new MCPManager()
const authManager = new AuthManager()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#2b2b2b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    },
    show: false
  })

  mainWindow.on('ready-to-show', () => {
    if (isWindowAlive()) {
      mainWindow!.show()
      if (isDev) mainWindow!.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Clean up webContents listeners BEFORE destruction to prevent
  // "Object has been destroyed" errors from queued events
  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.removeAllListeners()
    }
  })

  // Null out reference when window is destroyed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Force repaint after restore to prevent white screen (Chromium compositor bug)
  const forceRepaint = () => {
    if (!isWindowAlive()) return
    mainWindow!.webContents.invalidate()
  }
  mainWindow.on('restore', () => setTimeout(forceRepaint, 50))
  mainWindow.on('show', () => setTimeout(forceRepaint, 50))

  // If renderer process crashes, reload the page
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer process gone:', details.reason)
    if (details.reason !== 'clean-exit' && isWindowAlive()) {
      mainWindow!.webContents.reload()
    }
  })

  mainWindow.webContents.on('console-message', (...args: any[]) => {
    appendFileSync('/tmp/renderer-errors.log', `[${new Date().toISOString()}] ${JSON.stringify(args.slice(0, 3).map(a => typeof a === 'object' ? Object.keys(a) : a))}\n`)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { if (isWindowAlive()) mainWindow!.show() } },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setToolTip('Kangnam Client')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => { if (isWindowAlive()) mainWindow!.show() })
}

// Custom protocol for OAuth callbacks
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('kangnam-client', process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient('kangnam-client')
}

// Handle OAuth callback via custom protocol
app.on('open-url', (_event, url) => {
  authManager.handleOAuthCallback(url)
})

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Handle OAuth callback on Windows (protocol URL is in argv)
    const url = argv.find(arg => arg.startsWith('kangnam-client://'))
    if (url) {
      authManager.handleOAuthCallback(url)
    }
    if (isWindowAlive()) {
      if (mainWindow!.isMinimized()) mainWindow!.restore()
      mainWindow!.focus()
    }
  })
}

app.whenReady().then(async () => {
  appendFileSync('/tmp/renderer-errors.log', `[${new Date().toISOString()}] === APP READY ===\n`)
  // Initialize database first (IPC handlers depend on it)
  await initDatabase()

  // Register IPC handlers before window so renderer can call them immediately
  registerAuthHandlers(ipcMain, authManager)
  registerChatHandlers(ipcMain, authManager, mcpManager)
  registerCoworkHandlers(ipcMain, authManager, mcpManager)
  registerMcpHandlers(ipcMain, mcpManager, authManager)
  registerSettingsHandlers(ipcMain)
  registerPromptHandlers(ipcMain, authManager)
  registerEvalHandlers(ipcMain, authManager)

  // Now create window (renderer will find all handlers ready)
  createWindow()
  createTray()

  // Pass main window reference to auth manager
  if (mainWindow) {
    authManager.setMainWindow(mainWindow)
    mainWindow.on('closed', () => authManager.setMainWindow(null!))
  }

  // Load MCP servers from config (non-blocking, don't block window)
  mcpManager.loadFromConfig().catch(err => {
    console.warn('Failed to load MCP config:', err.message)
  })
})

app.on('window-all-closed', () => {
  // Destroy tray to fully release the process (fixes Windows uninstall issue)
  if (tray) {
    tray.destroy()
    tray = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  await mcpManager.disconnectAll()
})
