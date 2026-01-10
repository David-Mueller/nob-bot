import { ipcMain } from 'electron'
import { parseActivity, parseCorrection, isLLMReady, type Activity } from '../services/llm'
import { getActiveFiles } from '../services/config'

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
      // Get active clients from config if none provided
      if (!clients || clients.length === 0) {
        const activeFiles = getActiveFiles()
        clients = [...new Set(activeFiles.map(f => f.auftraggeber))]
        console.log(`[LLM] Using active clients from config: ${clients.join(', ')}`)
      }
      return await parseActivity(transcript, clients, themes)
    }
  )

  // Parse correction to update existing activity
  ipcMain.handle(
    'llm:parseCorrection',
    async (
      _event,
      existingActivity: Activity,
      correctionTranscript: string
    ): Promise<Activity> => {
      // Get active clients from config for correction too
      const activeFiles = getActiveFiles()
      const clients = [...new Set(activeFiles.map(f => f.auftraggeber))]
      console.log(`[LLM Correction] Using active clients: ${clients.join(', ')}`)
      return await parseCorrection(existingActivity, correctionTranscript, clients)
    }
  )

  // Check if LLM is ready (API key present)
  ipcMain.handle('llm:isReady', (): boolean => {
    return isLLMReady()
  })
}
