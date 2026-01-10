# FEAT-008: Rückfrage-Dialog bei fehlenden Daten

## Summary

Dialog zur Nachfrage fehlender Pflichtfelder mit Voice- oder Text-Eingabe.

## Acceptance Criteria

- [ ] Dialog erscheint wenn Pflichtfelder fehlen
- [ ] Zeigt welches Feld fehlt (z.B. "Wie viel Zeit?")
- [ ] Antwort per Spracheingabe möglich
- [ ] Antwort per Texteingabe möglich
- [ ] Mehrere Rückfragen nacheinander möglich
- [ ] Abbrechen-Option

## Technical Details

### Pflichtfelder

| Feld | Pflicht | Rückfrage |
|------|---------|-----------|
| auftraggeber | Ja | "Für welchen Auftraggeber?" |
| thema | Ja | "Welches Thema/Kunde?" |
| beschreibung | Ja | "Was wurde gemacht?" |
| stunden | Ja | "Wie viel Zeit wurde investiert?" |
| km | Nein | - |
| auslagen | Nein | - |

### FollowUpDialog.vue

```vue
<template>
  <div class="followup-dialog">
    <p class="question">{{ currentQuestion }}</p>

    <div class="input-options">
      <button @click="startVoiceInput" class="voice-btn">
        <MicIcon />
      </button>

      <input
        v-model="textInput"
        @keyup.enter="submitText"
        placeholder="Oder hier eingeben..."
      />
    </div>

    <div class="actions">
      <button @click="submit">Bestätigen</button>
      <button @click="cancel">Abbrechen</button>
    </div>
  </div>
</template>
```

### Follow-Up Logic

```typescript
export function getMissingFields(activity: Activity): string[] {
  const required = ['auftraggeber', 'thema', 'beschreibung', 'stunden'];
  return required.filter(field => activity[field] === null);
}

export const followUpQuestions: Record<string, string> = {
  auftraggeber: 'Für welchen Auftraggeber?',
  thema: 'Welches Thema oder welcher Kunde?',
  beschreibung: 'Was wurde gemacht?',
  stunden: 'Wie viel Zeit wurde investiert?'
};
```

## Test Plan

1. Aktivität ohne Stunden → Rückfrage "Wie viel Zeit?"
2. Voice-Antwort "15 Minuten" → stunden: 0.25
3. Text-Antwort "0.5" → stunden: 0.5
4. Abbrechen → Kein Eintrag gespeichert
