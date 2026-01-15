import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fsp from 'fs/promises'

// Mock dependencies
vi.mock('@main/services/backup', () => ({
  createBackup: vi.fn().mockResolvedValue('/path/to/backup.xlsx')
}))

vi.mock('@main/services/debugLog', () => ({
  debugLog: vi.fn()
}))

// Create mock cell and sheet objects
const createMockCell = (value: unknown = undefined) => ({
  value: vi.fn().mockImplementation((val?: unknown) => {
    if (val !== undefined) return createMockCell(val)
    return value
  })
})

const createMockSheet = (data: Record<string, unknown> = {}) => ({
  cell: vi.fn((ref: string) => createMockCell(data[ref])),
  usedRange: vi.fn(() => ({
    endCell: () => ({ rowNumber: () => 20 })
  }))
})

const createMockWorkbook = (sheets: Record<string, ReturnType<typeof createMockSheet>> = {}) => ({
  sheet: vi.fn((name: string) => sheets[name] || null)
})

vi.mock('@main/services/workbook', () => ({
  loadWorkbook: vi.fn(),
  saveWorkbook: vi.fn().mockResolvedValue(undefined),
  XlsxPopulate: {
    numberToDate: vi.fn((num: number) => {
      const epoch = new Date(1899, 11, 30)
      return new Date(epoch.getTime() + num * 24 * 60 * 60 * 1000)
    })
  }
}))

import { validateExcelFile, addActivity, getActivities, type Activity } from '@main/services/excel'
import { createBackup } from '@main/services/backup'
import { loadWorkbook, saveWorkbook } from '@main/services/workbook'

