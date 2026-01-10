import { config } from 'dotenv'
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTray, destroyTray } from './tray'
import { registerHotkeys, unregisterHotkeys } from './hotkey'
import { registerWhisperHandlers } from './ipc/whisperHandlers'
import { registerLLMHandlers } from './ipc/llmHandlers'
import { registerExcelHandlers } from './ipc/excelHandlers'

// Load .env early
config()

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    show: false,
    autoHideMenuBar: true,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aktivitaeten.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const window = createWindow()

  // Create tray icon
  createTray(window)

  // Register global hotkey
  registerHotkeys(window)

  // Register IPC handlers
  registerWhisperHandlers(window)
  registerLLMHandlers()
  registerExcelHandlers()

  // In dev mode, show window immediately for testing
  if (is.dev) {
    window.show()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Track quit state
let isQuitting = false

app.on('before-quit', () => {
  isQuitting = true
  unregisterHotkeys()
  destroyTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
