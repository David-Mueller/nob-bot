import { ipcMain } from 'electron'
import {
  loadConfig,
  saveConfig,
  getConfig,
  updateXlsxFile,
  removeXlsxFile,
  getActiveFiles,
  findFileForAuftraggeber,
  type AppConfig,
  type XlsxFileConfig
} from '../services/config'
import { scanDirectory, type ScannedFile } from '../services/fileScanner'

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

  // Update base path
  ipcMain.handle('config:setBasePath', async (_event, path: string): Promise<void> => {
    const config = getConfig()
    config.xlsxBasePath = path
    await saveConfig(config)
  })

  // Get base path
  ipcMain.handle('config:getBasePath', (): string => {
    return getConfig().xlsxBasePath
  })

  // Scan directory for XLSX files
  ipcMain.handle('config:scanFiles', async (): Promise<ScannedFile[]> => {
    const basePath = getConfig().xlsxBasePath
    return await scanDirectory(basePath)
  })

  // Update a single XLSX file config
  ipcMain.handle(
    'config:updateFile',
    async (
      _event,
      path: string,
      updates: Partial<Omit<XlsxFileConfig, 'path'>>
    ): Promise<void> => {
      await updateXlsxFile(path, updates)
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
    (_event, auftraggeber: string, jahr: number): XlsxFileConfig | null => {
      return findFileForAuftraggeber(auftraggeber, jahr)
    }
  )

  // Toggle file active status
  ipcMain.handle(
    'config:toggleFileActive',
    async (_event, path: string, active: boolean): Promise<void> => {
      await updateXlsxFile(path, { active })
    }
  )

  // Remove file from config
  ipcMain.handle(
    'config:removeFile',
    async (_event, path: string): Promise<void> => {
      await removeXlsxFile(path)
    }
  )
}
