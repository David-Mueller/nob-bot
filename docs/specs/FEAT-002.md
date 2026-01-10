# FEAT-002: System-Tray und Global Hotkey

## Summary

Implementiere System-Tray-Icon und globalen Hotkey zum Starten der Aufnahme.

## Acceptance Criteria

- [ ] App zeigt Icon im Windows System-Tray
- [ ] Rechtsklick auf Tray-Icon zeigt Kontextmenü (Öffnen, Beenden)
- [ ] Globaler Hotkey (Strg+Shift+A) öffnet Aufnahme-Fenster
- [ ] Hotkey funktioniert auch wenn App minimiert ist
- [ ] App startet minimiert im Tray (kein Fenster beim Start)

## Technical Details

### Tray-Manager (main/tray.ts)

```typescript
import { Tray, Menu, nativeImage } from 'electron';

export function createTray(mainWindow: BrowserWindow): Tray {
  const tray = new Tray(nativeImage.createFromPath('resources/icon.png'));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Öffnen', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() }
  ]);

  tray.setToolTip('Aktivitäten');
  tray.setContextMenu(contextMenu);

  return tray;
}
```

### Hotkey-Manager (main/hotkey.ts)

```typescript
import { globalShortcut } from 'electron';

export function registerHotkeys(mainWindow: BrowserWindow) {
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    mainWindow.show();
    mainWindow.webContents.send('start-recording');
  });
}
```

## Test Plan

1. App starten → Icon erscheint im Tray
2. Rechtsklick → Menü mit "Öffnen" und "Beenden"
3. Strg+Shift+A drücken → Fenster öffnet sich
4. Bei minimierter App: Hotkey öffnet trotzdem
