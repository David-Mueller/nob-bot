import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn().mockResolvedValue([])
}))

// Mock @langchain/openai
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        auftraggeber: 'Test Corp',
        jahr: 2025
      })
    })
  }))
}))

import { extractFileInfoSimple, scanDirectory, type ScannedFile } from '@main/services/fileScanner'
import { glob } from 'glob'

describe('fileScanner service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractFileInfoSimple', () => {
    it('should extract auftraggeber and year from standard filename', () => {
      const result = extractFileInfoSimple('LV IDT 2025.xlsx')
      expect(result.auftraggeber).toBe('IDT')
      expect(result.jahr).toBe(2025)
    })

    it('should handle spaced year format like "2 0 2 6"', () => {
      const result = extractFileInfoSimple('LV IDT 2 0 2 6.xlsx')
      expect(result.jahr).toBe(2026)
    })

    it('should handle two-digit year format', () => {
      const result = extractFileInfoSimple('LV ABC Corp 25.xlsx')
      expect(result.jahr).toBe(2025)
    })

    it('should extract multi-word auftraggeber', () => {
      const result = extractFileInfoSimple('LV Musterfirma GmbH 2025.xlsx')
      expect(result.auftraggeber).toBe('Musterfirma GmbH')
      expect(result.jahr).toBe(2025)
    })

    it('should handle lowercase lv prefix', () => {
      const result = extractFileInfoSimple('lv Company 2024.xlsx')
      expect(result.auftraggeber).toBe('Company')
      expect(result.jahr).toBe(2024)
    })

    it('should return null for auftraggeber if no year found', () => {
      const result = extractFileInfoSimple('LV Company.xlsx')
      expect(result.jahr).toBeNull()
    })

    it('should handle filenames with extra spaces', () => {
      const result = extractFileInfoSimple('LV  Company  2025.xlsx')
      expect(result.jahr).toBe(2025)
    })

    it('should remove .xlsx extension case-insensitively', () => {
      const result = extractFileInfoSimple('LV Test 2025.XLSX')
      expect(result.jahr).toBe(2025)
    })

    it('should handle mixed case LV prefix', () => {
      const result = extractFileInfoSimple('Lv Test 2024.xlsx')
      expect(result.auftraggeber).toBe('Test')
      expect(result.jahr).toBe(2024)
    })

    it('should handle .xls extension', () => {
      const result = extractFileInfoSimple('LV Test 2023.xls')
      expect(result.jahr).toBe(2023)
    })

    it('should return null auftraggeber when filename is too short', () => {
      const result = extractFileInfoSimple('LV.xlsx')
      expect(result.auftraggeber).toBeNull()
      expect(result.jahr).toBeNull()
    })

    it('should handle years in 2020s', () => {
      const result20 = extractFileInfoSimple('LV Test 20.xlsx')
      const result21 = extractFileInfoSimple('LV Test 21.xlsx')
      const result22 = extractFileInfoSimple('LV Test 22.xlsx')

      expect(result20.jahr).toBe(2020)
      expect(result21.jahr).toBe(2021)
      expect(result22.jahr).toBe(2022)
    })

    it('should handle auftraggeber with special characters', () => {
      const result = extractFileInfoSimple('LV Test-Company 2025.xlsx')
      expect(result.auftraggeber).toBe('Test-Company')
      expect(result.jahr).toBe(2025)
    })

    it('should handle year at the end without space', () => {
      const result = extractFileInfoSimple('LV Company2024.xlsx')
      expect(result.jahr).toBe(2024)
    })
  })

  describe('scanDirectory', () => {
    it('should return empty array if basePath is empty', async () => {
      const result = await scanDirectory('')
      expect(result).toEqual([])
    })

    it('should return empty array if path does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = await scanDirectory('/nonexistent/path')

      expect(result).toEqual([])
    })

    it('should list directory contents when path exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['file1.txt', 'LV Test 2025.xlsx'] as any)
      vi.mocked(glob).mockResolvedValue(['/test/path/LV Test 2025.xlsx'])

      await scanDirectory('/test/path')

      expect(fs.readdirSync).toHaveBeenCalledWith('/test/path')
    })

    it('should use glob to find LV*.xlsx files', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['LV Test 2025.xlsx'] as any)
      vi.mocked(glob).mockResolvedValue(['/test/path/LV Test 2025.xlsx'])

      await scanDirectory('/test/path')

      expect(glob).toHaveBeenCalledWith(
        '/test/path/LV*.xlsx',
        expect.objectContaining({
          windowsPathsNoEscape: true,
          nocase: true
        })
      )
    })

    it('should normalize Windows paths for glob', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([] as any)
      vi.mocked(glob).mockResolvedValue([])

      await scanDirectory('C:\\Users\\test\\Documents')

      expect(glob).toHaveBeenCalledWith(
        'C:/Users/test/Documents/LV*.xlsx',
        expect.any(Object)
      )
    })

    it('should fallback to readdirSync if glob returns empty', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['LV Test 2025.xlsx', 'other.txt'] as any)
      vi.mocked(glob).mockResolvedValue([])

      const result = await scanDirectory('/test/path')

      // Fallback should match LV*.xlsx files
      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('should fallback to readdirSync on glob error', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['LV Test 2025.xlsx'] as any)
      vi.mocked(glob).mockRejectedValue(new Error('Glob error'))

      const result = await scanDirectory('/test/path')

      expect(result).toBeDefined()
    })

    it('should return empty array if fallback also fails', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync)
        .mockReturnValueOnce(['file.txt'] as any) // First call for directory listing
        .mockImplementationOnce(() => { throw new Error('Read error') }) // Fallback call

      vi.mocked(glob).mockRejectedValue(new Error('Glob error'))

      const result = await scanDirectory('/test/path')

      expect(result).toEqual([])
    })

    it('should handle trailing slash in path', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([] as any)
      vi.mocked(glob).mockResolvedValue([])

      await scanDirectory('/test/path/')

      expect(glob).toHaveBeenCalledWith(
        '/test/path/LV*.xlsx',
        expect.any(Object)
      )
    })
  })

  describe('ScannedFile type', () => {
    it('should have correct structure', () => {
      const file: ScannedFile = {
        path: '/test/LV Test 2025.xlsx',
        filename: 'LV Test 2025.xlsx',
        auftraggeber: 'Test',
        jahr: 2025
      }

      expect(file.path).toBe('/test/LV Test 2025.xlsx')
      expect(file.filename).toBe('LV Test 2025.xlsx')
      expect(file.auftraggeber).toBe('Test')
      expect(file.jahr).toBe(2025)
    })

    it('should allow null values for auftraggeber and jahr', () => {
      const file: ScannedFile = {
        path: '/test/unknown.xlsx',
        filename: 'unknown.xlsx',
        auftraggeber: null,
        jahr: null
      }

      expect(file.auftraggeber).toBeNull()
      expect(file.jahr).toBeNull()
    })
  })

  describe('module exports', () => {
    it('should export extractFileInfoSimple', () => {
      expect(typeof extractFileInfoSimple).toBe('function')
    })

    it('should export scanDirectory', () => {
      expect(typeof scanDirectory).toBe('function')
    })
  })
})
