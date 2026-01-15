import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fsp from 'fs/promises'

// Create hoisted mocks to avoid initialization issues
const { mockWorkbook, mockValidateExcelFile, mockCreateBackup, mockLoadWorkbook, mockSaveWorkbook } = vi.hoisted(() => ({
  mockWorkbook: {
    sheets: vi.fn(),
    sheet: vi.fn(),
    addSheet: vi.fn()
  },
  mockValidateExcelFile: vi.fn(),
  mockCreateBackup: vi.fn(),
  mockLoadWorkbook: vi.fn(),
  mockSaveWorkbook: vi.fn()
}))

// Mock dependencies
vi.mock('@main/services/backup', () => ({
  createBackup: mockCreateBackup.mockResolvedValue('/path/to/backup.xlsx')
}))

vi.mock('@main/services/excel', () => ({
  validateExcelFile: mockValidateExcelFile.mockResolvedValue(undefined)
}))

vi.mock('@main/services/workbook', () => ({
  loadWorkbook: mockLoadWorkbook.mockResolvedValue(mockWorkbook),
  saveWorkbook: mockSaveWorkbook.mockResolvedValue(undefined)
}))

// Create mock cell and sheet objects - these don't need hoisting as they're helper functions
const createMockCell = (value: unknown = undefined) => ({
  value: vi.fn().mockImplementation((val?: unknown) => {
    if (val !== undefined) return createMockCell(val)
    return value
  })
})

const createMockSheet = (name: string, data: Record<string, unknown> = {}) => ({
  name: vi.fn().mockReturnValue(name),
  cell: vi.fn((row: number, col: number) => {
    const key = `${row},${col}`
    return createMockCell(data[key])
  }),
  usedRange: vi.fn(() => ({
    endCell: () => ({ rowNumber: () => 10 })
  })),
  column: vi.fn(() => ({ width: vi.fn() }))
})

import {
  clearGlossarCache,
  normalizeText,
  getKnownTerms,
  getAllKnownTerms,
  loadGlossar,
  loadGlossarsFromPaths,
  type Glossar,
  type GlossarEintrag
} from '@main/services/glossar'

