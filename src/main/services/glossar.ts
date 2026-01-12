import ExcelJS from 'exceljs'
import { readFile, writeFile } from 'fs/promises'
import { createBackup } from './backup'
import { validateExcelFile } from './excel'
import type { GlossarKategorie, GlossarEintrag, Glossar } from '@shared/types'

// Re-export types for consumers that import from this module
export type { GlossarKategorie, GlossarEintrag, Glossar }

/**
 * Glossar service for standardizing terms from Excel sheets.
 * Reads a "Glossar" sheet with columns: Kategorie, Begriff, Synonyme
 * Can auto-create Glossar from existing data if sheet doesn't exist.
 * Uses ExcelJS for full style preservation.
 */

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]

// Cache for loaded glossars
const glossarCache = new Map<string, Glossar>()

/**
 * Normalize a string for lookup (lowercase, trim, remove extra spaces)
 */
function normalizeForLookup(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Load glossar from an Excel file's "Glossar" sheet.
 * Returns cached version if available.
 */
export async function loadGlossar(xlsxPath: string): Promise<Glossar | null> {
  // Check cache
  if (glossarCache.has(xlsxPath)) {
    return glossarCache.get(xlsxPath)!
  }

  try {
    // Validate file before processing
    await validateExcelFile(xlsxPath)

    // Load workbook via buffer (workaround for Windows async iterable issue)
    const workbook = new ExcelJS.Workbook()
    const fileBuffer = await readFile(xlsxPath)
    await workbook.xlsx.load(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength))

    // Look for "Glossar" sheet (case-insensitive)
    let glossarSheet: ExcelJS.Worksheet | undefined
    workbook.eachSheet((sheet) => {
      if (sheet.name.toLowerCase() === 'glossar') {
        glossarSheet = sheet
      }
    })

    if (!glossarSheet) {
      console.log(`[Glossar] No "Glossar" sheet found in ${xlsxPath}`)
      return null
    }

    const eintraege: GlossarEintrag[] = []
    const byKategorie = new Map<GlossarKategorie, GlossarEintrag[]>()
    const lookupMap = new Map<string, string>()

    // Initialize kategorie maps
    const kategorien: GlossarKategorie[] = ['Auftraggeber', 'Thema', 'Kunde', 'Sonstiges']
    for (const kat of kategorien) {
      byKategorie.set(kat, [])
    }

    // Skip header row (row 1), read data from row 2 onwards
    glossarSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return // Skip header

      const kategorieCell = row.getCell(1)
      const begriffCell = row.getCell(2)
      const synonymeCell = row.getCell(3)

      const kategorieVal = kategorieCell.value ? String(kategorieCell.value).trim() : ''
      const begriffVal = begriffCell.value ? String(begriffCell.value).trim() : ''
      const synonymeVal = synonymeCell.value ? String(synonymeCell.value).trim() : ''

      if (!kategorieVal || !begriffVal) return

      const kategorie = kategorieVal as GlossarKategorie

      // Parse synonyms (comma-separated)
      const synonyme = synonymeVal
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      const eintrag: GlossarEintrag = {
        kategorie,
        begriff: begriffVal,
        synonyme
      }

      eintraege.push(eintrag)

      // Add to kategorie map
      if (byKategorie.has(kategorie)) {
        byKategorie.get(kategorie)!.push(eintrag)
      }

      // Add to lookup map
      // The begriff itself maps to itself
      lookupMap.set(normalizeForLookup(begriffVal), begriffVal)

      // Each synonym maps to the standardized begriff
      for (const synonym of synonyme) {
        lookupMap.set(normalizeForLookup(synonym), begriffVal)
      }
    })

    const glossar: Glossar = {
      eintraege,
      byKategorie,
      lookupMap
    }

    // Cache the result
    glossarCache.set(xlsxPath, glossar)
    console.log(`[Glossar] Loaded ${eintraege.length} entries from ${xlsxPath}`)

    return glossar
  } catch (err) {
    console.error(`[Glossar] Failed to load from ${xlsxPath}:`, err)
    return null
  }
}

/**
 * Clear cached glossar for a specific file (or all if no path given)
 */
export function clearGlossarCache(xlsxPath?: string): void {
  if (xlsxPath) {
    glossarCache.delete(xlsxPath)
  } else {
    glossarCache.clear()
  }
}

/**
 * Normalize a text using the glossar lookup map.
 * Returns the standardized spelling if found, otherwise the original.
 */
export function normalizeText(text: string, glossar: Glossar): string {
  const normalized = normalizeForLookup(text)
  return glossar.lookupMap.get(normalized) || text
}

/**
 * Get all known terms for a specific category.
 * Useful for passing to LLM prompts.
 */
export function getKnownTerms(glossar: Glossar, kategorie: GlossarKategorie): string[] {
  const entries = glossar.byKategorie.get(kategorie) || []
  return entries.map(e => e.begriff)
}

/**
 * Get all known terms across all categories.
 * Returns an object with arrays for each relevant category.
 */
export function getAllKnownTerms(glossar: Glossar): {
  auftraggeber: string[]
  themen: string[]
  kunden: string[]
} {
  return {
    auftraggeber: getKnownTerms(glossar, 'Auftraggeber'),
    themen: getKnownTerms(glossar, 'Thema'),
    kunden: getKnownTerms(glossar, 'Kunde')
  }
}

/**
 * Load glossar from all active Excel files and merge them.
 * Returns a combined glossar with entries from all files.
 * Uses parallel loading for better performance.
 */
