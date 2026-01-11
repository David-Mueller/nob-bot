import { ipcMain } from 'electron'
import { speak, isTTSReady, type TTSVoice } from '../services/tts'

export function registerTTSHandlers(): void {
  // Speak text using TTS
  // Return as Uint8Array for proper IPC serialization (ArrayBuffer doesn't transfer well)
  ipcMain.handle(
    'tts:speak',
    async (_event, text: string, voice?: TTSVoice): Promise<Uint8Array> => {
      const audioBuffer = await speak(text, voice)
      return new Uint8Array(audioBuffer)
    }
  )

  // Check if TTS is ready (API key present)
  ipcMain.handle('tts:isReady', async (): Promise<boolean> => {
    return await isTTSReady()
  })
}
