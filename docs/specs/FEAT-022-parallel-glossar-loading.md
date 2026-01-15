# FEAT-022: Parallele Glossar-Ladung

**Status: 📋 Backlog**
**Priorität: P1 - Hoch**
**Impact: Startup-Zeit 60-70% Reduktion**

## Problem

Glossar-Dateien werden sequentiell geladen (PERF-001), was den App-Start um 500-2000ms blockiert.

```typescript
// AKTUELL - Sequential (langsam)
for (const file of activeFiles) {
  const glossar = await ensureGlossar(file.path, file.auftraggeber)
  if (glossar) glossars.push(glossar)
}
```

### Messwerte

| Dateien | Sequentiell | Parallel (Ziel) |
|---------|-------------|-----------------|
| 1 Datei | 200ms | 200ms |
| 3 Dateien | 600ms | 250ms |
| 5 Dateien | 1000ms | 300ms |

## Lösung

### 1. Promise.all für parallele Ladung

```typescript
// src/main/ipc/glossarHandlers.ts
export async function reloadGlossar(): Promise<void> {
  const activeFiles = getActiveFiles()

  if (activeFiles.length === 0) {
    currentGlossar = null
    currentClients = []
    currentThemes = []
    return
  }

  // PARALLEL statt sequentiell
  const glossarPromises = activeFiles.map(file =>
    ensureGlossar(file.path, file.auftraggeber)
      .catch(err => {
        console.error(`[Glossar] Failed to load ${file.path}:`, err)
        return null
      })
  )

  const glossars = (await Promise.all(glossarPromises)).filter(Boolean) as Glossar[]

  if (glossars.length === 0) {
    currentGlossar = null
    currentClients = []
    currentThemes = []
    return
  }

  // Merge glossars
  currentGlossar = mergeGlossars(glossars)
  currentClients = getKnownTerms(currentGlossar, 'Auftraggeber')
  currentThemes = getKnownTerms(currentGlossar, 'Thema')
}
```

### 2. Auch in glossar.ts parallelisieren

```typescript
// src/main/services/glossar.ts
export async function loadGlossarsFromPaths(paths: string[]): Promise<Glossar | null> {
  // PARALLEL
  const glossarPromises = paths.map(path =>
    loadGlossar(path).catch(() => null)
  )
  const glossars = (await Promise.all(glossarPromises)).filter(Boolean) as Glossar[]

  if (glossars.length === 0) return null

  return mergeGlossars(glossars)
}

function mergeGlossars(glossars: Glossar[]): Glossar {
  const merged: Glossar = {
    eintraege: [],
    byKategorie: new Map(),
    lookupMap: new Map()
  }

  const kategorien: GlossarKategorie[] = ['Auftraggeber', 'Thema', 'Kunde', 'Sonstiges']
  for (const kat of kategorien) {
    merged.byKategorie.set(kat, [])
  }

  for (const glossar of glossars) {
    merged.eintraege.push(...glossar.eintraege)
    for (const [kategorie, entries] of glossar.byKategorie) {
      merged.byKategorie.get(kategorie)!.push(...entries)
    }
    for (const [key, value] of glossar.lookupMap) {
      merged.lookupMap.set(key, value)
    }
  }

  return merged
}
```

### 3. Lazy Loading für Startup

```typescript
// src/main/index.ts
app.whenReady().then(async () => {
  // ... window creation

  // Non-blocking glossar load
  reloadGlossar().catch(err => {
    console.error('[Startup] Glossar load failed:', err)
  })

  // App ist sofort nutzbar, Glossar lädt im Hintergrund
})
```

## Zusätzliche Optimierungen

### LRU Cache mit TTL

```typescript
// src/main/services/glossar.ts
import { LRUCache } from 'lru-cache'

const glossarCache = new LRUCache<string, Glossar>({
  max: 10,           // Max 10 Dateien gecached
  ttl: 30 * 60 * 1000  // 30 Minuten TTL
})
```

### File Watcher für Auto-Reload

```typescript
// Optional: Automatisches Reload bei Dateiänderung
import { watch } from 'fs'

export function watchGlossarFiles(paths: string[]): void {
  for (const path of paths) {
    watch(path, (eventType) => {
      if (eventType === 'change') {
        clearGlossarCache(path)
        reloadGlossar()
      }
    })
  }
}
```

## Akzeptanzkriterien

- [ ] Glossar-Dateien werden parallel geladen
- [ ] Startup-Zeit unter 1s mit 3 aktiven Dateien
- [ ] Fehler bei einzelner Datei blockiert nicht andere
- [ ] Cache hat TTL und maximale Größe
- [ ] App ist sofort nutzbar (Glossar lädt im Hintergrund)

## Test Plan

1. 3 aktive Dateien → Laden in <300ms (statt 600ms+)
2. 1 Datei fehlerhaft → Andere laden trotzdem
3. Cache-Hit → Kein erneutes Laden
4. Nach 30min → Cache expired, neu laden
