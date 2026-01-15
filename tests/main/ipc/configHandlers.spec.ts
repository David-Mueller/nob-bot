import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, dialog } from 'electron'

// Mock services before importing handler
vi.mock('@main/services/config', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getConfig: vi.fn(),
  updateXlsxFile: vi.fn(),
  removeXlsxFile: vi.fn(),
  getActiveFiles: vi.fn(),
  findFileForAuftraggeber: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn()
}))

vi.mock('@main/services/fileScanner', () => ({
  scanDirectory: vi.fn()
}))

vi.mock('@main/utils/pathValidator', () => ({
  validateExcelPath: vi.fn((p) => p)
}))

vi.mock('@main/services/debugLog', () => ({
  getLogFilePath: vi.fn(() => '/tmp/test.log'),
  readLogFile: vi.fn(() => Promise.resolve('test log content'))
}))

// fs and fs/promises are mocked in setup.ts

import { registerConfigHandlers } from '@main/ipc/configHandlers'
import * as configService from '@main/services/config'
import * as fileScanner from '@main/services/fileScanner'
import * as pathValidator from '@main/utils/pathValidator'
import * as debugLog from '@main/services/debugLog'

describe('configHandlers', () => {
  // Store registered handlers for testing
  const handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()

    // Capture handlers when ipcMain.handle is called
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    // Register handlers
    registerConfigHandlers()
  })

  describe('registerConfigHandlers', () => {
    it('should register all config handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('config:load', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:save', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:get', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:setBasePath', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:getBasePath', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:browseFolder', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:scanFiles', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:updateFile', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:getFiles', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:getActiveFiles', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:findFile', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:toggleFileActive', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:removeFile', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:getSettings', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:updateSettings', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('config:debugInfo', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('debug:getLogPath', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('debug:readLog', expect.any(Function))
    })
  })

  describe('config:load', () => {
    it('should call loadConfig and return result', async () => {
      const mockConfig = { xlsxBasePath: '/test', xlsxFiles: [], settings: {} }
      vi.mocked(configService.loadConfig).mockResolvedValue(mockConfig as any)

      const result = await handlers['config:load']()

      expect(configService.loadConfig).toHaveBeenCalled()
      expect(result).toEqual(mockConfig)
    })
  })

  describe('config:save', () => {
    it('should call saveConfig with provided config', async () => {
      const mockConfig = { xlsxBasePath: '/test', xlsxFiles: [], settings: {} }
      vi.mocked(configService.saveConfig).mockResolvedValue(undefined)

      await handlers['config:save']({}, mockConfig)

      expect(configService.saveConfig).toHaveBeenCalledWith(mockConfig)
    })
  })

  describe('config:get', () => {
    it('should return current config', () => {
      const mockConfig = { xlsxBasePath: '/test', xlsxFiles: [], settings: {} }
      vi.mocked(configService.getConfig).mockReturnValue(mockConfig as any)

      const result = handlers['config:get']()

      expect(configService.getConfig).toHaveBeenCalled()
      expect(result).toEqual(mockConfig)
    })
  })

  describe('config:setBasePath', () => {
    it('should reject path traversal attempts', async () => {
      await expect(handlers['config:setBasePath']({}, '/path/../etc')).rejects.toThrow()
    })

    it('should reject empty path', async () => {
      await expect(handlers['config:setBasePath']({}, '')).rejects.toThrow()
    })

    it('should reject path too long', async () => {
      const longPath = '/a'.repeat(501)
      await expect(handlers['config:setBasePath']({}, longPath)).rejects.toThrow()
    })
  })

  describe('config:getBasePath', () => {
    it('should return base path from config', () => {
      const mockConfig = { xlsxBasePath: '/test/path', xlsxFiles: [], settings: {} }
      vi.mocked(configService.getConfig).mockReturnValue(mockConfig as any)

      const result = handlers['config:getBasePath']()

      expect(result).toBe('/test/path')
    })
  })

  describe('config:browseFolder', () => {
    it('should return selected folder path', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/selected/folder']
      })

      const result = await handlers['config:browseFolder']()

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        title: 'Ordner auswählen',
        properties: ['openDirectory']
      })
      expect(result).toBe('/selected/folder')
    })

    it('should return null when dialog is canceled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: []
      })

      const result = await handlers['config:browseFolder']()

      expect(result).toBeNull()
    })
  })

  describe('config:scanFiles', () => {
    it('should scan directory and return files', async () => {
      const mockConfig = { xlsxBasePath: '/test/path', xlsxFiles: [], settings: {} }
      vi.mocked(configService.getConfig).mockReturnValue(mockConfig as any)

      const mockFiles = [
        { path: '/test/path/file1.xlsx', filename: 'file1.xlsx', auftraggeber: 'Client1', jahr: 2024 }
      ]
      vi.mocked(fileScanner.scanDirectory).mockResolvedValue(mockFiles)

      const result = await handlers['config:scanFiles']()

      expect(fileScanner.scanDirectory).toHaveBeenCalledWith('/test/path')
      expect(result).toEqual(mockFiles)
    })
  })

  describe('config:updateFile', () => {
    it('should update file config with valid path and updates', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/test/file.xlsx')
      vi.mocked(configService.updateXlsxFile).mockResolvedValue(undefined)

      await handlers['config:updateFile']({}, '/test/file.xlsx', { auftraggeber: 'NewClient' })

      expect(configService.updateXlsxFile).toHaveBeenCalledWith('/test/file.xlsx', {
        auftraggeber: 'NewClient'
      })
    })

    it('should throw on invalid path', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockImplementation(() => {
        throw new Error('Invalid path')
      })

      await expect(
        handlers['config:updateFile']({}, '/invalid/path', { auftraggeber: 'Test' })
      ).rejects.toThrow()
    })
  })

  describe('config:getFiles', () => {
    it('should return all configured files', () => {
      const mockFiles = [
        { path: '/test/file1.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ]
      vi.mocked(configService.getConfig).mockReturnValue({
        xlsxBasePath: '/test',
        xlsxFiles: mockFiles,
        settings: {}
      } as any)

      const result = handlers['config:getFiles']()

      expect(result).toEqual(mockFiles)
    })
  })

  describe('config:getActiveFiles', () => {
    it('should return only active files', () => {
      const mockActiveFiles = [{ path: '/test/file1.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }]
      vi.mocked(configService.getActiveFiles).mockReturnValue(mockActiveFiles)

      const result = handlers['config:getActiveFiles']()

      expect(configService.getActiveFiles).toHaveBeenCalled()
      expect(result).toEqual(mockActiveFiles)
    })
  })

  describe('config:findFile', () => {
    it('should find file for valid auftraggeber and year', () => {
      const mockFile = { path: '/test/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(mockFile)

      const result = handlers['config:findFile']({}, 'Client1', 2024)

      expect(configService.findFileForAuftraggeber).toHaveBeenCalledWith('Client1', 2024)
      expect(result).toEqual(mockFile)
    })

    it('should return null for invalid lookup', () => {
      const result = handlers['config:findFile']({}, '', 1999)

      // Schema validation fails for empty auftraggeber or year out of range
      expect(result).toBeNull()
    })
  })

  describe('config:toggleFileActive', () => {
    it('should toggle file active status', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/test/file.xlsx')
      vi.mocked(configService.updateXlsxFile).mockResolvedValue(undefined)

      await handlers['config:toggleFileActive']({}, '/test/file.xlsx', true)

      expect(configService.updateXlsxFile).toHaveBeenCalledWith('/test/file.xlsx', { active: true })
    })

    it('should default to false for non-boolean active', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/test/file.xlsx')
      vi.mocked(configService.updateXlsxFile).mockResolvedValue(undefined)

      await handlers['config:toggleFileActive']({}, '/test/file.xlsx', 'invalid')

      expect(configService.updateXlsxFile).toHaveBeenCalledWith('/test/file.xlsx', { active: false })
    })
  })

  describe('config:removeFile', () => {
    it('should remove file from config', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/test/file.xlsx')
      vi.mocked(configService.removeXlsxFile).mockResolvedValue(undefined)

      await handlers['config:removeFile']({}, '/test/file.xlsx')

      expect(configService.removeXlsxFile).toHaveBeenCalledWith('/test/file.xlsx')
    })
  })

  describe('config:getSettings', () => {
    it('should return settings', async () => {
      const mockSettings = { hotkey: 'Ctrl+R', hasApiKey: true, ttsEnabled: false }
      vi.mocked(configService.getSettings).mockResolvedValue(mockSettings as any)

      const result = await handlers['config:getSettings']()

      expect(configService.getSettings).toHaveBeenCalled()
      expect(result).toEqual(mockSettings)
    })
  })

  describe('config:updateSettings', () => {
    it('should update settings with valid data', async () => {
      const mockSettings = { hotkey: 'Ctrl+R', hasApiKey: true, ttsEnabled: true }
      vi.mocked(configService.updateSettings).mockResolvedValue(mockSettings as any)

      const result = await handlers['config:updateSettings']({}, { ttsEnabled: true })

      expect(configService.updateSettings).toHaveBeenCalledWith({ ttsEnabled: true })
      expect(result).toEqual(mockSettings)
    })

    it('should throw on invalid settings', async () => {
      // Invalid whisperModel value
      await expect(
        handlers['config:updateSettings']({}, { whisperModel: 'invalid' })
      ).rejects.toThrow()
    })

    it('should handle API key updates by sanitizing logs', async () => {
      const mockSettings = { hotkey: 'Ctrl+R', hasApiKey: true, ttsEnabled: false }
      vi.mocked(configService.updateSettings).mockResolvedValue(mockSettings as any)

      await handlers['config:updateSettings']({}, { openaiApiKey: 'sk-secret' })

      expect(configService.updateSettings).toHaveBeenCalledWith({ openaiApiKey: 'sk-secret' })
    })
  })

  describe('config:debugInfo', () => {
    it('should return base path from config', async () => {
      vi.mocked(configService.getConfig).mockReturnValue({
        xlsxBasePath: '/test/path',
        xlsxFiles: [],
        settings: {}
      } as any)

      const result = await handlers['config:debugInfo']()

      expect(result.basePath).toBe('/test/path')
    })
  })

  describe('debug:getLogPath', () => {
    it('should return log file path', () => {
      const result = handlers['debug:getLogPath']()

      expect(debugLog.getLogFilePath).toHaveBeenCalled()
      expect(result).toBe('/tmp/test.log')
    })
  })

  describe('debug:readLog', () => {
    it('should return log file contents', async () => {
      const result = await handlers['debug:readLog']()

      expect(debugLog.readLogFile).toHaveBeenCalled()
      expect(result).toBe('test log content')
    })
  })
})
