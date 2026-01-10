# FEAT-010: Windows Packaging (.exe)

## Summary

Erstelle Windows-Installer (.exe) für einfache Installation.

## Acceptance Criteria

- [ ] `pnpm build` erstellt Windows-Installer
- [ ] Installer funktioniert auf Windows 10/11
- [ ] App startet automatisch beim Windows-Start (optional)
- [ ] Tray-Icon und Hotkey funktionieren nach Installation
- [ ] Saubere Deinstallation möglich

## Technical Details

### electron-builder Konfiguration

```json
// package.json
{
  "build": {
    "appId": "com.aktivitaeten.app",
    "productName": "Aktivitäten",
    "win": {
      "target": ["nsis"],
      "icon": "resources/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "resources/icon.ico",
      "uninstallerIcon": "resources/icon.ico",
      "installerHeaderIcon": "resources/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "files": [
      "dist/**/*",
      "resources/**/*"
    ],
    "extraResources": [
      {
        "from": "resources/",
        "to": "resources/"
      }
    ]
  }
}
```

### Auto-Start Configuration

```typescript
// main/index.ts
import { app } from 'electron';

app.setLoginItemSettings({
  openAtLogin: settings.autoStart,
  path: app.getPath('exe')
});
```

### Build Command

```bash
pnpm build        # Build app
pnpm build:win    # Package for Windows
```

### Output

```
dist/
├── win-unpacked/           # Portable version
└── Aktivitäten-Setup.exe   # Installer
```

## Test Plan

1. `pnpm build:win` erstellt .exe ohne Fehler
2. Installer auf sauberem Windows ausführen
3. App startet und funktioniert vollständig
4. Deinstallation über Windows-Einstellungen
5. Auto-Start-Option funktioniert (wenn aktiviert)
