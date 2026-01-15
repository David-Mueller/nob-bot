# FEAT-025: Debug-Log Viewer in Einstellungen

## Übersicht

Benutzer sollen das Debug-Log direkt in der App einsehen können, um bei Problemen selbst nachschauen oder Support-Anfragen beifügen zu können.

## Anforderungen

### UI in Settings.vue

- Button "Debug-Log anzeigen" im Einstellungen-Bereich
- Öffnet entweder:
  - **Option A**: Modal/Dialog mit Log-Inhalt (scrollbar, monospace)
  - **Option B**: Externes Öffnen der Log-Datei im System-Editor

### Vorhandene Backend-API

```typescript
// Bereits implementiert in src/preload/index.ts
window.api.debug.getLogPath()  // → Pfad zur Log-Datei
window.api.debug.readLog()     // → Log-Inhalt als String
```

### Zusätzliche Funktionen (optional)

- [ ] "Log kopieren" Button für einfaches Teilen
- [ ] "Log leeren" Button
- [ ] Automatisches Scrollen zum Ende
- [ ] Syntax-Highlighting für Timestamps/Error-Level

## Implementierung

### Settings.vue Erweiterung

```vue
<!-- Debug Section -->
<div class="space-y-2 p-4 bg-gray-50 rounded-lg">
  <label class="block text-sm font-medium text-gray-700">
    Fehlerbehebung
  </label>
  <div class="flex gap-2">
    <button @click="openDebugLog" class="...">
      Debug-Log anzeigen
    </button>
    <button @click="copyDebugLog" class="...">
      Log kopieren
    </button>
  </div>
</div>
```

## Akzeptanzkriterien

- [ ] Button in Einstellungen sichtbar
- [ ] Log kann eingesehen werden
- [ ] Log-Pfad: `~/.aktivitaeten/debug.log`

## Priorität

Niedrig - Nice-to-have für Support-Fälle

## Aufwand

~30 Minuten
