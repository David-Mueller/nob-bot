import { glob } from 'glob'
import { join, basename } from 'path'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

export type ScannedFile = {
  path: string
  filename: string
  auftraggeber: string | null
  jahr: number | null
}

// Schema for LLM extraction
const FileInfoSchema = z.object({
  auftraggeber: z.string().describe('Name des Auftraggebers/Firma aus dem Dateinamen'),
  jahr: z.number().describe('4-stelliges Jahr aus dem Dateinamen')
})

const EXTRACTION_PROMPT = `Extrahiere aus dem folgenden Dateinamen den Auftraggeber und das Jahr.

Dateinamen beginnen typischerweise mit "LV" gefolgt vom Auftraggeber-Namen und dem Jahr.
Das Jahr kann verschiedene Formate haben: "2025", "2 0 2 5", "25", etc.

Beispiele:
- "LV IDT 2025.xlsx" → auftraggeber: "IDT", jahr: 2025
- "LV IDT 2 0 2 6.xlsx" → auftraggeber: "IDT", jahr: 2026
- "LV Musterfirma GmbH 2025.xlsx" → auftraggeber: "Musterfirma GmbH", jahr: 2025
- "LV ABC Corp 25.xlsx" → auftraggeber: "ABC Corp", jahr: 2025

Wenn das Jahr 2-stellig ist, interpretiere es als 20xx.
Ignoriere das "LV" Prefix und die ".xlsx" Endung.`

let llm: ChatOpenAI | null = null

function getLLM(): ChatOpenAI {
  if (!llm) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not found')
    }
    llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      apiKey
    })
  }
  return llm
}

export async function extractFileInfo(filename: string): Promise<{ auftraggeber: string; jahr: number }> {
  const structuredLLM = getLLM().withStructuredOutput(FileInfoSchema)

  const result = await structuredLLM.invoke([
    { role: 'system', content: EXTRACTION_PROMPT },
    { role: 'user', content: filename }
  ])

  return result
}

export async function scanDirectory(basePath: string): Promise<ScannedFile[]> {
  console.log(`[Scanner] Scanning: ${basePath}`)

  // Glob pattern for LV*.xlsx files
  const pattern = join(basePath, 'LV*.xlsx')
  const files = await glob(pattern, { windowsPathsNoEscape: true })

  console.log(`[Scanner] Found ${files.length} files`)

  const results: ScannedFile[] = []

  for (const filePath of files) {
    const filename = basename(filePath)

    try {
      const info = await extractFileInfo(filename)
      results.push({
        path: filePath,
        filename,
        auftraggeber: info.auftraggeber,
        jahr: info.jahr
      })
      console.log(`[Scanner] ${filename} → ${info.auftraggeber} (${info.jahr})`)
    } catch (err) {
      console.error(`[Scanner] Failed to extract info from ${filename}:`, err)
      results.push({
        path: filePath,
        filename,
        auftraggeber: null,
        jahr: null
      })
    }
  }

  return results
}

// Simple extraction without LLM (fallback / for testing)
export function extractFileInfoSimple(filename: string): { auftraggeber: string | null; jahr: number | null } {
  // Remove LV prefix and .xlsx suffix
  const name = filename.replace(/^LV\s*/i, '').replace(/\.xlsx$/i, '')

  // Try to find year (4 digits or spaced digits)
  const yearMatch = name.match(/(\d)\s*(\d)\s*(\d)\s*(\d)/) || name.match(/(\d{4})/)
  let jahr: number | null = null

  if (yearMatch) {
    if (yearMatch.length === 5) {
      // Spaced digits like "2 0 2 6"
      jahr = parseInt(yearMatch.slice(1).join(''), 10)
    } else {
      jahr = parseInt(yearMatch[1], 10)
    }
  }

  // Try to find 2-digit year
  if (!jahr) {
    const shortYearMatch = name.match(/\b(\d{2})\b/)
    if (shortYearMatch) {
      jahr = 2000 + parseInt(shortYearMatch[1], 10)
    }
  }

  // Extract auftraggeber: everything before the year
  let auftraggeber: string | null = null
  if (jahr) {
    const yearStr = String(jahr)
    const parts = name.split(/\d/).filter(Boolean)
    if (parts.length > 0) {
      auftraggeber = parts[0].trim()
    }
  }

  return { auftraggeber, jahr }
}
