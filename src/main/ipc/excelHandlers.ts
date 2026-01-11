import { ipcMain, dialog, shell } from 'electron'
import { addActivity, getActivities, type Activity as ExcelActivity } from '../services/excel'
import type { Activity as LLMActivity } from '../services/llm'
import { findFileForAuftraggeber, getActiveFiles } from '../services/config'
import { validateExcelPath } from '../utils/pathValidator'
import { ExcelPathSchema, ActivitySchema, MonthSchema } from '../schemas/ipcSchemas'

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
    // Convert minutes to hours (Excel service expects hours)
    zeit: llmActivity.minuten !== null ? llmActivity.minuten / 60 : null,
    km: llmActivity.km ?? 0,
    hotel: llmActivity.auslagen ?? 0
  }
}

export function registerExcelHandlers(): void {
  // Set Excel file path - validates path before setting
  ipcMain.handle('excel:setPath', (_event, path: unknown): void => {
    try {
      const validated = ExcelPathSchema.parse(path)
      const safePath = validateExcelPath(validated)
      setExcelFilePath(safePath)
    } catch (err) {
      console.error('[Excel] Invalid path for setPath:', err)
      throw err
    }
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
      // Dialog-selected paths are trusted, but still validate for safety
      try {
        const safePath = validateExcelPath(path)
        setExcelFilePath(safePath)
        return safePath
      } catch (err) {
        console.error('[Excel] Dialog path validation failed:', err)
        return null
      }
    }

    return null
  })

  // Open file in system default application
  ipcMain.handle('excel:openFile', async (_event, filePath: unknown): Promise<boolean> => {
    try {
      const validated = ExcelPathSchema.parse(filePath)
      const safePath = validateExcelPath(validated)
      await shell.openPath(safePath)
      return true
    } catch (err) {
      console.error('[Excel] Invalid path for openFile:', err)
      return false
    }
  })

  // Save activity to Excel
  ipcMain.handle(
    'excel:saveActivity',
    async (
      _event,
      activity: unknown
    ): Promise<{ success: boolean; error?: string; filePath?: string }> => {
      // Validate activity input with Zod
      let validatedActivity: LLMActivity
      try {
        validatedActivity = ActivitySchema.parse(activity) as LLMActivity
      } catch (err) {
        console.error('[Excel] Invalid activity data:', err)
        return { success: false, error: 'Ungültige Aktivitätsdaten' }
      }

      // Try to find file via Auftraggeber+Jahr from config
      let filePath: string | null = null

      if (validatedActivity.auftraggeber) {
        const jahr = extractYear(validatedActivity.datum)
        const configFile = findFileForAuftraggeber(validatedActivity.auftraggeber, jahr)

        if (configFile) {
          filePath = configFile.path
          console.log(
            `[Excel] Found config file for ${validatedActivity.auftraggeber}/${jahr}: ${filePath}`
          )
        } else {
          console.log(`[Excel] No config file for ${validatedActivity.auftraggeber}/${jahr}`)
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
          return {
            success: false,
            error: 'Keine aktiven Excel-Dateien konfiguriert. Bitte unter "Dateien" konfigurieren.'
          }
        }
        return {
          success: false,
          error: `Keine Datei für Auftraggeber "${validatedActivity.auftraggeber || 'unbekannt'}" gefunden. Verfügbar: ${activeFiles.map((f) => f.auftraggeber).join(', ')}`
        }
      }

      // Validate the resolved file path
      try {
        const safePath = validateExcelPath(filePath)
        const excelActivity = mapToExcelActivity(validatedActivity)
        await addActivity(safePath, excelActivity)
        return { success: true, filePath: safePath }
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
    async (_event, month: unknown): Promise<Array<ExcelActivity & { row: number }>> => {
      // Validate month input
      let validatedMonth: number
      try {
        validatedMonth = MonthSchema.parse(month)
      } catch (err) {
        console.error('[Excel] Invalid month:', err)
        return []
      }

      if (!legacyFilePath) {
        return []
      }

      try {
        // Validate legacy file path
        const safePath = validateExcelPath(legacyFilePath)
        return await getActivities(safePath, validatedMonth)
      } catch (err) {
        console.error('[Excel] Read failed:', err)
        return []
      }
    }
  )
}
