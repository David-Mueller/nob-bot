# Aktivitäten - Quick Reference Guide

## Project Structure

```
aktivitaeten/
├── src/
│   ├── main/                    # Main Process (Node.js)
│   │   ├── index.ts            # App entry point, window creation
│   │   ├── ipc/                # IPC handlers for main ↔ renderer
│   │   │   ├── llmHandlers.ts
│   │   │   ├── whisperHandlers.ts
│   │   │   ├── excelHandlers.ts
│   │   │   ├── configHandlers.ts
│   │   │   ├── glossarHandlers.ts
│   │   │   ├── ttsHandlers.ts
│   │   │   └── draftsHandlers.ts
│   │   ├── services/           # Business logic
│   │   │   ├── llm.ts         # GPT-4o integration
│   │   │   ├── whisper.ts     # Whisper transcription
│   │   │   ├── excel.ts       # Excel file operations
│   │   │   ├── glossar.ts     # Terminology database
│   │   │   ├── config.ts      # Settings persistence
│   │   │   ├── tts.ts         # Text-to-speech
│   │   │   └── secureStorage.ts
│   │   ├── schemas/
│   │   │   └── ipcSchemas.ts  # Zod validation schemas
│   │   └── utils/
│   ├── preload/                 # Preload Script (Bridge)
│   │   └── index.ts            # Exposes window.api to renderer
│   ├── renderer/                # Renderer Process (Vue 3)
│   │   └── src/
│   │       ├── App.vue         # Main UI component
│   │       ├── components/     # Vue components
│   │       ├── stores/         # Pinia stores
│   │       ├── composables/    # Vue composables
│   │       └── main.ts         # Vue entry point
│   └── shared/                  # Shared Types
│       └── types/
│           ├── activity.ts     # Activity & ActivityEntry
│           ├── config.ts       # AppConfig & AppSettings
│           ├── ipc.ts          # IPC type definitions
│           └── glossar.ts      # Glossar types
│
├── resources/                   # App icon, etc.
├── dist/                        # Built app (after build)
├── package.json                 # Dependencies & scripts
├── tsconfig.json               # TypeScript config
├── electron.vite.config.ts    # Build config
├── REVIEW.md                   # This review
└── IMPROVEMENTS.md             # Implementation guide
```

---

## Key Technologies

| Layer | Technology | Version |
|-------|-----------|---------|
| **Desktop Runtime** | Electron | 39.0.0 |
| **UI Framework** | Vue 3 | 3.5.13 |
| **Language** | TypeScript | 5.7.3 |
| **State** | Pinia | 2.3.0 |
| **Styling** | Tailwind CSS | 4.0.0 |
| **Build Tool** | electron-vite | 5.0.0 |
| **Installer** | electron-builder | 25.1.8 |
| **AI/LLM** | LangChain + OpenAI | Latest |
| **Validation** | Zod | 4.3.5 |

---

## Development Commands

```bash
# Start dev server with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Type checking
pnpm typecheck

# Build Windows installer
pnpm build:win

# Linting (if configured)
pnpm lint

# Format code (if configured)
pnpm format
```

---

## Architecture Overview

### Process Model

