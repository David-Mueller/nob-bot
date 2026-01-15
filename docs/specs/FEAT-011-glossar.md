# FEAT-011: Glossar-Sheet für Standardisierung

**Status: ✅ Implementiert**

## Übersicht

Jede Excel-Datei (.xlsx) enthält ein "Glossar"-Sheet mit standardisierten Schreibweisen für Themen, Kunden, Auftraggeber und andere Begriffe. Diese werden bei der LLM-Verarbeitung automatisch verwendet.

## Anforderungen

### Glossar-Sheet Struktur

| Spalte | Beschreibung | Beispiel |
|--------|--------------|----------|
| Kategorie | Art des Eintrags | `Auftraggeber`, `Thema`, `Kunde`, `Sonstiges` |
| Begriff | Standardisierte Schreibweise | `LOTUS` |
| Synonyme | Komma-getrennte Alternativen | `lotus, Lotus, LOTUS GmbH` |

### Beispiel Glossar-Daten

```
Kategorie    | Begriff      | Synonyme
-------------|--------------|----------------------------------
Auftraggeber | IDT          | idt, Idt, IDT GmbH, EDT, E.D.T.
Auftraggeber | Lakowa       | Lakova, la Coba, La Cobra
Kunde        | Krzysztof    | Kschischthoff, Krschischtoff
Thema        | Schulung     | schulung, Training
```

## Technische Umsetzung (src/main/services/glossar.ts)

### Datenstrukturen

```typescript
export type GlossarKategorie = 'Auftraggeber' | 'Thema' | 'Kunde' | 'Sonstiges'

export type GlossarEintrag = {
  kategorie: GlossarKategorie
  begriff: string           // Standardized spelling
  synonyme: string[]        // Alternative spellings
}

export type Glossar = {
  eintraege: GlossarEintrag[]
  byKategorie: Map<GlossarKategorie, GlossarEintrag[]>
  lookupMap: Map<string, string>  // synonym (lowercase) -> begriff
}
```

### Service-Funktionen

```typescript
// Load glossar from Excel file's "Glossar" sheet (with caching)
loadGlossar(xlsxPath: string): Promise<Glossar | null>

// Load and merge glossars from multiple files
loadGlossarsFromPaths(paths: string[]): Promise<Glossar | null>

// Normalize text using lookup map
normalizeText(text: string, glossar: Glossar): string

// Get known terms for LLM prompt
getKnownTerms(glossar: Glossar, kategorie: GlossarKategorie): string[]
getAllKnownTerms(glossar: Glossar): { auftraggeber, themen, kunden }

// Clear cache (when file changes)
clearGlossarCache(xlsxPath?: string): void

// Create Glossar sheet from existing data
createGlossarSheet(xlsxPath: string, auftraggeber: string): Promise<Glossar | null>

// Ensure Glossar exists, create if missing
ensureGlossar(xlsxPath: string, auftraggeber: string): Promise<Glossar | null>
```

### IPC Handler (src/main/ipc/glossarHandlers.ts)

```typescript
ipcMain.handle('glossar:reload', async () => reloadGlossar())
ipcMain.handle('glossar:getClients', () => getCurrentClients())
ipcMain.handle('glossar:getThemes', () => getCurrentThemes())
```

### LLM-Integration (src/main/services/llm.ts)

Bekannte Begriffe werden an LLM-Prompt übergeben:

```typescript
const SYSTEM_PROMPT = `
=== BEKANNTE AUFTRAGGEBER (NUR DIESE SIND GÜLTIG!) ===
{clients}

=== BEKANNTE THEMEN (falls vorhanden, nutze exakte Schreibweise) ===
{themes}

KRITISCH - AUFTRAGGEBER ERKENNUNG:
- Der Auftraggeber MUSS einer aus der obigen Liste sein!
- Erkenne phonetisch ähnliche Namen: "EDT"/"E.D.T." → "IDT", "Lakova"/"la Coba"/"La Cobra" → "Lakowa"
`

// parseActivity receives clients and themes from glossar
export async function parseActivity(
  transcript: string,
  clients: string[] = [],
  themes: string[] = []
): Promise<Activity>
```

### Auto-Erstellung

Wenn kein Glossar-Sheet existiert, wird es automatisch aus vorhandenen Daten erstellt:
- Auftraggeber aus der Config
- Thema-Werte werden aus allen Monats-Sheets (Spalte B) extrahiert

## Akzeptanzkriterien

- [x] Glossar-Sheet wird aus Excel gelesen
- [x] Glossar aus mehreren aktiven Dateien wird gemerged
- [x] LLM nutzt Glossar-Begriffe für Normalisierung
- [x] Case-insensitive Lookup (lotus → LOTUS)
- [x] Glossar-Sheet wird automatisch erstellt wenn nicht vorhanden
- [x] Caching für Performance
- [ ] UI zeigt angewendete Korrekturen an (future)
- [ ] Neue Begriffe können per UI hinzugefügt werden (future)

## Abhängigkeiten

- FEAT-006: Excel Service (xlsx Bibliothek)
- FEAT-012: XLSX Backup (vor Glossar-Erstellung)
