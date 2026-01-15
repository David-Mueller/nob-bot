import { ipcMain } from 'electron'
import {
  normalizeText,
  getAllKnownTerms,
  clearGlossarCache,
  ensureGlossar,
  type Glossar,
  type GlossarEintrag
} from '../services/glossar'
import { getActiveFiles, type XlsxFileConfig } from '../services/config'
import { validateExcelPath } from '../utils/pathValidator'
import { ExcelPathSchema, StringInputSchema } from '../schemas/ipcSchemas'

// Current merged glossar from all active files
let currentGlossar: Glossar | null = null

export function registerGlossarHandlers(): void {
  // Load glossar from all active Excel files (creates Glossar sheets if missing)
  ipcMain.handle('glossar:load', async (): Promise<boolean> => {
    await reloadGlossar()
    return currentGlossar !== null
  })

  // Get all known terms for LLM prompts
  ipcMain.handle(
    'glossar:getKnownTerms',
    (): {
      auftraggeber: string[]
      themen: string[]
      kunden: string[]
    } | null => {
      if (!currentGlossar) {
        return null
      }
      return getAllKnownTerms(currentGlossar)
    }
  )

  // Normalize a text using glossar
  ipcMain.handle('glossar:normalize', (_event, text: unknown): string => {
    // Validate text input
    let validatedText: string
    try {
      validatedText = StringInputSchema.parse(text)
    } catch (err) {
      console.error('[Glossar] Invalid text for normalize:', err)
      return typeof text === 'string' ? text : ''
    }

    if (!currentGlossar) {
      return validatedText
    }
    return normalizeText(validatedText, currentGlossar)
  })

  // Get all glossar entries
  ipcMain.handle('glossar:getEntries', (): GlossarEintrag[] => {
    if (!currentGlossar) {
      return []
    }
    return currentGlossar.eintraege
  })

  // Clear glossar cache (useful when files change)
  ipcMain.handle('glossar:clearCache', (): void => {
    clearGlossarCache()
    currentGlossar = null
    console.log('[Glossar] Cache cleared')
  })

  // Create Glossar sheet for a specific file from existing data
  ipcMain.handle(
    'glossar:createFromData',
    async (_event, filePath: unknown, auftraggeber: unknown): Promise<boolean> => {
      try {
        const validatedPath = ExcelPathSchema.parse(filePath)
        const safePath = validateExcelPath(validatedPath)
        const validatedAuftraggeber = StringInputSchema.parse(auftraggeber)

        const glossar = await ensureGlossar(safePath, validatedAuftraggeber)
        if (glossar) {
          // Reload full glossar to include new entries
          await reloadGlossar()
          return true
        }
        return false
      } catch (err) {
        console.error('[Glossar] Invalid createFromData params:', err)
        return false
      }
    }
  )
}

/**
 * Get the current glossar for use in other handlers (e.g., LLM)
 */
export function getCurrentGlossar(): Glossar | null {
  return currentGlossar
}

/**
 * Reload the glossar from active files.
 * Creates Glossar sheets from existing data if they don't exist.
 * Uses parallel loading for better performance.
 */
export async function reloadGlossar(): Promise<void> {
  const activeFiles = getActiveFiles()

  if (activeFiles.length === 0) {
    currentGlossar = null
    return
  }

  // Parallel loading - errors in one file don't block others
  const glossarPromises = activeFiles.map((file) =>
    ensureGlossar(file.path, file.auftraggeber).catch((err) => {
      console.error(`[Glossar] Failed to load ${file.path}:`, err)
      return null
    })
  )

  const results = await Promise.all(glossarPromises)
  const glossars = results.filter((g): g is Glossar => g !== null)

  if (glossars.length === 0) {
    currentGlossar = null
    return
  }

  // Merge all glossars
  currentGlossar = mergeGlossars(glossars)
}

/**
 * Merge multiple glossars into one.
 */
function mergeGlossars(glossars: Glossar[]): Glossar {
  const merged: Glossar = {
    eintraege: [],
    byKategorie: new Map(),
    lookupMap: new Map()
  }

  // Initialize kategorie maps
  const kategorien = ['Auftraggeber', 'Thema', 'Kunde', 'Sonstiges'] as const
  for (const kat of kategorien) {
    merged.byKategorie.set(kat, [])
  }

  for (const glossar of glossars) {
    merged.eintraege.push(...glossar.eintraege)

    for (const [kategorie, entries] of glossar.byKategorie) {
      merged.byKategorie.get(kategorie)!.push(...entries)
    }

    for (const [key, value] of glossar.lookupMap) {
      merged.lookupMap.set(key, value)
    }
  }

  return merged
}