```
┌─────────────────────────────────────────────────────────────┐
│                      ELECTRON APP                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐          ┌──────────────────────┐   │
│  │  Main Process    │◄─ IPC ──►│ Renderer Process      │   │
│  │  (Node.js)       │          │ (Browser/Vue 3)      │   │
│  │                  │          │                      │   │
│  │ • Services       │          │ • Components         │   │
│  │ • File I/O       │          │ • Stores (Pinia)     │   │
│  │ • API calls      │          │ • Composables        │   │
│  │ • Config mgmt    │          │ • UI State           │   │
│  └──────────────────┘          └──────────────────────┘   │
│         ▲                               ▲                  │
│         │                               │                  │
│         └─── Preload Bridge (Isolated)──┘                  │
│                                                             │
│  All communication via:                                    │
│  • ipcRenderer.invoke()   (async)                          │
│  • ipcRenderer.on()       (events)                         │
│  • ipcMain.handle()       (handlers)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: Voice to Excel

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
│   Microphone│      │   OpenAI Whisper │      │    GPT-4o LLM  │
│   (Device)  │      │    (Cloud API)   │      │  (Cloud API)   │
└──────┬──────┘      └────────┬─────────┘      └────────┬───────┘
       │                      │                         │
       │ PCM Audio            │                         │
       ▼                      ▼                         ▼
┌──────────────┐      ┌──────────────────┐      ┌────────────────┐
│RecordingWin  │      │useWhisper        │      │useWhisper      │
│   (Capture)  │─────►│(Transcription)   │─────►│(Parsing)       │
└──────────────┘      └──────────────────┘      └────────┬───────┘
                                                         │
                      ┌────────────────────────────────┐ │
                      │ Activity Object                │◄┘
                      │ {                              │
                      │   auftraggeber: "Client XYZ"   │
                      │   thema: "Meeting"             │
                      │   beschreibung: "..."          │
                      │   minuten: 45                  │
                      │ }                              │
                      └────────────────┬───────────────┘
                                       │
                      ┌────────────────▼───────────────┐
                      │   ActivityStore (Pinia)        │
                      │   (Local state in memory)      │
                      └────────────────┬───────────────┘
                                       │
                      ┌────────────────▼───────────────┐
                      │   Excel (SheetJS)              │
                      │   (Save to user's file)        │
                      └────────────────────────────────┘
```

---

## IPC API Reference

### Whisper (Speech-to-Text)

```typescript
// Initialize model
await window.api.whisper.init(model?: 'tiny' | 'base' | 'small')

// Transcribe audio
const result = await window.api.whisper.transcribe(
  pcmBuffer: ArrayBuffer,
  originalBlob?: ArrayBuffer
) // Returns: { text: string, language?: string, mode: WhisperMode, chunks?: [...] }

// Check status
const ready = await window.api.whisper.isReady()
const mode = await window.api.whisper.getMode() // 'cloud' | 'local' | 'none'

// Listen to progress
const unsubscribe = window.api.whisper.onProgress((progress) => {
  console.log(`${progress.status}: ${progress.progress}%`)
})
```

### LLM (Text Parsing)

```typescript
// Parse transcription into structured Activity
const activity = await window.api.llm.parse(
  transcript: string,
  clients?: string[],    // Known client names for better matching
  themes?: string[]      // Known project themes
)

// Correct an existing activity
const corrected = await window.api.llm.parseCorrection(
  existingActivity: Activity,
  correctionTranscript: string
)

// Ask follow-up questions for missing fields
const updated = await window.api.llm.parseFollowUp(
  existingActivity: Activity,
  userAnswer: string,
  missingFields: string[],
  question: string
)

// Check if LLM initialized
const ready = await window.api.llm.isReady()
```

### Excel

```typescript
// Save activity to Excel file
const result = await window.api.excel.saveActivity(activity: Activity)
// Returns: { success: boolean, error?: string, filePath?: string }

// Get activities from a specific month
const activities = await window.api.excel.getActivities(month: number)
// Returns: Array of { row, datum, thema, taetigkeit, zeit, km, hotel }

// Open file in Excel/user's default app
await window.api.excel.openFile(filePath: string)

// File selection dialog
const path = await window.api.excel.selectFile() // Returns null if cancelled
```

### Config

```typescript
// Load all config
const config = await window.api.config.load() // AppConfig

// Save config
await window.api.config.save(config: AppConfig)

// File operations
const files = await window.api.config.getFiles() // All configured files
const active = await window.api.config.getActiveFiles() // Only enabled

// Scan for files
const found = await window.api.config.scanFiles()
// Returns: Array of { path, filename, auftraggeber?, jahr? }

// Settings
const settings = await window.api.config.getSettings() // AppSettings
await window.api.config.updateSettings(updates: Partial<AppSettings>)
```

### Glossar (Terminology)

```typescript
// Load/reload terminology database
const loaded = await window.api.glossar.load()

// Get known terms for LLM hints
const terms = await window.api.glossar.getKnownTerms()
// Returns: { auftraggeber: [...], themen: [...], kunden: [...] }

// Normalize text using glossar
const normalized = await window.api.glossar.normalize(text: string)

// Get all glossar entries
const entries = await window.api.glossar.getEntries()

// Create glossar from existing Excel file
const created = await window.api.glossar.createFromData(
  filePath: string,
  auftraggeber: string
)
```

### TTS (Text-to-Speech)

