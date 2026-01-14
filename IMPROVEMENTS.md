# Aktivitäten - Code Improvements & Fixes

## Version 1.1.0 (Januar 2026)

### Neue Features & Verbesserungen

- **Neue Excel-Library**: Migration von xlsx/ExcelJS zu xlsx-populate. Zellen-Styles werden jetzt zuverlässig beibehalten.
- **Echtzeit-Audiovisualisierung**: Die Aufnahme zeigt jetzt ein echtes Frequenzspektrum der Stimme statt einer fake Animation. 17 Frequenzbänder optimiert für Sprachfrequenzen.
- **Flüssigere Aufnahme-UI**: Das Aufnahme-Popup öffnet sich jetzt sanft ohne Content-Jump. Animationen mit CSS transitions.
- **Fortschrittsanzeige**: Einträge in der Liste zeigen einen Ladebalken während Speichern (grün) oder Bearbeiten (amber).
- **TTS Audio-Cache**: Die gesprochenen Texte werden beim ersten Mal auf der Festplatte gespeichert und bei Wiederholung vom lokalen Cache wiedergegeben. In den Einstellungen kann der Cache manuell geleert werden.

### Technische Änderungen

- Neuer `workbook.ts` Service für gemeinsame Excel-Operationen
- `debugLog.ts` für einheitliches Debug-Logging
- Web Audio API Integration (AudioContext, AnalyserNode) für Mikrofon-Visualisierung
- TypeScript Types für xlsx-populate

---

Quick-start guide for implementing key recommendations from REVIEW.md

---

## 1. Fix TypeScript Compilation Error (BLOCKER)

**File:** `src/renderer/src/App.vue` line 98

**Current Code:**
```typescript
const handleRecorded = async (blob: Blob): Promise<void> => {
  // ...
  const result = await transcribe(blob)
  if (!result) return

  // Line 98 - Type error here
  chatStore.addUserMessage(`${messagePrefix}${result.text}`, result.language, result.mode)
}
```

**Issue:** `result.language` might be undefined, but parameter expects `WhisperMode | undefined`

**Fix:**
```typescript
chatStore.addUserMessage(
  `${messagePrefix}${result.text}`,
  result.language || undefined,  // Explicit undefined
  result.mode
)
```

Or check `useWhisper.ts` return type and ensure consistency.

---

## 2. Consolidate Type Definitions

### Step 1: Update `src/shared/types/ipc.ts`

Add all IPC-related types:

```typescript
// src/shared/types/ipc.ts

export type RecordingCallback = () => void

export type ProgressCallback = (progress: {
  status: string
  file?: string
  progress?: number
}) => void

export type TranscriptionResult = {
  text: string
  language?: string
  mode: WhisperMode
  chunks?: Array<{
    text: string
    timestamp: [number, number]
  }>
}

export type ScannedFile = {
  path: string
  filename: string
  auftraggeber: string | null
  jahr: number | null
}

export type ExcelActivity = {
  row: number
  datum: string
  thema: string
  taetigkeit: string
  zeit: number | null
  km: number
  hotel: number
}

// ... other types
```

### Step 2: Update `src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type {
  Activity,
  XlsxFileConfig,
  AppSettings,
  AppConfig,
  SaveResult,
  WhisperMode,
  RecordingCallback,
  ProgressCallback,
  TranscriptionResult,
  ScannedFile,
  ExcelActivity
} from '@shared/types'

const api = {
  // ... implementation unchanged
}

// Only export type
export type ElectronAPI = typeof api
```

### Step 3: Update `src/renderer/src/env.d.ts`

```typescript
/// <reference types="vite/client" />

import type { ElectronAPI } from '@preload/index' // Import from preload
import type {
  RecordingCallback,
  ProgressCallback,
  TranscriptionResult,
  // ... etc
} from '@shared/types'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare global {
  interface Window {
    api?: ElectronAPI
  }
}

export {}
```

---

## 3. Add Runtime IPC Validation

### Update `src/main/ipc/excelHandlers.ts`

```typescript
import { ipcMain } from 'electron'
import { ActivitySchema } from '../schemas/ipcSchemas'
import { saveActivity } from '../services/excel'

export function registerExcelHandlers(): void {
  ipcMain.handle(
    'excel:saveActivity',
    async (_event, activity: unknown): Promise<SaveResult> => {
      try {
        // Parse with Zod for runtime validation
        const validated = ActivitySchema.parse(activity)
        return await saveActivity(validated)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Validation failed'
        }
      }
    }
  )

  // Apply same pattern to all handlers
  ipcMain.handle(
    'config:updateSettings',
    async (_event, updates: unknown) => {
      const validated = SettingsUpdateSchema.parse(updates)
      // ... proceed with validated data
    }
  )
}
```

---

## 4. Implement Service Container

### Create `src/main/services/container.ts`

```typescript
import { ChatOpenAI } from '@langchain/openai'
import type { AppConfig, Glossar } from '@shared/types'
import { loadConfig as loadConfigFile } from './config'
import { loadGlossar as loadGlossarFile } from './glossar'
import { initWhisper } from './whisper'

