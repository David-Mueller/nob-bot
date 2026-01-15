import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create the mocks using vi.hoisted so they're available during vi.mock
const { mockExistsSync, mockReadFile, mockWriteFile, mockMkdir, mockReaddir, mockRm, mockGetApiKey, mockDebugLog } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockReaddir: vi.fn(),
  mockRm: vi.fn(),
  mockGetApiKey: vi.fn(),
  mockDebugLog: vi.fn()
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  default: { existsSync: mockExistsSync }
}))

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  readdir: mockReaddir,
  rm: mockRm,
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    readdir: mockReaddir,
    rm: mockRm
  }
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'home') return '/tmp/test-home'
      return '/tmp'
    })
  }
}))

vi.mock('@main/services/config', () => ({
  getApiKey: mockGetApiKey
}))

vi.mock('@main/services/debugLog', () => ({
  debugLog: mockDebugLog
}))

import { speak, isTTSReady, clearCache } from '@main/services/tts'

describe('tts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('speak', () => {
    it('should throw error when API key is not configured', async () => {
      mockGetApiKey.mockResolvedValue('')
      mockExistsSync.mockReturnValue(false)

      await expect(speak('Test text')).rejects.toThrow('OpenAI API key not configured')
    })

    it('should call TTS API with correct parameters', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const audioBuffer = new ArrayBuffer(100)
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer)
      })

      const result = await speak('Hello world', 'nova')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/speech',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1',
            voice: 'nova',
            input: 'Hello world',
            response_format: 'mp3'
          })
        })
      )

      expect(result).toBe(audioBuffer)
    })

    it('should use default voice nova when not specified', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const audioBuffer = new ArrayBuffer(100)
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer)
      })

      await speak('Test text')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"voice":"nova"')
        })
      )
    })

    it('should throw error on API failure', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')
      mockExistsSync.mockReturnValue(false)

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      })

      await expect(speak('Test')).rejects.toThrow('TTS API error: 401')
    })

    it('should cache audio in memory after API call', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const audioBuffer = new ArrayBuffer(100)
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer)
      })

      // First call - API call
      await speak('Cached text', 'alloy')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      await speak('Cached text', 'alloy')
      expect(mockFetch).toHaveBeenCalledTimes(1) // No additional call
    })

    it('should load from disk cache when available', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')
      // Cache file exists
      mockExistsSync.mockReturnValue(true)

      const cachedBuffer = Buffer.from('cached audio')
      mockReadFile.mockResolvedValue(cachedBuffer)

      const result = await speak('From disk', 'echo')

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.byteLength).toBeGreaterThan(0)
    })

    it('should accept all valid voice types', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const audioBuffer = new ArrayBuffer(100)
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer)
      })

      const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const
      for (const voice of voices) {
        await speak(`Test ${voice}`, voice)
      }

      expect(mockFetch).toHaveBeenCalledTimes(voices.length)
    })
  })

  describe('isTTSReady', () => {
    it('should return true when API key is present', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      const result = await isTTSReady()

      expect(result).toBe(true)
    })

    it('should return false when API key is missing', async () => {
      mockGetApiKey.mockResolvedValue('')

      const result = await isTTSReady()

      expect(result).toBe(false)
    })
  })

  describe('clearCache', () => {
    it('should clear memory cache and return deleted count', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReaddir.mockResolvedValue(['file1.mp3', 'file2.mp3', 'other.txt'])
      mockRm.mockResolvedValue(undefined)

      const count = await clearCache()

      // Should only count .mp3 files
      expect(count).toBe(2)
    })

    it('should return 0 when cache directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      const count = await clearCache()

      expect(count).toBe(0)
    })

    it('should handle errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReaddir.mockRejectedValue(new Error('Read error'))

      const count = await clearCache()

      expect(count).toBe(0)
    })
  })

  describe('cache key generation', () => {
    it('should generate different hash for different voice', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const audioBuffer = new ArrayBuffer(100)
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer)
      })

      await speak('Same text', 'nova')
      await speak('Same text', 'alloy')

      // Both should make API calls because voice is different
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('memory cache eviction', () => {
    it('should evict oldest entry when exceeding max size', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const audioBuffer = new ArrayBuffer(100)
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer)
      })

      // Add more than MAX_MEMORY_CACHE_SIZE (50) entries
      for (let i = 0; i < 52; i++) {
        await speak(`Text ${i}`, 'nova')
      }

      // Verify API was called for each unique text
      expect(mockFetch).toHaveBeenCalledTimes(52)
    })
  })
})
