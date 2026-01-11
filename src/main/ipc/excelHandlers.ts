import { ipcMain, dialog, shell } from 'electron'
import { addActivity, getActivities, type Activity as ExcelActivity } from '../services/excel'
import type { Activity as LLMActivity } from '../services/llm'
import { findFileForAuftraggeber, getActiveFiles } from '../services/config'

// Legacy: single file path (for backwards compatibility)
let legacyFilePath: string | null = process.env.EXCEL_FILE_PATH || null

export function setExcelFilePath(path: string): void {
  legacyFilePath = path
  console.log(`[Excel] Legacy file path set: ${path}`)
}

if (legacyFilePath) {
  console.log(`[Excel] Using legacy path from env: ${legacyFilePath}`)
}

// Extract year from datum string (YYYY-MM-DD or DD.MM.YYYY format)
function extractYear(datum: string | null): number {
  if (!datum) return new Date().getFullYear()

  // Try YYYY-MM-DD format
  const isoMatch = datum.match(/^(\d{4})-/)
  if (isoMatch) return parseInt(isoMatch[1], 10)

  // Try DD.MM.YYYY format
  const deMatch = datum.match(/\.(\d{4})$/)
  if (deMatch) return parseInt(deMatch[1], 10)

  return new Date().getFullYear()
}

// Map LLM activity to Excel activity format
function mapToExcelActivity(llmActivity: LLMActivity): ExcelActivity {
  return {
    datum: llmActivity.datum || new Date().toISOString().split('T')[0],
    thema: llmActivity.thema || 'Unbekannt',
    taetigkeit: llmActivity.beschreibung,
    zeit: llmActivity.minuten,
    km: llmActivity.km ?? 0,
    hotel: llmActivity.auslagen ?? 0
  }
}

export function registerExcelHandlers(): void {
  // Set Excel file path
  ipcMain.handle('excel:setPath', (_event, path: string): void => {
    setExcelFilePath(path)
  })

  // Get current file path (legacy)
  ipcMain.handle('excel:getPath', (): string | null => {
    return legacyFilePath
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

  // Open file in system default application
  ipcMain.handle('excel:openFile', async (_event, filePath: string): Promise<boolean> => {
    try {
      await shell.openPath(filePath)
      return true
    } catch (err) {
      console.error('[Excel] Failed to open file:', err)
      return false
    }
  })

  // Save activity to Excel
  ipcMain.handle(
    'excel:saveActivity',
    async (_event, activity: LLMActivity): Promise<{ success: boolean; error?: string; filePath?: string }> => {
      // Try to find file via Auftraggeber+Jahr from config
      let filePath: string | null = null

      if (activity.auftraggeber) {
        const jahr = extractYear(activity.datum)
        const configFile = findFileForAuftraggeber(activity.auftraggeber, jahr)

        if (configFile) {
          filePath = configFile.path
          console.log(`[Excel] Found config file for ${activity.auftraggeber}/${jahr}: ${filePath}`)
        } else {
          console.log(`[Excel] No config file for ${activity.auftraggeber}/${jahr}`)
        }
      }

      // Fallback to legacy path
      if (!filePath && legacyFilePath) {
        filePath = legacyFilePath
        console.log(`[Excel] Using legacy file path: ${filePath}`)
      }

      if (!filePath) {
        // Check if any active files exist
        const activeFiles = getActiveFiles()
        if (activeFiles.length === 0) {
          return { success: false, error: 'Keine aktiven Excel-Dateien konfiguriert. Bitte unter "Dateien" konfigurieren.' }
        }
        return {
          success: false,
          error: `Keine Datei für Auftraggeber "${activity.auftraggeber || 'unbekannt'}" gefunden. Verfügbar: ${activeFiles.map(f => f.auftraggeber).join(', ')}`
        }
      }

      try {
        const excelActivity = mapToExcelActivity(activity)
        await addActivity(filePath, excelActivity)
        return { success: true, filePath }
      } catch (err) {
        console.error('[Excel] Save failed:', err)
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unbekannter Fehler'
        }
      }
    }
  )

  // Get activities for a month (legacy - uses single file)
  ipcMain.handle(
    'excel:getActivities',
    async (_event, month: number): Promise<Array<ExcelActivity & { row: number }>> => {
      if (!legacyFilePath) {
        return []
      }

      try {
        return await getActivities(legacyFilePath, month)
      } catch (err) {
        console.error('[Excel] Read failed:', err)
        return []
      }
    }
  )
}
