import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs'

let LOG_DIR: string
let LOG_FILE: string
let initialized = false

function initPaths(): void {
  if (initialized) return

  LOG_DIR = join(app.getPath('home'), '.aktivitaeten')
  LOG_FILE = join(LOG_DIR, 'debug.log')

  // Ensure log directory exists
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }

  // Start new log session
  writeFileSync(LOG_FILE, `=== Log Started: ${new Date().toISOString()} ===\n`)
  initialized = true
}

/**
 * Initialize logging (called on app start).
 */
export function initLogging(): void {
  initPaths()
}

/**
 * Log message to console and file.
 */
export function debugLog(category: string, message: string, data?: unknown): void {
  // Ensure paths are initialized
  if (!initialized) initPaths()

  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [${category}] ${message}${data !== undefined ? ` | ${JSON.stringify(data)}` : ''}\n`

  // Always log to console
  console.log(`[${category}] ${message}`, data !== undefined ? data : '')

  // Always write to file
  if (LOG_FILE) {
    try {
      appendFileSync(LOG_FILE, logLine)
    } catch {
      // Ignore file write errors
    }
  }
}

export function getLogFilePath(): string {
  if (!initialized) initPaths()
  return LOG_FILE
}

export async function readLogFile(): Promise<string> {
  if (!initialized) initPaths()
  try {
    if (existsSync(LOG_FILE)) {
      return readFileSync(LOG_FILE, 'utf-8')
    }
    return '(Log file does not exist yet)'
  } catch (err) {
    return `(Error reading log: ${err})`
  }
}
