import XlsxPopulate, { Workbook } from 'xlsx-populate'
import { readFile, writeFile } from 'fs/promises'
import { debugLog } from './debugLog'

/**
 * Shared workbook utilities using xlsx-populate.
 * Buffer-based operations work reliably on all platforms (Mac, Windows, Linux).
 */

/**
 * Load a workbook from file using buffer (cross-platform compatible).
 */
export async function loadWorkbook(filePath: string): Promise<Workbook> {
  debugLog('Workbook', `Loading: ${filePath}`)
  const buffer = await readFile(filePath)
  const workbook = await XlsxPopulate.fromDataAsync(buffer)
  debugLog('Workbook', 'Loaded successfully')
  return workbook
}

/**
 * Save a workbook to file using buffer (cross-platform compatible).
 */
export async function saveWorkbook(workbook: Workbook, filePath: string): Promise<void> {
  debugLog('Workbook', `Saving: ${filePath}`)
  const output = await workbook.outputAsync()
  await writeFile(filePath, output as Buffer)
  debugLog('Workbook', 'Saved successfully')
}

// Re-export for convenience
export { XlsxPopulate }
export type { Workbook, Sheet } from 'xlsx-populate'
