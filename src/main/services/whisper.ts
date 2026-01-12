import OpenAI from 'openai'
import { getApiKey } from './config'

let openaiClient: OpenAI | null = null

export type WhisperMode = 'cloud' | 'none'

export interface TranscriptionResult {
  text: string
  language?: string
  mode: WhisperMode
}

async function initOpenAI(): Promise<OpenAI | null> {
  if (openaiClient) return openaiClient

  const apiKey = await getApiKey()
  if (!apiKey) {
    console.log('[Whisper] No OpenAI API key configured')
    return null
  }

  openaiClient = new OpenAI({ apiKey })
  console.log('[Whisper] OpenAI client initialized')
  return openaiClient
}

export async function transcribe(
  _audioData: Float32Array | ArrayBuffer,
  originalBlob?: ArrayBuffer
): Promise<TranscriptionResult> {
  if (!originalBlob) {
    throw new Error('Audio blob required for cloud transcription')
  }

  const client = await initOpenAI()
  if (!client) {
    throw new Error('OpenAI API key not configured')
  }

  const buffer = Buffer.from(originalBlob)
  const file = new File([buffer], 'audio.webm', { type: 'audio/webm' })

  console.log(`[Whisper] Uploading ${(buffer.length / 1024).toFixed(1)} KB`)

  // First try with auto-detect
  let response = await client.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    response_format: 'verbose_json'
  })

  console.log(`[Whisper] Detected language: ${response.language}`)

  // If not German or Polish, re-transcribe with German forced
  const allowedLanguages = ['german', 'polish', 'de', 'pl']
  if (response.language && !allowedLanguages.includes(response.language.toLowerCase())) {
    console.log(`[Whisper] Re-transcribing with forced German (was: ${response.language})`)

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

export async function initWhisper(): Promise<void> {
  await initOpenAI()
}

export async function isWhisperReady(): Promise<boolean> {
  const apiKey = await getApiKey()
  return !!apiKey
}

export async function getWhisperMode(): Promise<WhisperMode> {
  const apiKey = await getApiKey()
  return apiKey ? 'cloud' : 'none'
}
