import { ipcMain, dialog } from 'electron'
import { addActivity, getActivities, type Activity as ExcelActivity } from '../services/excel'
import type { Activity as LLMActivity } from '../services/llm'

// Excel file path - from env or user selection
let excelFilePath: string | null = process.env.EXCEL_FILE_PATH || null

export function setExcelFilePath(path: string): void {
  excelFilePath = path
  console.log(`[Excel] File path set: ${path}`)
}

if (excelFilePath) {
  console.log(`[Excel] Using path from env: ${excelFilePath}`)
}

// Map LLM activity to Excel activity format
function mapToExcelActivity(llmActivity: LLMActivity): ExcelActivity {
  // Combine auftraggeber and thema for the Excel "thema" column
  const themaParts: string[] = []
  if (llmActivity.auftraggeber) themaParts.push(llmActivity.auftraggeber)
  if (llmActivity.thema) themaParts.push(llmActivity.thema)

  return {
    datum: llmActivity.datum || new Date().toISOString().split('T')[0],
    thema: themaParts.join(' / ') || 'Unbekannt',
    taetigkeit: llmActivity.beschreibung,
    zeit: llmActivity.stunden,
    km: llmActivity.km ?? 0,
    hotel: llmActivity.auslagen ?? 0
  }
}

export function registerExcelHandlers(): void {
  // Set Excel file path
  ipcMain.handle('excel:setPath', (_event, path: string): void => {
    setExcelFilePath(path)
  })

  // Get current file path
  ipcMain.handle('excel:getPath', (): string | null => {
    return excelFilePath
  })

  // Open file picker to select Excel file
  ipcMain.handle('excel:selectFile', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Excel-Datei auswählen',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const path = result.filePaths[0]
      setExcelFilePath(path)
      return path
    }

    return null
  })

  // Save activity to Excel
  ipcMain.handle(
    'excel:saveActivity',
    async (_event, activity: LLMActivity): Promise<{ success: boolean; error?: string }> => {
      if (!excelFilePath) {
        return { success: false, error: 'Kein Excel-Pfad konfiguriert' }
      }

      try {
        const excelActivity = mapToExcelActivity(activity)
        await addActivity(excelFilePath, excelActivity)
        return { success: true }
      } catch (err) {
        console.error('[Excel] Save failed:', err)
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unbekannter Fehler'
        }
      }
    }
  )

  // Get activities for a month
  ipcMain.handle(
    'excel:getActivities',
    async (_event, month: number): Promise<Array<ExcelActivity & { row: number }>> => {
      if (!excelFilePath) {
        return []
      }

      try {
        return await getActivities(excelFilePath, month)
      } catch (err) {
        console.error('[Excel] Read failed:', err)
        return []
      }
    }
  )
}
