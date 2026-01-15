import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'

// Mock services before importing handler
vi.mock('@main/services/drafts', () => ({
  loadDrafts: vi.fn(),
  saveDrafts: vi.fn(),
  clearDrafts: vi.fn()
}))

import { registerDraftsHandlers } from '@main/ipc/draftsHandlers'
import * as draftsService from '@main/services/drafts'

describe('draftsHandlers', () => {
  const handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    registerDraftsHandlers()
  })

  describe('registerDraftsHandlers', () => {
    it('should register all drafts handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('drafts:load', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('drafts:save', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('drafts:clear', expect.any(Function))
    })
  })

  describe('drafts:load', () => {
    it('should load and return drafts', async () => {
      const mockDrafts = [
        {
          id: 1,
          activity: {
            auftraggeber: 'Client1',
            thema: 'Theme1',
            beschreibung: 'Test activity',
            minuten: 60,
            km: 0,
            auslagen: 0,
            datum: '2024-01-15'
          },
          transcript: 'test transcript',
          timestamp: '2024-01-15T10:00:00Z',
          saved: false
        }
      ]
      vi.mocked(draftsService.loadDrafts).mockResolvedValue(mockDrafts)

      const result = await handlers['drafts:load']()

      expect(draftsService.loadDrafts).toHaveBeenCalled()
      expect(result).toEqual(mockDrafts)
    })

    it('should return empty array when no drafts', async () => {
      vi.mocked(draftsService.loadDrafts).mockResolvedValue([])

      const result = await handlers['drafts:load']()

      expect(result).toEqual([])
    })
  })

  describe('drafts:save', () => {
    it('should save valid drafts', async () => {
      vi.mocked(draftsService.saveDrafts).mockResolvedValue(undefined)

      const validDrafts = [
        {
          id: 1,
          activity: {
            auftraggeber: 'Client1',
            thema: 'Theme1',
            beschreibung: 'Test activity',
            minuten: 60,
            km: 0,
            auslagen: 0,
            datum: '2024-01-15'
          },
          transcript: 'test transcript',
          timestamp: '2024-01-15T10:00:00Z',
          saved: false
        }
      ]

      await handlers['drafts:save']({}, validDrafts)

      expect(draftsService.saveDrafts).toHaveBeenCalledWith(validDrafts)
    })

    it('should throw on invalid draft data', async () => {
      const invalidDrafts = [{ invalid: 'data' }]

      await expect(handlers['drafts:save']({}, invalidDrafts)).rejects.toThrow()
      expect(draftsService.saveDrafts).not.toHaveBeenCalled()
    })

    it('should throw on missing required fields', async () => {
      const invalidDrafts = [
        {
          id: 1,
          // Missing activity
          transcript: 'test',
          timestamp: '2024-01-15T10:00:00Z',
          saved: false
        }
      ]

      await expect(handlers['drafts:save']({}, invalidDrafts)).rejects.toThrow()
    })

    it('should handle null fields in activity', async () => {
      vi.mocked(draftsService.saveDrafts).mockResolvedValue(undefined)

      const draftsWithNulls = [
        {
          id: 1,
          activity: {
            auftraggeber: null,
            thema: null,
            beschreibung: 'Test activity',
            minuten: null,
            km: 0,
            auslagen: 0,
            datum: null
          },
          transcript: 'test transcript',
          timestamp: '2024-01-15T10:00:00Z',
          saved: false
        }
      ]

      await handlers['drafts:save']({}, draftsWithNulls)

      expect(draftsService.saveDrafts).toHaveBeenCalledWith(draftsWithNulls)
    })
  })

  describe('drafts:clear', () => {
    it('should clear all drafts', async () => {
      vi.mocked(draftsService.clearDrafts).mockResolvedValue(undefined)

      await handlers['drafts:clear']()

      expect(draftsService.clearDrafts).toHaveBeenCalled()
    })
  })
})
