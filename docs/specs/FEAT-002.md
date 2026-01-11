# FEAT-002: Global Hotkey

**Status: ✅ Implementiert**

## Summary

Globaler Hotkey zum Starten der Aufnahme von überall im System.

## Acceptance Criteria

- [x] Globaler Hotkey (Standard: Strg+Shift+A) öffnet Aufnahme-Fenster
- [x] Hotkey funktioniert auch wenn App minimiert ist
- [x] Hotkey ist in Settings konfigurierbar
- [x] App startet mit normalem Fenster (kein Tray)

## Technical Details

### Hotkey-Manager (main/hotkey.ts)

```typescript
import { globalShortcut, BrowserWindow } from 'electron'

let registeredHotkey: string | null = null

export function registerHotkeys(mainWindow: BrowserWindow, hotkey: string): void {
  // Unregister old hotkey if exists
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey)
  }

  const success = globalShortcut.register(hotkey, () => {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('start-recording')
  })

  if (success) {
    registeredHotkey = hotkey
    console.log(`[Hotkey] Registered: ${hotkey}`)
  }
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
```

### Integration in main/index.ts

```typescript
import { registerHotkeys, unregisterHotkeys } from './hotkey'
import { getSettings } from './services/config'

app.whenReady().then(async () => {
  await loadConfig()
  const window = createWindow()

  // Register global hotkey from settings
  const settings = getSettings()
  registerHotkeys(window, settings.hotkey)
})

app.on('before-quit', () => {
  unregisterHotkeys()
})
```

## Test Plan

1. App starten → Fenster erscheint
2. Strg+Shift+A drücken → Aufnahme-Overlay öffnet sich
3. Bei minimierter App: Hotkey öffnet trotzdem
4. Hotkey in Settings ändern → Neuer Hotkey funktioniert nach Neustart
