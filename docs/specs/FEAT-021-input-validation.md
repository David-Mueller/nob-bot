# FEAT-021: IPC Input Validation & Path Security

**Status: 📋 Backlog**
**Priorität: P1 - Hoch**
**CVSS: 7.5 (Path Traversal), 6.5 (Input Validation)**

## Problem

### SEC-003: Path Traversal

Dateipfade vom Renderer werden ohne Validierung an Filesystem-Operationen übergeben.

```typescript
// UNSICHER - excelHandlers.ts:74-81
ipcMain.handle('excel:openFile', async (_event, filePath: string) => {
  await shell.openPath(filePath)  // Keine Validierung!
})
```

### SEC-004: Fehlende Input Validation

IPC-Handler akzeptieren Daten ohne Typ- oder Wertevalidierung.

```typescript
// UNSICHER - configHandlers.ts:35-38
ipcMain.handle('config:setBasePath', async (_event, path: string) => {
  config.xlsxBasePath = path  // Keine Validierung!
})
```

## Lösung

### 1. Path Validation Utility

```typescript
// src/main/utils/pathValidator.ts
import { normalize, resolve, isAbsolute } from 'path'
import { app } from 'electron'
import { getConfig } from '../services/config'

export function getAllowedBasePaths(): string[] {
  const config = getConfig()
  return [
    config.xlsxBasePath,
    app.getPath('home'),
    app.getPath('documents'),
    app.getPath('userData')
  ].filter(Boolean)
}

export function validatePath(inputPath: string): string {
  // Normalize and resolve to absolute
  const normalized = normalize(resolve(inputPath))

  // Check for path traversal attempts
  if (inputPath.includes('..')) {
    throw new Error('Path traversal not allowed')
  }

  // Verify within allowed directories
  const allowedBases = getAllowedBasePaths()
  const isAllowed = allowedBases.some(base =>
    normalized.startsWith(normalize(resolve(base)))
  )

  if (!isAllowed) {
    throw new Error(`Path outside allowed directories: ${inputPath}`)
  }

  return normalized
}

export function validateExcelPath(inputPath: string): string {
  const validated = validatePath(inputPath)

  // Must be Excel file
  if (!validated.match(/\.(xlsx|xls)$/i)) {
    throw new Error('Not an Excel file')
  }

  return validated
}
```

### 2. Zod Schemas für IPC Input

```typescript
// src/main/schemas/ipcSchemas.ts
import { z } from 'zod'

export const FilePathSchema = z.string()
  .min(1, 'Path required')
  .max(500, 'Path too long')
  .refine(p => !p.includes('..'), 'Path traversal not allowed')

export const ExcelPathSchema = FilePathSchema
  .refine(p => /\.(xlsx|xls)$/i.test(p), 'Must be Excel file')

export const ActivitySchema = z.object({
  auftraggeber: z.string().nullable(),
  thema: z.string().nullable(),
  beschreibung: z.string().min(1),
  minuten: z.number().nullable(),
  km: z.number().default(0),
  auslagen: z.number().default(0),
  datum: z.string().nullable()
})

export const SettingsUpdateSchema = z.object({
  hotkey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  whisperModel: z.enum(['tiny', 'base', 'small']).optional(),
  ttsEnabled: z.boolean().optional(),
  ttsVoice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional()
})
```

### 3. Handler-Updates

```typescript
// src/main/ipc/excelHandlers.ts
import { validateExcelPath } from '../utils/pathValidator'
import { ExcelPathSchema, ActivitySchema } from '../schemas/ipcSchemas'

ipcMain.handle('excel:openFile', async (_event, filePath: unknown) => {
  try {
    const validated = ExcelPathSchema.parse(filePath)
    const safePath = validateExcelPath(validated)
    await shell.openPath(safePath)
    return true
  } catch (err) {
    console.error('[Excel] Invalid path:', err)
    return false
  }
})

ipcMain.handle('excel:saveActivity', async (_event, activity: unknown) => {
  const validated = ActivitySchema.parse(activity)
  // ... rest of handler
})
```

### 4. Config Handler Updates

```typescript
// src/main/ipc/configHandlers.ts
import { validatePath } from '../utils/pathValidator'

ipcMain.handle('config:setBasePath', async (_event, path: unknown) => {
  const validated = FilePathSchema.parse(path)
  const safePath = validatePath(validated)

  // Verify directory exists
  const stats = await stat(safePath)
  if (!stats.isDirectory()) {
    throw new Error('Path must be a directory')
  }

  const config = getConfig()
  config.xlsxBasePath = safePath
  await saveConfig(config)
})
```

## Akzeptanzkriterien

- [ ] Alle IPC-Handler validieren Inputs mit Zod
- [ ] Path Traversal (`../`) wird blockiert
- [ ] Nur Pfade in erlaubten Verzeichnissen akzeptiert
- [ ] Excel-Handler akzeptieren nur .xlsx/.xls Dateien
- [ ] Fehlerhafte Inputs werden geloggt (ohne sensitive Daten)

## Betroffene Dateien

- `src/main/ipc/excelHandlers.ts`
- `src/main/ipc/configHandlers.ts`
- `src/main/ipc/glossarHandlers.ts`
- `src/main/ipc/draftsHandlers.ts`

## Test Plan

1. `excel:openFile` mit `../../etc/passwd` → Fehler
2. `excel:openFile` mit `/tmp/malicious.exe` → Fehler (nicht in allowed paths)
3. `config:setBasePath` mit ungültigem Pfad → Fehler
4. Normale Operationen → Funktionieren weiterhin
