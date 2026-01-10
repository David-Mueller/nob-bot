import ExcelJS from 'exceljs'
import { createBackup } from './backup'

/**
 * Excel service with automatic backup on every write operation.
 * Use this instead of ExcelJS directly to ensure data safety.
 */

export type Activity = {
  datum: string
  thema: string
  taetigkeit: string
  zeit: number | null
  km: number
  hotel: number
}

/**
 * Safely writes to an Excel file with automatic backup.
 * Backup is created BEFORE any modifications are written.
 */
export async function safeWriteWorkbook(
  workbook: ExcelJS.Workbook,
  filePath: string
): Promise<void> {
  // ALWAYS create backup before writing
  await createBackup(filePath)

  // Now safe to write
  await workbook.xlsx.writeFile(filePath)
  console.log(`[Excel] Saved: ${filePath}`)
}

/**
 * Reads an Excel workbook.
 */
export async function readWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  return workbook
}

/**
 * Adds an activity to the appropriate month sheet.
 * Automatically creates a backup before saving.
 */
export async function addActivity(
  filePath: string,
  activity: Activity
): Promise<void> {
  const workbook = await readWorkbook(filePath)

  // Determine target sheet from date
  const date = new Date(activity.datum)
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ]
  const sheetName = monthNames[date.getMonth()]

  let sheet = workbook.getWorksheet(sheetName)
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" nicht gefunden`)
  }

  // Find the last row with data (skip header rows)
  let lastDataRow = 6 // Headers typically end at row 6
  for (let i = sheet.rowCount; i > 6; i--) {
    const row = sheet.getRow(i)
    const hasData = row.getCell(1).value || row.getCell(2).value || row.getCell(3).value
    if (hasData) {
      lastDataRow = i
      break
    }
  }

  // Add new row
  const newRow = sheet.getRow(lastDataRow + 1)
  newRow.getCell(1).value = date
  newRow.getCell(2).value = activity.thema
  newRow.getCell(3).value = activity.taetigkeit
  newRow.getCell(4).value = activity.zeit
  newRow.getCell(5).value = activity.km || null
  newRow.getCell(6).value = activity.hotel || null
  newRow.commit()

  // Save with automatic backup
  await safeWriteWorkbook(workbook, filePath)
}

/**
 * Updates an existing row in the workbook.
 * Automatically creates a backup before saving.
 */
export async function updateRow(
  filePath: string,
  sheetName: string,
  rowNumber: number,
  values: Record<number, unknown>
): Promise<void> {
  const workbook = await readWorkbook(filePath)
  const sheet = workbook.getWorksheet(sheetName)

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" nicht gefunden`)
  }

  const row = sheet.getRow(rowNumber)
  for (const [col, value] of Object.entries(values)) {
    row.getCell(Number(col)).value = value as ExcelJS.CellValue
  }
  row.commit()

  // Save with automatic backup
  await safeWriteWorkbook(workbook, filePath)
}

/**
 * Reads all activities from a specific month.
 */
export async function getActivities(
  filePath: string,
  month: number // 0-11
): Promise<Array<Activity & { row: number }>> {
  const workbook = await readWorkbook(filePath)

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ]
  const sheetName = monthNames[month]
  const sheet = workbook.getWorksheet(sheetName)

  if (!sheet) {
    return []
  }

  const activities: Array<Activity & { row: number }> = []

  // Data typically starts at row 14 based on the file structure
  for (let i = 14; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const datum = row.getCell(1).value
    const thema = row.getCell(2).value
    const taetigkeit = row.getCell(3).value

    if (!datum && !thema && !taetigkeit) continue

    activities.push({
      row: i,
      datum: datum instanceof Date ? datum.toISOString().split('T')[0] : String(datum || ''),
      thema: String(thema || ''),
      taetigkeit: String(taetigkeit || ''),
      zeit: row.getCell(4).value as number | null,
      km: (row.getCell(5).value as number) || 0,
      hotel: (row.getCell(6).value as number) || 0
    })
  }

  return activities
}
