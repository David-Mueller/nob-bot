import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// Drafts file location: ~/.aktivitaeten/drafts.json
const CONFIG_DIR = join(app.getPath('home'), '.aktivitaeten')
const DRAFTS_FILE = join(CONFIG_DIR, 'drafts.json')

export type DraftActivity = {
  id: number
  activity: {
    auftraggeber: string | null
    thema: string | null
    beschreibung: string
    minuten: number | null
    km: number
    auslagen: number
    datum: string | null
  }
  transcript: string
  timestamp: string
  saved: boolean
}

export async function loadDrafts(): Promise<DraftActivity[]> {
  try {
    if (!existsSync(DRAFTS_FILE)) {
      return []
    }

    const content = await readFile(DRAFTS_FILE, 'utf-8')
    const drafts = JSON.parse(content) as DraftActivity[]

    // Only return unsaved drafts
    const unsaved = drafts.filter(d => !d.saved)
    console.log(`[Drafts] Loaded ${unsaved.length} unsaved drafts`)
    return unsaved
  } catch (err) {
    console.error('[Drafts] Failed to load:', err)
    return []
  }
}

export async function saveDrafts(drafts: DraftActivity[]): Promise<void> {
  try {
    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      await mkdir(CONFIG_DIR, { recursive: true })
    }

    // Only save unsaved drafts
    const unsaved = drafts.filter(d => !d.saved)

    await writeFile(DRAFTS_FILE, JSON.stringify(unsaved, null, 2), 'utf-8')
    console.log(`[Drafts] Saved ${unsaved.length} drafts`)
  } catch (err) {
    console.error('[Drafts] Failed to save:', err)
  }
}

export async function clearDrafts(): Promise<void> {
  try {
    await writeFile(DRAFTS_FILE, '[]', 'utf-8')
    console.log('[Drafts] Cleared all drafts')
  } catch (err) {
    console.error('[Drafts] Failed to clear:', err)
  }
}
