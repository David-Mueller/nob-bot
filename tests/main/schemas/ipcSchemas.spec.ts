import { describe, it, expect } from 'vitest'
import {
  FilePathSchema,
  ExcelPathSchema,
  ActivitySchema,
  SettingsUpdateSchema,
  DraftActivitySchema,
  DraftArraySchema,
  FileConfigUpdateSchema,
  AuftraggeberLookupSchema,
  MonthSchema,
  StringInputSchema,
  type ValidatedActivity,
  type ValidatedSettingsUpdate,
  type ValidatedDraftActivity,
  type ValidatedFileConfigUpdate
} from '@main/schemas/ipcSchemas'

describe('ipcSchemas', () => {
  describe('FilePathSchema', () => {
    it('should accept valid paths', () => {
      const validPaths = [
        '/home/user/file.xlsx',
        'C:\\Users\\Test\\file.xlsx',
        './relative/path.xlsx',
        '/a'
      ]

      for (const path of validPaths) {
        const result = FilePathSchema.safeParse(path)
        expect(result.success).toBe(true)
      }
    })

    it('should reject path traversal', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '/home/user/../../../etc/passwd',
        'C:\\..\\Windows\\System32'
      ]

      for (const path of maliciousPaths) {
        const result = FilePathSchema.safeParse(path)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Path traversal not allowed')
        }
      }
    })

    it('should reject empty paths', () => {
      const result = FilePathSchema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('should reject paths exceeding 500 characters', () => {
      const longPath = '/home/user/' + 'a'.repeat(500)
      const result = FilePathSchema.safeParse(longPath)
      expect(result.success).toBe(false)
    })
  })

  describe('ExcelPathSchema', () => {
    it('should accept .xlsx files', () => {
      const result = ExcelPathSchema.safeParse('/home/user/file.xlsx')
      expect(result.success).toBe(true)
    })

    it('should accept .xls files', () => {
      const result = ExcelPathSchema.safeParse('/home/user/file.xls')
      expect(result.success).toBe(true)
    })

    it('should accept case-insensitive extensions', () => {
      expect(ExcelPathSchema.safeParse('/home/user/file.XLSX').success).toBe(true)
      expect(ExcelPathSchema.safeParse('/home/user/file.XLS').success).toBe(true)
    })

    it('should reject non-Excel files', () => {
      const invalidFiles = [
        '/home/user/file.txt',
        '/home/user/file.csv',
        '/home/user/file.xlsm',
        '/home/user/file.xlsx.exe'
      ]

      for (const file of invalidFiles) {
        const result = ExcelPathSchema.safeParse(file)
        expect(result.success).toBe(false)
      }
    })

    it('should reject path traversal in Excel paths', () => {
      const result = ExcelPathSchema.safeParse('../../../etc/file.xlsx')
      expect(result.success).toBe(false)
    })
  })

  describe('ActivitySchema', () => {
    it('should validate complete activity', () => {
      const activity = {
        auftraggeber: 'Client',
        thema: 'Theme',
        beschreibung: 'Test description',
        minuten: 60,
        km: 10,
        auslagen: 50,
        datum: '2026-01-15'
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.beschreibung).toBe('Test description')
      }
    })

    it('should validate activity with null fields', () => {
      const activity = {
        auftraggeber: null,
        thema: null,
        beschreibung: 'Test description',
        minuten: null,
        km: 0,
        auslagen: 0,
        datum: null
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(true)
    })

    it('should apply default values for km and auslagen', () => {
      const activity = {
        auftraggeber: 'Client',
        thema: 'Theme',
        beschreibung: 'Test',
        minuten: 30,
        datum: '2026-01-15'
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.km).toBe(0)
        expect(result.data.auslagen).toBe(0)
      }
    })

    it('should reject empty beschreibung', () => {
      const activity = {
        auftraggeber: 'Client',
        thema: 'Theme',
        beschreibung: '',
        minuten: 30,
        km: 0,
        auslagen: 0,
        datum: '2026-01-15'
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(false)
    })

    it('should reject invalid types', () => {
      const activity = {
        auftraggeber: 'Client',
        thema: 'Theme',
        beschreibung: 123, // should be string
        minuten: 'sixty', // should be number or null
        km: 0,
        auslagen: 0,
        datum: '2026-01-15'
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(false)
    })

    it('should produce correct ValidatedActivity type', () => {
      const activity: ValidatedActivity = {
        auftraggeber: 'Client',
        thema: 'Theme',
        beschreibung: 'Test',
        minuten: 30,
        km: 0,
        auslagen: 0,
        datum: '2026-01-15'
      }
      expect(activity.beschreibung).toBe('Test')
    })
  })

  describe('SettingsUpdateSchema', () => {
    it('should validate partial settings update', () => {
      const update = { ttsEnabled: true }
      const result = SettingsUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate full settings update', () => {
      const update = {
        hotkey: 'CommandOrControl+Shift+R',
        openaiApiKey: 'sk-test',
        whisperModel: 'base',
        ttsEnabled: true,
        ttsVoice: 'nova'
      }

      const result = SettingsUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate empty update', () => {
      const result = SettingsUpdateSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject invalid voice', () => {
      const update = { ttsVoice: 'invalid-voice' }
      const result = SettingsUpdateSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should accept all valid voices', () => {
      const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
      for (const voice of voices) {
        const result = SettingsUpdateSchema.safeParse({ ttsVoice: voice })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid whisperModel', () => {
      const update = { whisperModel: 'large' }
      const result = SettingsUpdateSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should accept all valid whisperModels', () => {
      const models = ['tiny', 'base', 'small']
      for (const model of models) {
        const result = SettingsUpdateSchema.safeParse({ whisperModel: model })
        expect(result.success).toBe(true)
      }
    })

    it('should produce correct ValidatedSettingsUpdate type', () => {
      const update: ValidatedSettingsUpdate = {
        hotkey: 'Alt+R',
        ttsEnabled: false
      }
      expect(update.hotkey).toBe('Alt+R')
    })
  })

  describe('DraftActivitySchema', () => {
    it('should validate complete draft activity', () => {
      const draft = {
        id: 1,
        activity: {
          auftraggeber: 'Client',
          thema: 'Theme',
          beschreibung: 'Test',
          minuten: 30,
          km: 0,
          auslagen: 0,
          datum: '2026-01-15'
        },
        transcript: 'Voice transcript',
        timestamp: '2026-01-15T10:00:00Z',
        saved: false
      }

      const result = DraftActivitySchema.safeParse(draft)
      expect(result.success).toBe(true)
    })

    it('should reject missing required fields', () => {
      const draft = {
        id: 1,
        activity: {
          auftraggeber: 'Client',
          thema: 'Theme',
          beschreibung: 'Test',
          minuten: 30,
          km: 0,
          auslagen: 0,
          datum: '2026-01-15'
        }
        // missing transcript, timestamp, saved
      }

      const result = DraftActivitySchema.safeParse(draft)
      expect(result.success).toBe(false)
    })

    it('should produce correct ValidatedDraftActivity type', () => {
      const draft: ValidatedDraftActivity = {
        id: 1,
        activity: {
          auftraggeber: 'Client',
          thema: 'Theme',
          beschreibung: 'Test',
          minuten: 30,
          km: 0,
          auslagen: 0,
          datum: '2026-01-15'
        },
        transcript: 'Voice transcript',
        timestamp: '2026-01-15T10:00:00Z',
        saved: true
      }
      expect(draft.saved).toBe(true)
    })
  })

  describe('DraftArraySchema', () => {
    it('should validate array of drafts', () => {
      const drafts = [
        {
          id: 1,
          activity: {
            auftraggeber: 'Client',
            thema: 'Theme',
            beschreibung: 'Test 1',
            minuten: 30,
            km: 0,
            auslagen: 0,
            datum: '2026-01-15'
          },
          transcript: 'Transcript 1',
          timestamp: '2026-01-15T10:00:00Z',
          saved: false
        },
        {
          id: 2,
          activity: {
            auftraggeber: 'Client 2',
            thema: 'Theme 2',
            beschreibung: 'Test 2',
            minuten: 60,
            km: 10,
            auslagen: 5,
            datum: '2026-01-16'
          },
          transcript: 'Transcript 2',
          timestamp: '2026-01-16T10:00:00Z',
          saved: true
        }
      ]

      const result = DraftArraySchema.safeParse(drafts)
      expect(result.success).toBe(true)
    })

    it('should validate empty array', () => {
      const result = DraftArraySchema.safeParse([])
      expect(result.success).toBe(true)
    })

    it('should reject invalid items in array', () => {
      const drafts = [{ invalid: 'data' }]
      const result = DraftArraySchema.safeParse(drafts)
      expect(result.success).toBe(false)
    })
  })

  describe('FileConfigUpdateSchema', () => {
    it('should validate partial update', () => {
      const update = { auftraggeber: 'New Client' }
      const result = FileConfigUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate full update', () => {
      const update = {
        auftraggeber: 'Client',
        jahr: 2026,
        active: true
      }

      const result = FileConfigUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate empty update', () => {
      const result = FileConfigUpdateSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject invalid year (below 2000)', () => {
      const update = { jahr: 1999 }
      const result = FileConfigUpdateSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject invalid year (above 2100)', () => {
      const update = { jahr: 2101 }
      const result = FileConfigUpdateSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject non-integer year', () => {
      const update = { jahr: 2026.5 }
      const result = FileConfigUpdateSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should produce correct ValidatedFileConfigUpdate type', () => {
      const update: ValidatedFileConfigUpdate = {
        auftraggeber: 'Client',
        jahr: 2026,
        active: true
      }
      expect(update.active).toBe(true)
    })
  })

  describe('AuftraggeberLookupSchema', () => {
    it('should validate valid lookup', () => {
      const lookup = {
        auftraggeber: 'Client Name',
        jahr: 2026
      }

      const result = AuftraggeberLookupSchema.safeParse(lookup)
      expect(result.success).toBe(true)
    })

    it('should reject empty auftraggeber', () => {
      const lookup = {
        auftraggeber: '',
        jahr: 2026
      }

      const result = AuftraggeberLookupSchema.safeParse(lookup)
      expect(result.success).toBe(false)
    })

    it('should reject invalid year', () => {
      const lookup = {
        auftraggeber: 'Client',
        jahr: 1999
      }

      const result = AuftraggeberLookupSchema.safeParse(lookup)
      expect(result.success).toBe(false)
    })

    it('should reject missing fields', () => {
      const lookup = { auftraggeber: 'Client' }
      const result = AuftraggeberLookupSchema.safeParse(lookup)
      expect(result.success).toBe(false)
    })
  })

  describe('MonthSchema', () => {
    it('should accept valid months 1-12', () => {
      for (let month = 1; month <= 12; month++) {
        const result = MonthSchema.safeParse(month)
        expect(result.success).toBe(true)
      }
    })

    it('should reject month 0', () => {
      const result = MonthSchema.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('should reject month 13', () => {
      const result = MonthSchema.safeParse(13)
      expect(result.success).toBe(false)
    })

    it('should reject non-integer months', () => {
      const result = MonthSchema.safeParse(6.5)
      expect(result.success).toBe(false)
    })

    it('should reject string months', () => {
      const result = MonthSchema.safeParse('6')
      expect(result.success).toBe(false)
    })
  })

  describe('StringInputSchema', () => {
    it('should accept non-empty strings', () => {
      const result = StringInputSchema.safeParse('valid string')
      expect(result.success).toBe(true)
    })

    it('should accept single character', () => {
      const result = StringInputSchema.safeParse('a')
      expect(result.success).toBe(true)
    })

    it('should reject empty string', () => {
      const result = StringInputSchema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('should reject non-string types', () => {
      expect(StringInputSchema.safeParse(123).success).toBe(false)
      expect(StringInputSchema.safeParse(null).success).toBe(false)
      expect(StringInputSchema.safeParse(undefined).success).toBe(false)
    })
  })
})
