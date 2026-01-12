import ExcelJS from 'exceljs'
import { stat, writeFile, readFile } from 'fs/promises'
import { createBackup } from './backup'

/**
 * Excel service using ExcelJS for full style preservation.
 * Preserves all formatting: backgrounds, borders, text wrap, fonts, etc.
 * Automatic backup on every write operation.
 */

// Security: Maximum file size (50MB) to prevent DoS
const MAX_FILE_SIZE = 50 * 1024 * 1024

/**
 * Validate Excel file before processing.
 * Checks file size and extension for security.
 */
export async function validateExcelFile(filePath: string): Promise<void> {
  // Check file extension
  if (!filePath.match(/\.(xlsx|xls)$/i)) {
    throw new Error('Invalid file extension. Only .xlsx and .xls files are allowed.')
  }

  // Check file size
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
 * ExcelJS preserves all existing styles, only writes to new cells.
 */
export async function addActivity(
  filePath: string,
  activity: Activity
): Promise<void> {
  // Validate file before processing
  await validateExcelFile(filePath)

  // Create backup BEFORE any modifications
  await createBackup(filePath)

  // Load workbook via buffer (workaround for Windows async iterable issue)
  const workbook = new ExcelJS.Workbook()
  const fileBuffer = await readFile(filePath)
  await workbook.xlsx.load(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength))

  // Determine target sheet from date
  const date = new Date(activity.datum)
  const sheetName = MONTH_NAMES[date.getMonth()]

  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" nicht gefunden`)
  }

  // Find last row with actual content (Thema OR Tätigkeit filled)
  // Rule: 6+ consecutive rows with empty Thema AND Tätigkeit = end of data
  let lastContentRow = 7 // Default start row (1-based in ExcelJS)
  let emptyContentStreak = 0

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 7) return // Skip header rows

    const themaCell = row.getCell(2) // Column B
    const taetigkeitCell = row.getCell(3) // Column C

    const hasThema = themaCell.value && String(themaCell.value).trim().length > 0
    const hasTaetigkeit = taetigkeitCell.value && String(taetigkeitCell.value).trim().length > 0

    if (hasThema || hasTaetigkeit) {
      lastContentRow = rowNumber
      emptyContentStreak = 0
    } else {
      emptyContentStreak++
      if (emptyContentStreak >= 6) {
        return // Stop searching
      }
    }
  })

  const newRowNumber = lastContentRow + 1
  const newRow = sheet.getRow(newRowNumber)

  // Set values only - ExcelJS preserves existing styles automatically
  // Column A (1): Date
  newRow.getCell(1).value = date

  // Column B (2): Thema
  newRow.getCell(2).value = activity.thema

  // Column C (3): Tätigkeit
  newRow.getCell(3).value = activity.taetigkeit

  // Column D (4): Zeit (as decimal hours for Excel time format)
  if (activity.zeit !== null) {
    // Convert hours to Excel time value (fraction of day)
    newRow.getCell(4).value = activity.zeit / 24
  }

  // Column E (5): KM
  if (activity.km > 0) {
    newRow.getCell(5).value = activity.km
  }

  // Column F (6): Hotel/Auslagen
  if (activity.hotel > 0) {
    newRow.getCell(6).value = activity.hotel
  }

  // Save workbook via buffer (workaround for Windows async iterable issue)
  const outBuffer = await workbook.xlsx.writeBuffer()
  await writeFile(filePath, Buffer.from(outBuffer))
  console.log(`[Excel] Saved: ${filePath}`)
}

/**
 * Reads all activities from a specific month.
 */
export async function getActivities(
  filePath: string,
  month: number // 0-11
): Promise<Array<Activity & { row: number }>> {
  // Validate file before processing
  await validateExcelFile(filePath)

  // Load workbook via buffer (workaround for Windows async iterable issue)
  const workbook = new ExcelJS.Workbook()
  const fileBuffer = await readFile(filePath)
  await workbook.xlsx.load(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength))

  const sheetName = MONTH_NAMES[month]
  const sheet = workbook.getWorksheet(sheetName)

  if (!sheet) {
    return []
  }

  const activities: Array<Activity & { row: number }> = []

  // Data typically starts at row 14
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 14) return // Skip header rows

    const datumCell = row.getCell(1)
    const themaCell = row.getCell(2)
    const taetigkeitCell = row.getCell(3)

    if (!datumCell.value && !themaCell.value && !taetigkeitCell.value) return

    const zeitCell = row.getCell(4)
    const kmCell = row.getCell(5)
    const hotelCell = row.getCell(6)

    // Parse datum
    let datum = ''
    if (datumCell.value) {
      if (datumCell.value instanceof Date) {
        datum = datumCell.value.toISOString().split('T')[0]
      } else {
        datum = String(datumCell.value)
      }
    }

    // Parse zeit (stored as fraction of day, convert to hours)
    let zeit: number | null = null
    if (zeitCell.value !== null && zeitCell.value !== undefined) {
      const val = zeitCell.value
      if (typeof val === 'number') {
        zeit = val * 24 // Convert from day fraction to hours
      }
    }

    activities.push({
      row: rowNumber,
      datum,
      thema: themaCell.value ? String(themaCell.value) : '',
      taetigkeit: taetigkeitCell.value ? String(taetigkeitCell.value) : '',
      zeit,
      km: kmCell.value ? Number(kmCell.value) : 0,
      hotel: hotelCell.value ? Number(hotelCell.value) : 0
    })
  })

  return activities
}
