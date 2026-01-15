import { safeStorage } from 'electron'
import { join } from 'path'
import { app } from 'electron'
import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'

// Secure storage location: ~/.aktivitaeten/secure/
const SECURE_DIR = join(app.getPath('home'), '.aktivitaeten', 'secure')
const API_KEY_FILE = join(SECURE_DIR, 'openai.key')

async function ensureSecureDir(): Promise<void> {
  if (!existsSync(SECURE_DIR)) {
    await mkdir(SECURE_DIR, { recursive: true })
  }
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export async function storeApiKey(apiKey: string): Promise<void> {
  await ensureSecureDir()

  if (!apiKey) {
    // Remove stored key if empty
    if (existsSync(API_KEY_FILE)) {
      await unlink(API_KEY_FILE)
      console.log('[SecureStorage] API key removed')
    }
    return
  }

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[SecureStorage] Encryption not available, storing with basic protection')
    // Fallback: base64 encode (not secure, but better than plaintext in YAML)
    const encoded = Buffer.from(apiKey).toString('base64')
    await writeFile(API_KEY_FILE, encoded, 'utf-8')
    return
  }

  const encrypted = safeStorage.encryptString(apiKey)
  await writeFile(API_KEY_FILE, encrypted)
  console.log('[SecureStorage] API key stored securely')
}

export async function retrieveApiKey(): Promise<string> {
  if (!existsSync(API_KEY_FILE)) {
    return ''
  }

  try {
    const data = await readFile(API_KEY_FILE)

    if (!safeStorage.isEncryptionAvailable()) {
      // Fallback: base64 decode
      return Buffer.from(data.toString('utf-8'), 'base64').toString('utf-8')
    }

    return safeStorage.decryptString(data)
  } catch (err) {
    console.error('[SecureStorage] Failed to retrieve API key:', err)
    return ''
  }
}

export async function hasStoredApiKey(): Promise<boolean> {
  return existsSync(API_KEY_FILE)
}

export async function clearApiKey(): Promise<void> {
  if (existsSync(API_KEY_FILE)) {
    await unlink(API_KEY_FILE)
    console.log('[SecureStorage] API key cleared')
  }
}
