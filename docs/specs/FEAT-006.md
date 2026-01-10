# FEAT-006: Excel Service (Lesen/Schreiben)

## Summary

Service zum Lesen und Schreiben von Excel-Dateien (.xlsx) mit exceljs.

## Acceptance Criteria

- [ ] Excel-Datei öffnen und Zeilen lesen
- [ ] Neue Zeile am Ende anhängen
- [ ] Bestehende Themen extrahieren (für Autovervollständigung)
- [ ] Backup vor Schreibvorgang erstellen
- [ ] Fehlerbehandlung bei gesperrter Datei

## Technical Details

### Dependencies

```json
{
  "exceljs": "^4.4"
}
```

### Excel Service (main/services/excel.ts)

```typescript
import ExcelJS from 'exceljs';

export interface ExcelRow {
  datum: Date;
  auftraggeber: string;
  thema: string;
  beschreibung: string;
  stunden: number;
  km: number;
  auslagen: number;
}

export async function appendRow(filePath: string, row: ExcelRow): Promise<void> {
  // Backup erstellen
  await createBackup(filePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1);
  worksheet.addRow([
    row.datum,
    row.auftraggeber,
    row.thema,
    row.beschreibung,
    row.stunden,
    row.km,
    row.auslagen
  ]);

  await workbook.xlsx.writeFile(filePath);
}

export async function getThemes(filePath: string): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1);
  const themes = new Set<string>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Skip header
      const theme = row.getCell(3).value?.toString();
      if (theme) themes.add(theme);
    }
  });

  return Array.from(themes);
}
```

### Backup Strategy

```typescript
async function createBackup(filePath: string): Promise<void> {
  const backupPath = filePath.replace('.xlsx', `_backup_${Date.now()}.xlsx`);
  await fs.copyFile(filePath, backupPath);

  // Alte Backups löschen (behalte letzte 5)
  await cleanOldBackups(filePath);
}
```

## Test Plan

1. Zeile anhängen → Erscheint in Excel
2. Themen extrahieren → Unique-Liste aller Themen
3. Datei gesperrt → Fehlermeldung statt Crash
4. Backup wird erstellt vor Schreiben
