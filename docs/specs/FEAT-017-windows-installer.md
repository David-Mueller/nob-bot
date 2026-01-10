# FEAT-017: Windows Installer

## Goal

Erstellen eines Windows-Installers (.exe) der die App auf Windows-Systemen installiert, mit Autostart-Option und Tray-Integration.

## Context

- Electron-Builder ist bereits konfiguriert (NSIS-Target)
- App laeuft im System-Tray mit globalem Hotkey
- Zielnutzer: Windows 10/11
- .env-Datei mit API-Keys muss separat verwaltet werden

## Acceptance Criteria

### Build-Prozess

- [ ] `pnpm build:win` erzeugt funktionierenden Windows-Installer
- [ ] Installer-Dateiname enthaelt Version (z.B. `Aktivitaeten-Setup-1.0.0.exe`)
- [ ] Build funktioniert auf macOS (Cross-Compilation) oder Windows

### Installer-Verhalten

- [ ] NSIS-Installer mit Installationspfad-Auswahl
- [ ] Desktop-Shortcut optional
- [ ] Startmenue-Eintrag wird erstellt
- [ ] Deinstallation ueber Windows-Einstellungen moeglich

### App-Icon

- [ ] Windows-Icon (.ico) vorhanden in resources/
- [ ] Icon erscheint im Installer, Desktop-Shortcut und Taskleiste

### Autostart (optional)

- [ ] Checkbox im Installer: "Mit Windows starten"
- [ ] Oder: Setting in der App zum Aktivieren von Autostart
- [ ] Autostart startet App minimiert im Tray

### Code-Signing (optional, spaeter)

- [ ] Unsigned-Warnung wird akzeptiert (SmartScreen)
- [ ] Dokumentation fuer spaeteres Code-Signing

## Plan

1. Windows-Icon erstellen (resources/icon.ico, 256x256)
2. electron-builder.yml oder package.json build-Config pruefen
3. NSIS-Optionen konfigurieren (Sprache, Shortcuts, Autostart)
4. Cross-Compilation testen (Wine auf macOS falls noetig)
5. Installer auf Windows-VM testen
6. Autostart-Registry-Eintrag implementieren (optional)

## Technische Details

### electron-builder Konfiguration

```json
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
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Aktivitäten"
    }
  }
}
```

### Icon-Anforderungen

- Format: .ico (Windows)
- Groessen: 16x16, 32x32, 48x48, 256x256 (in einer .ico-Datei)
- Tool: `png2ico` oder Online-Converter

### Autostart-Registry

```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
Key: Aktivitaeten
Value: "C:\Program Files\Aktivitäten\Aktivitäten.exe" --hidden
```

## UAT Plan

### Setup

1. Windows 10/11 VM oder Rechner bereitstellen
2. Installer von Build-Maschine kopieren

### Steps

| # | Aktion | Erwartetes Ergebnis |
|---|--------|---------------------|
| 1 | Installer starten | NSIS-Dialog erscheint mit Sprachauswahl |
| 2 | Installation mit Custom-Pfad | App wird in gewaehltem Ordner installiert |
| 3 | Desktop-Shortcut pruefen | Icon auf Desktop vorhanden |
| 4 | Startmenue pruefen | Eintrag unter "Aktivitäten" vorhanden |
| 5 | App starten | Fenster erscheint, Tray-Icon sichtbar |
| 6 | Globaler Hotkey testen | Strg+Shift+A oeffnet App |
| 7 | Deinstallation | Ueber Einstellungen > Apps deinstallierbar |
| 8 | Nach Deinstallation | Keine Reste in Program Files |

### Evidence

- Screenshot: Installer-Dialog
- Screenshot: Installierte App mit Tray-Icon
- Screenshot: Windows-Einstellungen zeigt App
