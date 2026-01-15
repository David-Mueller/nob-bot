# FEAT-014: Rückfragen bei fehlenden Feldern

**Status: ✅ Implementiert**

## Übersicht

Wenn nach der LLM-Analyse Pflichtfelder fehlen (Auftraggeber, Thema, Zeit), stellt die App automatisch Rückfragen - idealerweise per Voice, wenn die Eingabe auch per Voice war.

## Implementiert

- [x] Automatische Erkennung fehlender Pflichtfelder (auftraggeber, thema, stunden)
- [x] Automatische Voice-Rückfragen mit RecordingWindow
- [x] LLM-basiertes Parsing der Follow-up Antworten
- [x] Iteratives Nachfragen bis alle Felder gefüllt
- [x] Anzeige der Rückfrage im Chat
- [ ] Text-to-Speech (TTS) - optional, nicht implementiert

## Pflichtfelder

| Feld | Pflicht | Rückfrage |
|------|---------|-----------|
| auftraggeber | ✅ | "Für welchen Auftraggeber war das?" |
| thema | ✅ | "Um welches Thema/Projekt ging es?" |
| stunden | ✅ | "Wie lange hat das gedauert?" |
| beschreibung | ✅ | (automatisch aus Kontext) |
| km | ❌ | Optional |
| auslagen | ❌ | Optional |
| datum | ❌ | Default: heute |

## Ablauf

```
┌─────────────────────────────────────────────────────────┐
│           Spracheingabe transkribiert                    │
└─────────────────────┬───────────────────────────────────┘
                      ▼
              ┌───────────────┐
              │  LLM Parse    │
              └───────┬───────┘
                      ▼
              ┌───────────────┐
              │ Felder prüfen │
              └───────┬───────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
    ┌─────────┐              ┌─────────────┐
    │ Komplett │              │ Felder fehlen│
    └────┬────┘              └──────┬──────┘
         │                          │
         ▼                          ▼
    ┌─────────┐              ┌─────────────────┐
    │ Speichern│              │ Rückfrage       │
    └─────────┘              │ (Voice/Text)    │
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │ Antwort + Merge │
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │ Nochmal prüfen  │
                             └─────────────────┘
```

## Voice Rückfragen (Optional)

Wenn Eingabe per Voice war:
1. Text-to-Speech für Rückfrage
2. Automatisch Mikrofon aktivieren
3. Antwort transkribieren
4. Mit bestehender Activity mergen

### TTS Optionen

- **OpenAI TTS API** (empfohlen)
  - `tts-1` oder `tts-1-hd`
  - ~$0.015 / 1000 Zeichen
  - Stimmen: alloy, echo, fable, onyx, nova, shimmer

- **Browser Web Speech API** (kostenlos)
  - `speechSynthesis.speak()`
  - Qualität variiert

## UI Design

### Chat-Stil Rückfrage

```
┌─────────────────────────────────────────┐
│ 👤 "Neues Projekt akquiriert, Thema     │
│    Hakobu, 200km gefahren"              │
│                        Cloud | Deutsch  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🤖 Erkannte Aktivität:                  │
│    Thema: Hakobu                        │
│    Beschreibung: Neues Projekt akquiriert│
│    KM: 200                              │
│                                         │
│    ⚠️ Fehlend: Auftraggeber, Zeit       │
│                                         │
│    🎤 "Für welchen Auftraggeber?"       │
│    [Antworten] [Überspringen]           │
└─────────────────────────────────────────┘

👤 "IDT, eine halbe Stunde"
                        Cloud | Deutsch

┌─────────────────────────────────────────┐
│ 🤖 ✅ Aktivität vollständig:            │
│    Auftraggeber: IDT                    │
│    Thema: Hakobu                        │
│    Beschreibung: Neues Projekt akquiriert│
│    Zeit: 0.5h                           │
│    KM: 200                              │
│                                         │
│    [Speichern] [Bearbeiten]             │
└─────────────────────────────────────────┘
```

## Technische Umsetzung

### Merge-Logik

```typescript
async function askFollowUp(
  activity: Activity,
  missingFields: string[]
): Promise<Activity> {
  // Generiere Frage basierend auf fehlenden Feldern
  const question = generateQuestion(missingFields)

  // TTS (optional)
  await speak(question)

  // Warte auf Antwort (Voice oder Text)
  const answer = await getAnswer()

  // Parse Antwort mit Kontext
  const updates = await parseFollowUpAnswer(answer, missingFields)

  // Merge
  return { ...activity, ...updates }
}
```

### LLM Follow-Up Prompt

```
Der Benutzer hat eine Aktivität erfasst, aber folgende Felder fehlen: {missingFields}

Bestehende Aktivität:
{existingActivity}

Benutzerantwort auf Rückfrage:
{userAnswer}

Extrahiere NUR die fehlenden Felder aus der Antwort.
```

## Priorität

Hoch - Verbessert UX erheblich

## Abhängigkeiten

- Whisper API (bereits implementiert)
- Optional: OpenAI TTS API für Voice-Rückfragen
