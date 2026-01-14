import { ipcMain, dialog } from 'electron'
import { stat, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getLogFilePath, readLogFile } from '../services/debugLog'
import {
  loadConfig,
  saveConfig,
  getConfig,
  updateXlsxFile,
  removeXlsxFile,
  getActiveFiles,
  findFileForAuftraggeber,
  getSettings,
  updateSettings,
  type AppConfig,
  type XlsxFileConfig,
  type AppSettings
} from '../services/config'
import { scanDirectory, type ScannedFile } from '../services/fileScanner'
import { validatePath, validateExcelPath } from '../utils/pathValidator'
import {
  FilePathSchema,
  ExcelPathSchema,
  SettingsUpdateSchema,
  FileConfigUpdateSchema,
  AuftraggeberLookupSchema
} from '../schemas/ipcSchemas'

export function registerConfigHandlers(): void {
  // Load config from file
  ipcMain.handle('config:load', async (): Promise<AppConfig> => {
    return await loadConfig()
  })

  // Save entire config
  ipcMain.handle('config:save', async (_event, config: AppConfig): Promise<void> => {
    await saveConfig(config)
  })

  // Get current config (in memory)
  ipcMain.handle('config:get', (): AppConfig => {
    return getConfig()
  })

  // Update base path - validates path and ensures it's a directory
  // NOTE: Does NOT use validatePath because we're setting a NEW allowed base path
  ipcMain.handle('config:setBasePath', async (_event, path: unknown): Promise<void> => {
    console.log(`[Config] setBasePath called with:`, path, `(type: ${typeof path})`)

    try {
      const validated = FilePathSchema.parse(path)
      console.log(`[Config] After schema parse:`, validated)

      // Basic security: block path traversal
      if (validated.includes('..')) {
        throw new Error('Path traversal not allowed')
      }

      // Verify directory exists
      console.log(`[Config] Checking if path exists...`)
      const stats = await stat(validated)
      console.log(`[Config] Stats:`, { isDirectory: stats.isDirectory(), isFile: stats.isFile() })

      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory')
      }

      // Remove trailing slashes for consistent storage
      const cleanPath = validated.replace(/[\\/]+$/, '')

      const config = getConfig()
      config.xlsxBasePath = cleanPath
      await saveConfig(config)
      console.log(`[Config] Base path set to: ${cleanPath}`)
    } catch (err) {
      console.error('[Config] Invalid base path:', err)
      throw err
    }
  })

  // Get base path
  ipcMain.handle('config:getBasePath', (): string => {
    return getConfig().xlsxBasePath
  })

  // Browse for folder
  ipcMain.handle('config:browseFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Ordner auswählen',
      properties: ['openDirectory']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  // Scan directory for XLSX files
  ipcMain.handle('config:scanFiles', async (): Promise<ScannedFile[]> => {
    const basePath = getConfig().xlsxBasePath
    console.log(`[Config] scanFiles called, basePath from config: "${basePath}"`)
    const results = await scanDirectory(basePath)
    console.log(`[Config] scanFiles returning ${results.length} files`)
    return results
  })

  // Update a single XLSX file config
  ipcMain.handle(
    'config:updateFile',
    async (
      _event,
      path: unknown,
      updates: unknown
    ): Promise<void> => {
      try {
        const validatedPath = ExcelPathSchema.parse(path)
        const safePath = validateExcelPath(validatedPath)
        const validatedUpdates = FileConfigUpdateSchema.parse(updates)
        await updateXlsxFile(safePath, validatedUpdates)
      } catch (err) {
        console.error('[Config] Invalid file update:', err)
        throw err
      }
    }
  )

  // Get all configured files
  ipcMain.handle('config:getFiles', (): XlsxFileConfig[] => {
    return getConfig().xlsxFiles
  })

  // Get only active files
  ipcMain.handle('config:getActiveFiles', (): XlsxFileConfig[] => {
    return getActiveFiles()
  })

  // Find file for auftraggeber and year
  ipcMain.handle(
    'config:findFile',
    (_event, auftraggeber: unknown, jahr: unknown): XlsxFileConfig | null => {
      try {
        const validated = AuftraggeberLookupSchema.parse({ auftraggeber, jahr })
        return findFileForAuftraggeber(validated.auftraggeber, validated.jahr)
      } catch (err) {
        console.error('[Config] Invalid auftraggeber lookup:', err)
        return null
      }
    }
  )

  // Toggle file active status
  ipcMain.handle(
    'config:toggleFileActive',
    async (_event, path: unknown, active: unknown): Promise<void> => {
      try {
        const validatedPath = ExcelPathSchema.parse(path)
        const safePath = validateExcelPath(validatedPath)
        const validatedActive = typeof active === 'boolean' ? active : false
        await updateXlsxFile(safePath, { active: validatedActive })
      } catch (err) {
        console.error('[Config] Invalid toggle file active:', err)
        throw err
      }
    }
  )

  // Remove file from config
  ipcMain.handle('config:removeFile', async (_event, path: unknown): Promise<void> => {
    try {
      const validatedPath = ExcelPathSchema.parse(path)
      const safePath = validateExcelPath(validatedPath)
      await removeXlsxFile(safePath)
    } catch (err) {
      console.error('[Config] Invalid remove file:', err)
      throw err
    }
  })

  // Get settings
  ipcMain.handle('config:getSettings', async (): Promise<AppSettings> => {
    return await getSettings()
  })

  // Update settings
  ipcMain.handle(
    'config:updateSettings',
    async (_event, updates: unknown): Promise<AppSettings> => {
      try {
        const validatedUpdates = SettingsUpdateSchema.parse(updates)
        return await updateSettings(validatedUpdates)
      } catch (err) {
        console.error('[Config] Invalid settings update:', err)
        throw err
      }
    }
  )

  // Debug: get diagnostic info about path and files
  ipcMain.handle('config:debugInfo', async (): Promise<{
    basePath: string
    pathExists: boolean
    allFiles: string[]
    xlsxFiles: string[]
    lvFiles: string[]
    error: string | null
  }> => {
    const basePath = getConfig().xlsxBasePath
    const result = {
      basePath,
      pathExists: false,
      allFiles: [] as string[],
      xlsxFiles: [] as string[],
      lvFiles: [] as string[],
      error: null as string | null
    }

    try {
      result.pathExists = existsSync(basePath)

      if (result.pathExists) {
        result.allFiles = await readdir(basePath)
        result.xlsxFiles = result.allFiles.filter(f => f.toLowerCase().endsWith('.xlsx'))
        result.lvFiles = result.xlsxFiles.filter(f => f.toLowerCase().startsWith('lv'))
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err)
    }

    return result
  })

  // Debug: get log file path
  ipcMain.handle('debug:getLogPath', (): string => {
    return getLogFilePath()
  })

  // Debug: read log file contents
  ipcMain.handle('debug:readLog', async (): Promise<string> => {
    return await readLogFile()
  })
}
