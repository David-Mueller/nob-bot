import { ipcMain } from 'electron'
import { parseActivity, parseCorrection, parseFollowUpAnswer, isLLMReady, type Activity } from '../services/llm'
import { getActiveFiles } from '../services/config'
import { getCurrentGlossar } from './glossarHandlers'
import { getAllKnownTerms, normalizeText } from '../services/glossar'

/**
 * Normalize activity fields using glossar
 */
function normalizeActivity(activity: Activity): Activity {
  const glossar = getCurrentGlossar()
  if (!glossar) return activity

  return {
    ...activity,
    auftraggeber: activity.auftraggeber
      ? normalizeText(activity.auftraggeber, glossar)
      : null,
    thema: activity.thema
      ? normalizeText(activity.thema, glossar)
      : null
  }
}

/**
 * Get known terms from glossar and config
 */
function getKnownTermsForLLM(): { clients: string[]; themes: string[] } {
  const glossar = getCurrentGlossar()
  const activeFiles = getActiveFiles()

  // Combine glossar terms with active file clients
  const configClients = [...new Set(activeFiles.map(f => f.auftraggeber))]

  if (glossar) {
    const glossarTerms = getAllKnownTerms(glossar)
    return {
      clients: [...new Set([...configClients, ...glossarTerms.auftraggeber])],
      themes: glossarTerms.themen
    }
  }

  return {
    clients: configClients,
    themes: []
  }
}

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
      // Get known terms from glossar and config if not provided
      if (!clients || clients.length === 0 || !themes || themes.length === 0) {
        const known = getKnownTermsForLLM()
        clients = clients && clients.length > 0 ? clients : known.clients
        themes = themes && themes.length > 0 ? themes : known.themes
        console.log(`[LLM] Using clients: ${clients.join(', ')}`)
        console.log(`[LLM] Using themes: ${themes.join(', ')}`)
      }

      const activity = await parseActivity(transcript, clients, themes)

      // Post-process with glossar normalization
      return normalizeActivity(activity)
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
      const known = getKnownTermsForLLM()
      console.log(`[LLM Correction] Using clients: ${known.clients.join(', ')}`)

      const activity = await parseCorrection(existingActivity, correctionTranscript, known.clients)

      // Post-process with glossar normalization
      return normalizeActivity(activity)
    }
  )

  // Parse follow-up answer to update missing fields
  ipcMain.handle(
    'llm:parseFollowUp',
    async (
      _event,
      existingActivity: Activity,
      userAnswer: string,
      missingFields: string[],
      question: string
    ): Promise<Activity> => {
      const known = getKnownTermsForLLM()
      console.log(`[LLM FollowUp] Missing: ${missingFields.join(', ')}, Answer: "${userAnswer}"`)

      const activity = await parseFollowUpAnswer(
        existingActivity,
        userAnswer,
        missingFields,
        question,
        known.clients,
        known.themes
      )

      // Post-process with glossar normalization
      return normalizeActivity(activity)
    }
  )

  // Check if LLM is ready (API key present)
  ipcMain.handle('llm:isReady', (): boolean => {
    return isLLMReady()
  })
}
