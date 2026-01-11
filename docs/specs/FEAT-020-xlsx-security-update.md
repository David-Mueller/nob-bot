# FEAT-020: xlsx Dependency Security Update

**Status: 📋 Backlog**
**Priorität: P0 - Kritisch**
**CVE: CVE-2023-30533, CVE-2024-22363**

## Problem

Die xlsx-Bibliothek (v0.18.5) hat bekannte Sicherheitslücken (SEC-002):

1. **CVE-2023-30533**: Prototype Pollution beim Parsen von Excel-Dateien
2. **CVE-2024-22363**: Regular Expression Denial of Service (ReDoS)

### Risiken

- Manipulierte Excel-Dateien könnten Code ausführen
- DoS durch speziell crafted Files
- npm-Package ist deprecated (kein Update verfügbar)

## Lösung

### Option A: SheetJS CDN Update (Empfohlen)

```bash
pnpm remove xlsx
pnpm add https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz
```

### Option B: Migration zu exceljs

```bash
pnpm remove xlsx
pnpm add exceljs
```

Migration erfordert Code-Änderungen in:
- `src/main/services/excel.ts`
- `src/main/services/glossar.ts`

## Technische Umsetzung (Option A)

### 1. Package Update

```json
// package.json
{
  "dependencies": {
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz"
  }
}
```

### 2. Import-Syntax prüfen

```typescript
// Bleibt gleich
import * as XLSX from 'xlsx'
```

### 3. API-Kompatibilität testen

Die API sollte kompatibel sein. Zu prüfen:
- `XLSX.readFile()` - Sync read
- `XLSX.writeFile()` - Sync write
- `XLSX.utils.sheet_to_json()` - Sheet parsing
- `XLSX.utils.book_append_sheet()` - Sheet creation

## Zusätzliche Absicherung

### Input Validation für Excel-Dateien

```typescript
// src/main/services/excel.ts
import { stat } from 'fs/promises'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB limit

export async function validateExcelFile(filePath: string): Promise<void> {
  const stats = await stat(filePath)

  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stats.size} bytes (max ${MAX_FILE_SIZE})`)
  }

  if (!filePath.endsWith('.xlsx') && !filePath.endsWith('.xls')) {
    throw new Error('Invalid file extension')
  }
}
```

## Akzeptanzkriterien

- [ ] xlsx auf Version 0.20.2+ aktualisiert
- [ ] Keine CVE-Warnungen in `pnpm audit`
- [ ] Alle Excel-Operationen funktionieren wie zuvor
- [ ] File-Size-Limit implementiert
- [ ] Extension-Validation implementiert

## Test Plan

1. `pnpm audit` → Keine xlsx Vulnerabilities
2. Excel lesen → Funktioniert
3. Excel schreiben → Funktioniert
4. Glossar laden → Funktioniert
5. Große Datei (>50MB) → Wird abgelehnt
