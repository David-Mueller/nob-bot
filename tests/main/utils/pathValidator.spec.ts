import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from 'electron'

// Mock config before importing pathValidator
vi.mock('@main/services/config', () => ({
  getConfig: vi.fn(() => ({
    xlsxBasePath: '/home/user/xlsx',
    xlsxFiles: [],
    settings: {
      hotkey: '',
      openaiApiKey: '',
      hasApiKey: false,
      ttsEnabled: false,
      ttsVoice: 'nova'
    }
  }))
}))

// Import actual module to get coverage
import {
  getAllowedBasePaths,
  validatePath,
  validateExcelPath
} from '@main/utils/pathValidator'
import { getConfig } from '@main/services/config'

describe('pathValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup mock returns for electron app - these should match the paths we test
    vi.mocked(app.getPath).mockImplementation((name: string) => {
      if (name === 'home') return '/home/user'
      if (name === 'documents') return '/home/user/Documents'
      if (name === 'userData') return '/home/user/.app'
      return '/tmp'
    })
    // Ensure config returns expected value
    vi.mocked(getConfig).mockReturnValue({
      xlsxBasePath: '/home/user/xlsx',
      xlsxFiles: [],
      settings: {
        hotkey: '',
        openaiApiKey: '',
        hasApiKey: false,
        ttsEnabled: false,
        ttsVoice: 'nova'
      }
    })
  })

  describe('getAllowedBasePaths', () => {
    it('should return xlsxBasePath from config', () => {
      const paths = getAllowedBasePaths()
      expect(paths).toContain('/home/user/xlsx')
    })

    it('should return home directory', () => {
      const paths = getAllowedBasePaths()
      expect(paths).toContain('/home/user')
    })

    it('should return documents directory', () => {
      const paths = getAllowedBasePaths()
      expect(paths).toContain('/home/user/Documents')
    })

    it('should return userData directory', () => {
      const paths = getAllowedBasePaths()
      expect(paths).toContain('/home/user/.app')
    })

    it('should filter out falsy values', () => {
      vi.mocked(getConfig).mockReturnValue({
        xlsxBasePath: '',
        xlsxFiles: [],
        settings: {
          hotkey: '',
          openaiApiKey: '',
          hasApiKey: false,
          ttsEnabled: false,
          ttsVoice: 'nova'
        }
      })
      const paths = getAllowedBasePaths()
      // Empty xlsxBasePath should be filtered out
      expect(paths.every((p) => p.length > 0)).toBe(true)
    })
  })

  describe('validatePath', () => {
    it('should reject path traversal with ..', () => {
      expect(() => validatePath('/home/user/../../../etc/passwd')).toThrow(
        'Path traversal not allowed'
      )
    })

    it('should reject simple .. at start', () => {
      expect(() => validatePath('../etc/passwd')).toThrow('Path traversal not allowed')
    })

    it('should reject paths outside allowed directories', () => {
      expect(() => validatePath('/etc/passwd')).toThrow('Path outside allowed directories')
    })

    it('should accept paths within home directory', () => {
      const result = validatePath('/home/user/myfile.txt')
      expect(result).toBe('/home/user/myfile.txt')
    })

    it('should accept paths within xlsx base path', () => {
      const result = validatePath('/home/user/xlsx/report.xlsx')
      expect(result).toBe('/home/user/xlsx/report.xlsx')
    })

    it('should accept paths within documents directory', () => {
      const result = validatePath('/home/user/Documents/report.txt')
      expect(result).toBe('/home/user/Documents/report.txt')
    })

    it('should accept paths within userData directory', () => {
      const result = validatePath('/home/user/.app/config.json')
      expect(result).toBe('/home/user/.app/config.json')
    })

    it('should return normalized absolute path', () => {
      const result = validatePath('/home/user/./subdir/file.txt')
      expect(result).toBe('/home/user/subdir/file.txt')
    })
  })

  describe('validateExcelPath', () => {
    it('should accept .xlsx files in allowed directories', () => {
      const result = validateExcelPath('/home/user/xlsx/report.xlsx')
      expect(result).toBe('/home/user/xlsx/report.xlsx')
    })

    it('should accept .xls files in allowed directories', () => {
      const result = validateExcelPath('/home/user/xlsx/report.xls')
      expect(result).toBe('/home/user/xlsx/report.xls')
    })

    it('should accept case-insensitive .XLSX', () => {
      const result = validateExcelPath('/home/user/Documents/report.XLSX')
      expect(result).toBe('/home/user/Documents/report.XLSX')
    })

    it('should accept case-insensitive .XLS', () => {
      const result = validateExcelPath('/home/user/Documents/report.XLS')
      expect(result).toBe('/home/user/Documents/report.XLS')
    })

    it('should reject non-Excel files in allowed directories', () => {
      expect(() => validateExcelPath('/home/user/file.txt')).toThrow('Not an Excel file')
    })

    it('should reject .csv files in allowed directories', () => {
      expect(() => validateExcelPath('/home/user/data.csv')).toThrow('Not an Excel file')
    })

    it('should reject files with fake extensions in allowed directories', () => {
      expect(() => validateExcelPath('/home/user/file.xlsx.exe')).toThrow('Not an Excel file')
    })

    it('should reject path traversal attempts', () => {
      expect(() => validateExcelPath('../../../etc/passwd.xlsx')).toThrow(
        'Path traversal not allowed'
      )
    })

    it('should reject Excel files outside allowed directories', () => {
      expect(() => validateExcelPath('/etc/report.xlsx')).toThrow('Path outside allowed directories')
    })
  })
})
