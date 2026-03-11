import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
const isDev = !app.isPackaged
import { initDatabase } from './db/database'
import { registerAuthHandlers } from './ipc/auth-handlers'
import { registerChatHandlers } from './ipc/chat-handlers'
import { registerMcpHandlers } from './ipc/mcp-handlers'
import { registerSettingsHandlers } from './ipc/settings-handlers'
import { MCPManager } from './mcp/mcp-manager'
import { AuthManager } from './auth/auth-manager'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
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
    { label: 'Show', click: () => mainWindow?.show() },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setToolTip('Kangnam Client')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => mainWindow?.show())
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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(async () => {
  // Initialize database
  await initDatabase()

  // Register IPC handlers
  registerAuthHandlers(ipcMain, authManager)
  registerChatHandlers(ipcMain, authManager, mcpManager)
  registerMcpHandlers(ipcMain, mcpManager)
  registerSettingsHandlers(ipcMain)

  createWindow()
  createTray()

  // Load MCP servers from config
  await mcpManager.loadFromConfig().catch(err => {
    console.warn('Failed to load MCP config:', err.message)
  })
})

app.on('window-all-closed', () => {
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
