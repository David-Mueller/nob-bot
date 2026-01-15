import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create the mocks using vi.hoisted so they're available during vi.mock
const { mockReadFile, mockWriteFile, mockMkdir, mockExistsSync } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockExistsSync: vi.fn()
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  default: { existsSync: mockExistsSync }
}))

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir
  }
}))

import { loadDrafts, saveDrafts, clearDrafts, type DraftActivity } from '@main/services/drafts'

describe('drafts service', () => {
  const mockDraft: DraftActivity = {
    id: 1,
    activity: {
      auftraggeber: 'Test Client',
      thema: 'Test Topic',
      beschreibung: 'Test description',
      minuten: 60,
      km: 0,
      auslagen: 0,
      datum: '2026-01-15'
    },
    transcript: 'Voice transcript text',
    timestamp: '2026-01-15T10:30:45Z',
    saved: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadDrafts', () => {
    it('should return empty array if drafts file does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await loadDrafts()

      expect(result).toEqual([])
    })

    it('should load and return unsaved drafts', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue(JSON.stringify([
        mockDraft,
        { ...mockDraft, id: 2, saved: true },
        { ...mockDraft, id: 3, saved: false }
      ]))

      const result = await loadDrafts()

      expect(result).toHaveLength(2)
      expect(result.map(d => d.id)).toEqual([1, 3])
    })

    it('should return empty array on parse error', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue('invalid json{{{')

      const result = await loadDrafts()

      expect(result).toEqual([])
    })

    it('should return empty array on read error', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockRejectedValue(new Error('Read error'))

      const result = await loadDrafts()

      expect(result).toEqual([])
    })

    it('should filter out saved drafts', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue(JSON.stringify([
        { ...mockDraft, id: 1, saved: true },
        { ...mockDraft, id: 2, saved: true }
      ]))

      const result = await loadDrafts()

      expect(result).toHaveLength(0)
    })
  })

  describe('saveDrafts', () => {
    it('should create config directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      await saveDrafts([mockDraft])

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('.aktivitaeten'),
        { recursive: true }
      )
    })

    it('should only save unsaved drafts', async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)

      const drafts: DraftActivity[] = [
        mockDraft,
        { ...mockDraft, id: 2, saved: true },
        { ...mockDraft, id: 3, saved: false }
      ]

      await saveDrafts(drafts)

      const savedContent = mockWriteFile.mock.calls[0][1] as string
      const savedDrafts = JSON.parse(savedContent)
      expect(savedDrafts).toHaveLength(2)
      expect(savedDrafts.map((d: DraftActivity) => d.id)).toEqual([1, 3])
    })

    it('should format JSON with indentation', async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)

      await saveDrafts([mockDraft])

      const savedContent = mockWriteFile.mock.calls[0][1] as string
      expect(savedContent).toContain('\n')
      expect(savedContent).toContain('  ')
    })

    it('should handle write errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockRejectedValue(new Error('Write error'))

      // Should not throw
      await expect(saveDrafts([mockDraft])).resolves.not.toThrow()
    })

    it('should write to correct file path', async () => {
      mockExistsSync.mockReturnValue(true)
      mockWriteFile.mockResolvedValue(undefined)

      await saveDrafts([mockDraft])

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('drafts.json'),
        expect.any(String),
        'utf-8'
      )
    })
  })

  describe('clearDrafts', () => {
    it('should write empty array to drafts file', async () => {
      mockWriteFile.mockResolvedValue(undefined)

      await clearDrafts()

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('drafts.json'),
        '[]',
        'utf-8'
      )
    })

    it('should handle write errors gracefully', async () => {
      mockWriteFile.mockRejectedValue(new Error('Write error'))

      // Should not throw
      await expect(clearDrafts()).resolves.not.toThrow()
    })
  })

  describe('DraftActivity type', () => {
    it('should support all activity fields', () => {
      const draft: DraftActivity = {
        id: 1,
        activity: {
          auftraggeber: null,
          thema: null,
          beschreibung: 'Minimal description',
          minuten: null,
          km: 100,
          auslagen: 50.5,
          datum: null
        },
        transcript: '',
        timestamp: '2026-01-15T00:00:00Z',
        saved: false
      }

      expect(draft.activity.auftraggeber).toBeNull()
      expect(draft.activity.km).toBe(100)
      expect(draft.activity.auslagen).toBe(50.5)
    })
  })
})