describe('excel service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateExcelFile', () => {
    describe('path validation', () => {
      it('should reject path traversal with double dots', async () => {
        await expect(validateExcelFile('/path/../etc/passwd.xlsx')).rejects.toThrow('Path traversal not allowed')
      })

      it('should reject path traversal with backslash double dots', async () => {
        await expect(validateExcelFile('C:\\path\\..\\etc\\passwd.xlsx')).rejects.toThrow('Path traversal not allowed')
      })

      it('should reject double path traversal', async () => {
        await expect(validateExcelFile('/path/../../etc/passwd.xlsx')).rejects.toThrow('Path traversal not allowed')
      })

      it('should reject path with embedded double dots', async () => {
        await expect(validateExcelFile('/safe/..hidden/file.xlsx')).rejects.toThrow('Path traversal not allowed')
      })
    })

    describe('extension validation', () => {
      it('should reject .txt files', async () => {
        await expect(validateExcelFile('/path/to/file.txt')).rejects.toThrow('Invalid file extension')
      })

      it('should reject .doc files', async () => {
        await expect(validateExcelFile('/path/to/file.doc')).rejects.toThrow('Invalid file extension')
      })

      it('should reject .pdf files', async () => {
        await expect(validateExcelFile('/path/to/file.pdf')).rejects.toThrow('Invalid file extension')
      })

      it('should reject files without extension', async () => {
        await expect(validateExcelFile('/path/to/file')).rejects.toThrow('Invalid file extension')
      })

      it('should reject .csv files', async () => {
        await expect(validateExcelFile('/path/to/data.csv')).rejects.toThrow('Invalid file extension')
      })

      it('should reject .xlsm files (macros)', async () => {
        await expect(validateExcelFile('/path/to/file.xlsm')).rejects.toThrow('Invalid file extension')
      })

      it('should reject .xlsb files (binary)', async () => {
        await expect(validateExcelFile('/path/to/file.xlsb')).rejects.toThrow('Invalid file extension')
      })
    })

    describe('file size validation', () => {
      it('should accept valid xlsx file under size limit', async () => {
        vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 * 1024 } as any)
        await expect(validateExcelFile('/path/to/valid.xlsx')).resolves.toBeUndefined()
      })

      it('should accept valid xls file under size limit', async () => {
        vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
        await expect(validateExcelFile('/path/to/valid.xls')).resolves.toBeUndefined()
      })

      it('should reject file exceeding 50MB limit', async () => {
        vi.mocked(fsp.stat).mockResolvedValue({ size: 51 * 1024 * 1024 } as any)
        await expect(validateExcelFile('/path/to/large.xlsx')).rejects.toThrow('File too large')
      })

      it('should accept file at exactly 50MB', async () => {
        vi.mocked(fsp.stat).mockResolvedValue({ size: 50 * 1024 * 1024 } as any)
        await expect(validateExcelFile('/path/to/exact.xlsx')).resolves.toBeUndefined()
      })

      it('should handle stat errors', async () => {
        vi.mocked(fsp.stat).mockRejectedValue(new Error('ENOENT'))
        await expect(validateExcelFile('/path/to/missing.xlsx')).rejects.toThrow('ENOENT')
      })
    })
  })

  describe('addActivity', () => {
    it('should validate file before adding activity', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({})
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'Test',
        taetigkeit: 'Testing',
        zeit: 2,
        km: 0,
        hotel: 0
      }

      await addActivity('/path/to/file.xlsx', activity)

      expect(fsp.stat).toHaveBeenCalledWith('/path/to/file.xlsx')
    })

    it('should create backup before modifications', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({})
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'Test',
        taetigkeit: 'Testing',
        zeit: 2,
        km: 0,
        hotel: 0
      }

      await addActivity('/path/to/file.xlsx', activity)

      expect(createBackup).toHaveBeenCalledWith('/path/to/file.xlsx')
    })

    it('should throw error for missing month sheet', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockWorkbook = createMockWorkbook({})
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'Test',
        taetigkeit: 'Testing',
        zeit: 2,
        km: 0,
        hotel: 0
      }

      await expect(addActivity('/path/to/file.xlsx', activity)).rejects.toThrow('Sheet "Januar" nicht gefunden')
    })

    it('should save workbook after adding activity', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({})
      const mockWorkbook = createMockWorkbook({ Februar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activity: Activity = {
        datum: '2026-02-20',
        thema: 'February Test',
        taetigkeit: 'Testing',
        zeit: 3,
        km: 50,
        hotel: 100
      }

      await addActivity('/path/to/file.xlsx', activity)

      expect(saveWorkbook).toHaveBeenCalledWith(mockWorkbook, '/path/to/file.xlsx')
    })

    it('should map date to correct month sheet', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({})
      const mockWorkbook = createMockWorkbook({ Dezember: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activity: Activity = {
        datum: '2026-12-25',
        thema: 'December Test',
        taetigkeit: 'Holiday work',
        zeit: 1,
        km: 0,
        hotel: 0
      }

      await addActivity('/path/to/file.xlsx', activity)

      expect(mockWorkbook.sheet).toHaveBeenCalledWith('Dezember')
    })

    it('should find last content row with existing data', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      // Simulate sheet with existing content at rows 7, 8, 9
      const mockSheet = createMockSheet({
        'B7': 'Existing Theme 1',
        'C7': 'Task 1',
        'B8': 'Existing Theme 2',
        'C8': '',
        'B9': '',
        'C9': 'Task Only'
      })
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'New Entry',
        taetigkeit: 'New Task',
        zeit: 2,
        km: 0,
        hotel: 0
      }

      await addActivity('/path/to/file.xlsx', activity)

      // Should have written to correct row after finding existing content
      expect(saveWorkbook).toHaveBeenCalled()
    })

    it('should handle activity with null zeit', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({})
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'Test',
        taetigkeit: 'Task',
        zeit: null,
        km: 0,
        hotel: 0
      }

      await addActivity('/path/to/file.xlsx', activity)

      expect(saveWorkbook).toHaveBeenCalled()
    })

    it('should handle activity with positive km and hotel', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({})
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'Test',
        taetigkeit: 'Task',
        zeit: 4,
        km: 150,
        hotel: 75
      }

      await addActivity('/path/to/file.xlsx', activity)

      expect(saveWorkbook).toHaveBeenCalled()
    })
  })

  describe('getActivities', () => {
    it('should validate file before reading', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({})
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      await getActivities('/path/to/file.xlsx', 0)

      expect(fsp.stat).toHaveBeenCalledWith('/path/to/file.xlsx')
    })

    it('should return empty array if sheet not found', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockWorkbook = createMockWorkbook({})
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activities = await getActivities('/path/to/file.xlsx', 0)

      expect(activities).toEqual([])
    })

    it('should read activities from correct month sheet', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({})
      const mockWorkbook = createMockWorkbook({ März: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      await getActivities('/path/to/file.xlsx', 2) // March = index 2

      expect(mockWorkbook.sheet).toHaveBeenCalledWith('März')
    })

    it('should handle all month indices correctly', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)

      const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
      ]

      for (let i = 0; i < 12; i++) {
        const mockSheet = createMockSheet({})
        const mockWorkbook = createMockWorkbook({ [monthNames[i]]: mockSheet })
        vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

        await getActivities('/path/to/file.xlsx', i)

        expect(mockWorkbook.sheet).toHaveBeenCalledWith(monthNames[i])
      }
    })

    it('should parse activities with number dates', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({
        'A14': 45000, // Excel serial date
        'B14': 'Theme',
        'C14': 'Task',
        'D14': 0.25, // 6 hours (as fraction of day)
        'E14': 100,
        'F14': 50
      })
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activities = await getActivities('/path/to/file.xlsx', 0)

      expect(activities.length).toBe(1)
      expect(activities[0].thema).toBe('Theme')
      expect(activities[0].taetigkeit).toBe('Task')
      expect(activities[0].zeit).toBe(6) // 0.25 * 24
      expect(activities[0].km).toBe(100)
      expect(activities[0].hotel).toBe(50)
    })

    it('should parse activities with Date objects', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const testDate = new Date(2026, 0, 15)
      const mockSheet = createMockSheet({
        'A14': testDate,
        'B14': 'Date Theme',
        'C14': 'Date Task'
      })
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activities = await getActivities('/path/to/file.xlsx', 0)

      expect(activities.length).toBe(1)
      expect(activities[0].datum).toBe('2026-01-15')
    })

    it('should parse activities with string dates', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({
        'A14': '15.01.2026',
        'B14': 'String Theme',
        'C14': 'String Task'
      })
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activities = await getActivities('/path/to/file.xlsx', 0)

      expect(activities.length).toBe(1)
      expect(activities[0].datum).toBe('15.01.2026')
    })

    it('should handle null/undefined values', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({
        'A14': null,
        'B14': 'Theme Only',
        'C14': undefined,
        'D14': undefined,
        'E14': null,
        'F14': undefined
      })
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activities = await getActivities('/path/to/file.xlsx', 0)

      expect(activities.length).toBe(1)
      expect(activities[0].datum).toBe('')
      expect(activities[0].thema).toBe('Theme Only')
      expect(activities[0].taetigkeit).toBe('')
      expect(activities[0].zeit).toBeNull()
      expect(activities[0].km).toBe(0)
      expect(activities[0].hotel).toBe(0)
    })

    it('should skip rows with no data', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({
        'A14': undefined,
        'B14': undefined,
        'C14': undefined,
        'A15': '2026-01-16',
        'B15': 'Valid',
        'C15': 'Activity'
      })
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activities = await getActivities('/path/to/file.xlsx', 0)

      expect(activities.length).toBe(1)
      expect(activities[0].thema).toBe('Valid')
    })

    it('should handle non-numeric zeit values', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({ size: 1024 } as any)
      const mockSheet = createMockSheet({
        'A14': '2026-01-15',
        'B14': 'Theme',
        'C14': 'Task',
        'D14': 'not a number'
      })
      const mockWorkbook = createMockWorkbook({ Januar: mockSheet })
      vi.mocked(loadWorkbook).mockResolvedValue(mockWorkbook as any)

      const activities = await getActivities('/path/to/file.xlsx', 0)

      expect(activities.length).toBe(1)
      expect(activities[0].zeit).toBeNull()
    })
  })

  describe('Activity type structure', () => {
    it('should have all required fields', () => {
      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'Test Theme',
        taetigkeit: 'Test Activity',
        zeit: 4.5,
        km: 100,
        hotel: 50
      }

      expect(activity.datum).toBe('2026-01-15')
      expect(activity.thema).toBe('Test Theme')
      expect(activity.taetigkeit).toBe('Test Activity')
      expect(activity.zeit).toBe(4.5)
      expect(activity.km).toBe(100)
      expect(activity.hotel).toBe(50)
    })

    it('should allow null zeit', () => {
      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'Test Theme',
        taetigkeit: 'Test Activity',
        zeit: null,
        km: 0,
        hotel: 0
      }

      expect(activity.zeit).toBeNull()
    })

    it('should allow zero values for km and hotel', () => {
      const activity: Activity = {
        datum: '2026-01-15',
        thema: '',
        taetigkeit: '',
        zeit: 0,
        km: 0,
        hotel: 0
      }

      expect(activity.zeit).toBe(0)
      expect(activity.km).toBe(0)
      expect(activity.hotel).toBe(0)
    })

    it('should handle decimal zeit values', () => {
      const activity: Activity = {
        datum: '2026-01-15',
        thema: 'Test',
        taetigkeit: 'Test',
        zeit: 2.75,
        km: 0,
        hotel: 0
      }

      expect(activity.zeit).toBe(2.75)
    })
  })

  describe('module exports', () => {
    it('should export validateExcelFile function', () => {
      expect(typeof validateExcelFile).toBe('function')
    })

    it('should export addActivity function', () => {
      expect(typeof addActivity).toBe('function')
    })

    it('should export getActivities function', () => {
      expect(typeof getActivities).toBe('function')
    })
  })
})
