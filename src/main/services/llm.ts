import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { config } from 'dotenv'
import { app } from 'electron'
import { join } from 'path'
import { getApiKey } from './config'
import type { Activity } from '@shared/types'

// Load .env from app root (fallback for API key)
config({ path: join(app.getAppPath(), '.env') })

// Re-export Activity type for consumers that import from this module
export type { Activity }

// Schema for LLM parsing - allows nullable for fields LLM might not extract
// Note: km and auslagen are nullable here for LLM, but converted to non-nullable numbers at boundary
const LLMActivitySchema = z.object({
  auftraggeber: z.string().nullable().describe('Name des Auftraggebers/Firma'),
  thema: z.string().nullable().describe('Kunde, Kontakt oder Projekt'),
  beschreibung: z.string().describe('Beschreibung der Tätigkeit'),
  minuten: z.number().nullable().describe('Investierte Zeit in MINUTEN (30 = halbe Stunde, 60 = eine Stunde)'),
  km: z.number().nullable().describe('Gefahrene Kilometer, 0 wenn nicht erwähnt'),
  auslagen: z.number().nullable().describe('Kostenauslagen in Euro, 0 wenn nicht erwähnt'),
  datum: z.string().nullable().describe('Datum im Format YYYY-MM-DD, null = heute')
})

const SYSTEM_PROMPT = `Du bist ein Assistent zur Erfassung von Arbeitsaktivitäten eines selbstständigen Vertreters.
Heute ist: {today}

Extrahiere aus der Spracheingabe folgende Informationen:
- auftraggeber: Name der Firma, für die gearbeitet wird (z.B. "ACME GmbH", "Beispiel AG")
- thema: Kunde, Kontakt oder Projekt-Name (NICHT der Auftraggeber!)
- beschreibung: Was wurde getan?
- minuten: Zeitaufwand in MINUTEN als ganze Zahl (z.B. 5 für "5 Minuten", 30 für "halbe Stunde", 60 für "eine Stunde", 15 für "Viertelstunde")
- km: Gefahrene Kilometer (0 wenn nicht erwähnt)
- auslagen: Kosten in Euro (0 wenn nicht erwähnt)
- datum: Datum im Format YYYY-MM-DD (KRITISCH - siehe unten)

=== BEKANNTE AUFTRAGGEBER (NUR DIESE SIND GÜLTIG!) ===
{clients}

=== BEKANNTE THEMEN (falls vorhanden, nutze exakte Schreibweise) ===
{themes}

KRITISCH - THEMA ERKENNUNG:
- Wenn "Thema X" oder "Thema ist X" gesagt wird, extrahiere X als thema!
- Thema kann auch ein unbekannter Name sein (nicht nur aus der Liste)
- "Thema Lotus" → thema = "Lotus"

KRITISCH - AUFTRAGGEBER ERKENNUNG:
- Der Auftraggeber MUSS einer aus der obigen Liste sein!
- Erkenne phonetisch ähnliche Namen: "EDT"/"E.D.T." → "IDT", "Lakova"/"la Coba"/"La Cobra" → "Lakowa"
- Buchstabierte Namen wie "I-D-T" → entsprechender Name aus der Liste

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
Beispiel: "Aktivität für Firma A... ach nein, es war für Firma B" → auftraggeber = "Firma B"

Weitere Regeln:
- Zeitangaben IN MINUTEN: "5 Minuten" = 5, "halbe Stunde" = 30, "Viertelstunde" = 15, "eine Stunde" = 60
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

export async function initLLM(): Promise<void> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in settings or environment')
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
    await initLLM()
  }

  if (!llm) {
    throw new Error('LLM not initialized')
  }

  const structuredLLM = llm.withStructuredOutput(LLMActivitySchema)

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

export async function isLLMReady(): Promise<boolean> {
  const apiKey = await getApiKey()
  return llm !== null || !!apiKey
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
- "das war eine Stunde, nicht eine halbe" → nur minuten ändern
- "Thema war eigentlich Hakobu" → nur thema ändern
- "das war im Dezember 2025" → datum auf 2025-12-15 ändern
- "das war letzten Monat" → datum auf Vormonat ändern

WICHTIG: Bei Auftraggeber-Namen die phonetisch ähnlich klingen wie ein bekannter Auftraggeber,
nutze die korrekte Schreibweise aus der Liste (z.B. "Lakova" → "Lakowa" wenn Lakowa bekannt ist).

Datum-Format: YYYY-MM-DD (z.B. 2025-12-15)
Wenn nur Monat genannt wird, nutze den 15. als Tag.

Gib die vollständige aktualisierte Aktivität zurück.`

