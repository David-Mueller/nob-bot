import { getApiKey } from './config'

/**
 * Text-to-Speech service using OpenAI TTS API.
 * Used for speaking follow-up questions to the user.
 */

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

const TTS_API_URL = 'https://api.openai.com/v1/audio/speech'

/**
 * Convert text to speech using OpenAI TTS API.
 * Returns audio data as ArrayBuffer (MP3 format).
 */
export async function speak(
  text: string,
  voice: TTSVoice = 'nova'
): Promise<ArrayBuffer> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  console.log(`[TTS] Speaking: "${text.substring(0, 50)}..."`)

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
    console.error('[TTS] API error:', error)
    throw new Error(`TTS API error: ${response.status}`)
  }

  const audioData = await response.arrayBuffer()
  console.log(`[TTS] Generated ${audioData.byteLength} bytes of audio`)

  return audioData
}

/**
 * Check if TTS is available (API key present).
 */
export async function isTTSReady(): Promise<boolean> {
  const apiKey = await getApiKey()
  return !!apiKey
}
