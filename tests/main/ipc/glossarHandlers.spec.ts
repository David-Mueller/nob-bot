import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'

// Mock services before importing handler
vi.mock('@main/services/glossar', () => ({
  normalizeText: vi.fn((text) => text),
  getAllKnownTerms: vi.fn(),
  clearGlossarCache: vi.fn(),
  ensureGlossar: vi.fn()
}))

vi.mock('@main/services/config', () => ({
  getActiveFiles: vi.fn()
}))

vi.mock('@main/utils/pathValidator', () => ({
  validateExcelPath: vi.fn((p) => p)
}))

import {
  registerGlossarHandlers,
  getCurrentGlossar,
  reloadGlossar
} from '@main/ipc/glossarHandlers'
import * as glossarService from '@main/services/glossar'
import * as configService from '@main/services/config'
import * as pathValidator from '@main/utils/pathValidator'

describe('glossarHandlers', () => {
  const handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    registerGlossarHandlers()
  })

  describe('registerGlossarHandlers', () => {
    it('should register all glossar handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('glossar:load', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('glossar:getKnownTerms', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('glossar:normalize', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('glossar:getEntries', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('glossar:clearCache', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('glossar:createFromData', expect.any(Function))
    })
  })

  describe('glossar:load', () => {
    it('should load glossar and return true when successful', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue(mockGlossar)

      const result = await handlers['glossar:load']()

      expect(result).toBe(true)
    })

    it('should return false when no active files', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([])

      const result = await handlers['glossar:load']()

      expect(result).toBe(false)
    })

    it('should return false when all glossar loads fail', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar).mockRejectedValue(new Error('Load failed'))

      const result = await handlers['glossar:load']()

      expect(result).toBe(false)
    })
  })

  describe('glossar:getKnownTerms', () => {
    it('should return known terms when glossar is loaded', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue(mockGlossar)
      vi.mocked(glossarService.getAllKnownTerms).mockReturnValue({
        auftraggeber: ['Client1', 'Client2'],
        themen: ['Theme1', 'Theme2'],
        kunden: ['Customer1']
      })

      await handlers['glossar:load']()
      const result = handlers['glossar:getKnownTerms']()

      expect(glossarService.getAllKnownTerms).toHaveBeenCalled()
      expect(result).toEqual({
        auftraggeber: ['Client1', 'Client2'],
        themen: ['Theme1', 'Theme2'],
        kunden: ['Customer1']
      })
    })

    it('should return null when glossar is not loaded', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      await handlers['glossar:load']()

      const result = handlers['glossar:getKnownTerms']()

      expect(result).toBeNull()
    })
  })

  describe('glossar:normalize', () => {
    it('should normalize text using glossar', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue(mockGlossar)
      vi.mocked(glossarService.normalizeText).mockReturnValue('Normalized Text')

      await handlers['glossar:load']()
      const result = handlers['glossar:normalize']({}, 'raw text')

      expect(glossarService.normalizeText).toHaveBeenCalledWith('raw text', expect.any(Object))
      expect(result).toBe('Normalized Text')
    })

    it('should return original text when glossar not loaded', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      await handlers['glossar:load']()

      const result = handlers['glossar:normalize']({}, 'test text')

      expect(result).toBe('test text')
    })

    it('should return empty string for invalid input', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      await handlers['glossar:load']()

      const result = handlers['glossar:normalize']({}, 123)

      expect(result).toBe('')
    })

    it('should return original text for validation errors when text is string', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      await handlers['glossar:load']()

      // Empty string fails StringInputSchema (min 1)
      const result = handlers['glossar:normalize']({}, '')

      expect(result).toBe('')
    })
  })

  describe('glossar:getEntries', () => {
    it('should return entries when glossar is loaded', async () => {
      const mockEntries = [
        { original: 'orig1', normalized: 'norm1', kategorie: 'Auftraggeber' as const },
        { original: 'orig2', normalized: 'norm2', kategorie: 'Thema' as const }
      ]
      const mockGlossar = {
        eintraege: mockEntries,
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue(mockGlossar)

      await handlers['glossar:load']()
      const result = handlers['glossar:getEntries']()

      expect(result).toEqual(mockEntries)
    })

    it('should return empty array when glossar not loaded', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      await handlers['glossar:load']()

      const result = handlers['glossar:getEntries']()

      expect(result).toEqual([])
    })
  })

  describe('glossar:clearCache', () => {
    it('should clear glossar cache', async () => {
      handlers['glossar:clearCache']()

      expect(glossarService.clearGlossarCache).toHaveBeenCalled()
    })

    it('should reset current glossar to null', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue(mockGlossar)

      await handlers['glossar:load']()
      handlers['glossar:clearCache']()

      // Now getKnownTerms should return null
      const result = handlers['glossar:getKnownTerms']()
      expect(result).toBeNull()
    })
  })

  describe('glossar:createFromData', () => {
    it('should create glossar from data', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/file.xlsx')
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue({
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      })
      vi.mocked(configService.getActiveFiles).mockReturnValue([])

      const result = await handlers['glossar:createFromData']({}, '/file.xlsx', 'Client1')

      expect(pathValidator.validateExcelPath).toHaveBeenCalledWith('/file.xlsx')
      expect(glossarService.ensureGlossar).toHaveBeenCalledWith('/file.xlsx', 'Client1')
      expect(result).toBe(true)
    })

    it('should return false on invalid path', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockImplementation(() => {
        throw new Error('Invalid path')
      })

      const result = await handlers['glossar:createFromData']({}, '/invalid/path', 'Client1')

      expect(result).toBe(false)
    })

    it('should return false on invalid auftraggeber', async () => {
      const result = await handlers['glossar:createFromData']({}, '/file.xlsx', '')

      expect(result).toBe(false)
    })

    it('should return false when ensureGlossar fails', async () => {
      vi.mocked(pathValidator.validateExcelPath).mockReturnValue('/file.xlsx')
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue(null)

      const result = await handlers['glossar:createFromData']({}, '/file.xlsx', 'Client1')

      expect(result).toBe(false)
    })
  })

  describe('getCurrentGlossar', () => {
    it('should return current glossar after load', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map([
          ['Auftraggeber', []],
          ['Thema', []],
          ['Kunde', []],
          ['Sonstiges', []]
        ]),
        lookupMap: new Map()
      }
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue(mockGlossar)

      await handlers['glossar:load']()
      const result = getCurrentGlossar()

      // After merging, glossar has entries from all loaded files
      expect(result).not.toBeNull()
      expect(result!.eintraege).toBeDefined()
      expect(result!.lookupMap).toBeDefined()
    })

    it('should return null when no glossar loaded', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      await handlers['glossar:load']()

      const result = getCurrentGlossar()

      expect(result).toBeNull()
    })
  })

  describe('reloadGlossar', () => {
    it('should reload glossar from active files', async () => {
      const mockGlossar = {
        eintraege: [{ original: 'test', normalized: 'Test', kategorie: 'Auftraggeber' as const }],
        byKategorie: new Map([['Auftraggeber', [{ original: 'test', normalized: 'Test', kategorie: 'Auftraggeber' as const }]]]),
        lookupMap: new Map([['test', 'Test']])
      }
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file1.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true },
        { path: '/file2.xlsx', auftraggeber: 'Client2', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar).mockResolvedValue(mockGlossar)

      await reloadGlossar()

      expect(glossarService.ensureGlossar).toHaveBeenCalledTimes(2)
      const glossar = getCurrentGlossar()
      expect(glossar).not.toBeNull()
    })

    it('should handle partial failures', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map([
          ['Auftraggeber', []],
          ['Thema', []],
          ['Kunde', []],
          ['Sonstiges', []]
        ]),
        lookupMap: new Map()
      }
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file1.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true },
        { path: '/file2.xlsx', auftraggeber: 'Client2', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar)
        .mockResolvedValueOnce(mockGlossar)
        .mockRejectedValueOnce(new Error('Load failed'))

      await reloadGlossar()

      // Should still have glossar from first successful load
      const glossar = getCurrentGlossar()
      expect(glossar).not.toBeNull()
    })

    it('should set glossar to null when no active files', async () => {
      vi.mocked(configService.getActiveFiles).mockReturnValue([])

      await reloadGlossar()

      expect(getCurrentGlossar()).toBeNull()
    })

    it('should merge multiple glossars', async () => {
      const glossar1 = {
        eintraege: [{ original: 'a', normalized: 'A', kategorie: 'Auftraggeber' as const }],
        byKategorie: new Map([
          ['Auftraggeber', [{ original: 'a', normalized: 'A', kategorie: 'Auftraggeber' as const }]],
          ['Thema', []],
          ['Kunde', []],
          ['Sonstiges', []]
        ]),
        lookupMap: new Map([['a', 'A']])
      }
      const glossar2 = {
        eintraege: [{ original: 'b', normalized: 'B', kategorie: 'Thema' as const }],
        byKategorie: new Map([
          ['Auftraggeber', []],
          ['Thema', [{ original: 'b', normalized: 'B', kategorie: 'Thema' as const }]],
          ['Kunde', []],
          ['Sonstiges', []]
        ]),
        lookupMap: new Map([['b', 'B']])
      }

      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file1.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true },
        { path: '/file2.xlsx', auftraggeber: 'Client2', jahr: 2024, active: true }
      ])
      vi.mocked(glossarService.ensureGlossar)
        .mockResolvedValueOnce(glossar1)
        .mockResolvedValueOnce(glossar2)

      await reloadGlossar()

      const merged = getCurrentGlossar()
      expect(merged).not.toBeNull()
      expect(merged!.eintraege.length).toBe(2)
      expect(merged!.lookupMap.get('a')).toBe('A')
      expect(merged!.lookupMap.get('b')).toBe('B')
    })
  })
})
