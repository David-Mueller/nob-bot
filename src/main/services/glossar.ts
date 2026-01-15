import * as fsp from 'fs/promises'
import { loadWorkbook, saveWorkbook, type Workbook, type Sheet } from './workbook'
import { createBackup } from './backup'
import { validateExcelFile } from './excel'
import type { GlossarKategorie, GlossarEintrag, Glossar } from '@shared/types'

// Re-export types for consumers
export type { GlossarKategorie, GlossarEintrag, Glossar }

/**
 * Glossar service for standardizing terms from Excel sheets.
 * Reads a "Glossar" sheet with columns: Kategorie, Begriff, Synonyme
 * Uses xlsx-populate for cross-platform compatibility.
 */

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]

// Cache for loaded glossars with mtime for invalidation
type CacheEntry = { glossar: Glossar; mtime: number }
const glossarCache = new Map<string, CacheEntry>()

/**
 * Normalize a string for lookup (lowercase, trim, remove extra spaces)
 */
function normalizeForLookup(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Get cell value as string, handling undefined/null
 */
function getCellString(sheet: Sheet, row: number, col: number): string {
  const value = sheet.cell(row, col).value()
  return value !== undefined && value !== null ? String(value).trim() : ''
}

/**
 * Load glossar from an Excel file's "Glossar" sheet.
 */
export async function loadGlossar(xlsxPath: string): Promise<Glossar | null> {
  try {
    await validateExcelFile(xlsxPath)

    // Check mtime for cache invalidation
    const stats = await fsp.stat(xlsxPath)
    const cached = glossarCache.get(xlsxPath)
    if (cached && cached.mtime === stats.mtimeMs) {
      return cached.glossar
    }

    const workbook = await loadWorkbook(xlsxPath)

    // Find "Glossar" sheet (case-insensitive)
    const sheets = workbook.sheets()
    const glossarSheet = sheets.find(s => s.name().toLowerCase() === 'glossar')

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

    // Get data extent
    const usedRange = glossarSheet.usedRange()
    const maxRow = usedRange ? usedRange.endCell().rowNumber() : 100

    // Skip header row (row 1), read data from row 2 onwards
    for (let rowNum = 2; rowNum <= maxRow; rowNum++) {
      const kategorieVal = getCellString(glossarSheet, rowNum, 1)
      const begriffVal = getCellString(glossarSheet, rowNum, 2)
      const synonymeVal = getCellString(glossarSheet, rowNum, 3)

      if (!kategorieVal || !begriffVal) continue

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

      if (byKategorie.has(kategorie)) {
        byKategorie.get(kategorie)!.push(eintrag)
      }

      // Add to lookup map
      lookupMap.set(normalizeForLookup(begriffVal), begriffVal)
      for (const synonym of synonyme) {
        lookupMap.set(normalizeForLookup(synonym), begriffVal)
      }
    }

    const glossar: Glossar = { eintraege, byKategorie, lookupMap }
    glossarCache.set(xlsxPath, { glossar, mtime: stats.mtimeMs })
    console.log(`[Glossar] Loaded ${eintraege.length} entries from ${xlsxPath}`)

    return glossar
  } catch (err) {
    console.error(`[Glossar] Failed to load from ${xlsxPath}:`, err)
    return null
  }
}

/**
 * Clear cached glossar
 */
export function clearGlossarCache(xlsxPath?: string): void {
  if (xlsxPath) {
    glossarCache.delete(xlsxPath)
  } else {
    glossarCache.clear()
  }
}

/**
 * Normalize text using glossar lookup with fuzzy fallback
 */
export function normalizeText(text: string, glossar: Glossar): string {
  const normalized = normalizeForLookup(text)

  // Exact match first
  const exact = glossar.lookupMap.get(normalized)
  if (exact) return exact

  // Fuzzy match fallback - find best match above threshold
  const FUZZY_THRESHOLD = 0.75
  let bestMatch: string | null = null
  let bestScore = FUZZY_THRESHOLD

  for (const [key, value] of glossar.lookupMap) {
    const score = similarity(normalized, key)
    if (score > bestScore) {
      bestScore = score
      bestMatch = value
    }
  }

  if (bestMatch) {
    console.log(`[Glossar] Fuzzy match: "${text}" → "${bestMatch}" (${(bestScore * 100).toFixed(0)}%)`)
    return bestMatch
  }

  return text
}

/**
 * Get known terms for a category
 */
export function getKnownTerms(glossar: Glossar, kategorie: GlossarKategorie): string[] {
  return (glossar.byKategorie.get(kategorie) || []).map(e => e.begriff)
}

/**
 * Get all known terms across categories
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
 * Load and merge glossars from multiple files
 */
export async function loadGlossarsFromPaths(paths: string[]): Promise<Glossar | null> {
  const results = await Promise.all(
    paths.map(path => loadGlossar(path).catch(() => null))
  )
  const glossars = results.filter((g): g is Glossar => g !== null)

  if (glossars.length === 0) return null
  return mergeGlossars(glossars)
}

function mergeGlossars(glossars: Glossar[]): Glossar {
  const merged: Glossar = {
    eintraege: [],
    byKategorie: new Map(),
    lookupMap: new Map()
  }

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
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate similarity ratio (0-1) between two strings
 */
function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()
  const maxLen = Math.max(aLower.length, bLower.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(aLower, bLower) / maxLen
}

/**
 * Cluster similar terms and pick the best representative
 */
function clusterSimilarTerms(terms: string[], threshold = 0.75): Array<{ begriff: string; synonyme: string[] }> {
  const clusters: Array<{ begriff: string; synonyme: string[]; count: Map<string, number> }> = []

  // Count occurrences of each term
  const termCounts = new Map<string, number>()
  for (const term of terms) {
    termCounts.set(term, (termCounts.get(term) || 0) + 1)
  }

  // Get unique terms
  const uniqueTerms = Array.from(new Set(terms))

  for (const term of uniqueTerms) {
    // Find existing cluster this term belongs to
    let foundCluster: typeof clusters[0] | null = null

    for (const cluster of clusters) {
      // Check similarity against the main begriff and all synonyms
      const allTermsInCluster = [cluster.begriff, ...cluster.synonyme]
      for (const clusterTerm of allTermsInCluster) {
        if (similarity(term, clusterTerm) >= threshold) {
          foundCluster = cluster
          break
        }
      }
      if (foundCluster) break
    }

    if (foundCluster) {
      // Add to existing cluster
      if (term !== foundCluster.begriff && !foundCluster.synonyme.includes(term)) {
        foundCluster.synonyme.push(term)
      }
      foundCluster.count.set(term, termCounts.get(term) || 1)
    } else {
      // Create new cluster
      clusters.push({
        begriff: term,
        synonyme: [],
        count: new Map([[term, termCounts.get(term) || 1]])
      })
    }
  }

  // For each cluster, pick the best representative as begriff
  return clusters.map(cluster => {
    // Find the term with highest count, or longest if tie (more likely to be complete)
    let bestTerm = cluster.begriff
    let bestScore = cluster.count.get(bestTerm) || 0

    for (const [term, count] of cluster.count) {
      // Prefer: higher count, then longer name, then alphabetically first (more "standard" looking)
      if (count > bestScore ||
          (count === bestScore && term.length > bestTerm.length) ||
          (count === bestScore && term.length === bestTerm.length && term < bestTerm)) {
        bestTerm = term
        bestScore = count
      }
    }

    // Build synonyms list (all terms except the best one)
    const synonyme = Array.from(cluster.count.keys())
      .filter(t => t !== bestTerm)
      .sort()

    return { begriff: bestTerm, synonyme }
  }).sort((a, b) => a.begriff.localeCompare(b.begriff))
}

/**
 * Extract Thema values from workbook (with duplicates for counting)
 */
async function extractThemenFromWorkbook(workbook: Workbook): Promise<string[]> {
  const themen: string[] = []

  for (const sheetName of MONTH_NAMES) {
    const sheet = workbook.sheet(sheetName)
    if (!sheet) continue

    const usedRange = sheet.usedRange()
    const maxRow = usedRange ? usedRange.endCell().rowNumber() : 100

    // Data starts at row 14, Thema is column B (2)
    for (let rowNum = 14; rowNum <= maxRow; rowNum++) {
      const thema = getCellString(sheet, rowNum, 2)
      if (thema) themen.push(thema) // Keep duplicates for counting
    }
  }

  return themen
}

/**
 * Create a Glossar sheet from existing data
 */
export async function createGlossarSheet(
  xlsxPath: string,
  auftraggeber: string
): Promise<Glossar | null> {
  try {
    await validateExcelFile(xlsxPath)
    await createBackup(xlsxPath)

    const workbook = await loadWorkbook(xlsxPath)

    // Check if Glossar sheet exists
    const sheets = workbook.sheets()
    if (sheets.find(s => s.name().toLowerCase() === 'glossar')) {
      console.log(`[Glossar] Sheet already exists in ${xlsxPath}`)
      return loadGlossar(xlsxPath)
    }

    // Extract Thema values (with duplicates for frequency counting)
    const themen = await extractThemenFromWorkbook(workbook)

    // Cluster similar terms intelligently
    const clusteredThemen = clusterSimilarTerms(themen)
    console.log(`[Glossar] Clustered ${themen.length} raw terms into ${clusteredThemen.length} unique entries`)

    // Build glossar data
    const glossarData: Array<{ kategorie: string; begriff: string; synonyme: string }> = []

    if (auftraggeber) {
      glossarData.push({ kategorie: 'Auftraggeber', begriff: auftraggeber, synonyme: '' })
    }

    for (const { begriff, synonyme } of clusteredThemen) {
      glossarData.push({
        kategorie: 'Thema',
        begriff,
        synonyme: synonyme.join(', ')
      })
    }

    // Create sheet
    const glossarSheet = workbook.addSheet('Glossar')

    // Set column widths
    glossarSheet.column(1).width(15)
    glossarSheet.column(2).width(30)
    glossarSheet.column(3).width(40)

    // Write header
    glossarSheet.cell(1, 1).value('Kategorie')
    glossarSheet.cell(1, 2).value('Begriff')
    glossarSheet.cell(1, 3).value('Synonyme')

    // Write data
    for (let i = 0; i < glossarData.length; i++) {
      const row = i + 2
      glossarSheet.cell(row, 1).value(glossarData[i].kategorie)
      glossarSheet.cell(row, 2).value(glossarData[i].begriff)
      glossarSheet.cell(row, 3).value(glossarData[i].synonyme)
    }

    await saveWorkbook(workbook, xlsxPath)
    console.log(`[Glossar] Created sheet with ${glossarData.length} entries in ${xlsxPath}`)

    clearGlossarCache(xlsxPath)
    return loadGlossar(xlsxPath)
  } catch (err) {
    console.error(`[Glossar] Failed to create sheet in ${xlsxPath}:`, err)
    return null
  }
}

/**
 * Ensure Glossar exists, creating if needed
 */
export async function ensureGlossar(
  xlsxPath: string,
  auftraggeber: string
): Promise<Glossar | null> {
  const existing = await loadGlossar(xlsxPath)
  if (existing) return existing

  console.log(`[Glossar] No sheet found in ${xlsxPath}, creating...`)
  return createGlossarSheet(xlsxPath, auftraggeber)
}
