# FEAT-007: Settings Management

**Status: ✅ Implementiert**

## Summary

Persistente Einstellungen für Hotkey, LLM-Provider, API-Keys und Excel-Pfade.

## Acceptance Criteria

- [x] Settings werden in YAML-Datei gespeichert (~/.aktivitaeten/config.yaml)
- [x] Settings-UI zum Bearbeiten (Settings.vue Tab)
- [x] Hotkey änderbar (Neustart erforderlich)
- [ ] ~~LLM-Provider wählbar (Claude/OpenAI)~~ (nur OpenAI, Claude erfordert größere Refactoring)
- [x] API-Key sicher speichern (in config.yaml)
- [x] Auftraggeber mit Excel-Pfaden verwalten (DateiManager)

## Technical Details

### Settings Schema

```typescript
interface Settings {
  hotkey: string;
  llmProvider: 'claude' | 'openai';
  llmApiKey: string;
  whisperModel: 'tiny' | 'base' | 'small';
  clients: Array<{
    id: string;
    name: string;
    excelPath: string;
  }>;
}

const defaultSettings: Settings = {
  hotkey: 'CommandOrControl+Shift+A',
  llmProvider: 'claude',
  llmApiKey: '',
  whisperModel: 'base',
  clients: []
};
```

### Storage Location

```
Windows: %APPDATA%/aktivitaeten/settings.json
```

### Settings Service (main/services/settings.ts)

```typescript
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

export async function loadSettings(): Promise<Settings> {
  try {
    const data = await fs.readFile(settingsPath, 'utf-8');
    return { ...defaultSettings, ...JSON.parse(data) };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}
```

### Settings UI (Settings.vue)

- Hotkey-Input mit Capture-Modus
- Dropdown für LLM-Provider
- Password-Input für API-Key
- Liste der Auftraggeber mit Datei-Picker

## Test Plan

1. Settings speichern → JSON-Datei existiert
2. App neu starten → Settings geladen
3. Hotkey ändern → Neuer Hotkey funktioniert
4. Auftraggeber hinzufügen → Erscheint in Liste