```typescript
// Generate speech audio
const audioBuffer = await window.api.tts.speak(
  text: string,
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
)

// Check if TTS ready
const ready = await window.api.tts.isReady()
```

### Drafts

```typescript
// Load saved drafts
const drafts = await window.api.drafts.load()
// Returns: Array of { id, activity, transcript, timestamp, saved }

// Save drafts
await window.api.drafts.save(drafts: DraftEntry[])

// Clear all drafts
await window.api.drafts.clear()
```

---

## Pinia Stores

### Activities Store

```typescript
import { useActivityStore } from '@/stores/activities'

const store = useActivityStore()

// State
store.entries // Array of ActivityEntry
store.unsavedEntries // Computed: unsaved entries
store.unsavedCount // Computed: count of unsaved
store.latestEditableEntry // Computed: most recent for quick edit
store.latestSaveableEntry // Computed: first complete unsaved

// Actions
store.addEntry(activity, transcript) // Returns ActivityEntry
store.updateEntry(id, updates) // Partial update
store.deleteEntry(id) // Remove entry
store.markSaved(id, filePath) // Mark as saved
store.getEntryById(id) // Fetch by id
store.restoreFromDrafts(drafts) // Load from storage
```

### Recording Store

```typescript
import { useRecordingStore } from '@/stores/recording'

const store = useRecordingStore()

// State
store.isRecording // boolean
store.isProcessing // boolean
store.processingStatus // 'transcribing' | 'parsing' | null
store.isEditing // boolean (editing existing entry)
store.isFollowUp // boolean (answering follow-up)
store.editingEntryId // number | null
store.followUpEntryId // number | null

// Actions
store.showOverlay() // Show recording UI
store.hideOverlay() // Hide recording UI
store.setProcessing(isProcessing, status?) // Set status
store.reset() // Clear recording state
```

### Chat Store

```typescript
import { useChatStore } from '@/stores/chat'

const store = useChatStore()

// State
store.messages // Array of { role, content, ... }

// Actions
store.addUserMessage(text, language?, mode?)
store.addAssistantMessage(text)
store.addErrorMessage(text)
store.clearMessages()
store.scrollToBottom()
```

---

## Vue Composables

### useWhisper

```typescript
import { useWhisper } from '@/composables/useWhisper'

const {
  status,           // 'unloaded' | 'loading' | 'ready' | 'transcribing' | 'error'
  loadingProgress,  // 0-100 for model download
  loadingFile,      // Current file being downloaded
  error,            // Error message if failed
  init,             // Initialize Whisper (async)
  transcribe        // Transcribe audio blob (async)
} = useWhisper()
```

### useAudioRecorder

```typescript
import { useAudioRecorder } from '@/composables/useAudioRecorder'

const {
  status,              // 'idle' | 'recording' | 'processing'
  errorMessage,        // Error if failed
  audioBlob,           // Recorded audio (ref)
  startRecording,      // Start capture (async)
  stopRecording,       // Stop & process (async)
  cancelRecording,     // Discard & cleanup
  reset                // Reset state
} = useAudioRecorder()
```

### useTTS

```typescript
import { useTTS } from '@/composables/useTTS'

const {
  isReady,             // boolean
  speak                // Speak text (async, returns audio)
} = useTTS()
```

### useDrafts

```typescript
import { useDrafts } from '@/composables/useDrafts'

const {
  loadDrafts,          // Load from disk (async)
  setupAutoSave        // Setup auto-save interval
} = useDrafts()
```

---

## Type Definitions

### Core Types

```typescript
export type Activity = {
  auftraggeber: string | null      // Client name
  thema: string | null             // Project/theme
  beschreibung: string             // Description
  minuten: number | null           // Duration in minutes
  km: number                        // Distance traveled
  auslagen: number                 // Expenses
  datum: string | null             // Date ISO string
}

export type ActivityEntry = {
  id: number                        // Unique ID
  activity: Activity                // Activity data
  transcript: string                // Original voice input
  timestamp: Date                   // When recorded
  saved: boolean                    // Saved to Excel?
  savedFilePath?: string           // Path to saved file
}

export type AppConfig = {
  xlsxBasePath: string             // Base path for Excel files
  xlsxFiles: XlsxFileConfig[]       // Configured files
  settings: AppSettings            // User settings
}

export type AppSettings = {
  hotkey: string                    // Recording hotkey (e.g., "Cmd+Shift+R")
  openaiApiKey: string             // OpenAI API key (never in YAML)
  whisperModel: 'tiny' | 'base' | 'small'
  ttsEnabled: boolean              // Enable text-to-speech
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}
```

