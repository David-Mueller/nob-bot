import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { config } from 'dotenv'
import { app } from 'electron'
import { join } from 'path'

// Load .env from app root
config({ path: join(app.getAppPath(), '.env') })

// Schema for parsed activity - no .default() for OpenAI compatibility
export const ActivitySchema = z.object({
  auftraggeber: z.string().nullable().describe('Name des Auftraggebers/Firma'),
  thema: z.string().nullable().describe('Kunde, Kontakt oder Projekt'),
  beschreibung: z.string().describe('Beschreibung der Tätigkeit'),
  stunden: z.number().nullable().describe('Investierte Zeit in Stunden (0.5 = halbe Stunde)'),
  km: z.number().nullable().describe('Gefahrene Kilometer, 0 wenn nicht erwähnt'),
  auslagen: z.number().nullable().describe('Kostenauslagen in Euro, 0 wenn nicht erwähnt'),
  datum: z.string().nullable().describe('Datum im Format YYYY-MM-DD, null = heute')
})

export type Activity = z.infer<typeof ActivitySchema>

const SYSTEM_PROMPT = `Du bist ein Assistent zur Erfassung von Arbeitsaktivitäten eines selbstständigen Vertreters.

Extrahiere aus der Spracheingabe folgende Informationen:
- auftraggeber: Name der Firma, für die gearbeitet wird (z.B. "IDT", "ABC")
- thema: Kunde, Kontakt oder Projekt-Name
- beschreibung: Was wurde getan?
- stunden: Zeitaufwand als Dezimalzahl (z.B. 0.5 für "halbe Stunde", 0.25 für "Viertelstunde", 0.75 für "dreiviertel Stunde")
- km: Gefahrene Kilometer (0 wenn nicht erwähnt)
- auslagen: Kosten in Euro (0 wenn nicht erwähnt)
- datum: Datum falls erwähnt, sonst null

Bekannte Auftraggeber: {clients}
Bekannte Themen: {themes}

KRITISCH - SELBSTKORREKTUREN BEACHTEN:
Der Sprecher korrigiert sich oft während der Aufnahme! Achte auf Phrasen wie:
- "Ach nein, das war nicht X, es war Y" → Nutze Y, nicht X
- "Moment, ich meinte..." → Nutze die Korrektur
- "Nein, falsch, es war..." → Nutze den korrigierten Wert
- "Nicht X sondern Y" → Nutze Y
Beispiel: "Aktivität für EDT... ach nein, es war für Erdbeerland" → auftraggeber = "Erdbeerland"

Weitere Regeln:
- Zeitangaben: "halbe Stunde" = 0.5, "Viertelstunde" = 0.25, "eine Stunde" = 1.0
- Wenn etwas nicht klar ist, setze null
- Beschreibung: Kern der Tätigkeit zusammenfassen (ohne Korrekturen/Versprecher)

POLNISCHE NAMEN - phonetisch geschriebene Namen korrigieren:
- "Kschischthoff/Krschischtoff" → "Krzysztof"
- "Kowalski/Kowalsky" → "Kowalski"
- "Schimansky/Schimanski" → "Szymański"
- Erkenne polnische Endungen: -ski, -wicz, -czyk, -owski`

let llm: ChatOpenAI | null = null

// Default to gpt-4o for better understanding, configurable via OPENAI_MODEL env var
// gpt-4.1-mini struggles with self-corrections like "ach nein, es war für X"
const DEFAULT_MODEL = 'gpt-4o'

export function initLLM(): void {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment')
  }

  const modelName = process.env.OPENAI_MODEL || DEFAULT_MODEL
  console.log(`[LLM] Using model: ${modelName}`)

  llm = new ChatOpenAI({
    modelName,
    temperature: 0,
    apiKey
  })
}

export async function parseActivity(
  transcript: string,
  clients: string[] = [],
  themes: string[] = []
): Promise<Activity> {
  if (!llm) {
    initLLM()
  }

  if (!llm) {
    throw new Error('LLM not initialized')
  }

  const structuredLLM = llm.withStructuredOutput(ActivitySchema)

  const prompt = SYSTEM_PROMPT
    .replace('{clients}', clients.length > 0 ? clients.join(', ') : 'keine bekannt')
    .replace('{themes}', themes.length > 0 ? themes.join(', ') : 'keine bekannt')

  const result = await structuredLLM.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: transcript }
  ])

  // Apply defaults for nullable number fields
  return {
    ...result,
    km: result.km ?? 0,
    auslagen: result.auslagen ?? 0
  } as Activity
}

export function isLLMReady(): boolean {
  return llm !== null || !!process.env.OPENAI_API_KEY
}
