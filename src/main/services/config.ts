import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import YAML from 'yaml'
import { storeApiKey, retrieveApiKey, hasStoredApiKey } from './secureStorage'
import type { XlsxFileConfig, AppSettings, AppConfig } from '@shared/types'

// Re-export types for consumers that import from this module
export type { XlsxFileConfig, AppSettings, AppConfig }

// Config file location: ~/.aktivitaeten/config.yaml
const CONFIG_DIR = join(app.getPath('home'), '.aktivitaeten')
const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml')

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
        ...parsed.settings,
        openaiApiKey: '' // Never load API key from YAML into memory
      }
    }

    // Migrate plaintext API key to secure storage if present
    if (parsed.settings?.openaiApiKey) {
      const hasSecureKey = await hasStoredApiKey()
      if (!hasSecureKey) {
        console.log('[Config] Migrating API key to secure storage...')
        await storeApiKey(parsed.settings.openaiApiKey)
        // Remove plaintext key from config file
        parsed.settings.openaiApiKey = ''
        const cleanedContent = YAML.stringify({
          ...parsed,
          settings: { ...parsed.settings, openaiApiKey: undefined }
        })
        await writeFile(CONFIG_FILE, cleanedContent, 'utf-8')
        console.log('[Config] API key migrated and removed from config.yaml')
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

    // Never save API key to YAML - strip it before writing
    const configToSave = {
      ...config,
      settings: {
        ...config.settings,
        openaiApiKey: undefined // Exclude from YAML
      }
    }

    const content = YAML.stringify(configToSave)
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
  // Handle API key separately via secure storage
  if (updates.openaiApiKey !== undefined) {
    await storeApiKey(updates.openaiApiKey)
    console.log('[Config] API key updated in secure storage')
    delete updates.openaiApiKey // Don't store in config object
  }

  currentConfig.settings = {
    ...currentConfig.settings,
    ...updates
  }
  await saveConfig(currentConfig)
  console.log('[Config] Settings updated')
  return currentConfig.settings
}

export async function getApiKey(): Promise<string> {
  // First check secure storage, then fall back to environment variable
  const storedKey = await retrieveApiKey()
  return storedKey || process.env.OPENAI_API_KEY || ''
}
