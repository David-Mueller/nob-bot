import { ipcMain } from 'electron'
import {
  loadGlossar,
  loadGlossarsFromPaths,
  normalizeText,
  getAllKnownTerms,
  clearGlossarCache,
  ensureGlossar,
  type Glossar,
  type GlossarEintrag
} from '../services/glossar'
import { getActiveFiles, type XlsxFileConfig } from '../services/config'

// Current merged glossar from all active files
let currentGlossar: Glossar | null = null

export function registerGlossarHandlers(): void {
  // Load glossar from all active Excel files
  ipcMain.handle('glossar:load', async (): Promise<boolean> => {
    const activeFiles = getActiveFiles()
    const paths = activeFiles.map(f => f.path)

    if (paths.length === 0) {
      console.log('[Glossar] No active files to load glossar from')
      currentGlossar = null
      return false
    }

    currentGlossar = await loadGlossarsFromPaths(paths)
    return currentGlossar !== null
  })

  // Get all known terms for LLM prompts
  ipcMain.handle('glossar:getKnownTerms', (): {
    auftraggeber: string[]
    themen: string[]
    kunden: string[]
  } | null => {
    if (!currentGlossar) {
      return null
    }
    return getAllKnownTerms(currentGlossar)
  })

  // Normalize a text using glossar
  ipcMain.handle('glossar:normalize', (_event, text: string): string => {
    if (!currentGlossar) {
      return text
    }
    return normalizeText(text, currentGlossar)
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
    async (_event, filePath: string, auftraggeber: string): Promise<boolean> => {
      const glossar = await ensureGlossar(filePath, auftraggeber)
      if (glossar) {
        // Reload full glossar to include new entries
        await reloadGlossar()
        return true
      }
      return false
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
 */
export async function reloadGlossar(): Promise<void> {
  const activeFiles = getActiveFiles()

  if (activeFiles.length === 0) {
    currentGlossar = null
    return
  }

  // Ensure each file has a Glossar sheet (create if missing)
  const glossars: Glossar[] = []
  for (const file of activeFiles) {
    const glossar = await ensureGlossar(file.path, file.auftraggeber)
    if (glossar) {
      glossars.push(glossar)
    }
  }

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
