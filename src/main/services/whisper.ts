import { pipeline, env } from '@xenova/transformers'
import { app } from 'electron'
import { join } from 'path'
import OpenAI from 'openai'
import { config } from 'dotenv'
import { Readable } from 'stream'
import { getApiKey } from './config'

// Load .env (fallback for API key)
config({ path: join(app.getAppPath(), '.env') })

// Configure cache directory for local models
env.cacheDir = join(app.getPath('userData'), 'models')
env.allowLocalModels = true

type TranscriptionPipeline = Awaited<ReturnType<typeof pipeline<'automatic-speech-recognition'>>>

let localTranscriber: TranscriptionPipeline | null = null
let isLoadingLocal = false
let openaiClient: OpenAI | null = null

export type WhisperMode = 'cloud' | 'local' | 'none'
export type WhisperModel = 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small'

export interface TranscriptionResult {
  text: string
  language?: string
  mode: WhisperMode
  chunks?: Array<{
    text: string
    timestamp: [number, number]
  }>
}

export type ProgressCallback = (progress: {
  status: string
  file?: string
  progress?: number
}) => void

/**
 * Initialize OpenAI client for cloud transcription
 */
function initOpenAI(): OpenAI | null {
  if (openaiClient) return openaiClient

  const apiKey = getApiKey()
  if (!apiKey) {
    console.log('[Whisper] No OpenAI API key - cloud mode unavailable')
    return null
  }

  openaiClient = new OpenAI({ apiKey })
  console.log('[Whisper] OpenAI client initialized')
  return openaiClient
}

/**
 * Initialize local Whisper model (fallback)
 */
export async function initLocalWhisper(
  model: WhisperModel = 'Xenova/whisper-base',
  onProgress?: ProgressCallback
): Promise<void> {
  if (localTranscriber || isLoadingLocal) return

  isLoadingLocal = true
  console.log('[Whisper] Loading local model:', model)

  try {
    localTranscriber = await pipeline('automatic-speech-recognition', model, {
      progress_callback: onProgress
        ? (data: { status: string; file?: string; progress?: number }) => {
            onProgress({
              status: data.status,
              file: data.file,
              progress: data.progress
            })
          }
        : undefined
    })
    console.log('[Whisper] Local model loaded')
  } finally {
    isLoadingLocal = false
  }
}

/**
 * Transcribe using OpenAI Whisper API (cloud)
 */
async function transcribeCloud(audioBuffer: ArrayBuffer): Promise<TranscriptionResult> {
  const client = initOpenAI()
  if (!client) {
    throw new Error('OpenAI client not available')
  }

  // Convert ArrayBuffer to a File-like object for OpenAI
  const buffer = Buffer.from(audioBuffer)

  // Create a File object from the buffer
  const file = new File([buffer], 'audio.webm', { type: 'audio/webm' })

  console.log(`[Whisper Cloud] Uploading ${(buffer.length / 1024).toFixed(1)} KB`)

  // First try with auto-detect
  let response = await client.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    response_format: 'verbose_json'
  })

  console.log(`[Whisper Cloud] Detected language: ${response.language}`)

  // If not German or Polish, re-transcribe with German forced
  const allowedLanguages = ['german', 'polish', 'de', 'pl']
  if (response.language && !allowedLanguages.includes(response.language.toLowerCase())) {
    console.log(`[Whisper Cloud] Re-transcribing with forced German (was: ${response.language})`)

    // Need to create a new File object for the retry
    const retryFile = new File([buffer], 'audio.webm', { type: 'audio/webm' })
    response = await client.audio.transcriptions.create({
      file: retryFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      language: 'de'
    })
  }

  return {
    text: response.text,
    language: response.language,
    mode: 'cloud'
  }
}

/**
 * Transcribe using local Whisper model
 */
async function transcribeLocal(
  audioData: Float32Array | ArrayBuffer
): Promise<TranscriptionResult> {
  if (!localTranscriber) {
    await initLocalWhisper()
  }

  if (!localTranscriber) {
    throw new Error('Local Whisper model not initialized')
  }

  // Convert ArrayBuffer to Float32Array if needed
  let float32Audio: Float32Array
  if (audioData instanceof ArrayBuffer) {
    const byteLength = audioData.byteLength
    const alignedLength = Math.floor(byteLength / 4) * 4
    if (alignedLength !== byteLength) {
      console.warn(`[Whisper Local] Audio buffer trimmed from ${byteLength} to ${alignedLength} bytes`)
      audioData = audioData.slice(0, alignedLength)
    }
    float32Audio = new Float32Array(audioData)
  } else {
    float32Audio = audioData
  }

  console.log(`[Whisper Local] Transcribing ${float32Audio.length} samples (${(float32Audio.length / 16000).toFixed(1)}s)`)

  const options: Record<string, unknown> = {
    task: 'transcribe',
    return_timestamps: false,
    // Force German to avoid misdetection on short phrases
    language: 'german'
  }

  const result = await localTranscriber(float32Audio, options)

  if (Array.isArray(result)) {
    return {
      text: result.map((r) => r.text).join(' '),
      language: (result[0] as { language?: string })?.language,
      mode: 'local'
    }
  }

  const typedResult = result as { text: string; language?: string }
  return {
    text: typedResult.text,
    language: typedResult.language,
    mode: 'local'
  }
}

/**
 * Check if we can reach OpenAI API
 */
async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    await fetch('https://api.openai.com', {
      method: 'HEAD',
      signal: controller.signal
    })

    clearTimeout(timeout)
    return true
  } catch {
    return false
  }
}

/**
 * Main transcription function - tries cloud first, falls back to local
 */
export async function transcribe(
  audioData: Float32Array | ArrayBuffer,
  originalBlob?: ArrayBuffer
): Promise<TranscriptionResult> {
  const hasApiKey = !!process.env.OPENAI_API_KEY

  // Try cloud first if we have API key
  if (hasApiKey && originalBlob) {
    try {
      const online = await isOnline()
      if (online) {
        console.log('[Whisper] Using cloud API')
        return await transcribeCloud(originalBlob)
      } else {
        console.log('[Whisper] Offline - falling back to local')
      }
    } catch (err) {
      console.warn('[Whisper] Cloud failed, falling back to local:', err)
    }
  }

  // Fallback to local
  console.log('[Whisper] Using local model')
  return await transcribeLocal(audioData)
}

/**
 * Initialize whisper - preloads local model as fallback
 */
export async function initWhisper(
  model: WhisperModel = 'Xenova/whisper-base',
  onProgress?: ProgressCallback
): Promise<void> {
  // Initialize OpenAI client
  initOpenAI()

  // Also preload local model as fallback
  await initLocalWhisper(model, onProgress)
}

export function isWhisperReady(): boolean {
  return localTranscriber !== null || !!process.env.OPENAI_API_KEY
}

export function isWhisperLoading(): boolean {
  return isLoadingLocal
}

export function getWhisperMode(): WhisperMode {
  if (process.env.OPENAI_API_KEY) return 'cloud'
  if (localTranscriber) return 'local'
  return 'none'
}

export async function unloadWhisper(): Promise<void> {
  localTranscriber = null
}