---

## Common Tasks

### Add a New IPC Handler

1. **Define in preload:**
   ```typescript
   // src/preload/index.ts
   const api = {
     myApi: {
       doSomething: (param: string): Promise<string> => {
         return ipcRenderer.invoke('my:doSomething', param)
       }
     }
   }
   ```

2. **Implement in main:**
   ```typescript
   // src/main/ipc/myHandlers.ts
   export function registerMyHandlers(): void {
     ipcMain.handle('my:doSomething', async (_event, param: string) => {
       return await myService.doSomething(param)
     })
   }
   ```

3. **Register in app:**
   ```typescript
   // src/main/index.ts
   registerMyHandlers()
   ```

4. **Update types:**
   ```typescript
   // src/renderer/src/env.d.ts
   type MyAPI = {
     doSomething: (param: string) => Promise<string>
   }
   ```

### Update Config

```typescript
// In component
const config = await window.api.config.get()
config.settings.hotkey = 'Cmd+Shift+T'
await window.api.config.save(config)
```

### Add Activity to Excel

```typescript
const activity: Activity = {
  auftraggeber: 'Client A',
  thema: 'Development',
  beschreibung: 'Implemented new feature',
  minuten: 120,
  km: 0,
  auslagen: 0,
  datum: '2026-01-11'
}

const result = await window.api.excel.saveActivity(activity)
if (result.success) {
  console.log('Saved to:', result.filePath)
} else {
  console.error('Error:', result.error)
}
```

### Use Store in Component

```vue
<script setup lang="ts">
import { useActivityStore } from '@/stores/activities'

const activityStore = useActivityStore()

// Reactive state
const unsavedCount = computed(() => activityStore.unsavedCount)

// Call action
const deleteActivity = (id: number) => {
  activityStore.deleteEntry(id)
}
</script>

<template>
  <div>{{ unsavedCount }} unsaved activities</div>
</template>
```

---

## Debugging Tips

### Enable Console Logging
```typescript
// In main process
console.log('[Service] Starting operation...')
console.error('[Error] Something failed:', error)

// Prefix logs with component name for easy filtering
```

### Access DevTools
- In dev mode: `Ctrl+Shift+I` (Windows) or `Cmd+Opt+I` (macOS)
- Inspect renderer state
- Check Network tab for API calls

### Check IPC Communication
```typescript
// Add logging in preload to trace IPC calls
ipcRenderer.invoke = new Proxy(ipcRenderer.invoke, {
  apply(target, thisArg, args) {
    console.log('[IPC Call]', args[0], args.slice(1))
    return target.apply(thisArg, args)
  }
})
```

### Monitor Module State
```typescript
// Check current config
import { currentConfig } from '@main/services/config'
console.log('Config:', currentConfig)

// Check LLM instance
import { llm } from '@main/services/llm'
console.log('LLM ready:', llm !== null)
```

---

## Performance Optimization

### Model Loading
- Whisper models: 40-100MB (base model)
- Download cached locally on first run
- Subsequent runs use cached model

### Memory Management
- Clear chat history periodically
- Unload models when not in use
- Monitor heap size during long sessions

### API Rate Limiting
- OpenAI API: 3 req/sec free tier
- Whisper: ~3 audio files/sec
- LLM: ~1 request/sec

---

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...        # OpenAI API key

# Optional
OPENAI_MODEL=gpt-4o          # LLM model (default: gpt-4o)
WHISPER_MODEL=base           # Whisper model (default: base)
LOG_LEVEL=debug              # Logging level
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Check console for errors; verify `.aktivitaeten/config.yaml` |
| Microphone not detected | Grant app microphone permission in OS settings |
| Transcription fails | Verify internet connection; check OpenAI API key |
| Excel save fails | Verify file path; ensure Excel file not locked |
| Memory usage high | Restart app; disable Whisper if not needed |
| Type checking fails | Run `pnpm install`; check tsconfig.json |

---

**Last Updated:** 2026-01-11
**For detailed info, see:** REVIEW.md, IMPROVEMENTS.md, DEPLOY_CHECKLIST.md
