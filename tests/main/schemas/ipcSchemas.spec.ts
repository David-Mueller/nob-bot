import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Recreate schemas for testing (avoid importing electron-dependent code)
const ActivitySchema = z.object({
  beschreibung: z.string(),
  auftraggeber: z.string().nullable(),
  thema: z.string().nullable(),
  datum: z.string(),
  minuten: z.number().nullable(),
  km: z.number().nullable(),
  auslagen: z.number().nullable()
})

const SettingsUpdateSchema = z.object({
  hotkey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  ttsEnabled: z.boolean().optional(),
  ttsVoice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional()
})

const FilePathSchema = z.string().min(1).refine(
  (path) => !path.includes('..'),
  { message: 'Path traversal not allowed' }
)

describe('IPC Schemas', () => {
  describe('ActivitySchema', () => {
    it('should validate complete activity', () => {
      const activity = {
        beschreibung: 'Test activity',
        auftraggeber: 'Client',
        thema: 'Theme',
        datum: '2026-01-15',
        minuten: 60,
        km: 10,
        auslagen: 50
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(true)
    })

    it('should validate activity with null fields', () => {
      const activity = {
        beschreibung: 'Test activity',
        auftraggeber: null,
        thema: null,
        datum: '2026-01-15',
        minuten: null,
        km: null,
        auslagen: null
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(true)
    })

    it('should reject activity without required fields', () => {
      const activity = {
        auftraggeber: 'Client'
        // missing beschreibung and datum
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(false)
    })

    it('should reject invalid types', () => {
      const activity = {
        beschreibung: 123, // should be string
        auftraggeber: 'Client',
        thema: 'Theme',
        datum: '2026-01-15',
        minuten: 'sixty', // should be number
        km: null,
        auslagen: null
      }

      const result = ActivitySchema.safeParse(activity)
      expect(result.success).toBe(false)
    })
  })

  describe('SettingsUpdateSchema', () => {
    it('should validate partial settings update', () => {
      const update = {
        ttsEnabled: true
      }

      const result = SettingsUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate full settings update', () => {
      const update = {
        hotkey: 'CommandOrControl+Shift+R',
        openaiApiKey: 'sk-test',
        ttsEnabled: true,
        ttsVoice: 'nova'
      }

      const result = SettingsUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should reject invalid voice', () => {
      const update = {
        ttsVoice: 'invalid-voice'
      }

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
  })

  describe('FilePathSchema', () => {
    it('should accept valid paths', () => {
      const validPaths = [
        '/home/user/file.xlsx',
        'C:\\Users\\Test\\file.xlsx',
        './relative/path.xlsx'
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
      }
    })

    it('should reject empty paths', () => {
      const result = FilePathSchema.safeParse('')
      expect(result.success).toBe(false)
    })
  })
})
