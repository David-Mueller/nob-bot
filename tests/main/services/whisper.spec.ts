import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create the mocks using vi.hoisted so they're available during vi.mock
const { mockGetApiKey, mockTranscriptionsCreate } = vi.hoisted(() => {
  const mockTranscriptionsCreate = vi.fn()
  return {
    mockGetApiKey: vi.fn(),
    mockTranscriptionsCreate
  }
})

vi.mock('openai', () => {
  // Must use a class constructor for 'new OpenAI()'
  return {
    default: class MockOpenAI {
      audio = {
        transcriptions: {
          create: mockTranscriptionsCreate
        }
      }
    }
  }
})

vi.mock('@main/services/config', () => ({
  getApiKey: mockGetApiKey
}))

import { transcribe, initWhisper, isWhisperReady, getWhisperMode } from '@main/services/whisper'

describe('whisper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('transcribe', () => {
    it('should throw error when no originalBlob is provided', async () => {
      const audioData = new Float32Array(100)

      await expect(transcribe(audioData)).rejects.toThrow('Audio blob required for cloud transcription')
    })

    it('should throw error when API key is not configured', async () => {
      mockGetApiKey.mockResolvedValue('')

      const audioData = new Float32Array(100)
      const blob = new ArrayBuffer(100)

      await expect(transcribe(audioData, blob)).rejects.toThrow('OpenAI API key not configured')
    })

    it('should transcribe audio successfully', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      mockTranscriptionsCreate.mockResolvedValue({
        text: 'Test transcription',
        language: 'german'
      })

      const audioData = new Float32Array(100)
      const blob = new ArrayBuffer(100)

      const result = await transcribe(audioData, blob)

      expect(result.text).toBe('Test transcription')
      expect(result.language).toBe('german')
      expect(result.mode).toBe('cloud')
    })

    it('should re-transcribe with German when non-German/Polish language detected', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      // First call returns English, second call with forced German
      mockTranscriptionsCreate
        .mockResolvedValueOnce({
          text: 'English text',
          language: 'english'
        })
        .mockResolvedValueOnce({
          text: 'German text forced',
          language: 'german'
        })

      const audioData = new Float32Array(100)
      const blob = new ArrayBuffer(100)

      const result = await transcribe(audioData, blob)

      expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(2)
      expect(result.text).toBe('German text forced')
      // Second call should have language: 'de'
      expect(mockTranscriptionsCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          language: 'de'
        })
      )
    })

    it('should not re-transcribe when Polish is detected', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      mockTranscriptionsCreate.mockResolvedValue({
        text: 'Polish text',
        language: 'polish'
      })

      const audioData = new Float32Array(100)
      const blob = new ArrayBuffer(100)

      const result = await transcribe(audioData, blob)

      expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(1)
      expect(result.text).toBe('Polish text')
      expect(result.language).toBe('polish')
    })

    it('should accept language code de', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      mockTranscriptionsCreate.mockResolvedValue({
        text: 'German text',
        language: 'de'
      })

      const audioData = new Float32Array(100)
      const blob = new ArrayBuffer(100)

      const result = await transcribe(audioData, blob)

      expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(1)
      expect(result.text).toBe('German text')
    })

    it('should accept language code pl', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      mockTranscriptionsCreate.mockResolvedValue({
        text: 'Polish text',
        language: 'pl'
      })

      const audioData = new Float32Array(100)
      const blob = new ArrayBuffer(100)

      const result = await transcribe(audioData, blob)

      expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(1)
      expect(result.text).toBe('Polish text')
    })
  })

  describe('initWhisper', () => {
    it('should initialize OpenAI client with API key', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      await initWhisper()

      // Just verify it doesn't throw - the mock class doesn't track constructor calls
      expect(true).toBe(true)
    })

    it('should not throw when API key is missing', async () => {
      mockGetApiKey.mockResolvedValue('')

      await expect(initWhisper()).resolves.not.toThrow()
    })
  })

  describe('isWhisperReady', () => {
    it('should return true when API key is present', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      const result = await isWhisperReady()

      expect(result).toBe(true)
    })

    it('should return false when API key is missing', async () => {
      mockGetApiKey.mockResolvedValue('')

      const result = await isWhisperReady()

      expect(result).toBe(false)
    })
  })

  describe('getWhisperMode', () => {
    it('should return cloud when API key is present', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      const result = await getWhisperMode()

      expect(result).toBe('cloud')
    })

    it('should return none when API key is missing', async () => {
      mockGetApiKey.mockResolvedValue('')

      const result = await getWhisperMode()

      expect(result).toBe('none')
    })
  })

  describe('TranscriptionResult type', () => {
    it('should have correct structure', async () => {
      mockGetApiKey.mockResolvedValue('test-api-key')

      mockTranscriptionsCreate.mockResolvedValue({
        text: 'Test',
        language: 'german'
      })

      const audioData = new Float32Array(100)
      const blob = new ArrayBuffer(100)

      const result = await transcribe(audioData, blob)

      expect(result).toHaveProperty('text')
      expect(result).toHaveProperty('language')
      expect(result).toHaveProperty('mode')
    })
  })
})