/**
 * Centralized service initialization and lifecycle management
 * Prevents module-level mutable state
 */
export class AppServices {
  private llm: ChatOpenAI | null = null
  private config: AppConfig | null = null
  private glossar: Glossar | null = null

  /**
   * Initialize all services - call once on app startup
   */
  async initialize(): Promise<void> {
    // Load config first (required by other services)
    this.config = await loadConfigFile()

    // Initialize LLM with OpenAI API key from config
    const apiKey = await retrieveApiKey()
    if (apiKey) {
      this.llm = new ChatOpenAI({
        apiKey,
        model: process.env.OPENAI_MODEL || 'gpt-4o'
      })
    }

    // Initialize Whisper speech-to-text
    await initWhisper()

    // Load glossar (non-blocking, can fail gracefully)
    try {
      this.glossar = await loadGlossarFile()
    } catch (err) {
      console.warn('[Services] Glossar load failed:', err)
    }
  }

  /**
   * Cleanup resources on app shutdown
   */
  async cleanup(): Promise<void> {
    this.llm = null
    this.config = null
    this.glossar = null
  }

  // Getters with defensive programming
  getLLM(): ChatOpenAI {
    if (!this.llm) throw new Error('LLM not initialized')
    return this.llm
  }

  getConfig(): AppConfig {
    if (!this.config) throw new Error('Config not initialized')
    // Return defensive copy to prevent external mutations
    return JSON.parse(JSON.stringify(this.config))
  }

  getGlossar(): Glossar | null {
    return this.glossar
  }

  /**
   * Update config after user changes
   */
  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    if (!this.config) throw new Error('Config not initialized')
    this.config = { ...this.config, ...updates }
    await saveConfig(this.config)
  }

  /**
   * Reload glossar (called when files change)
   */
  async reloadGlossar(): Promise<void> {
    try {
      this.glossar = await loadGlossarFile()
    } catch (err) {
      console.error('[Services] Glossar reload failed:', err)
      this.glossar = null
    }
  }
}

// Singleton instance
let services: AppServices | null = null

export function getServices(): AppServices {
  if (!services) {
    throw new Error(
      'Services not initialized. Call initializeServices() first.'
    )
  }
  return services
}

export async function initializeServices(): Promise<void> {
  if (services) {
    throw new Error('Services already initialized')
  }
  services = new AppServices()
  await services.initialize()
}

export async function cleanupServices(): Promise<void> {
  if (services) {
    await services.cleanup()
    services = null
  }
}
```

### Update `src/main/index.ts`

```typescript
import { initializeServices, cleanupServices } from './services/container'

app.whenReady().then(async () => {
  // ... existing code ...

  // Initialize services BEFORE registering IPC handlers
  await initializeServices()

  const window = createWindow()

  // ... rest of initialization ...
})

app.on('before-quit', async () => {
  unregisterHotkeys()
  await cleanupServices() // Add cleanup
})
```

### Update IPC handlers to use container

```typescript
// src/main/ipc/llmHandlers.ts
import { getServices } from '../services/container'

export function registerLLMHandlers(): void {
  ipcMain.handle(
    'llm:parse',
    async (
      _event,
      transcript: string,
      clients?: string[],
      themes?: string[]
    ): Promise<Activity> => {
      const services = getServices()
      const llm = services.getLLM()
      const activity = await llm.invoke(...)
      return activity
    }
  )
}
```

---

## 5. Move Store Helpers to Utils

### Create `src/renderer/src/utils/activities.ts`

```typescript
import type { Activity } from '@shared/types'
import { REQUIRED_FIELDS } from '../stores/activities'

export function getMissingFieldKeys(activity: Activity): string[] {
  return REQUIRED_FIELDS
    .filter(f => activity[f.key] === null)
    .map(f => f.key)
}

export function getMissingFields(activity: Activity): string[] {
  return REQUIRED_FIELDS
    .filter(f => activity[f.key] === null)
    .map(f => f.label)
}

export function getNextFollowUpQuestion(
  activity: Activity
): { question: string; missingFields: string[] } | null {
  const missingKeys = getMissingFieldKeys(activity)
  if (missingKeys.length === 0) return null

  const questionParts: Record<string, string> = {
    auftraggeber: 'welcher Auftraggeber',
    thema: 'welches Thema',
    minuten: 'wie lange'
  }

  let question: string
  if (missingKeys.length === 1) {
    const field = REQUIRED_FIELDS.find(f => f.key === missingKeys[0])
    question = field?.question || `Was ist ${missingKeys[0]}?`
  } else {
    const parts = missingKeys.map(k => questionParts[k] || k)
    const lastPart = parts.pop()
    question = parts.length > 0
      ? `${parts.join(', ')} und ${lastPart}?`
      : `${lastPart}?`
    question = question.charAt(0).toUpperCase() + question.slice(1)
  }

  return { question, missingFields: missingKeys }
}

