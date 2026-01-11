# Aktivitäten - Spezifikation

## Projektübersicht

**Aktivitäten** ist eine Desktop-Anwendung für selbstständige Vertreter und Berater zur Erfassung von Tätigkeiten per Spracheingabe. Die App ermöglicht schnelles Protokollieren von Kundenaktivitäten, Fahrtkosten und Zeitaufwänden – direkt in bestehende Excel-Dateien.

### Kernproblem

Ein selbstständiger Vertreter betreut mehrere Auftraggeber und führt täglich zahlreiche Aktivitäten durch (Kundengespräche, Akquise, Organisation). Diese müssen dokumentiert werden für:
- Abrechnung gegenüber Auftraggebern
- Nachvollziehbarkeit bei Reklamationen
- Übersicht über geleistete Arbeit und Fahrten

Bisher: Manuelle Pflege von Excel-Listen – zeitaufwändig und fehleranfällig.

### Lösung

Spracheingabe-gestützte Erfassung: Der Nutzer spricht eine Aktivität ein, das System erkennt und strukturiert die Daten automatisch und trägt sie in die richtige Excel-Datei ein.

---

## Nutzer & Kontext

| Attribut | Wert |
|----------|------|
| Zielnutzer | Selbstständiger Vertreter/Berater/Dealmaker |
| Auftraggeber | 2 (erweiterbar) |
| Themen pro Auftraggeber/Jahr | ~50 |
| Einträge pro Monat | ~200 |
| Plattform | Windows (ThinkPad) |
| Bestehendes System | Excel-Dateien (.xlsx) pro Auftraggeber |

---

## Datenmodell

### Aktivität (Excel-Zeile)

| Spalte | Typ | Beschreibung | Pflicht |
|--------|-----|--------------|---------|
| Datum | Date | Tag der Aktivität | Ja (Default: heute) |
| Auftraggeber | String | Firma, für die gearbeitet wird | Ja |
| Thema | String | Kunde/Kontakt/Projekt (standardisiert) | Ja |
| Beschreibung | String | Freitext zur Tätigkeit | Ja |
| Stunden | Number | Investierte Zeit | Ja |
| KM | Number | Gefahrene Kilometer | Nein (Default: 0) |
| Auslagen | Number | Kosten (Hotel, etc.) | Nein (Default: 0) |

### Excel-Struktur

- Pro Auftraggeber eine `.xlsx`-Datei
- Neue Einträge werden am Ende angehängt
- Spaltenüberschriften in Zeile 1
- Dateipfade konfigurierbar (neue Auftraggeber hinzufügbar)

### Themen-Register

- Themen werden aus bestehenden Excel-Dateien extrahiert
- Bei Spracheingabe: Fuzzy-Matching gegen bekannte Themen
- Neue Themen werden automatisch ins Register aufgenommen

---

## Meilensteine

### Meilenstein 1: Datenpflege via Spracheingabe (MVP)

**Ziel:** Neue Aktivitäten per Sprache erfassen und in Excel speichern.

**Features:**
- [ ] System-Tray-App für Windows
- [ ] Globaler Hotkey startet Aufnahme
- [ ] Lokale Spracherkennung (Whisper, Deutsch)
- [ ] LLM-basiertes Parsing der Spracheingabe
- [ ] Automatische Zuordnung zu Auftraggeber/Thema
- [ ] Rückfragen bei fehlenden Pflichtfeldern
- [ ] Excel-Eintrag schreiben
- [ ] Basic UI: Aufnahme-Status, letzte Einträge, Einstellungen

### Meilenstein 2: Insights & Beratung (Später)

**Ziel:** Auswertungen und KI-gestützte Beratung auf Basis der Daten.

**Mögliche Features:**
- Zeitauswertungen pro Auftraggeber/Thema
- KM-Übersichten
- Abrechnungsvorlagen
- Kontextsuche ("Was habe ich zuletzt mit Kunde X besprochen?")
- Proaktive Hinweise

---

## User Interface

### Systemverhalten

