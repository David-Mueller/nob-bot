import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { getApiKey } from './config'
import { debugLog } from './debugLog'

/**
 * Text-to-Speech service using OpenAI TTS API.
 * Includes caching for repeated phrases (follow-up questions).
 */

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

const TTS_API_URL = 'https://api.openai.com/v1/audio/speech'
const MAX_MEMORY_CACHE_SIZE = 50

// In-memory cache for fast access
const memoryCache = new Map<string, ArrayBuffer>()

// Disk cache directory
let cacheDir: string | null = null

function getCacheDir(): string {
  if (!cacheDir) {
    cacheDir = join(app.getPath('home'), '.aktivitaeten', 'tts-cache')
  }
  return cacheDir
}

// Generate cache key from text and voice
function getCacheKey(text: string, voice: TTSVoice): string {
  const hash = createHash('sha256').update(`${voice}:${text}`).digest('hex')
  return hash
}

// Get cache file path
function getCacheFilePath(cacheKey: string): string {
  return join(getCacheDir(), `${cacheKey}.mp3`)
}

// Try to load from disk cache
async function loadFromDiskCache(cacheKey: string): Promise<ArrayBuffer | null> {
  try {
    const filePath = getCacheFilePath(cacheKey)
    if (existsSync(filePath)) {
      const buffer = await readFile(filePath)
      debugLog('TTS', `Cache hit (disk): ${cacheKey}`)
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }
  } catch {
    // Ignore disk cache errors
  }
  return null
}

// Save to disk cache
async function saveToDiskCache(cacheKey: string, data: ArrayBuffer): Promise<void> {
  try {
    const dir = getCacheDir()
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    const filePath = getCacheFilePath(cacheKey)
    await writeFile(filePath, Buffer.from(data))
    debugLog('TTS', `Cached to disk: ${cacheKey}`)
  } catch (err) {
    debugLog('TTS', `Failed to cache to disk: ${err}`)
  }
}

/**
 * Convert text to speech using OpenAI TTS API.
 * Returns audio data as ArrayBuffer (MP3 format).
 * Uses caching for repeated phrases.
 */
export async function speak(
  text: string,
  voice: TTSVoice = 'nova'
): Promise<ArrayBuffer> {
  const cacheKey = getCacheKey(text, voice)

  // Check memory cache first
  const memoryCached = memoryCache.get(cacheKey)
  if (memoryCached) {
    debugLog('TTS', `Cache hit (memory): "${text.substring(0, 30)}..."`)
    return memoryCached
  }

  // Check disk cache
  const diskCached = await loadFromDiskCache(cacheKey)
  if (diskCached) {
    // Store in memory cache for faster subsequent access
    memoryCache.set(cacheKey, diskCached)
    // Evict oldest entry when cache exceeds limit
    if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
      const firstKey = memoryCache.keys().next().value
      if (firstKey) memoryCache.delete(firstKey)
    }
    return diskCached
  }

  // Cache miss - call API
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  debugLog('TTS', `API call: "${text.substring(0, 50)}..."`)

  const response = await fetch(TTS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    debugLog('TTS', `API error: ${error}`)
    throw new Error(`TTS API error: ${response.status}`)
  }

  const audioData = await response.arrayBuffer()
  debugLog('TTS', `Generated ${audioData.byteLength} bytes`)

  // Store in both caches
  memoryCache.set(cacheKey, audioData)
  // Evict oldest entry when cache exceeds limit
  if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
    const firstKey = memoryCache.keys().next().value
    if (firstKey) memoryCache.delete(firstKey)
  }
  saveToDiskCache(cacheKey, audioData) // Non-blocking

  return audioData
}

/**
 * Check if TTS is available (API key present).
 */
export async function isTTSReady(): Promise<boolean> {
  const apiKey = await getApiKey()
  return !!apiKey
}

/**
 * Clear the TTS cache (both memory and disk).
 * Returns the number of files deleted.
 */
export async function clearCache(): Promise<number> {
  memoryCache.clear()
  debugLog('TTS', 'Memory cache cleared')

  // Clear disk cache
  let deletedCount = 0
  try {
    const dir = getCacheDir()
    if (existsSync(dir)) {
      const files = await readdir(dir)
      const deletePromises = files
        .filter(f => f.endsWith('.mp3'))
        .map(f => rm(join(dir, f)).catch(() => {}))
      await Promise.all(deletePromises)
      deletedCount = deletePromises.length
      debugLog('TTS', `Deleted ${deletedCount} cached audio files`)
    }
  } catch (err) {
    debugLog('TTS', `Error clearing disk cache: ${err}`)
  }

  return deletedCount
}
