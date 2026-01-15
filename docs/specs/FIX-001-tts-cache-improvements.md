# FIX-001: TTS Cache Verbesserungen

## Übersicht

Drei zusammenhängende Issues im TTS-Service beheben.

## Issues

### 1. Memory Cache unbegrenzt (Kritisch)
**Datei:** `src/main/services/tts.ts:19`

Der In-Memory Cache hat kein Limit. Bei vielen einzigartigen TTS-Phrasen wächst der Speicherverbrauch unbegrenzt.

**Fix:**
```typescript
const MAX_MEMORY_CACHE_SIZE = 50

// Nach memoryCache.set():
if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
  const firstKey = memoryCache.keys().next().value
  if (firstKey) memoryCache.delete(firstKey)
}
```

### 2. MD5 durch SHA-256 ersetzen (Kritisch)
**Datei:** `src/main/services/tts.ts:33`

MD5 ist kryptographisch veraltet. SHA-256 ist der moderne Standard.

**Fix:**
```typescript
// Vorher
const hash = createHash('md5').update(`${voice}:${text}`).digest('hex')

// Nachher
const hash = createHash('sha256').update(`${voice}:${text}`).digest('hex')
```

### 3. clearCache parallel statt sequentiell (Performance)
**Datei:** `src/main/services/tts.ts:159-163`

Files werden sequentiell gelöscht. Mit Promise.all parallel löschen.

**Fix:**
```typescript
const deletePromises = files
  .filter(f => f.endsWith('.mp3'))
  .map(f => rm(join(dir, f)).catch(() => {}))
await Promise.all(deletePromises)
deletedCount = deletePromises.length
```

## Akzeptanzkriterien

- [ ] Memory Cache auf 50 Einträge begrenzt
- [ ] SHA-256 statt MD5 für Cache-Keys
- [ ] Paralleles Löschen beim Cache-Clear

## Aufwand

~15 Minuten
