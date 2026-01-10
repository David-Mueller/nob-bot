import { ipcMain } from 'electron'
import { parseActivity, isLLMReady, type Activity } from '../services/llm'

export function registerLLMHandlers(): void {
  // Parse transcript to activity
  ipcMain.handle(
    'llm:parse',
    async (
      _event,
      transcript: string,
      clients?: string[],
      themes?: string[]
    ): Promise<Activity> => {
      return await parseActivity(transcript, clients, themes)
    }
  )

  // Check if LLM is ready (API key present)
  ipcMain.handle('llm:isReady', (): boolean => {
    return isLLMReady()
  })
}
