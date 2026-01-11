import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import YAML from 'yaml'

// Config file location: ~/.aktivitaeten/config.yaml
const CONFIG_DIR = join(app.getPath('home'), '.aktivitaeten')
const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml')

export type XlsxFileConfig = {
  path: string
  auftraggeber: string
  jahr: number
  active: boolean
}

export type AppSettings = {
  hotkey: string
  openaiApiKey: string
  whisperModel: 'tiny' | 'base' | 'small'
  ttsEnabled: boolean
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

export type AppConfig = {
  // Base path pattern for scanning XLSX files
  xlsxBasePath: string
  // List of known XLSX files with their status
  xlsxFiles: XlsxFileConfig[]
  // App settings
  settings: AppSettings
}

const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'CommandOrControl+Shift+R',
  openaiApiKey: '',
  whisperModel: 'base',
  ttsEnabled: false,
  ttsVoice: 'nova'
}

const DEFAULT_CONFIG: AppConfig = {
  xlsxBasePath: 'D:\\C-Con\\AL-kas',
  xlsxFiles: [],
  settings: { ...DEFAULT_SETTINGS }
}

let currentConfig: AppConfig = { ...DEFAULT_CONFIG }

export async function loadConfig(): Promise<AppConfig> {
  try {
    if (!existsSync(CONFIG_FILE)) {
      console.log('[Config] No config file found, using defaults')
      return currentConfig
    }

    const content = await readFile(CONFIG_FILE, 'utf-8')
    const parsed = YAML.parse(content) as Partial<AppConfig>

    currentConfig = {
      xlsxBasePath: parsed.xlsxBasePath || DEFAULT_CONFIG.xlsxBasePath,
      xlsxFiles: parsed.xlsxFiles || [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...parsed.settings
      }
    }

    console.log(`[Config] Loaded from ${CONFIG_FILE}`)
    return currentConfig
  } catch (err) {
    console.error('[Config] Failed to load:', err)
    return currentConfig
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      await mkdir(CONFIG_DIR, { recursive: true })
    }

    const content = YAML.stringify(config)
    await writeFile(CONFIG_FILE, content, 'utf-8')

    currentConfig = config
    console.log(`[Config] Saved to ${CONFIG_FILE}`)
  } catch (err) {
    console.error('[Config] Failed to save:', err)
    throw err
  }
}

export function getConfig(): AppConfig {
  return currentConfig
}

export async function updateXlsxFile(
  path: string,
  updates: Partial<Omit<XlsxFileConfig, 'path'>>
): Promise<void> {
  const index = currentConfig.xlsxFiles.findIndex(f => f.path === path)

  if (index >= 0) {
    currentConfig.xlsxFiles[index] = {
      ...currentConfig.xlsxFiles[index],
      ...updates
    }
  } else {
    currentConfig.xlsxFiles.push({
      path,
      auftraggeber: updates.auftraggeber || '',
      jahr: updates.jahr || new Date().getFullYear(),
      active: updates.active ?? false
    })
  }

  await saveConfig(currentConfig)
}

export function getActiveFiles(): XlsxFileConfig[] {
  return currentConfig.xlsxFiles.filter(f => f.active)
}

export async function removeXlsxFile(path: string): Promise<void> {
  currentConfig.xlsxFiles = currentConfig.xlsxFiles.filter(f => f.path !== path)
  await saveConfig(currentConfig)
  console.log(`[Config] Removed file: ${path}`)
}

export function findFileForAuftraggeber(
  auftraggeber: string,
  jahr: number
): XlsxFileConfig | null {
  const normalized = auftraggeber.toLowerCase().trim()

  return currentConfig.xlsxFiles.find(f =>
    f.active &&
    f.jahr === jahr &&
    f.auftraggeber.toLowerCase().trim() === normalized
  ) || null
}

// Settings functions
export function getSettings(): AppSettings {
  return currentConfig.settings
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  currentConfig.settings = {
    ...currentConfig.settings,
    ...updates
  }
  await saveConfig(currentConfig)
  console.log('[Config] Settings updated')
  return currentConfig.settings
}

export function getApiKey(): string {
  // First check settings, then fall back to environment variable
  return currentConfig.settings.openaiApiKey || process.env.OPENAI_API_KEY || ''
}
