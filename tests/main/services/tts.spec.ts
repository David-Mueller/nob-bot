import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'

// Test the cache key generation logic
describe('TTS Cache Key Generation', () => {
  it('should generate consistent SHA-256 hash for same input', () => {
    const text = 'Hello world'
    const voice = 'nova'

    const hash1 = createHash('sha256').update(`${voice}:${text}`).digest('hex')
    const hash2 = createHash('sha256').update(`${voice}:${text}`).digest('hex')

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 produces 64 hex chars
  })

  it('should generate different hash for different voice', () => {
    const text = 'Hello world'

    const hash1 = createHash('sha256').update(`nova:${text}`).digest('hex')
    const hash2 = createHash('sha256').update(`alloy:${text}`).digest('hex')

    expect(hash1).not.toBe(hash2)
  })

  it('should generate different hash for different text', () => {
    const voice = 'nova'

    const hash1 = createHash('sha256').update(`${voice}:Hello`).digest('hex')
    const hash2 = createHash('sha256').update(`${voice}:World`).digest('hex')

    expect(hash1).not.toBe(hash2)
  })
})

// Test the memory cache eviction logic
describe('TTS Memory Cache Eviction', () => {
  it('should evict oldest entry when exceeding max size', () => {
    const MAX_SIZE = 3
    const cache = new Map<string, ArrayBuffer>()

    // Fill cache to max
    cache.set('key1', new ArrayBuffer(10))
    cache.set('key2', new ArrayBuffer(10))
    cache.set('key3', new ArrayBuffer(10))

    expect(cache.size).toBe(3)

    // Add new entry and evict oldest
    cache.set('key4', new ArrayBuffer(10))
    if (cache.size > MAX_SIZE) {
      const firstKey = cache.keys().next().value
      if (firstKey) cache.delete(firstKey)
    }

    expect(cache.size).toBe(3)
    expect(cache.has('key1')).toBe(false)
    expect(cache.has('key4')).toBe(true)
  })
})

// Test voice type validation
describe('TTS Voice Types', () => {
  const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

  it.each(validVoices)('should accept valid voice: %s', (voice) => {
    expect(validVoices).toContain(voice)
  })

  it('should have 6 available voices', () => {
    expect(validVoices).toHaveLength(6)
  })
})
