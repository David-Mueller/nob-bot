# FIX-002: AudioContext Error Handling

## Übersicht

AudioContext-Erstellung kann fehlschlagen, wird aber nicht abgefangen.

## Issue

**Datei:** `src/renderer/src/composables/useAudioRecorder.ts:78`

`new AudioContext()` kann werfen wenn:
- Browser-Limits überschritten
- Autoplay-Policy blockiert
- Keine Audio-Hardware verfügbar

Aktuell würde die Recording in einem kaputten Zustand bleiben.

## Fix

```typescript
// In startRecording(), nach stream acquisition:
try {
  audioContext = new AudioContext()
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.7

  const source = audioContext.createMediaStreamSource(stream)
  source.connect(analyser)
  updateAudioLevels()
} catch (err) {
  console.error('AudioContext creation failed:', err)
  // Weiter ohne Visualisierung - Recording funktioniert trotzdem
}
```

## Akzeptanzkriterien

- [ ] AudioContext-Fehler werden abgefangen
- [ ] Recording funktioniert auch ohne Visualisierung
- [ ] Fehler wird geloggt

## Aufwand

~5 Minuten
