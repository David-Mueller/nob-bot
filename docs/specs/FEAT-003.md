# FEAT-003: Audio-Aufnahme Komponente

## Summary

Vue-Komponente für Mikrofon-Aufnahme mit visuellem Feedback.

## Acceptance Criteria

- [ ] Komponente zeigt Aufnahme-Status (bereit, aufnehmen, verarbeiten)
- [ ] Roter pulsierender Punkt während Aufnahme
- [ ] Mikrofon-Berechtigung wird angefragt
- [ ] Audio wird als WAV/WebM aufgenommen
- [ ] Enter oder Hotkey beendet Aufnahme
- [ ] Esc bricht Aufnahme ab

## Technical Details

### RecordingWindow.vue

```vue
<template>
  <div class="recording-window">
    <div class="status-indicator" :class="{ recording: isRecording }">
      <span v-if="isRecording" class="pulse-dot"></span>
      {{ statusText }}
    </div>

    <div class="transcript" v-if="transcript">
      {{ transcript }}
    </div>

    <div class="controls">
      <span>[Enter] Fertig</span>
      <span>[Esc] Abbrechen</span>
    </div>
  </div>
</template>
```

### Audio Recording Service

```typescript
export async function startRecording(): Promise<MediaRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm'
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  mediaRecorder.start();

  return mediaRecorder;
}
```

## Test Plan

1. Komponente mounten → Status "Bereit"
2. Aufnahme starten → Roter Punkt pulsiert
3. Mikrofon-Dialog erscheint bei erstem Aufruf
4. Enter drücken → Audio-Blob wird zurückgegeben
5. Esc drücken → Aufnahme abgebrochen, kein Blob
