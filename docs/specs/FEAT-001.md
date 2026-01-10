# FEAT-001: Projekt-Setup

## Summary

Initialisiere das Electron-Projekt mit electron-vite 5.x, Vue 3, TypeScript und Tailwind CSS.

## Version Policy

Wir nutzen **aktuelle stabile Versionen** (Stand Januar 2026). Bei Installation immer `pnpm view <pkg> version` prüfen.

## Acceptance Criteria

- [ ] Electron-App startet ohne Fehler
- [ ] Vue 3 mit Composition API konfiguriert
- [ ] TypeScript strikt konfiguriert
- [ ] Tailwind CSS funktioniert (Test: Utility-Klasse in App.vue)
- [ ] Hot-Reload funktioniert im Development-Modus
- [ ] Build-Prozess erstellt lauffähige App
- [ ] Security Best Practices eingehalten (siehe unten)

## Technical Details

### Dependencies (Januar 2026)

```json
{
  "dependencies": {
    "vue": "^3.5",
    "pinia": "^2.2"
  },
  "devDependencies": {
    "electron": "^39.0.0",
    "electron-vite": "^5.0.0",
    "electron-builder": "^25",
    "typescript": "^5.7",
    "vue-tsc": "^2",
    "tailwindcss": "^4",
    "postcss": "^8"
  }
}
```

### Security Best Practices (Electron 39.x)

1. **Context Isolation aktiviert** (default seit Electron 12)
2. **Sandbox für Renderer** aktiviert (default seit Electron 20)
3. **nodeIntegration deaktiviert** - Kommunikation nur via Preload Scripts
4. **IPC Nachrichten validieren** - Sender immer prüfen
5. **Keine Remote Module** - deprecated und unsicher
6. **CSP definieren** - Content Security Policy im HTML
7. **Aktuelle Electron-Version** - mindestens eine der 3 unterstützten Stable-Releases

Referenz: [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)

### Folder Structure

```
aktivitaeten/
├── src/
│   ├── main/
│   │   └── index.ts
│   ├── renderer/
│   │   ├── App.vue
│   │   ├── main.ts
│   │   └── styles/main.css
│   ├── preload/
│   │   └── index.ts
│   └── shared/
│       └── types.ts
├── electron.vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

## Test Plan

1. `pnpm dev` startet Electron-App mit Vue-UI
2. Tailwind-Klassen wie `bg-blue-500` werden korrekt gerendert
3. `pnpm build` erstellt dist-Ordner ohne Fehler

## Setup Command

```bash
npm create @quick-start/electron@latest aktivitaeten -- --template vue-ts
```

Danach manuell hinzufügen: Tailwind CSS, Pinia.

## References

- [electron-vite Getting Started](https://electron-vite.org/guide/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Releases](https://releases.electronjs.org/)
