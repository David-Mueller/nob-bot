# FIX-003: Excel/Glossar Validation & Cache

## Übersicht

Zwei zusammenhängende Issues in Excel-/Glossar-Handling.

## Issues

### 1. validateExcelFile ohne Path-Traversal Check
**Datei:** `src/main/services/excel.ts:18-26`

Die öffentliche Funktion `validateExcelFile` prüft Extension und Größe, aber nicht auf Path-Traversal (`..`). Sie wird von `glossar.ts` aufgerufen.

**Fix:**
```typescript
export async function validateExcelFile(filePath: string): Promise<void> {
  // Path-Traversal Check
  if (filePath.includes('..')) {
    throw new Error('Path traversal not allowed')
  }

  // ... existing checks
}
```

### 2. Glossar-Cache ohne Invalidierung bei Dateiänderung
**Datei:** `src/main/services/glossar.ts:44-99`

`glossarCache` hat keinen TTL oder mtime-Check. Wenn ein User die Excel-Datei extern bearbeitet, bleibt der Cache veraltet bis zum App-Neustart.

**Fix:**
```typescript
type CacheEntry = { glossar: Glossar; mtime: number }
const glossarCache = new Map<string, CacheEntry>()

// In loadGlossar:
const stats = await stat(xlsxPath)
const cached = glossarCache.get(xlsxPath)
if (cached && cached.mtime === stats.mtimeMs) {
  return cached.glossar
}

// Nach erfolgreichem Laden:
glossarCache.set(xlsxPath, { glossar, mtime: stats.mtimeMs })
```

## Akzeptanzkriterien

- [ ] Path-Traversal in validateExcelFile geprüft
- [ ] Glossar-Cache invalidiert bei Dateiänderung (mtime)

## Aufwand

~20 Minuten
