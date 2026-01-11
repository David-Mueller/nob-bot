# FEAT-015: TTS für Voice-Rückfragen

## Übersicht

Bei fehlenden Pflichtfeldern stellt das System Rückfragen. Diese Fragen sollen per Text-to-Speech (TTS) vorgelesen werden, damit der Benutzer ohne Blick auf den Bildschirm interagieren kann.

## Anforderungen

### Funktionale Anforderungen

1. **TTS-Integration**
   - OpenAI TTS API für hochwertige Sprachausgabe
   - Deutsche Stimme (alloy, echo, fable, onyx, nova, shimmer)
   - Kurze Latenz für natürlichen Dialog

2. **Auslöser**
   - Bei neuer Aktivität mit fehlenden Feldern
   - Bei weiteren fehlenden Feldern nach Antwort
   - Optional: Bestätigung bei erfolgreichem Speichern

3. **Audio-Wiedergabe**
   - Im Renderer via HTML5 Audio
   - Nicht blockierend (User kann sofort antworten)
   - Lautstärke-Einstellung in Settings

### Technische Umsetzung

```typescript
// src/main/services/tts.ts
export async function speak(text: string): Promise<ArrayBuffer>

// Verwendet OpenAI TTS API:
// POST https://api.openai.com/v1/audio/speech
// { model: "tts-1", voice: "nova", input: text }
```

### IPC-Handler

```typescript
ipcMain.handle('tts:speak', async (_event, text: string): Promise<ArrayBuffer>)
```

### Frontend-Integration

```typescript
// In App.vue bei Rückfrage
const speakQuestion = async (question: string) => {
  const audioData = await window.api.tts.speak(question)
  const blob = new Blob([audioData], { type: 'audio/mpeg' })
  const audio = new Audio(URL.createObjectURL(blob))
  audio.play()
}
```

## Akzeptanzkriterien

- [x] OpenAI TTS API integriert
- [x] Rückfragen werden vorgelesen
- [x] Keine Blockierung der Aufnahme
- [ ] TTS kann in Settings deaktiviert werden (future)

## Abhängigkeiten

- FEAT-014: Rückfragen (Follow-up) - bereits implementiert
- OpenAI API Key (bereits für Whisper/LLM vorhanden)

## Priorität

Mittel - Verbessert Voice-First UX