const FOLLOWUP_PROMPT = `Du bist ein Assistent zur Erfassung von Arbeitsaktivitäten.
Heute ist: {today}

Der Benutzer hat eine Aktivität erfasst, aber folgende Felder fehlen: {missingFields}

BESTEHENDE AKTIVITÄT:
{existingActivity}

RÜCKFRAGE WAR: {question}

BENUTZERANTWORT: {userAnswer}

Extrahiere NUR die fehlenden Felder aus der Antwort.

=== BEKANNTE AUFTRAGGEBER (NUR DIESE SIND GÜLTIG!) ===
{clients}

=== BEKANNTE THEMEN (falls vorhanden, nutze exakte Schreibweise) ===
{themes}

KRITISCHE REGELN FÜR THEMA:
- Thema kann JEDER Name sein (auch wenn nicht in der Liste!)
- Wenn bekanntes Thema phonetisch ähnlich, nutze exakte Schreibweise

KRITISCHE REGELN FÜR AUFTRAGGEBER:
- Der Auftraggeber MUSS einer aus der obigen Liste sein!
- Erkenne phonetisch ähnliche Namen und mappe sie auf die bekannte Schreibweise:
  - "EDT", "E.D.T.", "Edete" → wahrscheinlich "IDT"
  - "Lakova", "la Coba", "La Cobra", "Lakowa" → "Lakowa"
  - Buchstabierte Namen wie "I-D-T" oder "E.D.T." → entsprechender Name aus der Liste
- Wenn unsicher, wähle den phonetisch ähnlichsten bekannten Auftraggeber

WEITERE REGELN:
- auftraggeber = Firma (aus BEKANNTE AUFTRAGGEBER)
- thema = Kunde, Kontakt oder Projekt (aus BEKANNTE THEMEN)
- Zeitangaben IN MINUTEN: "5 Minuten" = 5, "halbe Stunde" = 30, "Viertelstunde" = 15, "eine Stunde" = 60
- Lasse alle anderen Felder auf den bestehenden Werten

Gib die vollständige aktualisierte Aktivität zurück.`

export const FOLLOWUP_QUESTIONS: Record<string, string> = {
  auftraggeber: 'Auftraggeber',
  thema: 'Thema/Projekt',
  minuten: 'Dauer'
}

// Build combined question for all missing fields
export function buildFollowUpQuestion(missingFields: string[]): string {
  if (missingFields.length === 0) return ''

  const labels = missingFields.map(f => FOLLOWUP_QUESTIONS[f] || f)

  if (missingFields.length === 1) {
    const field = missingFields[0]
    if (field === 'auftraggeber') return 'Für welchen Auftraggeber war das?'
    if (field === 'thema') return 'Um welches Thema oder Projekt ging es?'
    if (field === 'minuten') return 'Wie lange hat das gedauert?'
    return `Was ist ${labels[0]}?`
  }

  return `Was fehlt noch: ${labels.join(', ')}?`
}

export async function parseFollowUpAnswer(
  existingActivity: Activity,
  userAnswer: string,
  missingFields: string[],
  question: string,
  clients: string[] = [],
  themes: string[] = []
): Promise<Activity> {
  if (!llm) {
    await initLLM()
  }

  if (!llm) {
    throw new Error('LLM not initialized')
  }

  const structuredLLM = llm.withStructuredOutput(LLMActivitySchema)

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const activityStr = Object.entries(existingActivity)
    .map(([k, v]) => `- ${k}: ${v ?? 'nicht angegeben'}`)
    .join('\n')

  const prompt = FOLLOWUP_PROMPT
    .replace('{today}', today)
    .replace('{missingFields}', missingFields.join(', '))
    .replace('{existingActivity}', activityStr)
    .replace('{question}', question)
    .replace('{userAnswer}', userAnswer)
    .replace('{clients}', clients.length > 0 ? clients.join(', ') : 'keine bekannt')
    .replace('{themes}', themes.length > 0 ? themes.join(', ') : 'keine bekannt')

  const result = await structuredLLM.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: userAnswer }
  ])

  const todayISO = new Date().toISOString().split('T')[0]

  // Merge: LLM result overwrites existing ONLY if not null
  // This preserves existing values when LLM returns null for non-asked fields
  return {
    auftraggeber: result.auftraggeber ?? existingActivity.auftraggeber,
    thema: result.thema ?? existingActivity.thema,
    beschreibung: result.beschreibung || existingActivity.beschreibung,
    minuten: result.minuten ?? existingActivity.minuten,
    datum: result.datum ?? existingActivity.datum ?? todayISO,
    km: result.km ?? existingActivity.km ?? 0,
    auslagen: result.auslagen ?? existingActivity.auslagen ?? 0
  }
}

export async function parseCorrection(
  existingActivity: Activity,
  correctionTranscript: string,
  clients: string[] = []
): Promise<Activity> {
  if (!llm) {
    await initLLM()
  }

  if (!llm) {
    throw new Error('LLM not initialized')
  }

  const structuredLLM = llm.withStructuredOutput(LLMActivitySchema)

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

  // Merge: LLM result overwrites existing ONLY if not null
  // This preserves existing values when LLM returns null for unchanged fields
  const todayISO = new Date().toISOString().split('T')[0]

  return {
    auftraggeber: result.auftraggeber ?? existingActivity.auftraggeber,
    thema: result.thema ?? existingActivity.thema,
    beschreibung: result.beschreibung || existingActivity.beschreibung,
    minuten: result.minuten ?? existingActivity.minuten,
    datum: result.datum ?? existingActivity.datum ?? todayISO,
    km: result.km ?? existingActivity.km ?? 0,
    auslagen: result.auslagen ?? existingActivity.auslagen ?? 0
  }
}
