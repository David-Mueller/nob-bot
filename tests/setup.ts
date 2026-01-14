import { vi } from 'vitest'

// Mock Electron APIs for main process tests
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'home') return '/tmp/test-home'
      if (name === 'userData') return '/tmp/test-userdata'
      return '/tmp'
    }),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn()
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  },
  BrowserWindow: vi.fn(() => ({
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
      on: vi.fn()
    }
  })),
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  },
  shell: {
    openPath: vi.fn()
  },
  globalShortcut: {
    register: vi.fn(),
    unregisterAll: vi.fn()
  },
  Tray: vi.fn(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn()
  })),
  Menu: {
    buildFromTemplate: vi.fn()
  },
  nativeImage: {
    createFromPath: vi.fn()
  }
}))

// Mock fs/promises for file operations
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn()
  }
})

// Global test utilities
globalThis.createMockActivity = () => ({
  beschreibung: 'Test activity',
  auftraggeber: 'Test Client',
  thema: 'Test Theme',
  datum: '2026-01-15',
  minuten: 60,
  km: null,
  auslagen: null
})
