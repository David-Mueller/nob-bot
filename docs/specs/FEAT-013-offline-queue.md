# FEAT-013: Offline-Queue für Aktivitäten

## Übersicht

Wenn offline, werden Transkriptionen lokal gespeichert und bei Internetverbindung nachträglich mit LLM verarbeitet und in Excel gespeichert.

## Ablauf

```
┌─────────────────────────────────────────────────────────┐
│                    AUFNAHME                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │   Online?     │
              └───────┬───────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
    ┌─────────┐              ┌─────────┐
    │   JA    │              │  NEIN   │
    └────┬────┘              └────┬────┘
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│ Cloud Whisper   │      │ Lokal Whisper   │
│ + LLM Parse     │      │ → Queue         │
│ + Excel Save    │      └────────┬────────┘
└─────────────────┘               │
                                  ▼
                         ┌─────────────────┐
                         │ Pending Entry:  │
                         │ - transcript    │
                         │ - timestamp     │
                         │ - audio (opt)   │
                         └─────────────────┘
                                  │
                         (später online)
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Queue Worker:   │
                         │ - LLM Parse     │
                         │ - Excel Save    │
                         │ - Entry löschen │
                         └─────────────────┘
```

## Datenstruktur

```typescript
type PendingEntry = {
  id: string
  createdAt: string           // ISO timestamp
  transcript: string          // Lokale Whisper-Transkription
  audioPath?: string          // Optional: Audio für Cloud-Retranskription
  status: 'pending' | 'processing' | 'failed'
  retries: number
  lastError?: string
}
```

## Speicherort

```
~/.aktivitaeten/
└── queue/
    ├── pending.json          # Liste aller ausstehenden Einträge
    └── audio/
        ├── entry-001.webm    # Optional: Audio-Dateien
        └── entry-002.webm
```

## Queue Worker

- Startet bei App-Start
- Prüft alle 30 Sekunden auf Internetverbindung
- Bei Verbindung: Arbeitet Queue ab
- Max 3 Retries pro Eintrag
- Bei Erfolg: Eintrag + Audio löschen

## UI-Anzeige

- Badge im Header: "3 ausstehend"
- Gelber Hinweis bei offline Transkription
- Liste der ausstehenden Einträge einsehbar

## Priorität

Niedrig - Nice-to-have Feature

## Abhängigkeiten

- FEAT-006: Excel Service
- OpenAI Whisper API (bereits implementiert)