```
┌─────────────────────────────────────────────────────────────┐
│ 1. App läuft im System-Tray (minimiert)                     │
│ 2. Nutzer drückt Hotkey (z.B. Strg+Shift+A)                 │
│ 3. Aufnahme-Fenster erscheint mit visuellem Indikator       │
│ 4. Nutzer spricht Aktivität ein                             │
│ 5. Nutzer beendet mit Hotkey oder Enter                     │
│ 6. System transkribiert und parsed                          │
│ 7. Bei fehlenden Daten: Rückfrage-Dialog                    │
│ 8. Bestätigung + Eintrag in Excel                           │
│ 9. Fenster verschwindet oder zeigt letzte Einträge          │
└─────────────────────────────────────────────────────────────┘
```

### Aufnahme-Fenster

```
┌─────────────────────────────────────────┐
│  ● Aufnahme läuft...                    │  ← Roter Punkt = visuelles Signal
│                                         │
│  "neuer eintrag idt, thema lotus..."    │  ← Live-Transkription (optional)
│                                         │
│  [Enter] Fertig    [Esc] Abbrechen      │
└─────────────────────────────────────────┘
```

### Rückfrage-Dialog

Bei fehlenden Pflichtfeldern (z.B. Stunden nicht genannt):

```
┌─────────────────────────────────────────┐
│  Wie viel Zeit wurde investiert?        │
│                                         │
│  🎤 [Spracheingabe]  oder  [___] Minuten│
│                                         │
│  [Bestätigen]    [Abbrechen]            │
└─────────────────────────────────────────┘
```

- Rückfragen via Text-Dialog
- Antwort via Sprache oder Texteingabe möglich
- (Luxus/Später: Sprachausgabe der Fragen)

### Hauptfenster (Basic UI)