export async function loadGlossarsFromPaths(paths: string[]): Promise<Glossar | null> {
  // Parallel loading - errors in one file don't block others
  const glossarPromises = paths.map((path) =>
    loadGlossar(path).catch((err) => {
      console.error(`[Glossar] Failed to load ${path}:`, err)
      return null
    })
  )

  const results = await Promise.all(glossarPromises)
  const glossars = results.filter((g): g is Glossar => g !== null)

  if (glossars.length === 0) {
    return null
  }

  return mergeGlossars(glossars)
}

/**
 * Merge multiple glossars into one.
 */
function mergeGlossars(glossars: Glossar[]): Glossar {
  const merged: Glossar = {
    eintraege: [],
    byKategorie: new Map(),
    lookupMap: new Map()
  }

  // Initialize kategorie maps
  const kategorien: GlossarKategorie[] = ['Auftraggeber', 'Thema', 'Kunde', 'Sonstiges']
  for (const kat of kategorien) {
    merged.byKategorie.set(kat, [])
  }

  for (const glossar of glossars) {
    merged.eintraege.push(...glossar.eintraege)

    for (const [kategorie, entries] of glossar.byKategorie) {
      merged.byKategorie.get(kategorie)!.push(...entries)
    }

    for (const [key, value] of glossar.lookupMap) {
      merged.lookupMap.set(key, value)
    }
  }

  return merged
}

/**
 * Extract unique Thema values from all month sheets in an Excel file.
 */
async function extractThemenFromWorkbook(workbook: ExcelJS.Workbook): Promise<string[]> {
  const themen = new Set<string>()

  for (const sheetName of MONTH_NAMES) {
    const sheet = workbook.getWorksheet(sheetName)
    if (!sheet) continue

    // Data typically starts at row 14, Thema is column B (2)
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 14) return // Skip header rows

      const themaCell = row.getCell(2) // Column B
      if (themaCell.value) {
        const thema = String(themaCell.value).trim()
        if (thema.length > 0) {
          themen.add(thema)
        }
      }
    })
  }

  return Array.from(themen).sort()
}

/**
 * Create a Glossar sheet from existing data in the workbook.
 * Uses the auftraggeber from config and extracts Thema values from month sheets.
 * ExcelJS preserves all existing styles.
 */
export async function createGlossarSheet(
  xlsxPath: string,
  auftraggeber: string
): Promise<Glossar | null> {
  try {
    // Validate file before processing
    await validateExcelFile(xlsxPath)

    // Create backup before modifying
    await createBackup(xlsxPath)

    // Load workbook via buffer (workaround for Windows async iterable issue)
    const workbook = new ExcelJS.Workbook()
    const fileBuffer = await readFile(xlsxPath)
    await workbook.xlsx.load(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength))

    // Check if Glossar sheet already exists
    let existingSheet: ExcelJS.Worksheet | undefined
    workbook.eachSheet((sheet) => {
      if (sheet.name.toLowerCase() === 'glossar') {
        existingSheet = sheet
      }
    })

    if (existingSheet) {
      console.log(`[Glossar] Sheet already exists in ${xlsxPath}`)
      return loadGlossar(xlsxPath)
    }

    // Extract unique Thema values from existing data
    const themen = await extractThemenFromWorkbook(workbook)

    // Build the Glossar data
    const glossarData: Array<{ kategorie: string; begriff: string; synonyme: string }> = []

    // Add Auftraggeber entry
    if (auftraggeber) {
      glossarData.push({
        kategorie: 'Auftraggeber',
        begriff: auftraggeber,
        synonyme: ''
      })
    }

    // Add Thema entries
    for (const thema of themen) {
      glossarData.push({
        kategorie: 'Thema',
        begriff: thema,
        synonyme: ''
      })
    }

    // Create the Glossar sheet - minimal approach, only set cell values directly
    const glossarSheet = workbook.addWorksheet('Glossar')

    // Set column widths directly (no headers in column definition)
    glossarSheet.getColumn(1).width = 15
    glossarSheet.getColumn(2).width = 30
    glossarSheet.getColumn(3).width = 40

    // Write header row manually
    glossarSheet.getCell(1, 1).value = 'Kategorie'
    glossarSheet.getCell(1, 2).value = 'Begriff'
    glossarSheet.getCell(1, 3).value = 'Synonyme'

    // Write data rows manually (starting at row 2)
    let rowNum = 2
    for (const entry of glossarData) {
      glossarSheet.getCell(rowNum, 1).value = entry.kategorie
      glossarSheet.getCell(rowNum, 2).value = entry.begriff
      glossarSheet.getCell(rowNum, 3).value = entry.synonyme
      rowNum++
    }

    // Write the workbook back via buffer (workaround for Windows async iterable issue)
    const outBuffer = await workbook.xlsx.writeBuffer()
    await writeFile(xlsxPath, Buffer.from(outBuffer))

    console.log(`[Glossar] Created sheet with ${glossarData.length} entries in ${xlsxPath}`)

    // Clear cache and reload
    clearGlossarCache(xlsxPath)
    return loadGlossar(xlsxPath)
  } catch (err) {
    console.error(`[Glossar] Failed to create sheet in ${xlsxPath}:`, err)
    return null
  }
}

/**
 * Ensure Glossar exists in a file, creating it from existing data if needed.
 */
export async function ensureGlossar(
  xlsxPath: string,
  auftraggeber: string
): Promise<Glossar | null> {
  // Try to load existing glossar first
  const existing = await loadGlossar(xlsxPath)
  if (existing) {
    return existing
  }

  // No glossar sheet exists, create one from existing data
  console.log(`[Glossar] No sheet found in ${xlsxPath}, creating from existing data...`)
  return createGlossarSheet(xlsxPath, auftraggeber)
}
