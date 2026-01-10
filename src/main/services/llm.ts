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
Heute ist: {today}

Extrahiere aus der Spracheingabe folgende Informationen:
- auftraggeber: Name der Firma, für die gearbeitet wird (z.B. "IDT", "ABC")
- thema: Kunde, Kontakt oder Projekt-Name
- beschreibung: Was wurde getan?
- stunden: Zeitaufwand als Dezimalzahl (z.B. 0.5 für "halbe Stunde", 0.25 für "Viertelstunde", 0.75 für "dreiviertel Stunde")
- km: Gefahrene Kilometer (0 wenn nicht erwähnt)
- auslagen: Kosten in Euro (0 wenn nicht erwähnt)
- datum: Datum im Format YYYY-MM-DD (KRITISCH - siehe unten)

Bekannte Auftraggeber: {clients}
Bekannte Themen: {themes}

KRITISCH - DATUM EXTRAKTION:
Das Datum bestimmt, in welches Excel-Sheet geschrieben wird! Erkenne diese Muster:
- "für Dezember 2025" → 2025-12-15 (Mitte des genannten Monats)
- "im November" → aktuelles Jahr, November, Tag 15
- "letzten Monat" → Vormonat vom heutigen Datum, Tag 15
- "gestern" → gestrige Datum
- "am 15." oder "am fünfzehnten" → aktueller Monat, Tag 15
- "am 3. Dezember" → aktueller/nächster Dezember, Tag 3
- KEINE Datumsangabe → null (Node-Prozess setzt dann "heute")

Wenn nur Monat genannt wird, nutze den 15. als Tag.
Datum muss IMMER vollständig sein: YYYY-MM-DD (oder null wenn nichts erwähnt).

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

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const prompt = SYSTEM_PROMPT
    .replace('{today}', today)
    .replace('{clients}', clients.length > 0 ? clients.join(', ') : 'keine bekannt')
    .replace('{themes}', themes.length > 0 ? themes.join(', ') : 'keine bekannt')

  const result = await structuredLLM.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: transcript }
  ])

  // Node-Prozess setzt das heutige Datum wenn LLM keines extrahiert hat
  const todayISO = new Date().toISOString().split('T')[0]

  // Apply defaults for nullable fields
  return {
    ...result,
    datum: result.datum ?? todayISO,
    km: result.km ?? 0,
    auslagen: result.auslagen ?? 0
  } as Activity
}

export function isLLMReady(): boolean {
  return llm !== null || !!process.env.OPENAI_API_KEY
}

const CORRECTION_PROMPT = `Du bist ein Assistent zur Korrektur von Arbeitsaktivitäten.
Heute ist: {today}

Der Benutzer hat eine bestehende Aktivität und möchte sie per Spracheingabe korrigieren.
Analysiere die Korrektur und aktualisiere NUR die Felder, die explizit erwähnt werden.
Alle anderen Felder bleiben unverändert.

BEKANNTE AUFTRAGGEBER: {clients}
(Nutze diese exakte Schreibweise wenn ein ähnlicher Name genannt wird!)

BESTEHENDE AKTIVITÄT:
{existingActivity}

KORREKTUR-ANWEISUNG:
{correction}

Beispiele:
- "es waren doch 500km" → nur km ändern
- "nicht IDT sondern LOTUS" → nur auftraggeber ändern
- "das war eine Stunde, nicht eine halbe" → nur stunden ändern
- "Thema war eigentlich Hakobu" → nur thema ändern
- "das war im Dezember 2025" → datum auf 2025-12-15 ändern
- "das war letzten Monat" → datum auf Vormonat ändern

WICHTIG: Bei Auftraggeber-Namen die phonetisch ähnlich klingen wie ein bekannter Auftraggeber,
nutze die korrekte Schreibweise aus der Liste (z.B. "Lakova" → "Lakowa" wenn Lakowa bekannt ist).

Datum-Format: YYYY-MM-DD (z.B. 2025-12-15)
Wenn nur Monat genannt wird, nutze den 15. als Tag.

Gib die vollständige aktualisierte Aktivität zurück.`

export async function parseCorrection(
  existingActivity: Activity,
  correctionTranscript: string,
  clients: string[] = []
): Promise<Activity> {
  if (!llm) {
    initLLM()
  }

  if (!llm) {
    throw new Error('LLM not initialized')
  }

  const structuredLLM = llm.withStructuredOutput(ActivitySchema)

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const activityStr = Object.entries(existingActivity)
    .map(([k, v]) => `- ${k}: ${v ?? 'nicht angegeben'}`)
    .join('\n')

  const prompt = CORRECTION_PROMPT
    .replace('{today}', today)
    .replace('{clients}', clients.length > 0 ? clients.join(', ') : 'keine bekannt')
    .replace('{existingActivity}', activityStr)
    .replace('{correction}', correctionTranscript)

  const result = await structuredLLM.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: correctionTranscript }
  ])

  // Behalte das ursprüngliche Datum wenn LLM keines zurückgibt
  // Falls auch das ursprüngliche null ist, nutze heute
  const todayISO = new Date().toISOString().split('T')[0]

  return {
    ...result,
    datum: result.datum ?? existingActivity.datum ?? todayISO,
    km: result.km ?? 0,
    auslagen: result.auslagen ?? 0
  } as Activity
}