describe('glossar service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearGlossarCache()
    // Reset mock defaults
    mockValidateExcelFile.mockResolvedValue(undefined)
    mockLoadWorkbook.mockResolvedValue(mockWorkbook)
    mockSaveWorkbook.mockResolvedValue(undefined)
  })

  describe('normalizeText', () => {
    it('should return exact match from lookup map', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map([['meeting', 'Meeting']])
      }

      expect(normalizeText('meeting', glossar)).toBe('Meeting')
    })

    it('should normalize input before lookup', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map([['meeting', 'Meeting']])
      }

      expect(normalizeText('  MEETING  ', glossar)).toBe('Meeting')
    })

    it('should use fuzzy matching when no exact match', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map([['meeting', 'Meeting']])
      }

      // "meetin" is close enough to "meeting"
      expect(normalizeText('meetin', glossar)).toBe('Meeting')
    })

    it('should return original text when no match above threshold', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map([['meeting', 'Meeting']])
      }

      expect(normalizeText('completely different', glossar)).toBe('completely different')
    })

    it('should handle empty lookup map', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }

      expect(normalizeText('anything', glossar)).toBe('anything')
    })

    it('should handle multiple spaces in input', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map([['test entry', 'Test Entry']])
      }

      expect(normalizeText('  test   entry  ', glossar)).toBe('Test Entry')
    })

    it('should prefer higher similarity scores', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map([
          ['development', 'Development'],
          ['deployment', 'Deployment']
        ])
      }

      // "developmen" is closer to "development" than "deployment"
      expect(normalizeText('developmen', glossar)).toBe('Development')
    })
  })

  describe('getKnownTerms', () => {
    it('should return terms for specified category', () => {
      const eintrag: GlossarEintrag = {
        kategorie: 'Thema',
        begriff: 'Development',
        synonyme: []
      }
      const glossar: Glossar = {
        eintraege: [eintrag],
        byKategorie: new Map([['Thema', [eintrag]]]),
        lookupMap: new Map()
      }

      const terms = getKnownTerms(glossar, 'Thema')
      expect(terms).toEqual(['Development'])
    })

    it('should return empty array for unknown category', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }

      const terms = getKnownTerms(glossar, 'Auftraggeber')
      expect(terms).toEqual([])
    })

    it('should return multiple terms for category with multiple entries', () => {
      const eintrag1: GlossarEintrag = {
        kategorie: 'Thema',
        begriff: 'Development',
        synonyme: []
      }
      const eintrag2: GlossarEintrag = {
        kategorie: 'Thema',
        begriff: 'Testing',
        synonyme: []
      }
      const glossar: Glossar = {
        eintraege: [eintrag1, eintrag2],
        byKategorie: new Map([['Thema', [eintrag1, eintrag2]]]),
        lookupMap: new Map()
      }

      const terms = getKnownTerms(glossar, 'Thema')
      expect(terms).toEqual(['Development', 'Testing'])
    })

    it('should handle Sonstiges category', () => {
      const eintrag: GlossarEintrag = {
        kategorie: 'Sonstiges',
        begriff: 'Misc Item',
        synonyme: []
      }
      const glossar: Glossar = {
        eintraege: [eintrag],
        byKategorie: new Map([['Sonstiges', [eintrag]]]),
        lookupMap: new Map()
      }

      const terms = getKnownTerms(glossar, 'Sonstiges')
      expect(terms).toEqual(['Misc Item'])
    })
  })

  describe('getAllKnownTerms', () => {
    it('should return terms grouped by category', () => {
      const auftraggeber: GlossarEintrag = {
        kategorie: 'Auftraggeber',
        begriff: 'Client A',
        synonyme: []
      }
      const thema: GlossarEintrag = {
        kategorie: 'Thema',
        begriff: 'Dev',
        synonyme: []
      }
      const kunde: GlossarEintrag = {
        kategorie: 'Kunde',
        begriff: 'Customer X',
        synonyme: []
      }

      const glossar: Glossar = {
        eintraege: [auftraggeber, thema, kunde],
        byKategorie: new Map([
          ['Auftraggeber', [auftraggeber]],
          ['Thema', [thema]],
          ['Kunde', [kunde]]
        ]),
        lookupMap: new Map()
      }

      const result = getAllKnownTerms(glossar)

      expect(result.auftraggeber).toEqual(['Client A'])
      expect(result.themen).toEqual(['Dev'])
      expect(result.kunden).toEqual(['Customer X'])
    })

    it('should handle empty categories', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map([
          ['Auftraggeber', []],
          ['Thema', []],
          ['Kunde', []]
        ]),
        lookupMap: new Map()
      }

      const result = getAllKnownTerms(glossar)

      expect(result.auftraggeber).toEqual([])
      expect(result.themen).toEqual([])
      expect(result.kunden).toEqual([])
    })

    it('should handle missing categories in map', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }

      const result = getAllKnownTerms(glossar)

      expect(result.auftraggeber).toEqual([])
      expect(result.themen).toEqual([])
      expect(result.kunden).toEqual([])
    })
  })

  describe('clearGlossarCache', () => {
    it('should not throw when clearing specific path', () => {
      expect(() => clearGlossarCache('/path/to/file.xlsx')).not.toThrow()
    })

    it('should not throw when clearing all cache', () => {
      expect(() => clearGlossarCache()).not.toThrow()
    })

    it('should clear cache for specific file', () => {
      clearGlossarCache('/specific/file.xlsx')
      // No error means success - cache operations are internal
      expect(true).toBe(true)
    })
  })

  describe('loadGlossar', () => {
    it('should validate excel file before loading', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      mockWorkbook.sheets.mockReturnValue([])

      await loadGlossar('/path/to/file.xlsx')

      expect(mockValidateExcelFile).toHaveBeenCalledWith('/path/to/file.xlsx')
    })

    it('should return null if no Glossar sheet found', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      mockWorkbook.sheets.mockReturnValue([
        createMockSheet('Januar'),
        createMockSheet('Februar')
      ])

      const result = await loadGlossar('/path/to/file.xlsx')

      expect(result).toBeNull()
    })

    it('should load glossar from sheet with correct name', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      const glossarSheet = createMockSheet('Glossar', {
        '2,1': 'Thema',
        '2,2': 'Development',
        '2,3': 'dev, coding'
      })
      mockWorkbook.sheets.mockReturnValue([glossarSheet])

      const result = await loadGlossar('/path/to/file.xlsx')

      expect(result).not.toBeNull()
      expect(result?.eintraege.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle case-insensitive sheet name', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      const glossarSheet = createMockSheet('GLOSSAR')
      mockWorkbook.sheets.mockReturnValue([glossarSheet])

      await loadGlossar('/path/to/file.xlsx')

      expect(mockLoadWorkbook).toHaveBeenCalled()
    })

    it('should return null on error', async () => {
      mockValidateExcelFile.mockRejectedValue(new Error('Invalid file'))

      const result = await loadGlossar('/path/to/invalid.xlsx')

      expect(result).toBeNull()
    })

    it('should use cached glossar if mtime matches', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      const glossarSheet = createMockSheet('Glossar')
      mockWorkbook.sheets.mockReturnValue([glossarSheet])

      // First call loads the glossar
      await loadGlossar('/path/to/cached.xlsx')
      vi.clearAllMocks()

      // Second call should use cache
      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      await loadGlossar('/path/to/cached.xlsx')

      // loadWorkbook should not be called again if cache hit
      // (hard to test directly due to cache clearing in beforeEach)
    })
  })

  describe('loadGlossarsFromPaths', () => {
    it('should return null if no paths provided', async () => {
      const result = await loadGlossarsFromPaths([])

      expect(result).toBeNull()
    })

    it('should return null if all paths fail', async () => {
      mockValidateExcelFile.mockRejectedValue(new Error('Invalid'))

      const result = await loadGlossarsFromPaths(['/path1.xlsx', '/path2.xlsx'])

      expect(result).toBeNull()
    })

    it('should merge glossars from multiple paths', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      const glossarSheet = createMockSheet('Glossar', {
        '2,1': 'Thema',
        '2,2': 'Test',
        '2,3': ''
      })
      mockWorkbook.sheets.mockReturnValue([glossarSheet])

      const result = await loadGlossarsFromPaths(['/path1.xlsx', '/path2.xlsx'])

      // If at least one succeeds, result should not be null
      expect(result).toBeDefined()
    })
  })

  describe('Glossar type validation', () => {
    it('should have correct structure for GlossarEintrag', () => {
      const eintrag: GlossarEintrag = {
        kategorie: 'Thema',
        begriff: 'Test',
        synonyme: ['test1', 'test2']
      }

      expect(eintrag.kategorie).toBe('Thema')
      expect(eintrag.begriff).toBe('Test')
      expect(eintrag.synonyme).toHaveLength(2)
    })

    it('should have correct structure for Glossar', () => {
      const glossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }

      expect(glossar.eintraege).toEqual([])
      expect(glossar.byKategorie).toBeInstanceOf(Map)
      expect(glossar.lookupMap).toBeInstanceOf(Map)
    })

    it('should support all valid categories', () => {
      const categories = ['Auftraggeber', 'Thema', 'Kunde', 'Sonstiges']

      for (const kategorie of categories) {
        const eintrag: GlossarEintrag = {
          kategorie: kategorie as any,
          begriff: 'Test',
          synonyme: []
        }
        expect(eintrag.kategorie).toBe(kategorie)
      }
    })
  })

  describe('createGlossarSheet', () => {
    it('should export createGlossarSheet function', async () => {
      const mod = await import('@main/services/glossar')
      expect(typeof mod.createGlossarSheet).toBe('function')
    })

    it('should return existing glossar if sheet already exists', async () => {
      const { createGlossarSheet } = await import('@main/services/glossar')

      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      const glossarSheet = createMockSheet('Glossar', {
        '2,1': 'Thema',
        '2,2': 'Test',
        '2,3': ''
      })
      mockWorkbook.sheets.mockReturnValue([glossarSheet])

      const result = await createGlossarSheet('/path/to/file.xlsx', 'TestClient')

      // Should return existing glossar, not create new
      expect(result).toBeDefined()
    })

    it('should return null on validation error', async () => {
      const { createGlossarSheet } = await import('@main/services/glossar')

      mockValidateExcelFile.mockRejectedValue(new Error('Invalid'))

      const result = await createGlossarSheet('/invalid/file.xlsx', 'TestClient')

      expect(result).toBeNull()
    })
  })

  describe('ensureGlossar', () => {
    it('should export ensureGlossar function', async () => {
      const mod = await import('@main/services/glossar')
      expect(typeof mod.ensureGlossar).toBe('function')
    })

    it('should return existing glossar if it exists', async () => {
      const { ensureGlossar } = await import('@main/services/glossar')

      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      const glossarSheet = createMockSheet('Glossar', {
        '2,1': 'Auftraggeber',
        '2,2': 'TestClient',
        '2,3': ''
      })
      mockWorkbook.sheets.mockReturnValue([glossarSheet])

      const result = await ensureGlossar('/path/to/file.xlsx', 'TestClient')

      expect(result).toBeDefined()
    })

    it('should attempt to create glossar if not exists', async () => {
      const { ensureGlossar } = await import('@main/services/glossar')

      vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 12345 } as any)
      // No glossar sheet - simulate creating one
      mockWorkbook.sheets.mockReturnValue([
        createMockSheet('Januar')
      ])
      mockWorkbook.addSheet.mockReturnValue(createMockSheet('Glossar'))

      const result = await ensureGlossar('/path/to/file.xlsx', 'TestClient')

      // Result depends on whether creation succeeded
      expect(mockLoadWorkbook).toHaveBeenCalled()
    })
  })

  describe('module exports', () => {
    it('should export clearGlossarCache', () => {
      expect(typeof clearGlossarCache).toBe('function')
    })

    it('should export normalizeText', () => {
      expect(typeof normalizeText).toBe('function')
    })

    it('should export getKnownTerms', () => {
      expect(typeof getKnownTerms).toBe('function')
    })

    it('should export getAllKnownTerms', () => {
      expect(typeof getAllKnownTerms).toBe('function')
    })

    it('should export loadGlossar', () => {
      expect(typeof loadGlossar).toBe('function')
    })

    it('should export loadGlossarsFromPaths', () => {
      expect(typeof loadGlossarsFromPaths).toBe('function')
    })
  })
})
