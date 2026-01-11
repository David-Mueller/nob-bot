/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

type RecordingCallback = () => void
type ProgressCallback = (progress: {
  status: string
  file?: string
  progress?: number
}) => void

type WhisperMode = 'cloud' | 'local' | 'none'

interface TranscriptionResult {
  text: string
  language?: string
  mode: WhisperMode
  chunks?: Array<{
    text: string
    timestamp: [number, number]
  }>
}

interface Activity {
  auftraggeber: string | null
  thema: string | null
  beschreibung: string
  minuten: number | null
  km: number
  auslagen: number
  datum: string | null
}

interface WhisperAPI {
  init: (model?: string) => Promise<void>
  transcribe: (pcmBuffer: ArrayBuffer, originalBlob?: ArrayBuffer) => Promise<TranscriptionResult>
  isReady: () => Promise<boolean>
  isLoading: () => Promise<boolean>
  getMode: () => Promise<WhisperMode>
  onProgress: (callback: ProgressCallback) => () => void
}

interface LLMAPI {
  parse: (transcript: string, clients?: string[], themes?: string[]) => Promise<Activity>
  parseCorrection: (existingActivity: Activity, correctionTranscript: string) => Promise<Activity>
  parseFollowUp: (
    existingActivity: Activity,
    userAnswer: string,
    missingFields: string[],
    question: string
  ) => Promise<Activity>
  isReady: () => Promise<boolean>
}

interface ExcelActivity {
  row: number
  datum: string
  thema: string
  taetigkeit: string
  zeit: number | null
  km: number
  hotel: number
}

interface ExcelAPI {
  setPath: (path: string) => Promise<void>
  getPath: () => Promise<string | null>
  selectFile: () => Promise<string | null>
  saveActivity: (activity: Activity) => Promise<{ success: boolean; error?: string; filePath?: string }>
  openFile: (filePath: string) => Promise<boolean>
  getActivities: (month: number) => Promise<ExcelActivity[]>
}

interface XlsxFileConfig {
  path: string
  auftraggeber: string
  jahr: number
  active: boolean
}

interface AppSettings {
  hotkey: string
  openaiApiKey: string
  whisperModel: 'tiny' | 'base' | 'small'
  ttsEnabled: boolean
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

interface AppConfig {
  xlsxBasePath: string
  xlsxFiles: XlsxFileConfig[]
  settings: AppSettings
}

interface ScannedFile {
  path: string
  filename: string
  auftraggeber: string | null
  jahr: number | null
}

interface ConfigAPI {
  load: () => Promise<AppConfig>
  save: (config: AppConfig) => Promise<void>
  get: () => Promise<AppConfig>
  setBasePath: (path: string) => Promise<void>
  getBasePath: () => Promise<string>
  scanFiles: () => Promise<ScannedFile[]>
  updateFile: (path: string, updates: Partial<XlsxFileConfig>) => Promise<void>
  getFiles: () => Promise<XlsxFileConfig[]>
  getActiveFiles: () => Promise<XlsxFileConfig[]>
  findFile: (auftraggeber: string, jahr: number) => Promise<XlsxFileConfig | null>
  toggleFileActive: (path: string, active: boolean) => Promise<void>
  removeFile: (path: string) => Promise<void>
  getSettings: () => Promise<AppSettings>
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
}

interface GlossarEntry {
  kategorie: string
  begriff: string
  synonyme: string[]
}

interface GlossarKnownTerms {
  auftraggeber: string[]
  themen: string[]
  kunden: string[]
}

interface GlossarAPI {
  load: () => Promise<boolean>
  getKnownTerms: () => Promise<GlossarKnownTerms | null>
  normalize: (text: string) => Promise<string>
  getEntries: () => Promise<GlossarEntry[]>
  clearCache: () => Promise<void>
  createFromData: (filePath: string, auftraggeber: string) => Promise<boolean>
}

type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

interface TTSAPI {
  speak: (text: string, voice?: TTSVoice) => Promise<Uint8Array>
  isReady: () => Promise<boolean>
}

interface DraftEntry {
  id: number
  activity: Activity
  transcript: string
  timestamp: string
  saved: boolean
}

interface DraftsAPI {
  load: () => Promise<DraftEntry[]>
  save: (drafts: DraftEntry[]) => Promise<void>
  clear: () => Promise<void>
}

interface ElectronAPI {
  onStartRecording: (callback: RecordingCallback) => void
  removeStartRecordingListener: (callback: RecordingCallback) => void
  whisper: WhisperAPI
  llm: LLMAPI
  excel: ExcelAPI
  config: ConfigAPI
  glossar: GlossarAPI
  tts: TTSAPI
  drafts: DraftsAPI
}

declare global {
  interface Window {
    api?: ElectronAPI
  }
}

export {}
