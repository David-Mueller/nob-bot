import { ipcMain } from 'electron'
import { loadDrafts, saveDrafts, clearDrafts, type DraftActivity } from '../services/drafts'
import { DraftArraySchema } from '../schemas/ipcSchemas'

export function registerDraftsHandlers(): void {
  ipcMain.handle('drafts:load', async (): Promise<DraftActivity[]> => {
    return await loadDrafts()
  })

  ipcMain.handle('drafts:save', async (_event, drafts: unknown): Promise<void> => {
    try {
      const validatedDrafts = DraftArraySchema.parse(drafts) as DraftActivity[]
      await saveDrafts(validatedDrafts)
    } catch (err) {
      console.error('[Drafts] Invalid drafts data:', err)
      throw err
    }
  })

  ipcMain.handle('drafts:clear', async (): Promise<void> => {
    await clearDrafts()
  })
}
