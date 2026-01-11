# FEAT-015: TTS für Voice-Rückfragen

**Status: ✅ Implementiert**

## Übersicht

Bei fehlenden Pflichtfeldern stellt das System Rückfragen. Diese werden per Text-to-Speech (TTS) vorgelesen, damit der Benutzer ohne Blick auf den Bildschirm interagieren kann.

## Anforderungen

### Funktionale Anforderungen

1. **TTS-Integration**
   - OpenAI TTS API (tts-1 Modell)
   - Deutsche Stimme (Standard: nova)
   - Verfügbare Stimmen: alloy, echo, fable, onyx, nova, shimmer

2. **Auslöser**
   - Bei neuer Aktivität mit fehlenden Feldern
   - Nach Follow-up wenn weitere Felder fehlen

3. **Audio-Wiedergabe**
   - MP3-Format vom API
   - Im Renderer via HTML5 Audio
   - Nicht blockierend (User kann sofort antworten)

## Technische Umsetzung

### TTS Service (src/main/services/tts.ts)

```typescript
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

const TTS_API_URL = 'https://api.openai.com/v1/audio/speech'

export async function speak(
  text: string,
  voice: TTSVoice = 'nova'
): Promise<ArrayBuffer> {
  const apiKey = getApiKey()

  const response = await fetch(TTS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3'
    })
  })

  return await response.arrayBuffer()
}

export function isTTSReady(): boolean {
  return !!getApiKey()
}
```

### IPC Handler (src/main/ipc/ttsHandlers.ts)

```typescript
ipcMain.handle('tts:speak', async (_event, text: string, voice?: string) => {
  const settings = getSettings()
  const selectedVoice = voice || settings.ttsVoice || 'nova'
  return speak(text, selectedVoice as TTSVoice)
})

ipcMain.handle('tts:isEnabled', () => {
  const settings = getSettings()
  return settings.ttsEnabled && isTTSReady()
})
```

### Frontend-Integration (App.vue)

```typescript
const speakQuestion = async (question: string): Promise<void> => {
  const isEnabled = await window.api?.tts.isEnabled()
  if (!isEnabled) return

  try {
    const audioData = await window.api?.tts.speak(question)
    if (audioData) {
      const blob = new Blob([audioData], { type: 'audio/mpeg' })
      const audio = new Audio(URL.createObjectURL(blob))
      audio.play()
    }
  } catch (err) {
    console.error('[TTS] Failed to speak:', err)
  }
}

// Called when follow-up question is needed
if (hasFollowUpQuestion) {
  await speakQuestion(followUpQuestion)
}
```

### Settings Integration

TTS kann in Settings aktiviert/deaktiviert werden:

```typescript
type AppSettings = {
  // ...
  ttsEnabled: boolean
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}
```

## Akzeptanzkriterien

- [x] OpenAI TTS API integriert
- [x] Rückfragen werden vorgelesen (wenn aktiviert)
- [x] Keine Blockierung der Aufnahme
- [x] Stimme in Settings wählbar
- [x] TTS kann in Settings deaktiviert werden

## Abhängigkeiten

- FEAT-014: Rückfragen (Follow-up) - bereits implementiert
- FEAT-007: Settings - für TTS-Konfiguration
- OpenAI API Key (bereits für Whisper/LLM vorhanden)
