import { config } from 'dotenv'
import { app, BrowserWindow, shell, nativeImage, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerHotkeys, unregisterHotkeys } from './hotkey'
import { registerWhisperHandlers } from './ipc/whisperHandlers'
import { registerLLMHandlers } from './ipc/llmHandlers'
import { registerExcelHandlers } from './ipc/excelHandlers'
import { registerConfigHandlers } from './ipc/configHandlers'
import { registerGlossarHandlers, reloadGlossar } from './ipc/glossarHandlers'
import { registerTTSHandlers } from './ipc/ttsHandlers'
import { registerDraftsHandlers } from './ipc/draftsHandlers'
import { loadConfig, getSettings } from './services/config'
import { initLogging, getLogFilePath, debugLog } from './services/debugLog'

// Load .env early
config()

// Initialize logging (always writes to file)
initLogging()

// Debug mode: opens DevTools on start (--debug or DEBUG=1)
const openDevTools = process.argv.includes('--debug') || process.env.DEBUG === '1'

debugLog('Startup', `Platform: ${process.platform}`)
debugLog('Startup', `Electron: ${process.versions.electron}, Node: ${process.versions.node}`)
debugLog('Startup', `App path: ${app.getAppPath()}`)
debugLog('Startup', `Log file: ${getLogFilePath()}`)

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const iconPath = is.dev
    ? join(app.getAppPath(), 'resources', 'icon.png')
    : join(process.resourcesPath, 'resources', 'icon.png')

  mainWindow = new BrowserWindow({
    width: 720,
    height: 650,
    show: true,
    autoHideMenuBar: true,
    resizable: true,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
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

  // Open DevTools only if explicitly requested
  if (openDevTools) {
    mainWindow.webContents.openDevTools()
  }

  return mainWindow
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.nobcon.app')
  app.setName('NoB-Con Aktivitäten')

  // Set dock icon on macOS
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = is.dev
      ? join(app.getAppPath(), 'resources', 'icon.png')
      : join(process.resourcesPath, 'resources', 'icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon)
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Load config FIRST
  await loadConfig()

  const window = createWindow()

  // Register global hotkey
  const settings = await getSettings()
  registerHotkeys(window, settings.hotkey)

  // Register IPC handlers
  registerWhisperHandlers(window)
  registerLLMHandlers()
  registerExcelHandlers()
  registerConfigHandlers()
  registerGlossarHandlers()
  registerTTSHandlers()
  registerDraftsHandlers()

  // Non-blocking glossar load
  reloadGlossar().catch((err) => {
    console.error('[Startup] Glossar load failed:', err)
  })

  // DevTools shortcut (Ctrl+Shift+I / Cmd+Option+I)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.webContents.toggleDevTools()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  unregisterHotkeys()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
