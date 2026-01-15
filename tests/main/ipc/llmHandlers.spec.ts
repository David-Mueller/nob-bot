import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'

// Mock services before importing handler
vi.mock('@main/services/llm', () => ({
  parseActivity: vi.fn(),
  parseCorrection: vi.fn(),
  parseFollowUpAnswer: vi.fn(),
  isLLMReady: vi.fn()
}))

vi.mock('@main/services/config', () => ({
  getActiveFiles: vi.fn()
}))

vi.mock('@main/services/glossar', () => ({
  getAllKnownTerms: vi.fn(),
  normalizeText: vi.fn((text) => text)
}))

vi.mock('@main/ipc/glossarHandlers', () => ({
  getCurrentGlossar: vi.fn()
}))

import { registerLLMHandlers } from '@main/ipc/llmHandlers'
import * as llmService from '@main/services/llm'
import * as configService from '@main/services/config'
import * as glossarService from '@main/services/glossar'
import * as glossarHandlers from '@main/ipc/glossarHandlers'

describe('llmHandlers', () => {
  const handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    registerLLMHandlers()
  })

  describe('registerLLMHandlers', () => {
    it('should register all LLM handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('llm:parse', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('llm:parseCorrection', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('llm:parseFollowUp', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('llm:isReady', expect.any(Function))
    })
  })

  describe('llm:parse', () => {
    const mockActivity = {
      auftraggeber: 'Client1',
      thema: 'Theme1',
      beschreibung: 'Test description',
      minuten: 60,
      km: null,
      auslagen: null,
      datum: '2024-01-15'
    }

    it('should parse transcript and return activity', async () => {
      vi.mocked(llmService.parseActivity).mockResolvedValue(mockActivity)
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(null)
      vi.mocked(configService.getActiveFiles).mockReturnValue([])

      const result = await handlers['llm:parse']({}, 'test transcript')

      expect(llmService.parseActivity).toHaveBeenCalledWith('test transcript', [], [])
      expect(result).toEqual(mockActivity)
    })

    it('should use provided clients and themes', async () => {
      vi.mocked(llmService.parseActivity).mockResolvedValue(mockActivity)
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(null)

      const clients = ['Client1', 'Client2']
      const themes = ['Theme1', 'Theme2']

      await handlers['llm:parse']({}, 'test transcript', clients, themes)

      expect(llmService.parseActivity).toHaveBeenCalledWith('test transcript', clients, themes)
    })

    it('should get known terms from glossar when not provided', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(mockGlossar)
      vi.mocked(glossarService.getAllKnownTerms).mockReturnValue({
        auftraggeber: ['GlossarClient1'],
        themen: ['GlossarTheme1'],
        kunden: []
      })
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'ConfigClient1', jahr: 2024, active: true }
      ])
      vi.mocked(llmService.parseActivity).mockResolvedValue(mockActivity)

      await handlers['llm:parse']({}, 'test transcript')

      expect(llmService.parseActivity).toHaveBeenCalledWith(
        'test transcript',
        expect.arrayContaining(['ConfigClient1', 'GlossarClient1']),
        ['GlossarTheme1']
      )
    })

    it('should normalize activity fields using glossar', async () => {
      const rawActivity = {
        ...mockActivity,
        auftraggeber: 'client1',
        thema: 'theme1'
      }
      vi.mocked(llmService.parseActivity).mockResolvedValue(rawActivity)

      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(mockGlossar)
      vi.mocked(glossarService.normalizeText)
        .mockReturnValueOnce('Client1')
        .mockReturnValueOnce('Theme1')
      vi.mocked(configService.getActiveFiles).mockReturnValue([])

      const result = await handlers['llm:parse']({}, 'test transcript')

      expect(glossarService.normalizeText).toHaveBeenCalledWith('client1', mockGlossar)
      expect(glossarService.normalizeText).toHaveBeenCalledWith('theme1', mockGlossar)
      expect(result.auftraggeber).toBe('Client1')
      expect(result.thema).toBe('Theme1')
    })

    it('should handle null auftraggeber and thema', async () => {
      const activityWithNulls = {
        ...mockActivity,
        auftraggeber: null,
        thema: null
      }
      vi.mocked(llmService.parseActivity).mockResolvedValue(activityWithNulls)
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue({
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      })
      vi.mocked(configService.getActiveFiles).mockReturnValue([])

      const result = await handlers['llm:parse']({}, 'test transcript')

      expect(result.auftraggeber).toBeNull()
      expect(result.thema).toBeNull()
    })

    it('should use only provided clients when given non-empty array', async () => {
      vi.mocked(llmService.parseActivity).mockResolvedValue(mockActivity)
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(null)
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'ConfigClient', jahr: 2024, active: true }
      ])

      await handlers['llm:parse']({}, 'test transcript', ['ProvidedClient'], [])

      expect(llmService.parseActivity).toHaveBeenCalledWith(
        'test transcript',
        ['ProvidedClient'],
        expect.any(Array)
      )
    })
  })

  describe('llm:parseCorrection', () => {
    const existingActivity = {
      auftraggeber: 'Client1',
      thema: 'Theme1',
      beschreibung: 'Original description',
      minuten: 60,
      km: null,
      auslagen: null,
      datum: '2024-01-15'
    }

    const correctedActivity = {
      ...existingActivity,
      beschreibung: 'Corrected description',
      minuten: 90
    }

    it('should parse correction and return updated activity', async () => {
      vi.mocked(llmService.parseCorrection).mockResolvedValue(correctedActivity)
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(null)
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])

      const result = await handlers['llm:parseCorrection'](
        {},
        existingActivity,
        'correction transcript'
      )

      expect(llmService.parseCorrection).toHaveBeenCalledWith(
        existingActivity,
        'correction transcript',
        ['Client1']
      )
      expect(result).toEqual(correctedActivity)
    })

    it('should normalize corrected activity fields', async () => {
      const rawCorrected = {
        ...correctedActivity,
        auftraggeber: 'client1',
        thema: 'theme1'
      }
      vi.mocked(llmService.parseCorrection).mockResolvedValue(rawCorrected)

      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(mockGlossar)
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      vi.mocked(glossarService.normalizeText)
        .mockReturnValueOnce('Client1')
        .mockReturnValueOnce('Theme1')

      const result = await handlers['llm:parseCorrection'](
        {},
        existingActivity,
        'correction transcript'
      )

      expect(result.auftraggeber).toBe('Client1')
      expect(result.thema).toBe('Theme1')
    })

    it('should combine glossar and config clients', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(mockGlossar)
      vi.mocked(glossarService.getAllKnownTerms).mockReturnValue({
        auftraggeber: ['GlossarClient'],
        themen: ['GlossarTheme'],
        kunden: []
      })
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'ConfigClient', jahr: 2024, active: true }
      ])
      vi.mocked(llmService.parseCorrection).mockResolvedValue(correctedActivity)

      await handlers['llm:parseCorrection']({}, existingActivity, 'correction transcript')

      expect(llmService.parseCorrection).toHaveBeenCalledWith(
        existingActivity,
        'correction transcript',
        expect.arrayContaining(['ConfigClient', 'GlossarClient'])
      )
    })
  })

  describe('llm:parseFollowUp', () => {
    const existingActivity = {
      auftraggeber: null,
      thema: null,
      beschreibung: 'Test description',
      minuten: null,
      km: null,
      auslagen: null,
      datum: '2024-01-15'
    }

    const updatedActivity = {
      ...existingActivity,
      auftraggeber: 'Client1',
      minuten: 60
    }

    it('should parse follow-up answer and return updated activity', async () => {
      vi.mocked(llmService.parseFollowUpAnswer).mockResolvedValue(updatedActivity)
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(null)
      vi.mocked(configService.getActiveFiles).mockReturnValue([
        { path: '/file.xlsx', auftraggeber: 'Client1', jahr: 2024, active: true }
      ])

      const result = await handlers['llm:parseFollowUp'](
        {},
        existingActivity,
        'Client1 for 1 hour',
        ['auftraggeber', 'minuten'],
        'What client and how long?'
      )

      expect(llmService.parseFollowUpAnswer).toHaveBeenCalledWith(
        existingActivity,
        'Client1 for 1 hour',
        ['auftraggeber', 'minuten'],
        'What client and how long?',
        ['Client1'],
        []
      )
      expect(result).toEqual(updatedActivity)
    })

    it('should use themes from glossar', async () => {
      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(mockGlossar)
      vi.mocked(glossarService.getAllKnownTerms).mockReturnValue({
        auftraggeber: ['GlossarClient'],
        themen: ['GlossarTheme1', 'GlossarTheme2'],
        kunden: []
      })
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      vi.mocked(llmService.parseFollowUpAnswer).mockResolvedValue(updatedActivity)

      await handlers['llm:parseFollowUp'](
        {},
        existingActivity,
        'some answer',
        ['thema'],
        'What theme?'
      )

      expect(llmService.parseFollowUpAnswer).toHaveBeenCalledWith(
        existingActivity,
        'some answer',
        ['thema'],
        'What theme?',
        ['GlossarClient'],
        ['GlossarTheme1', 'GlossarTheme2']
      )
    })

    it('should normalize follow-up result', async () => {
      const rawUpdated = {
        ...updatedActivity,
        auftraggeber: 'client1',
        thema: 'theme1'
      }
      vi.mocked(llmService.parseFollowUpAnswer).mockResolvedValue(rawUpdated)

      const mockGlossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }
      vi.mocked(glossarHandlers.getCurrentGlossar).mockReturnValue(mockGlossar)
      vi.mocked(configService.getActiveFiles).mockReturnValue([])
      vi.mocked(glossarService.normalizeText)
        .mockReturnValueOnce('Client1')
        .mockReturnValueOnce('Theme1')

      const result = await handlers['llm:parseFollowUp'](
        {},
        existingActivity,
        'answer',
        ['auftraggeber'],
        'question'
      )

      expect(result.auftraggeber).toBe('Client1')
      expect(result.thema).toBe('Theme1')
    })
  })

  describe('llm:isReady', () => {
    it('should return true when LLM is ready', async () => {
      vi.mocked(llmService.isLLMReady).mockResolvedValue(true)

      const result = await handlers['llm:isReady']()

      expect(llmService.isLLMReady).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should return false when LLM is not ready', async () => {
      vi.mocked(llmService.isLLMReady).mockResolvedValue(false)

      const result = await handlers['llm:isReady']()

      expect(result).toBe(false)
    })
  })
})
