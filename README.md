# Aktivitäten

Desktop-App zur Erfassung von Arbeitsaktivitäten per Spracheingabe.

## Features

- **Voice Recording**: Aktivitäten per Sprache erfassen
- **Whisper API**: Cloud-Transkription mit lokalem Fallback
- **LLM Parsing**: Automatische Extraktion von Auftraggeber, Thema, Zeit, KM, Auslagen
- **Voice-Korrektur**: Einträge per Sprache bearbeiten
- **System Tray**: Globaler Hotkey `Cmd+Shift+R` / `Ctrl+Shift+R`

## Setup

```bash
pnpm install
cp .env.example .env
# OPENAI_API_KEY in .env eintragen
```

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build:mac    # macOS
pnpm build:win    # Windows
```

## Tech Stack

- Electron + electron-vite
- Vue 3 + TypeScript
- Tailwind CSS 4
- OpenAI Whisper API + GPT-4o
- LangChain
