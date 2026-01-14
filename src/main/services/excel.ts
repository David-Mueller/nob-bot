import { stat } from 'fs/promises'
import { createBackup } from './backup'
import { debugLog } from './debugLog'
import { loadWorkbook, saveWorkbook, XlsxPopulate } from './workbook'

/**
 * Excel service using xlsx-populate for full style preservation.
 * Buffer-based operations work reliably on all platforms.
 * Automatic backup on every write operation.
 */

// Security: Maximum file size (50MB) to prevent DoS
const MAX_FILE_SIZE = 50 * 1024 * 1024

/**
 * Validate Excel file before processing.
 */
export async function validateExcelFile(filePath: string): Promise<void> {
  if (!filePath.match(/\.(xlsx|xls)$/i)) {
    throw new Error('Invalid file extension. Only .xlsx and .xls files are allowed.')
  }

  const stats = await stat(filePath)
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`)
  }
}

export type Activity = {
  datum: string
  thema: string
  taetigkeit: string
  zeit: number | null
  km: number
  hotel: number
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]

/**
 * Adds an activity to the appropriate month sheet.
 */
export async function addActivity(
  filePath: string,
  activity: Activity
): Promise<void> {
  debugLog('Excel', `addActivity called for: ${filePath}`)
  debugLog('Excel', `Activity: ${JSON.stringify(activity)}`)

  // Validate file
  debugLog('Excel', 'Step 1: Validating file...')
  await validateExcelFile(filePath)
  debugLog('Excel', 'Step 1: Validation passed')

  // Create backup BEFORE modifications
  debugLog('Excel', 'Step 2: Creating backup...')
  await createBackup(filePath)
  debugLog('Excel', 'Step 2: Backup created')

  // Load workbook
  debugLog('Excel', 'Step 3: Loading workbook...')
  const workbook = await loadWorkbook(filePath)
  debugLog('Excel', 'Step 3: Workbook loaded')

  // Determine target sheet from date
  // Parse date components to avoid timezone issues (create local midnight)
  const [year, month, day] = activity.datum.split('-').map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed
  const sheetName = MONTH_NAMES[date.getMonth()]

  const sheet = workbook.sheet(sheetName)
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" nicht gefunden`)
  }

  // Find last row with content
  let lastContentRow = 7
  let emptyContentStreak = 0
  const usedRange = sheet.usedRange()
  const maxRow = usedRange ? usedRange.endCell().rowNumber() : 100

  for (let rowNum = 7; rowNum <= maxRow; rowNum++) {
    const themaValue = sheet.cell(`B${rowNum}`).value()
    const taetigkeitValue = sheet.cell(`C${rowNum}`).value()

    const hasThema = themaValue !== undefined && themaValue !== null && String(themaValue).trim().length > 0
    const hasTaetigkeit = taetigkeitValue !== undefined && taetigkeitValue !== null && String(taetigkeitValue).trim().length > 0

    if (hasThema || hasTaetigkeit) {
      lastContentRow = rowNum
      emptyContentStreak = 0
    } else {
      emptyContentStreak++
      if (emptyContentStreak >= 6) break
    }
  }

  const newRow = lastContentRow + 1
  debugLog('Excel', `Step 4: Writing to row ${newRow}`)

  // Set values - don't override numberFormat, let column style apply
  // Date: Pass Date object directly, xlsx-populate handles conversion
  sheet.cell(`A${newRow}`).value(date)

  // Thema
  sheet.cell(`B${newRow}`).value(activity.thema)

  // Tätigkeit
  sheet.cell(`C${newRow}`).value(activity.taetigkeit)

  // Zeit: fraction of day, let column format apply
  if (activity.zeit !== null) {
    sheet.cell(`D${newRow}`).value(activity.zeit / 24)
  }

  // KM
  if (activity.km > 0) {
    sheet.cell(`E${newRow}`).value(activity.km)
  }

  // Hotel/Auslagen
  if (activity.hotel > 0) {
    sheet.cell(`F${newRow}`).value(activity.hotel)
  }

  // Save workbook
  debugLog('Excel', 'Step 5: Saving workbook...')
  await saveWorkbook(workbook, filePath)
  debugLog('Excel', `Saved: ${filePath}`)
}

/**
 * Reads all activities from a specific month.
 */
export async function getActivities(
  filePath: string,
  month: number // 0-11
): Promise<Array<Activity & { row: number }>> {
  await validateExcelFile(filePath)

  const workbook = await loadWorkbook(filePath)
  const sheetName = MONTH_NAMES[month]
  const sheet = workbook.sheet(sheetName)

  if (!sheet) {
    return []
  }

  const activities: Array<Activity & { row: number }> = []
  const usedRange = sheet.usedRange()
  const maxRow = usedRange ? usedRange.endCell().rowNumber() : 100

  // Data typically starts at row 14
  for (let rowNum = 14; rowNum <= maxRow; rowNum++) {
    const datumValue = sheet.cell(`A${rowNum}`).value()
    const themaValue = sheet.cell(`B${rowNum}`).value()
    const taetigkeitValue = sheet.cell(`C${rowNum}`).value()

    if (!datumValue && !themaValue && !taetigkeitValue) continue

    const zeitValue = sheet.cell(`D${rowNum}`).value()
    const kmValue = sheet.cell(`E${rowNum}`).value()
    const hotelValue = sheet.cell(`F${rowNum}`).value()

    // Parse datum using xlsx-populate's built-in conversion
    let datum = ''
    if (datumValue !== undefined && datumValue !== null) {
      if (typeof datumValue === 'number') {
        const jsDate = XlsxPopulate.numberToDate(datumValue)
        datum = jsDate.toISOString().split('T')[0]
      } else if (datumValue instanceof Date) {
        datum = datumValue.toISOString().split('T')[0]
      } else {
        datum = String(datumValue)
      }
    }

    // Parse zeit (stored as fraction of day, convert to hours)
    let zeit: number | null = null
    if (zeitValue !== undefined && zeitValue !== null && typeof zeitValue === 'number') {
      zeit = zeitValue * 24
    }

    activities.push({
      row: rowNum,
      datum,
      thema: themaValue !== undefined && themaValue !== null ? String(themaValue) : '',
      taetigkeit: taetigkeitValue !== undefined && taetigkeitValue !== null ? String(taetigkeitValue) : '',
      zeit,
      km: kmValue !== undefined && kmValue !== null ? Number(kmValue) : 0,
      hotel: hotelValue !== undefined && hotelValue !== null ? Number(hotelValue) : 0
    })
  }

  return activities
}
