import { normalize, resolve } from 'path'
import { app } from 'electron'
import { getConfig } from '../services/config'

/**
 * Returns list of directories where file access is permitted.
 * Includes xlsxBasePath from config plus standard user directories.
 */
export function getAllowedBasePaths(): string[] {
  const config = getConfig()
  return [
    config.xlsxBasePath,
    app.getPath('home'),
    app.getPath('documents'),
    app.getPath('userData')
  ].filter(Boolean)
}

/**
 * Validates that a path is safe and within allowed directories.
 * Blocks path traversal attempts and paths outside allowed directories.
 *
 * @throws Error if path is invalid or outside allowed directories
 * @returns Normalized absolute path
 */
export function validatePath(inputPath: string): string {
  // Check for path traversal attempts before normalization
  if (inputPath.includes('..')) {
    throw new Error('Path traversal not allowed')
  }

  // Normalize and resolve to absolute
  const normalized = normalize(resolve(inputPath))

  // Verify within allowed directories
  const allowedBases = getAllowedBasePaths()
  const isAllowed = allowedBases.some((base) =>
    normalized.startsWith(normalize(resolve(base)))
  )

  if (!isAllowed) {
    throw new Error(`Path outside allowed directories: ${inputPath}`)
  }

  return normalized
}

/**
 * Validates that a path is a valid Excel file within allowed directories.
 *
 * @throws Error if path is invalid, outside allowed directories, or not an Excel file
 * @returns Normalized absolute path
 */
export function validateExcelPath(inputPath: string): string {
  const validated = validatePath(inputPath)

  // Must be Excel file
  if (!validated.match(/\.(xlsx|xls)$/i)) {
    throw new Error('Not an Excel file')
  }

  return validated
}
