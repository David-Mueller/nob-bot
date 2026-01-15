# FEAT-019: Sichere API-Key Speicherung

**Status: 📋 Backlog**
**Priorität: P0 - Kritisch**
**CVSS: 9.1**

## Problem

Der OpenAI API-Key wird unverschlüsselt in `~/.aktivitaeten/config.yaml` gespeichert (SEC-001).

```yaml
# Aktuell - UNSICHER
settings:
  openaiApiKey: "sk-..."  # Plaintext!
```

### Risiken

- Malware kann API-Key auslesen
- Andere Prozesse des Users haben Lesezugriff
- API-Key-Diebstahl führt zu unbefugter API-Nutzung
- Finanzielle Schäden durch API-Missbrauch

## Lösung

Electron `safeStorage` API für OS-native Verschlüsselung verwenden.

### Technische Umsetzung

```typescript
// src/main/services/secureStorage.ts
import { safeStorage } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

const API_KEY_FILE = join(app.getPath('userData'), '.api-key')

export async function setApiKey(key: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage not available on this system')
  }
  const encrypted = safeStorage.encryptString(key)
  await writeFile(API_KEY_FILE, encrypted)
}

export async function getApiKey(): Promise<string> {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback to env var only
    return process.env.OPENAI_API_KEY || ''
  }
  try {
    const encrypted = await readFile(API_KEY_FILE)
    return safeStorage.decryptString(encrypted)
  } catch {
    return process.env.OPENAI_API_KEY || ''
  }
}

export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}
```

### Migration bestehender Keys

```typescript
// Beim App-Start prüfen und migrieren
export async function migrateApiKey(): Promise<void> {
  const config = getConfig()
  if (config.settings.openaiApiKey) {
    // Migriere zu secure storage
    await setApiKey(config.settings.openaiApiKey)
    // Lösche aus config
    config.settings.openaiApiKey = ''
    await saveConfig(config)
    console.log('[Security] API key migrated to secure storage')
  }
}
```

### Config-Datei Permissions

```typescript
// src/main/services/config.ts
import { chmod } from 'fs/promises'

await writeFile(CONFIG_FILE, content, { encoding: 'utf-8', mode: 0o600 })
// Zusätzlich chmod für existierende Dateien
await chmod(CONFIG_FILE, 0o600)
```

## Akzeptanzkriterien

- [ ] API-Key wird mit OS-nativer Verschlüsselung gespeichert
- [ ] Fallback auf Umgebungsvariable wenn safeStorage nicht verfügbar
- [ ] Bestehende plaintext Keys werden automatisch migriert
- [ ] Config-Datei hat 0600 Permissions
- [ ] API-Key nicht mehr in config.yaml sichtbar

## Abhängigkeiten

- Electron safeStorage API (verfügbar seit Electron 15)
- Funktioniert auf Windows (DPAPI), macOS (Keychain), Linux (libsecret)

## Test Plan

1. Neuer API-Key → wird verschlüsselt gespeichert
2. App-Neustart → Key wird korrekt entschlüsselt
3. Migration → Plaintext Key wird migriert und gelöscht
4. `cat ~/.aktivitaeten/config.yaml` → Kein API-Key sichtbar
