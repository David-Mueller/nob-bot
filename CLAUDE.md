# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start Electron in dev mode
pnpm build        # Build for production
pnpm build:win    # Build Windows installer (.exe)
pnpm typecheck    # Run TypeScript type checking
```

## Architecture

This is an Electron desktop app for tracking work activities via voice input. It uses electron-vite for bundling.

### Process Architecture

```
Main Process (Node.js)
├── src/main/index.ts          # App entry, window creation, tray, hotkeys
├── src/main/ipc/              # IPC handlers (whisper, llm, excel, config)
└── src/main/services/         # Business logic (whisper, llm, excel, config, backup)

Preload (Bridge)
└── src/preload/index.ts       # Exposes window.api to renderer

Renderer Process (Browser)
├── src/renderer/src/App.vue   # Main UI, activity state management
└── src/renderer/src/components/
    ├── RecordingWindow.vue    # Voice recording UI
    ├── ActivityList.vue       # Activity entry cards
    └── DateiManager.vue       # XLSX file configuration
```

### Key Data Flow

1. **Voice Input**: RecordingWindow captures audio → whisperHandlers → OpenAI Whisper API → transcript
2. **LLM Parsing**: Transcript → llmHandlers → GPT-4o with Zod schema → structured Activity object
3. **Excel Writing**: Activity → excelHandlers → SheetJS (xlsx) → append row to month sheet

### IPC Pattern

All renderer-to-main communication uses `window.api.*` (defined in preload). Types are duplicated in:
- `src/preload/index.ts` (implementation)
- `src/renderer/src/env.d.ts` (TypeScript types for renderer)

When adding new IPC methods, update both files.

### Configuration

- Config stored in `~/.aktivitaeten/config.yaml`
- Maps Auftraggeber (client) names to Excel files
- Files scanned from configurable base path (e.g., `D:\C-Con\AL-kas\LV*.xlsx`)

### Excel Integration

- Uses SheetJS (xlsx) library for Excel compatibility
- Writes to month-named sheets (Januar, Februar, etc.)
- Copies cell styles from existing rows to preserve formatting
- Creates backups before every write operation

## Important Patterns

- Vue reactive objects must use `toRaw()` before IPC serialization
- Config must be loaded before IPC handlers are registered (async in main/index.ts)
- LLM prompts include known client names for better matching
- Time values stored as Excel day fractions (hours/24)