```
┌─────────────────────────────────────────────────────────────┐
│  Aktivitäten                                    [_][□][X]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Letzte Einträge:                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 10.01. │ IDT │ Lotus │ Anfrage aufbereitet │ 0.5h   │    │
│  │ 10.01. │ IDT │ Weber │ Telefonat Angebot   │ 0.25h  │    │
│  │ 09.01. │ ABC │ Müller│ Vor-Ort-Termin      │ 2h 45km│    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [🎤 Neue Aktivität]              [⚙ Einstellungen]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Einstellungen

```
┌─────────────────────────────────────────────────────────────┐
│  Einstellungen                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hotkey: [Strg+Shift+A]                                     │
│                                                             │
│  Excel-Dateien:                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ IDT     │ C:\Users\...\aktivitaeten_idt.xlsx  [📁]    │  │
│  │ ABC     │ C:\Users\...\aktivitaeten_abc.xlsx  [📁]    │  │
│  │ [+ Neuer Auftraggeber]                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  LLM Provider: [Claude ▼]                                   │
│  API Key: [••••••••••••••••]                                │
│                                                             │
│  [Speichern]                                                │
└─────────────────────────────────────────────────────────────┘
```

### Feedback

- **Kein Audio-Feedback** (kein Beep)
- **Visuelles Feedback:**
  - Roter Punkt / Pulsierender Indikator bei Aufnahme
  - Grüner Haken bei erfolgreichem Eintrag
  - Gelbe Warnung bei Rückfrage
  - Kurze Toast-Notification bei Erfolg

---

## Beispiel-Workflow

### Spracheingabe

**User sagt:**
> "Neuer Eintrag IDT, Thema Lotus. Anfrage zu Abstellung 2026 geprüft, aufbereitet und an Sylvia versendet. Halbe Stunde Arbeit."

**System erkennt:**

| Feld | Wert | Quelle |
|------|------|--------|
| Auftraggeber | IDT | "IDT" im Text |
| Thema | Lotus | "Thema Lotus" |
| Beschreibung | Anfrage zu Abstellung 2026 geprüft, aufbereitet und an Sylvia versendet | Restsatz |
| Stunden | 0.5 | "halbe Stunde" |
| Datum | 2025-01-10 | Implizit (heute) |
| KM | 0 | Nicht genannt |
| Auslagen | 0 | Nicht genannt |

**System schreibt in:** `aktivitaeten_idt.xlsx`

### Rückfrage-Szenario

**User sagt:**
> "Eintrag für ABC, Telefonat mit Schneider wegen Lieferverzug"

**System erkennt:**
- Auftraggeber: ABC ✓
- Thema: Schneider ✓
- Beschreibung: Telefonat wegen Lieferverzug ✓
- Stunden: ❌ Fehlt!

**System fragt:**
> "Wie viel Zeit wurde investiert?"

**User antwortet (Sprache oder Text):**
> "15 Minuten"

**System vervollständigt und speichert.**

---

## Technische Architektur

### Version Policy

Wir nutzen **aktuelle stabile Versionen** (Stand Januar 2026). Bei Installation immer aktuelle Versionen prüfen.

### Tech-Stack

| Komponente | Technologie | Version (Jan 2026) |
|------------|-------------|-------------------|
| Runtime | Node.js / TypeScript | Node 22.x, TS 5.7 |
| Desktop-Framework | Electron | 39.x |
| Build-Tool | electron-vite | 5.x |
| UI-Framework | Vue 3 (Composition API) | 3.5.x |
| Styling | Tailwind CSS | 4.x |
| Sprache-zu-Text | @xenova/transformers (Whisper, lokal) | 2.x |
| LLM-Integration | LangChain (@langchain/anthropic, @langchain/openai) | 0.3.x |
| Excel-Bearbeitung | exceljs | 4.x |
| Packaging | electron-builder | 25.x |

### Security Best Practices (Electron 39.x)

1. **Context Isolation aktiviert** (default seit Electron 12)
2. **Sandbox für Renderer** aktiviert (default seit Electron 20)
3. **nodeIntegration deaktiviert** - Kommunikation nur via Preload Scripts
4. **IPC Nachrichten validieren** - Sender immer prüfen
5. **Keine Remote Module** - deprecated und unsicher
6. **CSP definieren** - Content Security Policy im HTML

Referenz: [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)

### Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron App                            │
├──────────────────────┬──────────────────────────────────────┤
│    Main Process      │         Renderer Process             │
├──────────────────────┼──────────────────────────────────────┤
│                      │                                      │
│  ┌────────────────┐  │  ┌────────────────────────────────┐  │
│  │ Global Hotkey  │  │  │         Vue 3 UI               │  │
│  └───────┬────────┘  │  │  ┌──────────────────────────┐  │  │
│          │           │  │  │  Aufnahme-Komponente     │  │  │
│  ┌───────▼────────┐  │  │  │  - Mikrofon-Zugriff      │  │  │
│  │  Tray Manager  │  │  │  │  - Visuelles Feedback    │  │  │
│  └────────────────┘  │  │  └──────────────────────────┘  │  │
│                      │  │                                │  │
│  ┌────────────────┐  │  │  ┌──────────────────────────┐  │  │
│  │ Whisper Worker │◄─┼──┼──│  Einträge-Liste          │  │  │
│  │ (lokal)        │  │  │  └──────────────────────────┘  │  │
│  └───────┬────────┘  │  │                                │  │
│          │           │  │  ┌──────────────────────────┐  │  │
│  ┌───────▼────────┐  │  │  │  Einstellungen           │  │  │
│  │ LangChain      │  │  │  └──────────────────────────┘  │  │
│  │ (Claude/OpenAI)│  │  └────────────────────────────────┘  │
│  └───────┬────────┘  │                                      │
│          │           │                                      │
│  ┌───────▼────────┐  │                                      │
│  │ Excel Service  │  │                                      │
│  │ (exceljs)      │  │                                      │
│  └───────┬────────┘  │                                      │
│          │           │                                      │
│          ▼           │                                      │
│  ┌────────────────┐  │                                      │
│  │ .xlsx Dateien  │  │                                      │
│  └────────────────┘  │                                      │
│                      │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

### Datenfluss

```
┌──────────┐    ┌─────────┐    ┌──────────┐    ┌───────┐    ┌───────┐
│  Sprache │───▶│ Whisper │───▶│ LangChain│───▶│ Excel │───▶│ .xlsx │
│  (Audio) │    │ (Text)  │    │ (Struct) │    │Service│    │ File  │
└──────────┘    └─────────┘    └──────────┘    └───────┘    └───────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │ Rückfrage│ (falls Daten fehlen)
                              └──────────┘
