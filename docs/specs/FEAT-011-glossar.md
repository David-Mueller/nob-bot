# FEAT-011: Glossar-Sheet für Standardisierung

## Übersicht

Jede Excel-Datei (.xlsx) enthält ein "Glossar"-Sheet mit standardisierten Schreibweisen für Themen, Kunden, Auftraggeber und andere Begriffe. Diese Schreibweisen werden bei der LLM-Verarbeitung und Speicherung automatisch angewendet.

## Anforderungen

### Glossar-Sheet Struktur

Das Sheet "Glossar" enthält folgende Spalten:

| Spalte | Beschreibung | Beispiel |
|--------|--------------|----------|
| Kategorie | Art des Eintrags | `Auftraggeber`, `Thema`, `Kunde`, `Sonstiges` |
| Begriff | Standardisierte Schreibweise | `LOTUS` |
| Synonyme | Komma-getrennte Alternativen | `lotus, Lotus, LOTUS GmbH` |

### Beispiel Glossar-Daten

```
Kategorie    | Begriff      | Synonyme
-------------|--------------|----------------------------------
Auftraggeber | IDT          | idt, Idt, IDT GmbH
Auftraggeber | LOTUS        | lotus, Lotus, LOTUS GmbH
Auftraggeber | ORLEN        | orlen, Orlen, PKN Orlen
Kunde        | Krzysztof    | Kschischthoff, Krschischtoff, Christoph
Kunde        | Szymański    | Schimansky, Schimanski, Szymanski
Thema        | Schulung     | schulung, Training, training
```

### Funktionale Anforderungen

1. **Glossar laden**
   - Beim Start: Glossar aus aktiver Excel-Datei lesen
   - Cache im Speicher für schnellen Zugriff
   - Reload bei Datei-Wechsel

2. **LLM-Integration**
   - Bekannte Begriffe an LLM-Prompt übergeben
   - LLM erhält Liste aller standardisierten Schreibweisen
   - Nach LLM-Antwort: Finaler Abgleich mit Glossar

3. **Normalisierung**
   - Case-insensitive Matching
   - Fuzzy-Match für ähnliche Schreibweisen (optional)
   - Polnische Sonderzeichen berücksichtigen (ł, ą, ę, ś, ć, ź, ż, ó, ń)

4. **UI-Feedback**
   - Bei Korrektur: Anzeigen was korrigiert wurde
   - Möglichkeit, neue Begriffe zum Glossar hinzuzufügen

## Technische Umsetzung

### Datenstruktur

```typescript
type GlossarKategorie = 'Auftraggeber' | 'Thema' | 'Kunde' | 'Sonstiges'

type GlossarEintrag = {
  kategorie: GlossarKategorie
  begriff: string           // Standardisierte Schreibweise
  synonyme: string[]        // Alternative Schreibweisen
}

type Glossar = {
  eintraege: GlossarEintrag[]
  byKategorie: Map<GlossarKategorie, GlossarEintrag[]>
  lookupMap: Map<string, string>  // synonym (lowercase) -> begriff
}
```

### Service-Funktionen

```typescript
// glossar.ts
loadGlossar(xlsxPath: string): Promise<Glossar>
normalizeText(text: string, glossar: Glossar): string
getKnownTerms(glossar: Glossar, kategorie: GlossarKategorie): string[]
addGlossarEntry(xlsxPath: string, entry: GlossarEintrag): Promise<void>
```

### LLM-Prompt Erweiterung

```
Bekannte Auftraggeber: {glossar.auftraggeber}
Bekannte Themen: {glossar.themen}
Bekannte Kunden: {glossar.kunden}

WICHTIG: Verwende EXAKT die angegebenen Schreibweisen!
```

## Abhängigkeiten

- FEAT-006: Excel Service (Lesen/Schreiben)
- exceljs Bibliothek

## Akzeptanzkriterien

- [ ] Glossar-Sheet wird aus Excel gelesen
- [ ] LLM nutzt Glossar-Begriffe für Normalisierung
- [ ] "lotus" wird zu "LOTUS" korrigiert
- [ ] "Kschischthoff" wird zu "Krzysztof" korrigiert
- [ ] UI zeigt angewendete Korrekturen an
- [ ] Neue Begriffe können hinzugefügt werden

## Priorität

Hoch - Verbessert Datenqualität erheblich

## Geschätzter Aufwand

- Glossar-Parser: 2h
- LLM-Integration: 1h
- Normalisierungs-Logik: 2h
- UI für Korrekturen: 1h
