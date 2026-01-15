# FEAT-024: Shared Types Module

**Status: 📋 Backlog**
**Priorität: P1 - Hoch**
**Impact: DRY, Type Safety**

## Problem

Der `Activity`-Typ ist 5x im Codebase definiert (CODE-002):

| Datei | Zeilen |
|-------|--------|
| `src/preload/index.ts` | 18-27 |
| `src/renderer/src/App.vue` | 9-17 |
| `src/renderer/src/env.d.ts` | 28-36 |
| `src/renderer/src/components/ActivityList.vue` | 4-12 |
| `src/main/services/llm.ts` | 22 (via Zod) |

### Risiken

- Änderungen müssen an 5 Stellen gemacht werden
- Type Drift (unterschiedliche Definitionen)
- Inkonsistenzen schwer zu finden

## Lösung

### 1. Shared Types Modul erstellen

```typescript
// src/shared/types/activity.ts
export type Activity = {
  auftraggeber: string | null
  thema: string | null
  beschreibung: string
  minuten: number | null
  km: number
  auslagen: number
  datum: string | null
}

export type ActivityEntry = {
  id: number
  activity: Activity
  transcript: string
  timestamp: Date
  saved: boolean
  savedFilePath?: string
}
```

```typescript
// src/shared/types/config.ts
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
```

```typescript
// src/shared/types/glossar.ts
export type GlossarKategorie = 'Auftraggeber' | 'Thema' | 'Kunde' | 'Sonstiges'

export type GlossarEintrag = {
  kategorie: GlossarKategorie
  begriff: string
  synonyme: string[]
}

export type Glossar = {
  eintraege: GlossarEintrag[]
  byKategorie: Map<GlossarKategorie, GlossarEintrag[]>
  lookupMap: Map<string, string>
}
```

```typescript
// src/shared/types/ipc.ts
export type SaveResult = {
  success: boolean
  error?: string
  filePath?: string
}

export type WhisperMode = 'new' | 'correction' | 'followup'

export type ProgressCallback = (progress: number) => void
```

```typescript
// src/shared/types/index.ts
export * from './activity'
export * from './config'
export * from './glossar'
export * from './ipc'
```

### 2. electron-vite Config anpassen

```typescript
// electron.vite.config.ts
import { resolve } from 'path'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  }
})
```

### 3. tsconfig.json erweitern

```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  }
}
```

### 4. Imports aktualisieren

```typescript
// src/main/services/llm.ts
import type { Activity } from '@shared/types'

// Zod Schema separat, Type importiert
import { z } from 'zod'

export const ActivitySchema = z.object({
  auftraggeber: z.string().nullable(),
  thema: z.string().nullable(),
  beschreibung: z.string(),
  minuten: z.number().nullable(),
  km: z.number().nullable(),
  auslagen: z.number().nullable(),
  datum: z.string().nullable()
}) satisfies z.ZodType<Activity>
```

```typescript
// src/preload/index.ts
import type { Activity, AppConfig, SaveResult } from '@shared/types'

// Remove local type definitions
```

```typescript
// src/renderer/src/App.vue
import type { Activity, ActivityEntry } from '@shared/types'

// Remove local type definitions
```

```typescript
// src/renderer/src/env.d.ts
import type { Activity, AppConfig, XlsxFileConfig, SaveResult } from '@shared/types'

// Nur noch Window interface, keine Typ-Duplikate
declare global {
  interface Window {
    api: {
      whisper: WhisperAPI
      llm: LLMAPI
      excel: ExcelAPI
      config: ConfigAPI
      glossar: GlossarAPI
      tts: TTSAPI
      drafts: DraftsAPI
    }
  }
}
```

### 5. Verzeichnisstruktur

```
src/
├── shared/
│   └── types/
│       ├── activity.ts
│       ├── config.ts
│       ├── glossar.ts
│       ├── ipc.ts
│       └── index.ts
├── main/
│   └── services/
│       └── llm.ts  # import from @shared/types
├── preload/
│   └── index.ts    # import from @shared/types
└── renderer/
    └── src/
        ├── App.vue       # import from @shared/types
        └── env.d.ts      # import from @shared/types
```

## Akzeptanzkriterien

- [ ] Alle Types in `src/shared/types/` definiert
- [ ] Keine Type-Duplikate mehr in anderen Dateien
- [ ] Alias `@shared` funktioniert in allen Prozessen
- [ ] TypeScript-Fehler: 0
- [ ] Build funktioniert

## Migration Checkliste

1. [ ] `src/shared/types/` erstellen
2. [ ] Types aus bestehenden Dateien kopieren
3. [ ] electron-vite.config anpassen
4. [ ] tsconfig.json anpassen
5. [ ] `src/main/services/` - Imports ändern
6. [ ] `src/preload/index.ts` - Imports ändern, lokale Types löschen
7. [ ] `src/renderer/src/App.vue` - Imports ändern, lokale Types löschen
8. [ ] `src/renderer/src/env.d.ts` - Imports ändern, lokale Types löschen
9. [ ] `src/renderer/src/components/` - Imports ändern
10. [ ] `pnpm typecheck` erfolgreich

## Geschätzter Aufwand

- Types erstellen: 30min
- Config anpassen: 30min
- Imports migrieren: 1h
- Testing: 30min

**Total: ~2.5h**
