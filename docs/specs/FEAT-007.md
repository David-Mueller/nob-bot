# FEAT-007: Settings Management

**Status: ✅ Implementiert**

## Summary

Persistente Einstellungen für Hotkey, OpenAI API-Key, Whisper-Modell, TTS und Excel-Dateiverwaltung.

## Acceptance Criteria

- [x] Settings werden in YAML-Datei gespeichert (~/.aktivitaeten/config.yaml)
- [x] Settings-UI zum Bearbeiten (Settings.vue Tab)
- [x] Hotkey änderbar (Neustart erforderlich)
- [x] OpenAI API-Key speichern
- [x] Whisper-Modell wählbar (tiny/base/small)
- [x] TTS aktivierbar mit Stimmen-Auswahl
- [x] Auftraggeber mit Excel-Pfaden verwalten (DateiManager)

## Technical Details

### Settings Schema (src/main/services/config.ts)

```typescript
export type XlsxFileConfig = {
  path: string
  auftraggeber: string
  jahr: number
  active: boolean
}

export type AppSettings = {
  hotkey: string
  openaiApiKey: string
  whisperModel: 'tiny' | 'base' | 'small'
  ttsEnabled: boolean
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

export type AppConfig = {
  xlsxBasePath: string
  xlsxFiles: XlsxFileConfig[]
  settings: AppSettings
}

const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'CommandOrControl+Shift+R',
  openaiApiKey: '',
  whisperModel: 'base',
  ttsEnabled: false,
  ttsVoice: 'nova'
}
```

### Storage Location

```
~/.aktivitaeten/config.yaml
```

### Config Service Functions

```typescript
// Load/save full config
loadConfig(): Promise<AppConfig>
saveConfig(config: AppConfig): Promise<void>
getConfig(): AppConfig

// Settings management
getSettings(): AppSettings
updateSettings(updates: Partial<AppSettings>): Promise<AppSettings>
getApiKey(): string  // Falls back to OPENAI_API_KEY env var

// XLSX file management
updateXlsxFile(path: string, updates: Partial<XlsxFileConfig>): Promise<void>
removeXlsxFile(path: string): Promise<void>
getActiveFiles(): XlsxFileConfig[]
findFileForAuftraggeber(auftraggeber: string, jahr: number): XlsxFileConfig | null
```

### IPC Handlers (src/main/ipc/configHandlers.ts)

```typescript
ipcMain.handle('config:get', () => getConfig())
ipcMain.handle('config:save', (_, config) => saveConfig(config))
ipcMain.handle('config:getSettings', () => getSettings())
ipcMain.handle('config:updateSettings', (_, updates) => updateSettings(updates))
```

### Settings UI (Settings.vue)

- Hotkey-Input mit Capture-Modus
- Password-Input für API-Key (mit Show/Hide Toggle)
- Dropdown für Whisper-Modell
- Toggle für TTS aktivieren/deaktivieren
- Dropdown für TTS-Stimme
- DateiManager für XLSX-Dateiverwaltung

## Example Config (config.yaml)

```yaml
xlsxBasePath: D:\C-Con\AL-kas
xlsxFiles:
  - path: D:\C-Con\AL-kas\LV-IDT-2025.xlsx
    auftraggeber: IDT
    jahr: 2025
    active: true
  - path: D:\C-Con\AL-kas\LV-LOTUS-2025.xlsx
    auftraggeber: LOTUS
    jahr: 2025
    active: true
settings:
  hotkey: CommandOrControl+Shift+R
  openaiApiKey: sk-...
  whisperModel: base
  ttsEnabled: true
  ttsVoice: nova
```

## Test Plan

1. Settings speichern → YAML-Datei existiert unter ~/.aktivitaeten/
2. App neu starten → Settings geladen
3. Hotkey ändern → Neuer Hotkey funktioniert nach Neustart
4. API-Key ändern → LLM/Whisper nutzt neuen Key
5. Auftraggeber hinzufügen → Erscheint in DateiManager
