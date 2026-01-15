# FEAT-018: UX Verbesserungen

**Status: ✅ Implementiert**

## Übersicht

Sammlung von UX-Verbesserungen für bessere Bedienbarkeit der App.

## Implementierte Features

### 1. Excel-Datei öffnen

Nach dem Speichern einer Aktivität kann die zugehörige Excel-Datei direkt geöffnet werden.

**Umsetzung:**

```typescript
// src/main/ipc/excelHandlers.ts
ipcMain.handle('excel:openFile', async (_event, filePath: string): Promise<boolean> => {
  try {
    await shell.openPath(filePath)
    return true
  } catch (err) {
    console.error('[Excel] Failed to open file:', err)
    return false
  }
})

// saveActivity gibt jetzt filePath zurück
return { success: true, filePath }
```

**UI-Integration:**

- "Excel öffnen" Link in der Erfolgsmeldung im Chat
- "Excel öffnen" Button in der ActivityList für gespeicherte Einträge

### 2. Bearbeiten aus Chat-Fenster

Der letzte ungespeicherte Eintrag kann direkt aus dem Chat-Input-Bereich bearbeitet werden.

**Umsetzung (App.vue):**

```typescript
// Computed für den letzten bearbeitbaren Eintrag
const latestEditableEntry = computed(() => {
  const unsaved = entries.value.filter(e => !e.saved)
  return unsaved.length > 0 ? unsaved[unsaved.length - 1] : null
})
```

**UI:**
- "Bearbeiten" Button erscheint im Input-Bereich wenn ein ungespeicherter Eintrag existiert
- Startet Voice-Korrektur für diesen Eintrag

### 3. Größeres Startfenster

Fenster startet mit komfortablerer Größe für bessere Übersicht.

```typescript
// src/main/index.ts
mainWindow = new BrowserWindow({
  width: 720,
  height: 650,
  // ...
})
```

### 4. Vereinfachtes App-Lifecycle

- Kein System-Tray mehr
- Schließen des Fensters beendet die App komplett
- Standard-Electron-Verhalten

```typescript
app.on('window-all-closed', () => {
  app.quit()
})
```

### 5. Phonetische Alternativen im LLM

Zusätzliche phonetische Varianten für bessere Erkennung:

```typescript
// In SYSTEM_PROMPT
- Erkenne phonetisch ähnliche Namen: "EDT"/"E.D.T." → "IDT", "Lakova"/"la Coba"/"La Cobra" → "Lakowa"
```

## Akzeptanzkriterien

- [x] Excel-Datei kann nach Speichern geöffnet werden
- [x] Link erscheint in Erfolgs-Chat-Message
- [x] Button in ActivityList für gespeicherte Einträge
- [x] Bearbeiten-Button im Chat für letzten ungespeicherten Eintrag
- [x] Fenster startet mit 720x650 Pixel
- [x] App schließt vollständig beim Fenster-Schließen (kein Tray)

## Abhängigkeiten

- FEAT-006: Excel Service
- FEAT-008: Entry List UI + Voice-Korrektur
