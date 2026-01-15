import { vi } from 'vitest'

// Mock Electron APIs for main process tests
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'home') return '/tmp/test-home'
      if (name === 'userData') return '/tmp/test-userdata'
      if (name === 'documents') return '/tmp/test-documents'
      return '/tmp'
    }),
    getAppPath: vi.fn(() => '/app'),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn()
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn().mockReturnValue(Buffer.from('encrypted')),
    decryptString: vi.fn().mockReturnValue('decrypted')
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
    register: vi.fn().mockReturnValue(true),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn().mockReturnValue(true)
  },
  Tray: vi.fn(function () {
    return {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 22, height: 22 })),
      setTitle: vi.fn()
    }
  }),
  Menu: {
    buildFromTemplate: vi.fn().mockReturnValue({})
  },
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({
      isEmpty: vi.fn().mockReturnValue(false),
      getSize: vi.fn().mockReturnValue({ width: 64, height: 64 }),
      resize: vi.fn().mockReturnThis()
    })
  }
}))

// Mock fs/promises for file operations
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    default: actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    copyFile: vi.fn(),
    unlink: vi.fn()
  }
})

// Mock fs (sync) for file operations
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    default: actual,
    existsSync: vi.fn().mockReturnValue(false),
    appendFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(''),
    readdirSync: vi.fn().mockReturnValue([])
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
