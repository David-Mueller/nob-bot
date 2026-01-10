# FEAT-012: Automatische XLSX-Backups

## Übersicht

Vor jeder schreibenden Operation auf eine Excel-Datei wird automatisch ein Backup erstellt. Die Excel-Dateien enthalten wichtige Geschäftsdaten und müssen vor Datenverlust geschützt werden.

## Anforderungen

### Backup-Strategie

1. **Zeitpunkt**: Vor JEDER schreibenden Operation (Speichern, Ändern, Hinzufügen)
2. **Methode**: Kopie der Original-Datei
3. **Speicherort**: `backups/` Unterordner im selben Verzeichnis wie die Original-Datei
4. **Benennung**: `{original-name}_{timestamp}.xlsx`

### Beispiel

```
Aktivitaetenlisten/
├── LV IDT 2025.xlsx                    # Original
└── backups/
    ├── LV IDT 2025_2025-01-10_20-30-15.xlsx
    ├── LV IDT 2025_2025-01-10_21-45-00.xlsx
    └── LV IDT 2025_2025-01-11_09-15-30.xlsx
```

### Technische Umsetzung

```typescript
// backup.ts
import { copyFile, mkdir } from 'fs/promises'
import { join, dirname, basename, extname } from 'path'

export async function createBackup(xlsxPath: string): Promise<string> {
  const dir = dirname(xlsxPath)
  const backupDir = join(dir, 'backups')
  const name = basename(xlsxPath, extname(xlsxPath))
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)

  const backupPath = join(backupDir, `${name}_${timestamp}.xlsx`)

  // Erstelle backups/ Ordner falls nicht vorhanden
  await mkdir(backupDir, { recursive: true })

  // Kopiere Original
  await copyFile(xlsxPath, backupPath)

  console.log(`[Backup] Created: ${backupPath}`)
  return backupPath
}
```

### Integration in Excel-Service

```typescript
// excel.ts
export async function saveActivity(xlsxPath: string, activity: Activity): Promise<void> {
  // 1. Backup erstellen
  await createBackup(xlsxPath)

  // 2. Änderungen speichern
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(xlsxPath)
  // ... Änderungen ...
  await workbook.xlsx.writeFile(xlsxPath)
}
```

### Backup-Rotation (Optional)

Um Speicherplatz zu sparen:
- Maximal 50 Backups pro Datei behalten
- Älteste Backups automatisch löschen
- Konfigurierbar via Settings

```typescript
const MAX_BACKUPS = 50

async function cleanOldBackups(backupDir: string, baseName: string): Promise<void> {
  const files = await readdir(backupDir)
  const backups = files
    .filter(f => f.startsWith(baseName) && f.endsWith('.xlsx'))
    .sort()
    .reverse()

  // Lösche alle über MAX_BACKUPS
  for (const old of backups.slice(MAX_BACKUPS)) {
    await unlink(join(backupDir, old))
    console.log(`[Backup] Deleted old: ${old}`)
  }
}
```

## Akzeptanzkriterien

- [ ] Backup wird vor jedem Schreibvorgang erstellt
- [ ] Backup-Ordner wird automatisch angelegt
- [ ] Dateiname enthält Timestamp
- [ ] Original-Datei bleibt unverändert bis Backup fertig
- [ ] Fehler beim Backup stoppt den Schreibvorgang
- [ ] Optional: Alte Backups werden rotiert

## Priorität

**Kritisch** - Datensicherheit

## Hinweise

- Backup MUSS vor dem Schreiben abgeschlossen sein
- Bei Backup-Fehler: Schreibvorgang abbrechen
- Atomare Operation: Erst Backup, dann Schreiben
