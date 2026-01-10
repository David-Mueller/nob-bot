import * as XLSX from 'xlsx'
import { createBackup } from './backup'

/**
 * Excel service using SheetJS (xlsx) for better Excel compatibility.
 * Preserves styles, formulas, and formatting.
 * Automatic backup on every write operation.
 */

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

// Read options to preserve styles, formulas, and formatting
const READ_OPTIONS: XLSX.ParsingOptions = {
  cellStyles: true,    // Preserve cell styles
  cellFormula: true,   // Preserve formulas
  cellDates: true,     // Parse dates properly
  cellNF: true,        // Preserve number formats
  sheetStubs: true     // Create stubs for empty cells (preserves structure)
}

// Write options to preserve everything
const WRITE_OPTIONS: XLSX.WritingOptions = {
  cellStyles: true,    // Write cell styles
  bookSST: true,       // Use shared string table (better compatibility)
  compression: true    // Compress output
}

/**
 * Adds an activity to the appropriate month sheet.
 * Automatically creates a backup before saving.
 */
export async function addActivity(
  filePath: string,
  activity: Activity
): Promise<void> {
  // Create backup BEFORE any modifications
  await createBackup(filePath)

  // Read workbook with full style/formula preservation
  const workbook = XLSX.readFile(filePath, READ_OPTIONS)

  // Determine target sheet from date
  const date = new Date(activity.datum)
  const sheetName = MONTH_NAMES[date.getMonth()]

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" nicht gefunden`)
  }

  // Get sheet range to find last row
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

  // Find last row with data (start from bottom)
  let lastDataRow = 6 // Default if sheet is empty
  for (let row = range.e.r; row >= 6; row--) {
    const cellA = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })]
    const cellB = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })]
    const cellC = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })]
    if (cellA || cellB || cellC) {
      lastDataRow = row
      break
    }
  }

  const newRow = lastDataRow + 1

  // Helper to copy style from template row
  const copyStyleFromRow = (col: number): { s?: unknown; z?: string } => {
    const templateCell = sheet[XLSX.utils.encode_cell({ r: lastDataRow, c: col })]
    const result: { s?: unknown; z?: string } = {}
    if (templateCell?.s !== undefined) result.s = templateCell.s
    if (templateCell?.z !== undefined) result.z = templateCell.z
    return result
  }

  // Write cells - Column A: Date (with style from template)
  const dateStyle = copyStyleFromRow(0)
  sheet[XLSX.utils.encode_cell({ r: newRow, c: 0 })] = {
    t: 'd',
    v: date,
    w: date.toLocaleDateString('de-DE'),
    ...dateStyle
  }

  // Column B: Thema
  const themaStyle = copyStyleFromRow(1)
  sheet[XLSX.utils.encode_cell({ r: newRow, c: 1 })] = {
    t: 's',
    v: activity.thema,
    ...themaStyle
  }

  // Column C: Tätigkeit
  const taetigkeitStyle = copyStyleFromRow(2)
  sheet[XLSX.utils.encode_cell({ r: newRow, c: 2 })] = {
    t: 's',
    v: activity.taetigkeit,
    ...taetigkeitStyle
  }

  // Column D: Zeit (as time value: hours/24)
  const zeitStyle = copyStyleFromRow(3)
  if (activity.zeit !== null) {
    const timeValue = activity.zeit / 24
    const hours = Math.floor(activity.zeit)
    const minutes = Math.round((activity.zeit - hours) * 60)
    sheet[XLSX.utils.encode_cell({ r: newRow, c: 3 })] = {
      t: 'n',
      v: timeValue,
      w: `${hours}:${minutes.toString().padStart(2, '0')}`,
      ...zeitStyle
    }
  }

  // Column E: KM
  const kmStyle = copyStyleFromRow(4)
  if (activity.km > 0) {
    sheet[XLSX.utils.encode_cell({ r: newRow, c: 4 })] = {
      t: 'n',
      v: activity.km,
      ...kmStyle
    }
  }

  // Column F: Hotel/Auslagen
  const hotelStyle = copyStyleFromRow(5)
  if (activity.hotel > 0) {
    sheet[XLSX.utils.encode_cell({ r: newRow, c: 5 })] = {
      t: 'n',
      v: activity.hotel,
      ...hotelStyle
    }
  }

  // Update sheet range to include new row
  range.e.r = Math.max(range.e.r, newRow)
  sheet['!ref'] = XLSX.utils.encode_range(range)

  // Write file with style preservation
  XLSX.writeFile(workbook, filePath, WRITE_OPTIONS)
  console.log(`[Excel] Saved: ${filePath}`)
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
  await createBackup(filePath)

  const workbook = XLSX.readFile(filePath, READ_OPTIONS)
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" nicht gefunden`)
  }

  // Update cells (rowNumber is 1-based, XLSX uses 0-based)
  const row = rowNumber - 1
  for (const [col, value] of Object.entries(values)) {
    const colNum = Number(col) - 1 // Convert to 0-based
    const cellAddr = XLSX.utils.encode_cell({ r: row, c: colNum })

    if (value === null || value === undefined) {
      delete sheet[cellAddr]
    } else if (typeof value === 'number') {
      sheet[cellAddr] = { t: 'n', v: value }
    } else if (value instanceof Date) {
      sheet[cellAddr] = { t: 'd', v: value }
    } else {
      sheet[cellAddr] = { t: 's', v: String(value) }
    }
  }

  XLSX.writeFile(workbook, filePath, WRITE_OPTIONS)
  console.log(`[Excel] Updated row ${rowNumber} in ${sheetName}`)
}

/**
 * Reads all activities from a specific month.
 */
export async function getActivities(
  filePath: string,
  month: number // 0-11
): Promise<Array<Activity & { row: number }>> {
  const workbook = XLSX.readFile(filePath, READ_OPTIONS)
  const sheetName = MONTH_NAMES[month]
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) {
    return []
  }

  const activities: Array<Activity & { row: number }> = []
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

  // Data typically starts at row 14 (0-based: 13)
  for (let row = 13; row <= range.e.r; row++) {
    const datumCell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })]
    const themaCell = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })]
    const taetigkeitCell = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })]

    if (!datumCell && !themaCell && !taetigkeitCell) continue

    const zeitCell = sheet[XLSX.utils.encode_cell({ r: row, c: 3 })]
    const kmCell = sheet[XLSX.utils.encode_cell({ r: row, c: 4 })]
    const hotelCell = sheet[XLSX.utils.encode_cell({ r: row, c: 5 })]

    // Parse datum
    let datum = ''
    if (datumCell) {
      if (datumCell.t === 'd' && datumCell.v instanceof Date) {
        datum = datumCell.v.toISOString().split('T')[0]
      } else if (datumCell.w) {
        datum = datumCell.w
      } else {
        datum = String(datumCell.v || '')
      }
    }

    // Parse zeit (stored as fraction of day, convert to hours)
    let zeit: number | null = null
    if (zeitCell && zeitCell.v !== undefined) {
      if (typeof zeitCell.v === 'number') {
        zeit = zeitCell.v * 24 // Convert from day fraction to hours
      }
    }

    activities.push({
      row: row + 1, // Convert to 1-based for display
      datum,
      thema: themaCell?.v ? String(themaCell.v) : '',
      taetigkeit: taetigkeitCell?.v ? String(taetigkeitCell.v) : '',
      zeit,
      km: kmCell?.v ? Number(kmCell.v) : 0,
      hotel: hotelCell?.v ? Number(hotelCell.v) : 0
    })
  }

  return activities
}
