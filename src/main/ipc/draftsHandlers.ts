import { ipcMain } from 'electron'
import { loadDrafts, saveDrafts, clearDrafts, type DraftActivity } from '../services/drafts'

export function registerDraftsHandlers(): void {
  ipcMain.handle('drafts:load', async (): Promise<DraftActivity[]> => {
    return await loadDrafts()
  })

  ipcMain.handle('drafts:save', async (_event, drafts: DraftActivity[]): Promise<void> => {
    await saveDrafts(drafts)
  })

  ipcMain.handle('drafts:clear', async (): Promise<void> => {
    await clearDrafts()
  })
}