export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) {
    return `${h}h`
  }
  return `${h}h ${m}min`
}

export function formatActivity(activity: Activity): string {
  const parts: string[] = []
  if (activity.auftraggeber) parts.push(`**Auftraggeber:** ${activity.auftraggeber}`)
  if (activity.thema) parts.push(`**Thema:** ${activity.thema}`)
  parts.push(`**Beschreibung:** ${activity.beschreibung}`)
  if (activity.minuten !== null) parts.push(`**Zeit:** ${formatTime(activity.minuten)}`)
  if (activity.km && activity.km > 0) parts.push(`**KM:** ${activity.km}`)
  if (activity.auslagen && activity.auslagen > 0) parts.push(`**Auslagen:** ${activity.auslagen}€`)
  if (activity.datum) parts.push(`**Datum:** ${activity.datum}`)
  return parts.join('\n')
}
```

### Update `src/renderer/src/stores/activities.ts`

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Activity, ActivityEntry } from '@shared/types'
import {
  getMissingFieldKeys,
  getNextFollowUpQuestion
} from '../utils/activities'

export type { Activity, ActivityEntry }

export const REQUIRED_FIELDS: { key: keyof Activity; label: string; question: string }[] = [
  // ... keep this here as it's store-specific
]

export const useActivityStore = defineStore('activities', () => {
  // ... rest of store unchanged
})

// Remove helper exports - they're now in utils/activities.ts
```

---

## 6. Enable Strict TypeScript Options

### Update `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ESNext", "DOM"],
    "skipLibCheck": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"],
      "@main/*": ["./src/main/*"],
      "@preload/*": ["./src/preload/*"],
      "@renderer/*": ["./src/renderer/src/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"],
  "references": [
    { "path": "./tsconfig.node.json" }
  ]
}
```

---

## 7. Add GitHub Actions Pipeline

### Create `.github/workflows/build.yml`

```yaml
name: Build & Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Type Check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint
        if: hashFiles('.eslintrc.*') != ''

  build:
    needs: lint
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Build
        run: pnpm build

      - name: Build Installer (Windows)
        if: runner.os == 'Windows'
        run: pnpm build:win

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: dist-${{ matrix.os }}
          path: dist/
          retention-days: 7
```

### Create `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: macos-latest
            artifact: '*.dmg'
          - os: windows-latest
            artifact: '*.exe'
          - os: ubuntu-latest
            artifact: '*.AppImage'
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm build
      - run: pnpm build:win  # Adjust per OS

      - uses: softprops/action-gh-release@v1
        with:
          files: dist/${{ matrix.artifact }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 8. Add Basic Linting

### Create `.eslintrc.json`

```json
{
  "root": true,
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:vue/vue3-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "vue-eslint-parser",
  "parserOptions": {
    "parser": "@typescript-eslint/parser",
    "sourceType": "module"
  },
  "rules": {
    "vue/multi-word-component-names": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ]
  }
}
```

### Update `package.json`

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.vue",
    "format": "prettier --write \"src/**/*.{ts,vue,json}\""
  },
  "devDependencies": {
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint-plugin-vue": "^9.0.0",
    "prettier": "^3.0.0"
  }
}
```

---

## 9. Summary of Files Changed

| File | Change | Priority |
|------|--------|----------|
| `src/renderer/src/App.vue` | Fix type error line 98 | CRITICAL |
| `src/shared/types/ipc.ts` | Add all IPC types | HIGH |
| `src/preload/index.ts` | Remove inline types | HIGH |
| `src/renderer/src/env.d.ts` | Import from shared | HIGH |
| `src/main/services/container.ts` | NEW - Service container | HIGH |
| `src/main/index.ts` | Initialize services | HIGH |
| `src/main/ipc/*` | Add Zod validation | HIGH |
| `src/renderer/src/utils/activities.ts` | NEW - Extract helpers | MEDIUM |
| `src/renderer/src/stores/activities.ts` | Remove helpers | MEDIUM |
| `tsconfig.json` | Add strict options | MEDIUM |
| `.github/workflows/build.yml` | NEW - CI/CD | CRITICAL |
| `.eslintrc.json` | NEW - Linting | MEDIUM |
| `package.json` | Add scripts + deps | MEDIUM |

---

## Testing Changes

After implementing these changes, verify:

1. **Type checking passes:**
   ```bash
   pnpm typecheck
   ```

2. **Build succeeds:**
   ```bash
   pnpm build
   ```

3. **Dev server works:**
   ```bash
   pnpm dev
   ```

4. **Linting passes** (if implemented):
   ```bash
   pnpm lint
   ```

---

## Implementation Timeline

- **Day 1:** Fix TypeScript error, consolidate types, add validation
- **Day 2:** Implement service container, refactor IPC handlers
- **Day 3:** Set up GitHub Actions, add linting
- **Day 4:** Testing and refinement

**Estimated Effort:** 3-4 days for one developer
