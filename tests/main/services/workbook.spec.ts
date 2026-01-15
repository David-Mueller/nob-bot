import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fsp from 'fs/promises'

// Create mocks using vi.hoisted to avoid initialization issues
const { mockFromDataAsync, mockOutputAsync, mockDebugLog } = vi.hoisted(() => ({
  mockFromDataAsync: vi.fn(),
  mockOutputAsync: vi.fn(),
  mockDebugLog: vi.fn()
}))

// Mock debugLog
vi.mock('@main/services/debugLog', () => ({
  debugLog: mockDebugLog
}))

// Mock xlsx-populate with hoisted mocks
vi.mock('xlsx-populate', () => ({
  default: {
    fromDataAsync: mockFromDataAsync,
    numberToDate: vi.fn((num: number) => {
      const epoch = new Date(1899, 11, 30)
      return new Date(epoch.getTime() + num * 24 * 60 * 60 * 1000)
    }),
    dateToNumber: vi.fn((date: Date) => {
      const epoch = new Date(1899, 11, 30)
      return (date.getTime() - epoch.getTime()) / (24 * 60 * 60 * 1000)
    })
  }
}))

import { loadWorkbook, saveWorkbook, XlsxPopulate } from '@main/services/workbook'
import { debugLog } from '@main/services/debugLog'

describe('workbook service', () => {
  // Create a mock workbook for tests
  let mockWorkbook: { outputAsync: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkbook = {
      outputAsync: mockOutputAsync
    }
    mockOutputAsync.mockResolvedValue(Buffer.from('mock output'))
    mockFromDataAsync.mockResolvedValue(mockWorkbook)
  })

  describe('loadWorkbook', () => {
    it('should read file and create workbook from buffer', async () => {
      const mockBuffer = Buffer.from('mock excel content')
      vi.mocked(fsp.readFile).mockResolvedValue(mockBuffer)

      await loadWorkbook('/path/to/file.xlsx')

      expect(fsp.readFile).toHaveBeenCalledWith('/path/to/file.xlsx')
    })

    it('should log loading messages', async () => {
      const mockBuffer = Buffer.from('mock excel content')
      vi.mocked(fsp.readFile).mockResolvedValue(mockBuffer)

      await loadWorkbook('/test/workbook.xlsx')

      expect(mockDebugLog).toHaveBeenCalledWith('Workbook', 'Loading: /test/workbook.xlsx')
      expect(mockDebugLog).toHaveBeenCalledWith('Workbook', 'Loaded successfully')
    })

    it('should handle read errors', async () => {
      vi.mocked(fsp.readFile).mockRejectedValue(new Error('ENOENT'))

      await expect(loadWorkbook('/missing/file.xlsx')).rejects.toThrow('ENOENT')
    })

    it('should return workbook from xlsx-populate', async () => {
      const mockBuffer = Buffer.from('mock excel content')
      vi.mocked(fsp.readFile).mockResolvedValue(mockBuffer)

      const workbook = await loadWorkbook('/path/to/file.xlsx')

      expect(workbook).toBe(mockWorkbook)
    })

    it('should pass buffer to xlsx-populate', async () => {
      const mockBuffer = Buffer.from('mock excel content')
      vi.mocked(fsp.readFile).mockResolvedValue(mockBuffer)

      await loadWorkbook('/path/to/file.xlsx')

      expect(mockFromDataAsync).toHaveBeenCalledWith(mockBuffer)
    })
  })

  describe('saveWorkbook', () => {
    it('should output workbook and write to file', async () => {
      vi.mocked(fsp.writeFile).mockResolvedValue(undefined)

      await saveWorkbook(mockWorkbook as any, '/path/to/output.xlsx')

      expect(mockOutputAsync).toHaveBeenCalled()
      expect(fsp.writeFile).toHaveBeenCalledWith('/path/to/output.xlsx', expect.any(Buffer))
    })

    it('should log saving messages', async () => {
      vi.mocked(fsp.writeFile).mockResolvedValue(undefined)

      await saveWorkbook(mockWorkbook as any, '/test/output.xlsx')

      expect(mockDebugLog).toHaveBeenCalledWith('Workbook', 'Saving: /test/output.xlsx')
      expect(mockDebugLog).toHaveBeenCalledWith('Workbook', 'Saved successfully')
    })

    it('should handle write errors', async () => {
      vi.mocked(fsp.writeFile).mockRejectedValue(new Error('EACCES'))

      await expect(saveWorkbook(mockWorkbook as any, '/readonly/file.xlsx')).rejects.toThrow('EACCES')
    })

    it('should handle outputAsync errors', async () => {
      const failingWorkbook = {
        outputAsync: vi.fn().mockRejectedValue(new Error('Output failed'))
      }

      await expect(saveWorkbook(failingWorkbook as any, '/path/to/file.xlsx')).rejects.toThrow('Output failed')
    })
  })

  describe('XlsxPopulate re-export', () => {
    it('should export XlsxPopulate', () => {
      expect(XlsxPopulate).toBeDefined()
    })

    it('should have numberToDate function', () => {
      expect(typeof XlsxPopulate.numberToDate).toBe('function')
    })

    it('should have dateToNumber function', () => {
      expect(typeof XlsxPopulate.dateToNumber).toBe('function')
    })

    it('should convert Excel serial number to date', () => {
      // Excel serial number 44927 = 2023-01-01
      const date = XlsxPopulate.numberToDate(44927)
      expect(date).toBeInstanceOf(Date)
    })
  })

  describe('module exports', () => {
    it('should export loadWorkbook function', () => {
      expect(typeof loadWorkbook).toBe('function')
    })

    it('should export saveWorkbook function', () => {
      expect(typeof saveWorkbook).toBe('function')
    })

    it('should export XlsxPopulate', () => {
      expect(XlsxPopulate).toBeDefined()
    })
  })
})
