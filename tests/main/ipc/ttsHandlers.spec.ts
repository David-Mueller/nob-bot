import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'

// Mock services before importing handler
vi.mock('@main/services/tts', () => ({
  speak: vi.fn(),
  isTTSReady: vi.fn(),
  clearCache: vi.fn()
}))

import { registerTTSHandlers } from '@main/ipc/ttsHandlers'
import * as ttsService from '@main/services/tts'

describe('ttsHandlers', () => {
  const handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    registerTTSHandlers()
  })

  describe('registerTTSHandlers', () => {
    it('should register all TTS handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('tts:speak', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('tts:isReady', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('tts:clearCache', expect.any(Function))
    })
  })

  describe('tts:speak', () => {
    it('should speak text and return Uint8Array', async () => {
      const mockAudioBuffer = new ArrayBuffer(1024)
      vi.mocked(ttsService.speak).mockResolvedValue(mockAudioBuffer)

      const result = await handlers['tts:speak']({}, 'Hello world')

      expect(ttsService.speak).toHaveBeenCalledWith('Hello world', undefined)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(1024)
    })

    it('should pass voice parameter to speak service', async () => {
      const mockAudioBuffer = new ArrayBuffer(512)
      vi.mocked(ttsService.speak).mockResolvedValue(mockAudioBuffer)

      await handlers['tts:speak']({}, 'Hello world', 'nova')

      expect(ttsService.speak).toHaveBeenCalledWith('Hello world', 'nova')
    })

    it('should handle different voice types', async () => {
      const mockAudioBuffer = new ArrayBuffer(256)
      vi.mocked(ttsService.speak).mockResolvedValue(mockAudioBuffer)

      const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

      for (const voice of voices) {
        await handlers['tts:speak']({}, 'Test', voice)
        expect(ttsService.speak).toHaveBeenCalledWith('Test', voice)
      }
    })

    it('should convert ArrayBuffer to Uint8Array correctly', async () => {
      // Create ArrayBuffer with known content
      const originalBuffer = new ArrayBuffer(4)
      const view = new Uint8Array(originalBuffer)
      view[0] = 1
      view[1] = 2
      view[2] = 3
      view[3] = 4

      vi.mocked(ttsService.speak).mockResolvedValue(originalBuffer)

      const result = await handlers['tts:speak']({}, 'Test')

      expect(result[0]).toBe(1)
      expect(result[1]).toBe(2)
      expect(result[2]).toBe(3)
      expect(result[3]).toBe(4)
    })
  })

  describe('tts:isReady', () => {
    it('should return true when TTS is ready', async () => {
      vi.mocked(ttsService.isTTSReady).mockResolvedValue(true)

      const result = await handlers['tts:isReady']()

      expect(ttsService.isTTSReady).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should return false when TTS is not ready', async () => {
      vi.mocked(ttsService.isTTSReady).mockResolvedValue(false)

      const result = await handlers['tts:isReady']()

      expect(result).toBe(false)
    })
  })

  describe('tts:clearCache', () => {
    it('should clear cache and return count of cleared items', async () => {
      vi.mocked(ttsService.clearCache).mockResolvedValue(5)

      const result = await handlers['tts:clearCache']()

      expect(ttsService.clearCache).toHaveBeenCalled()
      expect(result).toBe(5)
    })

    it('should return 0 when cache is empty', async () => {
      vi.mocked(ttsService.clearCache).mockResolvedValue(0)

      const result = await handlers['tts:clearCache']()

      expect(result).toBe(0)
    })
  })
})
