# FEAT-004: Whisper Integration (Speech-to-Text)

## Summary

Lokale Spracherkennung mit Whisper.js (@xenova/transformers) für Deutsch.

## Acceptance Criteria

- [ ] Whisper-Modell wird beim ersten Start heruntergeladen
- [ ] Audio-Blob wird zu Text transkribiert
- [ ] Deutsche Sprache korrekt erkannt
- [ ] Transkription dauert < 5 Sekunden für 30-Sekunden-Audio
- [ ] Fehlerbehandlung bei Modell-Ladeproblemen

## Technical Details

### Dependencies

```json
{
  "@xenova/transformers": "^2.17"
}
```

### Whisper Service (main/services/whisper.ts)

```typescript
import { pipeline } from '@xenova/transformers';

let transcriber: any = null;

export async function initWhisper() {
  transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-base',
    {
      language: 'german',
      task: 'transcribe'
    }
  );
}

export async function transcribe(audioBlob: Blob): Promise<string> {
  if (!transcriber) await initWhisper();

  const arrayBuffer = await audioBlob.arrayBuffer();
  const result = await transcriber(arrayBuffer);

  return result.text;
}
```

### Model Options

| Modell | Größe | Geschwindigkeit | Genauigkeit |
|--------|-------|-----------------|-------------|
| whisper-tiny | 75MB | Schnell | Basis |
| whisper-base | 150MB | Mittel | Gut |
| whisper-small | 500MB | Langsam | Sehr gut |

Default: `whisper-base` (konfigurierbar in Settings)

## Test Plan

1. Erstes Laden → Modell-Download (Fortschrittsanzeige)
2. Deutsche Spracheingabe → Korrekter Text
3. Zahlen ("halbe Stunde") → Korrekt erkannt
4. Fachbegriffe (Firmennamen) → Erkannt oder phonetisch ähnlich
