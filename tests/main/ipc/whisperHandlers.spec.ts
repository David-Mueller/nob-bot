import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, BrowserWindow } from 'electron'

// Mock services before importing handler
vi.mock('@main/services/whisper', () => ({
  initWhisper: vi.fn(),
  transcribe: vi.fn(),
  isWhisperReady: vi.fn(),
  getWhisperMode: vi.fn()
}))

import { registerWhisperHandlers } from '@main/ipc/whisperHandlers'
import * as whisperService from '@main/services/whisper'

describe('whisperHandlers', () => {
  const handlers: Record<string, Function> = {}
  let mockMainWindow: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock BrowserWindow (BrowserWindow mock returns an object, not a class)
    mockMainWindow = {
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      on: vi.fn(),
      webContents: {
        send: vi.fn(),
        on: vi.fn()
      }
    }

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    registerWhisperHandlers(mockMainWindow)
  })

  describe('registerWhisperHandlers', () => {
    it('should register all whisper handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('whisper:init', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('whisper:transcribe', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('whisper:getMode', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('whisper:isReady', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('whisper:isLoading', expect.any(Function))
    })
  })

  describe('whisper:init', () => {
    it('should initialize whisper service', async () => {
      vi.mocked(whisperService.initWhisper).mockResolvedValue(undefined)

      await handlers['whisper:init']()

      expect(whisperService.initWhisper).toHaveBeenCalled()
    })
  })

  describe('whisper:transcribe', () => {
    const mockTranscriptionResult = {
      text: 'Hello world',
      confidence: 0.95
    }

    it('should transcribe ArrayBuffer PCM data', async () => {
      vi.mocked(whisperService.transcribe).mockResolvedValue(mockTranscriptionResult)

      const pcmData = new ArrayBuffer(1024)
      const result = await handlers['whisper:transcribe']({}, pcmData)

      expect(whisperService.transcribe).toHaveBeenCalledWith(pcmData, undefined)
      expect(result).toEqual(mockTranscriptionResult)
    })

    it('should transcribe Buffer PCM data', async () => {
      vi.mocked(whisperService.transcribe).mockResolvedValue(mockTranscriptionResult)

      const pcmData = Buffer.alloc(1024)
      const result = await handlers['whisper:transcribe']({}, pcmData)

      expect(whisperService.transcribe).toHaveBeenCalled()
      expect(result).toEqual(mockTranscriptionResult)
    })

    it('should transcribe Uint8Array PCM data', async () => {
      vi.mocked(whisperService.transcribe).mockResolvedValue(mockTranscriptionResult)

      const pcmData = new Uint8Array(1024)
      const result = await handlers['whisper:transcribe']({}, pcmData)

      expect(whisperService.transcribe).toHaveBeenCalled()
      expect(result).toEqual(mockTranscriptionResult)
    })

    it('should pass original blob when provided', async () => {
      vi.mocked(whisperService.transcribe).mockResolvedValue(mockTranscriptionResult)

      const pcmData = new ArrayBuffer(1024)
      const originalBlob = new ArrayBuffer(2048)

      await handlers['whisper:transcribe']({}, pcmData, originalBlob)

      expect(whisperService.transcribe).toHaveBeenCalledWith(pcmData, originalBlob)
    })

    it('should convert Buffer original blob to ArrayBuffer', async () => {
      vi.mocked(whisperService.transcribe).mockResolvedValue(mockTranscriptionResult)

      const pcmData = new ArrayBuffer(1024)
      const originalBlob = Buffer.alloc(2048)

      await handlers['whisper:transcribe']({}, pcmData, originalBlob)

      expect(whisperService.transcribe).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        expect.any(ArrayBuffer)
      )
    })

    it('should throw on invalid data type', async () => {
      await expect(handlers['whisper:transcribe']({}, 'invalid data')).rejects.toThrow(
        'Invalid data type'
      )
    })
  })

  describe('whisper:getMode', () => {
    it('should return whisper mode', async () => {
      vi.mocked(whisperService.getWhisperMode).mockResolvedValue('api')

      const result = await handlers['whisper:getMode']()

      expect(whisperService.getWhisperMode).toHaveBeenCalled()
      expect(result).toBe('api')
    })

    it('should return local mode', async () => {
      vi.mocked(whisperService.getWhisperMode).mockResolvedValue('local')

      const result = await handlers['whisper:getMode']()

      expect(result).toBe('local')
    })
  })

  describe('whisper:isReady', () => {
    it('should return true when whisper is ready', async () => {
      vi.mocked(whisperService.isWhisperReady).mockResolvedValue(true)

      const result = await handlers['whisper:isReady']()

      expect(whisperService.isWhisperReady).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should return false when whisper is not ready', async () => {
      vi.mocked(whisperService.isWhisperReady).mockResolvedValue(false)

      const result = await handlers['whisper:isReady']()

      expect(result).toBe(false)
    })
  })

  describe('whisper:isLoading', () => {
    it('should always return false (legacy endpoint)', () => {
      const result = handlers['whisper:isLoading']()

      expect(result).toBe(false)
    })
  })
})
