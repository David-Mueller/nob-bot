import * as XLSX from 'xlsx'
import { createBackup } from './backup'
import { validateExcelFile } from './excel'
import type { GlossarKategorie, GlossarEintrag, Glossar } from '@shared/types'

// Re-export types for consumers that import from this module
export type { GlossarKategorie, GlossarEintrag, Glossar }

/**
 * Glossar service for standardizing terms from Excel sheets.
 * Reads a "Glossar" sheet with columns: Kategorie, Begriff, Synonyme
 * Can auto-create Glossar from existing data if sheet doesn't exist.
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

    const workbook = XLSX.readFile(xlsxPath, { cellStyles: false })

    // Look for "Glossar" sheet (case-insensitive)
    const sheetName = workbook.SheetNames.find(
      name => name.toLowerCase() === 'glossar'
    )

    if (!sheetName) {
      console.log(`[Glossar] No "Glossar" sheet found in ${xlsxPath}`)
      return null
    }

    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      header: ['kategorie', 'begriff', 'synonyme'],
      range: 1 // Skip header row
    })

    const eintraege: GlossarEintrag[] = []
    const byKategorie = new Map<GlossarKategorie, GlossarEintrag[]>()
    const lookupMap = new Map<string, string>()

    // Initialize kategorie maps
    const kategorien: GlossarKategorie[] = ['Auftraggeber', 'Thema', 'Kunde', 'Sonstiges']
    for (const kat of kategorien) {
      byKategorie.set(kat, [])
    }

    for (const row of data) {
      if (!row.kategorie || !row.begriff) continue

      const kategorie = row.kategorie as GlossarKategorie
      const begriff = row.begriff.trim()
      const synonymeStr = row.synonyme || ''

      // Parse synonyms (comma-separated)
      const synonyme = synonymeStr
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      const eintrag: GlossarEintrag = {
        kategorie,
        begriff,
        synonyme
      }

      eintraege.push(eintrag)

      // Add to kategorie map
      if (byKategorie.has(kategorie)) {
        byKategorie.get(kategorie)!.push(eintrag)
      }

      // Add to lookup map
      // The begriff itself maps to itself
      lookupMap.set(normalizeForLookup(begriff), begriff)

      // Each synonym maps to the standardized begriff
      for (const synonym of synonyme) {
        lookupMap.set(normalizeForLookup(synonym), begriff)
      }
    }

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
function extractThemenFromWorkbook(workbook: XLSX.WorkBook): string[] {
  const themen = new Set<string>()

  for (const sheetName of MONTH_NAMES) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

    // Data typically starts at row 14 (0-based: 13), Thema is column B (index 1)
    for (let row = 13; row <= range.e.r; row++) {
      const themaCell = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })]
      if (themaCell?.v) {
        const thema = String(themaCell.v).trim()
        if (thema.length > 0) {
          themen.add(thema)
        }
      }
    }
  }

  return Array.from(themen).sort()
}

/**
 * Create a Glossar sheet from existing data in the workbook.
 * Uses the auftraggeber from config and extracts Thema values from month sheets.
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

    const workbook = XLSX.readFile(xlsxPath, { cellStyles: true })

    // Check if Glossar sheet already exists
    const existingSheet = workbook.SheetNames.find(
      name => name.toLowerCase() === 'glossar'
    )
    if (existingSheet) {
      console.log(`[Glossar] Sheet already exists in ${xlsxPath}`)
      return loadGlossar(xlsxPath)
    }

    // Extract unique Thema values from existing data
    const themen = extractThemenFromWorkbook(workbook)

    // Build the Glossar data
    const glossarData: Array<{ Kategorie: string; Begriff: string; Synonyme: string }> = []

    // Add Auftraggeber entry
    if (auftraggeber) {
      glossarData.push({
        Kategorie: 'Auftraggeber',
        Begriff: auftraggeber,
        Synonyme: ''
      })
    }

    // Add Thema entries
    for (const thema of themen) {
      glossarData.push({
        Kategorie: 'Thema',
        Begriff: thema,
        Synonyme: ''
      })
    }

    // Create the Glossar sheet
    const glossarSheet = XLSX.utils.json_to_sheet(glossarData, {
      header: ['Kategorie', 'Begriff', 'Synonyme']
    })

    // Set column widths
    glossarSheet['!cols'] = [
      { wch: 15 }, // Kategorie
      { wch: 30 }, // Begriff
      { wch: 40 }  // Synonyme
    ]

    // Add the sheet to the workbook
    XLSX.utils.book_append_sheet(workbook, glossarSheet, 'Glossar')

    // Write the workbook back
    XLSX.writeFile(workbook, xlsxPath, { cellStyles: true, compression: true })

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