```

### LLM Prompt (Intent-Parsing)

```typescript
const systemPrompt = `
Du bist ein Assistent zur Erfassung von Arbeitsaktivitäten.
Extrahiere aus der Spracheingabe folgende Felder:

- auftraggeber: Name der Firma (bekannte: IDT, ABC, ...)
- thema: Kunde/Kontakt/Projekt
- beschreibung: Was wurde getan?
- stunden: Zeitaufwand als Dezimalzahl
- km: Gefahrene Kilometer (0 wenn nicht genannt)
- auslagen: Kosten in Euro (0 wenn nicht genannt)
- datum: Datum (heute wenn nicht genannt)

Antworte im JSON-Format.
`;
```

### Datei-Struktur

```
aktivitaeten/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── index.ts             # Entry Point
│   │   ├── tray.ts              # System Tray Management
│   │   ├── hotkey.ts            # Global Shortcuts
│   │   ├── services/
│   │   │   ├── whisper.ts       # Speech-to-Text
│   │   │   ├── llm.ts           # LangChain Integration
│   │   │   └── excel.ts         # Excel Read/Write
│   │   └── ipc/                 # IPC Handlers
│   │       └── handlers.ts
│   │
│   ├── renderer/                # Vue App
│   │   ├── App.vue
│   │   ├── main.ts
│   │   ├── components/
│   │   │   ├── RecordingWindow.vue
│   │   │   ├── EntryList.vue
│   │   │   ├── FollowUpDialog.vue
│   │   │   └── Settings.vue
│   │   ├── stores/              # Pinia Stores
│   │   │   ├── recording.ts
│   │   │   ├── entries.ts
│   │   │   └── settings.ts
│   │   └── styles/
│   │       └── main.css         # Tailwind
│   │
│   ├── shared/                  # Shared Types
│   │   └── types.ts
│   │
│   └── preload/                 # Preload Scripts
│       └── index.ts
│
├── resources/                   # App Icons, etc.
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

---

## Konfiguration

### Settings (JSON)

```json
{
  "hotkey": "CommandOrControl+Shift+A",
  "llmProvider": "claude",
  "llmApiKey": "sk-...",
  "clients": [
    {
      "id": "idt",
      "name": "IDT",
      "excelPath": "C:\\Users\\Norbert\\Documents\\aktivitaeten_idt.xlsx"
    },
    {
      "id": "abc",
      "name": "ABC",
      "excelPath": "C:\\Users\\Norbert\\Documents\\aktivitaeten_abc.xlsx"
    }
  ],
  "whisperModel": "base",
  "language": "de"
}
```

---

## Offene Punkte / Entscheidungen

| # | Thema | Status | Notizen |
|---|-------|--------|---------|
| 1 | Whisper-Modell (tiny/base/small) | Offen | Base als Default, konfigurierbar |
| 2 | Live-Transkription während Aufnahme | Nice-to-have | Später |
| 3 | Artefakte-Zuordnung (Dateien, E-Mails) | M2 | Nicht in M1 |
| 4 | Mobile App / Handy-Eingabe | Später | Separates Projekt |
| 5 | Backup-Strategie für Excel-Dateien | Empfohlen | Vor jedem Schreibvorgang |
| 6 | Multi-Language Support | Nein | Deutsch only |

---

## Nächste Schritte

1. **Projekt-Setup:** electron-vite + Vue + Tailwind initialisieren
2. **Basis-UI:** Tray-Icon + Hauptfenster + Aufnahme-Dialog
3. **Audio-Aufnahme:** MediaRecorder Integration
4. **Whisper-Integration:** @xenova/transformers einbinden
5. **LLM-Parsing:** LangChain mit Structured Output
6. **Excel-Service:** Lesen/Schreiben mit exceljs
7. **Settings:** Konfiguration persistent speichern
8. **Testing:** Manuell auf Windows testen
9. **Packaging:** .exe Installer erstellen

---

## Glossar

| Begriff | Bedeutung |
|---------|-----------|
| Auftraggeber | Firma, in deren Namen/Auftrag gearbeitet wird |
| Thema | Kunde, Kontakt oder Projekt innerhalb eines Auftraggebers |
| Aktivität | Einzelner Arbeitseintrag mit Zeit, Beschreibung, etc. |
| Tray | System-Tray / Benachrichtigungsbereich in Windows |

---

*Erstellt: 2025-01-10*
*Version: 1.0*
*Status: Bereit für Implementierung*
