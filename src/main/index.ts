import { config } from 'dotenv';
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { registerHotkeys, unregisterHotkeys } from './hotkey';
import { registerWhisperHandlers } from './ipc/whisperHandlers';
import { registerLLMHandlers } from './ipc/llmHandlers';
import { registerExcelHandlers } from './ipc/excelHandlers';
import { registerConfigHandlers } from './ipc/configHandlers';
import { registerGlossarHandlers, reloadGlossar } from './ipc/glossarHandlers';
import { registerTTSHandlers } from './ipc/ttsHandlers';
import { registerDraftsHandlers } from './ipc/draftsHandlers';
import { loadConfig, getSettings } from './services/config';

// Load .env early
config();

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 650,
    show: true,
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.aktivitaeten.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Load config FIRST (before window and handlers)
  await loadConfig();

  const window = createWindow();

  // Register global hotkey (from settings)
  const settings = getSettings();
  registerHotkeys(window, settings.hotkey);

  // Register IPC handlers
  registerWhisperHandlers(window);
  registerLLMHandlers();
  registerExcelHandlers();
  registerConfigHandlers();
  registerGlossarHandlers();
  registerTTSHandlers();
  registerDraftsHandlers();

  // Load glossar from active files
  await reloadGlossar();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  unregisterHotkeys();
});

app.on('window-all-closed', () => {
  app.quit();
});
