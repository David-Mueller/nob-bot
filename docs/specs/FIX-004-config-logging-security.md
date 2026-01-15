# FIX-004: Config Logging Security

## Übersicht

Potenzielle Gefahr, dass API-Keys in Logs landen.

## Issue

**Datei:** `src/main/ipc/configHandlers.ts:57`

Wenn `updates`-Objekte mit `openaiApiKey` geloggt werden, wird der API-Key exponiert.

## Fix

Sanitize-Funktion für Logging erstellen:

```typescript
function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...obj }
  if ('openaiApiKey' in sanitized) {
    sanitized.openaiApiKey = '[REDACTED]'
  }
  return sanitized
}

// Beim Loggen:
debugLog('Config', `Updating settings: ${JSON.stringify(sanitizeForLogging(updates))}`)
```

Oder einfach keine sensiblen Objekte loggen.

## Akzeptanzkriterien

- [ ] API-Key erscheint nie in Logs
- [ ] Updates können trotzdem für Debugging geloggt werden (sanitized)

## Aufwand

~10 Minuten
