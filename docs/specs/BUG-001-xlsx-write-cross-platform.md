# BUG-001: XLSX-Dateien korrekt auf Mac und Windows schreiben

## Problem

XLSX-Dateien werden nicht zuverlässig auf beiden Plattformen (Mac und Windows) geschrieben. Die aktuelle Implementierung in `excel.ts` verwendet zwar Buffer-Workarounds für das Windows Async Iterable Issue, jedoch treten weiterhin Probleme auf.

## Betroffene Dateien

- `src/main/services/excel.ts`
- `src/main/services/backup.ts`

## Symptome

- [ ] Datei wird auf Mac korrekt geschrieben, aber nicht auf Windows
- [ ] Datei wird auf Windows korrekt geschrieben, aber nicht auf Mac
- [ ] Datei wird beschädigt beim Speichern
- [ ] Datei-Locking Probleme (Datei noch geöffnet)
- [ ] Pfade mit Sonderzeichen/Umlauten funktionieren nicht
- [ ] Netzlaufwerke (UNC-Pfade) funktionieren nicht

## Aktuelle Implementierung

```typescript
// Lesen via Buffer
const fileBuffer = await readFile(filePath)
await workbook.xlsx.load(fileBuffer.buffer.slice(...))

// Schreiben via Buffer
const outBuffer = await workbook.xlsx.writeBuffer()
await writeFile(filePath, Buffer.from(outBuffer))
```

## Mögliche Ursachen

### 1. Pfad-Normalisierung
- Windows verwendet `\`, Mac verwendet `/`
- `path.normalize()` sollte auf beiden Plattformen verwendet werden
- UNC-Pfade (`\\server\share\...`) benötigen spezielle Behandlung

### 2. Dateisystem-Unterschiede
- Windows hat Case-Insensitive Dateisysteme
- Windows sperrt Dateien die geöffnet sind (Excel hat Datei offen)
- Mac erlaubt gleichzeitige Zugriffe

### 3. Buffer-Handling
- `ArrayBuffer.slice()` vs `Buffer.from()` Unterschiede
- Encoding-Probleme bei Umlauten im Pfad

### 4. Berechtigungen
- Windows UAC könnte Schreibzugriff verweigern
- Netzlaufwerke haben andere Berechtigungen

## Lösungsansätze

### Option A: Atomares Schreiben mit temporärer Datei
```typescript
import { writeFile, rename, unlink } from 'fs/promises'
import { join, dirname, basename } from 'path'
import { tmpdir } from 'os'

async function atomicWrite(filePath: string, data: Buffer): Promise<void> {
  const tempPath = join(tmpdir(), `xlsx-${Date.now()}-${basename(filePath)}`)

  try {
    await writeFile(tempPath, data)
    // Auf Windows: Zieldatei zuerst löschen falls existent
    if (process.platform === 'win32') {
      try { await unlink(filePath) } catch {}
    }
    await rename(tempPath, filePath)
  } catch (error) {
    // Cleanup temp file on error
    try { await unlink(tempPath) } catch {}
    throw error
  }
}
```

### Option B: Plattform-spezifische Pfadhandhabung
```typescript
import { normalize, resolve } from 'path'

function normalizeXlsxPath(inputPath: string): string {
  // UNC-Pfade auf Windows bewahren
  if (process.platform === 'win32' && inputPath.startsWith('\\\\')) {
    return inputPath.replace(/\//g, '\\')
  }
  return normalize(resolve(inputPath))
}
```

### Option C: Retry-Logik für File-Locking
```typescript
async function writeWithRetry(
  filePath: string,
  data: Buffer,
  maxRetries = 3,
  delayMs = 500
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await writeFile(filePath, data)
      return
    } catch (error: unknown) {
      const isLockError = error instanceof Error &&
        (error.code === 'EBUSY' || error.code === 'EPERM')

      if (isLockError && attempt < maxRetries - 1) {
        console.log(`[Excel] File locked, retrying in ${delayMs}ms...`)
        await new Promise(r => setTimeout(r, delayMs))
        continue
      }
      throw error
    }
  }
}
```

## Reproduktionsschritte

1. App auf Windows starten
2. XLSX-Datei laden die auf einem Netzlaufwerk liegt
3. Aktivität hinzufügen und speichern
4. Erwartung: Datei wird korrekt gespeichert
5. Aktuell: [Fehlerverhalten beschreiben]

## Akzeptanzkriterien

- [ ] XLSX-Dateien werden auf Mac korrekt geschrieben
- [ ] XLSX-Dateien werden auf Windows korrekt geschrieben
- [ ] Pfade mit deutschen Umlauten funktionieren (ä, ö, ü, ß)
- [ ] Netzlaufwerke/UNC-Pfade funktionieren auf Windows
- [ ] File-Locking wird graceful behandelt (Retry oder Fehlermeldung)
- [ ] Atomares Schreiben verhindert Dateikorruption bei Absturz
- [ ] Backup funktioniert weiterhin vor jedem Schreibvorgang

## Tests

```typescript
// tests/excel.spec.ts
describe('Excel cross-platform write', () => {
  it('writes to local path with umlauts', async () => {
    const testPath = join(tmpdir(), 'Tätigkeiten_Test.xlsx')
    // Create test file, write, verify
  })

  it('handles file locked error gracefully', async () => {
    // Mock EBUSY error, verify retry or user-friendly error
  })

  it('writes atomically (temp file then rename)', async () => {
    // Verify no partial writes on interrupt
  })
})
```

## Priorität

**Hoch** - Kernfunktionalität der App

## Related

- [FEAT-012: Automatische XLSX-Backups](FEAT-012-xlsx-backup.md)
- [FEAT-017: Windows Installer](FEAT-017-windows-installer.md)
