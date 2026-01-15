import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, dialog, shell } from 'electron'

// Mock services before importing handler
vi.mock('@main/services/excel', () => ({
  addActivity: vi.fn(),
  getActivities: vi.fn()
}))

vi.mock('@main/services/config', () => ({
  findFileForAuftraggeber: vi.fn(),
  getActiveFiles: vi.fn()
}))

vi.mock('@main/utils/pathValidator', () => ({
  validateExcelPath: vi.fn((p) => p)
}))

import { registerExcelHandlers, setExcelFilePath } from '@main/ipc/excelHandlers'
import * as excelService from '@main/services/excel'
import * as configService from '@main/services/config'
import * as pathValidator from '@main/utils/pathValidator'

describe('excelHandlers', () => {
  const handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    registerExcelHandlers()
  })

  describe('registerExcelHandlers', () => {
    it('should register all excel handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('excel:setPath', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('excel:getPath', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('excel:selectFile', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('excel:openFile', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('excel:saveActivity', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('excel:getActivities', expect.any(Function))
    })
  })

  describe('setExcelFilePath', () => {
    it('should set the legacy file path', () => {
      setExcelFilePath('/test/file.xlsx')

      const result = handlers['excel:getPath']()
      expect(result).toBe('/test/file.xlsx')
    })
  })

  describe('excel:setPath', () => {
    it('should set path with valid Excel file', () => {
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/test/file.xlsx')

      handlers['excel:setPath']({}, '/test/file.xlsx')

      expect(pathValidator.validateExcelPath).toHaveBeenCalledWith('/test/file.xlsx')
    })

    it('should throw on invalid path', () => {
      vi.mocked(pathValidator.validateExcelPath).mockImplementation(() => {
        throw new Error('Invalid path')
      })

      expect(() => handlers['excel:setPath']({}, '/invalid/path')).toThrow()
    })

    it('should throw on non-Excel file', () => {
      vi.mocked(pathValidator.validateExcelPath).mockImplementation(() => {
        throw new Error('Must be Excel file')
      })

      expect(() => handlers['excel:setPath']({}, '/test/file.txt')).toThrow()
    })
  })

  describe('excel:getPath', () => {
    it('should return current legacy file path', () => {
      setExcelFilePath('/current/file.xlsx')

      const result = handlers['excel:getPath']()

      expect(result).toBe('/current/file.xlsx')
    })
  })

  describe('excel:selectFile', () => {
    it('should return selected file path', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/selected/file.xlsx']
      })
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/selected/file.xlsx')

      const result = await handlers['excel:selectFile']()

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        title: 'Excel-Datei auswählen',
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile']
      })
      expect(result).toBe('/selected/file.xlsx')
    })

    it('should return null when dialog is canceled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: []
      })

      const result = await handlers['excel:selectFile']()

      expect(result).toBeNull()
    })

    it('should return null when path validation fails', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/selected/file.xlsx']
      })
      vi.mocked(pathValidator.validateExcelPath).mockImplementation(() => {
        throw new Error('Invalid path')
      })

      const result = await handlers['excel:selectFile']()

      expect(result).toBeNull()
    })
  })

  describe('excel:openFile', () => {
    it('should open file in system default app', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/test/file.xlsx')
      vi.mocked(shell.openPath).mockResolvedValue('')

      const result = await handlers['excel:openFile']({}, '/test/file.xlsx')

      expect(shell.openPath).toHaveBeenCalledWith('/test/file.xlsx')
      expect(result).toBe(true)
    })

    it('should return false on invalid path', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockImplementation(() => {
        throw new Error('Invalid path')
      })

      const result = await handlers['excel:openFile']({}, '/invalid/path')

      expect(result).toBe(false)
    })
  })

  describe('excel:saveActivity', () => {
    const validActivity = {
      auftraggeber: 'Client1',
      thema: 'Theme1',
      beschreibung: 'Test activity description',
      minuten: 60,
      km: 10,
      auslagen: 5,
      datum: '2024-01-15'
    }

    it('should save activity to config file', async () => {
      const mockConfigFile = { path: '/config/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(mockConfigFile)
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/config/file.xlsx')
      vi.mocked(excelService.addActivity).mockResolvedValue(undefined)

      const result = await handlers['excel:saveActivity']({}, validActivity)

      expect(configService.findFileForAuftraggeber).toHaveBeenCalledWith('Client1', 2024)
      expect(excelService.addActivity).toHaveBeenCalledWith('/config/file.xlsx', expect.objectContaining({
        datum: '2024-01-15',
        thema: 'Theme1',
        taetigkeit: 'Test activity description',
        zeit: 1, // 60 minutes = 1 hour
        km: 10,
        hotel: 5
      }))
      expect(result.success).toBe(true)
      expect(result.filePath).toBe('/config/file.xlsx')
    })

    it('should fall back to legacy path when no config file found', async () => {
      setExcelFilePath('/legacy/file.xlsx')
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(null)
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/legacy/file.xlsx')
      vi.mocked(excelService.addActivity).mockResolvedValue(undefined)

      const result = await handlers['excel:saveActivity']({}, validActivity)

      expect(result.success).toBe(true)
      expect(result.filePath).toBe('/legacy/file.xlsx')
    })

    it('should return error when no file found and no active files', async () => {
      setExcelFilePath(null as any)
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(null)
      vi.mocked(configService.getActiveFiles).mockReturnValue([])

      const result = await handlers['excel:saveActivity']({}, {
        ...validActivity,
        auftraggeber: 'UnknownClient'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Keine aktiven Excel-Dateien')
    })

    it('should return error when no matching file found', async () => {
      setExcelFilePath(null as any)
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(null)
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file1.xlsx', auftraggeber: 'OtherClient', jahr: 2024, active: true }
      ])

      const result = await handlers['excel:saveActivity']({}, {
        ...validActivity,
        auftraggeber: 'UnknownClient'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Keine Datei für Auftraggeber')
    })

    it('should return error on invalid activity data', async () => {
      const invalidActivity = { invalid: 'data' }

      const result = await handlers['excel:saveActivity']({}, invalidActivity)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Ungültige Aktivitätsdaten')
    })

    it('should handle null minuten', async () => {
      const activityWithNullMinuten = { ...validActivity, minuten: null }
      const mockConfigFile = { path: '/config/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(mockConfigFile)
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/config/file.xlsx')
      vi.mocked(excelService.addActivity).mockResolvedValue(undefined)

      const result = await handlers['excel:saveActivity']({}, activityWithNullMinuten)

      expect(excelService.addActivity).toHaveBeenCalledWith('/config/file.xlsx', expect.objectContaining({
        zeit: null
      }))
      expect(result.success).toBe(true)
    })

    it('should handle activity without auftraggeber', async () => {
      const activityWithoutAuftraggeber = { ...validActivity, auftraggeber: null }
      setExcelFilePath('/legacy/file.xlsx')
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(null)
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/legacy/file.xlsx')
      vi.mocked(excelService.addActivity).mockResolvedValue(undefined)

      const result = await handlers['excel:saveActivity']({}, activityWithoutAuftraggeber)

      expect(configService.findFileForAuftraggeber).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('should extract year from ISO date format', async () => {
      const mockConfigFile = { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2025, active: true }
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(mockConfigFile)
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/file.xlsx')
      vi.mocked(excelService.addActivity).mockResolvedValue(undefined)

      await handlers['excel:saveActivity']({}, {
        ...validActivity,
        datum: '2025-06-15'
      })

      expect(configService.findFileForAuftraggeber).toHaveBeenCalledWith('Client1', 2025)
    })

    it('should extract year from German date format', async () => {
      const mockConfigFile = { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2025, active: true }
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(mockConfigFile)
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/file.xlsx')
      vi.mocked(excelService.addActivity).mockResolvedValue(undefined)

      await handlers['excel:saveActivity']({}, {
        ...validActivity,
        datum: '15.06.2025'
      })

      expect(configService.findFileForAuftraggeber).toHaveBeenCalledWith('Client1', 2025)
    })

    it('should use current year when datum is null', async () => {
      const currentYear = new Date().getFullYear()
      const mockConfigFile = { path: '/file.xlsx', auftraggeber: 'Client1', jahr: currentYear, active: true }
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(mockConfigFile)
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/file.xlsx')
      vi.mocked(excelService.addActivity).mockResolvedValue(undefined)

      await handlers['excel:saveActivity']({}, {
        ...validActivity,
        datum: null
      })

      expect(configService.findFileForAuftraggeber).toHaveBeenCalledWith('Client1', currentYear)
    })

    it('should handle save failure', async () => {
      const mockConfigFile = { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      vi.mocked(configService.findFileForAuftraggeber).mockReturnValue(mockConfigFile)
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/file.xlsx')
      vi.mocked(excelService.addActivity).mockRejectedValue(new Error('Write failed'))

      const result = await handlers['excel:saveActivity']({}, validActivity)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Write failed')
    })
  })

  describe('excel:getActivities', () => {
    it('should return activities for valid month', async () => {
      setExcelFilePath('/test/file.xlsx')
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/test/file.xlsx')

      const mockActivities = [
        { datum: '2024-01-15', thema: 'Theme1', taetigkeit: 'Task1', zeit: 1, km: 0, hotel: 0, row: 5 }
      ]
      vi.mocked(excelService.getActivities).mockResolvedValue(mockActivities)

      const result = await handlers['excel:getActivities']({}, 1)

      expect(excelService.getActivities).toHaveBeenCalledWith('/test/file.xlsx', 1)
      expect(result).toEqual(mockActivities)
    })

    it('should return empty array for invalid month', async () => {
      const result = await handlers['excel:getActivities']({}, 13)

      expect(excelService.getActivities).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should return empty array when no legacy path set', async () => {
      // Reset legacy path by registering handlers again
      vi.mocked(ipcMain.handle).mockClear()
      registerExcelHandlers()
      // Set it to null explicitly
      setExcelFilePath(null as any)

      const result = await handlers['excel:getActivities']({}, 1)

      expect(result).toEqual([])
    })

    it('should return empty array on read failure', async () => {
      setExcelFilePath('/test/file.xlsx')
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/test/file.xlsx')
      vi.mocked(excelService.getActivities).mockRejectedValue(new Error('Read failed'))

      const result = await handlers['excel:getActivities']({}, 1)

      expect(result).toEqual([])
    })
  })
})
