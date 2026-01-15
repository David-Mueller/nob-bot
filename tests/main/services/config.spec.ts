import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create the mocks using vi.hoisted so they're available during vi.mock
const { mockReadFile, mockWriteFile, mockMkdir, mockExistsSync, mockStoreApiKey, mockRetrieveApiKey, mockHasStoredApiKey } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockExistsSync: vi.fn(),
  mockStoreApiKey: vi.fn(),
  mockRetrieveApiKey: vi.fn().mockResolvedValue(''),
  mockHasStoredApiKey: vi.fn().mockResolvedValue(false)
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  default: { existsSync: mockExistsSync }
}))

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir
  }
}))

vi.mock('@main/services/secureStorage', () => ({
  storeApiKey: mockStoreApiKey,
  retrieveApiKey: mockRetrieveApiKey,
  hasStoredApiKey: mockHasStoredApiKey
}))

import {
  loadConfig,
  saveConfig,
  getConfig,
  updateXlsxFile,
  getActiveFiles,
  removeXlsxFile,
  findFileForAuftraggeber,
  getSettings,
  updateSettings,
  getApiKey
} from '@main/services/config'

describe('config service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  describe('loadConfig', () => {
    it('should return default config when no config file exists', async () => {
      mockExistsSync.mockReturnValue(false)

      const config = await loadConfig()

      expect(config.xlsxBasePath).toBe('D:\\C-Con\\AL-kas')
      expect(config.xlsxFiles).toEqual([])
      expect(config.settings.hotkey).toBe('CommandOrControl+Shift+R')
    })

    it('should load config from YAML file', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /custom/path
xlsxFiles:
  - path: /file1.xlsx
    auftraggeber: Client A
    jahr: 2026
    active: true
settings:
  hotkey: Ctrl+Shift+X
  ttsEnabled: true
  ttsVoice: shimmer
`)

      const config = await loadConfig()

      expect(config.xlsxBasePath).toBe('/custom/path')
      expect(config.xlsxFiles).toHaveLength(1)
      expect(config.xlsxFiles[0].auftraggeber).toBe('Client A')
      expect(config.settings.hotkey).toBe('Ctrl+Shift+X')
      expect(config.settings.ttsEnabled).toBe(true)
    })

    it('should migrate plaintext API key to secure storage', async () => {
      mockExistsSync.mockReturnValue(true)
      mockHasStoredApiKey.mockResolvedValue(false)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /custom/path
xlsxFiles: []
settings:
  openaiApiKey: sk-test-key-12345
`)
      mockWriteFile.mockResolvedValue(undefined)

      await loadConfig()

      expect(mockStoreApiKey).toHaveBeenCalledWith('sk-test-key-12345')
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should not migrate API key if already in secure storage', async () => {
      mockExistsSync.mockReturnValue(true)
      mockHasStoredApiKey.mockResolvedValue(true)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /custom/path
xlsxFiles: []
settings:
  openaiApiKey: sk-test-key-12345
`)

      await loadConfig()

      expect(mockStoreApiKey).not.toHaveBeenCalled()
    })

    it('should handle parse errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockRejectedValue(new Error('File read error'))

      const config = await loadConfig()

      // Should return current/default config
      expect(config).toBeDefined()
    })
  })

  describe('saveConfig', () => {
    it('should create config directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      await saveConfig({
        xlsxBasePath: '/test/path',
        xlsxFiles: [],
        settings: {
          hotkey: 'Ctrl+R',
          openaiApiKey: '',
          hasApiKey: false,
          ttsEnabled: false,
          ttsVoice: 'nova'
        }
      })

      expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('.aktivitaeten'), { recursive: true })
    })

    it('should exclude API key from saved YAML', async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)

      await saveConfig({
        xlsxBasePath: '/test/path',
        xlsxFiles: [],
        settings: {
          hotkey: 'Ctrl+R',
          openaiApiKey: 'secret-key',
          hasApiKey: true,
          ttsEnabled: false,
          ttsVoice: 'nova'
        }
      })

      const savedContent = mockWriteFile.mock.calls[0][1] as string
      expect(savedContent).not.toContain('secret-key')
    })

    it('should throw on write error', async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockRejectedValue(new Error('Permission denied'))

      await expect(
        saveConfig({
          xlsxBasePath: '/test',
          xlsxFiles: [],
          settings: {
            hotkey: 'Ctrl+R',
            openaiApiKey: '',
            hasApiKey: false,
            ttsEnabled: false,
            ttsVoice: 'nova'
          }
        })
      ).rejects.toThrow('Permission denied')
    })
  })

  describe('getConfig', () => {
    it('should return current config', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /loaded/path
xlsxFiles: []
settings: {}
`)
      await loadConfig()

      const config = getConfig()

      expect(config.xlsxBasePath).toBe('/loaded/path')
    })
  })

  describe('updateXlsxFile', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /test
xlsxFiles:
  - path: /existing.xlsx
    auftraggeber: Existing
    jahr: 2026
    active: false
settings: {}
`)
      await loadConfig()
    })

    it('should update existing file config', async () => {
      await updateXlsxFile('/existing.xlsx', { active: true })

      const config = getConfig()
      expect(config.xlsxFiles[0].active).toBe(true)
    })

    it('should add new file config if not found', async () => {
      await updateXlsxFile('/new.xlsx', { auftraggeber: 'New Client', jahr: 2026 })

      const config = getConfig()
      const newFile = config.xlsxFiles.find(f => f.path === '/new.xlsx')
      expect(newFile).toBeDefined()
      expect(newFile?.auftraggeber).toBe('New Client')
    })

    it('should use current year as default for new files', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-15'))

      await updateXlsxFile('/new.xlsx', { auftraggeber: 'Test' })

      const config = getConfig()
      const newFile = config.xlsxFiles.find(f => f.path === '/new.xlsx')
      expect(newFile?.jahr).toBe(2026)

      vi.useRealTimers()
    })
  })

  describe('getActiveFiles', () => {
    it('should return only active files', async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /test
xlsxFiles:
  - path: /active1.xlsx
    auftraggeber: A
    jahr: 2026
    active: true
  - path: /inactive.xlsx
    auftraggeber: B
    jahr: 2026
    active: false
  - path: /active2.xlsx
    auftraggeber: C
    jahr: 2026
    active: true
settings: {}
`)
      await loadConfig()

      const active = getActiveFiles()

      expect(active).toHaveLength(2)
      expect(active.map(f => f.path)).toEqual(['/active1.xlsx', '/active2.xlsx'])
    })
  })

  describe('removeXlsxFile', () => {
    it('should remove file from config', async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /test
xlsxFiles:
  - path: /file1.xlsx
    auftraggeber: A
    jahr: 2026
    active: true
  - path: /file2.xlsx
    auftraggeber: B
    jahr: 2026
    active: true
settings: {}
`)
      await loadConfig()

      await removeXlsxFile('/file1.xlsx')

      const config = getConfig()
      expect(config.xlsxFiles).toHaveLength(1)
      expect(config.xlsxFiles[0].path).toBe('/file2.xlsx')
    })
  })

  describe('findFileForAuftraggeber', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /test
xlsxFiles:
  - path: /acme2026.xlsx
    auftraggeber: ACME Corp
    jahr: 2026
    active: true
  - path: /acme2025.xlsx
    auftraggeber: ACME Corp
    jahr: 2025
    active: true
  - path: /inactive.xlsx
    auftraggeber: Inactive Corp
    jahr: 2026
    active: false
settings: {}
`)
      await loadConfig()
    })

    it('should find file by auftraggeber and year', () => {
      const result = findFileForAuftraggeber('ACME Corp', 2026)

      expect(result).toBeDefined()
      expect(result?.path).toBe('/acme2026.xlsx')
    })

    it('should perform case-insensitive match', () => {
      const result = findFileForAuftraggeber('acme corp', 2026)

      expect(result).toBeDefined()
      expect(result?.path).toBe('/acme2026.xlsx')
    })

    it('should return null if no match found', () => {
      const result = findFileForAuftraggeber('Unknown', 2026)

      expect(result).toBeNull()
    })

    it('should not return inactive files', () => {
      const result = findFileForAuftraggeber('Inactive Corp', 2026)

      expect(result).toBeNull()
    })

    it('should match correct year', () => {
      const result2025 = findFileForAuftraggeber('ACME Corp', 2025)
      const result2024 = findFileForAuftraggeber('ACME Corp', 2024)

      expect(result2025?.path).toBe('/acme2025.xlsx')
      expect(result2024).toBeNull()
    })
  })

  describe('getSettings', () => {
    it('should return settings without exposing API key', async () => {
      mockHasStoredApiKey.mockResolvedValue(true)
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /test
xlsxFiles: []
settings:
  hotkey: Ctrl+R
  ttsEnabled: true
`)
      await loadConfig()

      const settings = await getSettings()

      expect(settings.openaiApiKey).toBe('')
      expect(settings.hasApiKey).toBe(true)
      expect(settings.hotkey).toBe('Ctrl+R')
    })

    it('should detect API key from environment variable', async () => {
      mockHasStoredApiKey.mockResolvedValue(false)
      process.env.OPENAI_API_KEY = 'env-key'

      const settings = await getSettings()

      expect(settings.hasApiKey).toBe(true)

      delete process.env.OPENAI_API_KEY
    })
  })

  describe('updateSettings', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(`
xlsxBasePath: /test
xlsxFiles: []
settings:
  hotkey: Ctrl+R
`)
      await loadConfig()
    })

    it('should update settings and save config', async () => {
      await updateSettings({ ttsEnabled: true, ttsVoice: 'echo' })

      const config = getConfig()
      expect(config.settings.ttsEnabled).toBe(true)
      expect(config.settings.ttsVoice).toBe('echo')
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should store API key in secure storage', async () => {
      await updateSettings({ openaiApiKey: 'new-api-key' })

      expect(mockStoreApiKey).toHaveBeenCalledWith('new-api-key')
    })
  })

  describe('getApiKey', () => {
    it('should retrieve key from secure storage', async () => {
      mockRetrieveApiKey.mockResolvedValue('stored-key')

      const key = await getApiKey()

      expect(key).toBe('stored-key')
    })

    it('should fall back to environment variable', async () => {
      mockRetrieveApiKey.mockResolvedValue('')
      process.env.OPENAI_API_KEY = 'env-api-key'

      const key = await getApiKey()

      expect(key).toBe('env-api-key')

      delete process.env.OPENAI_API_KEY
    })

    it('should return empty string if no key available', async () => {
      mockRetrieveApiKey.mockResolvedValue('')
      delete process.env.OPENAI_API_KEY

      const key = await getApiKey()

      expect(key).toBe('')
    })
  })
})
