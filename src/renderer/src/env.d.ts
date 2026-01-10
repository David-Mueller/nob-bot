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
  stunden: number | null
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
  saveActivity: (activity: Activity) => Promise<{ success: boolean; error?: string }>
  getActivities: (month: number) => Promise<ExcelActivity[]>
}

interface ElectronAPI {
  onStartRecording: (callback: RecordingCallback) => void
  removeStartRecordingListener: (callback: RecordingCallback) => void
  whisper: WhisperAPI
  llm: LLMAPI
  excel: ExcelAPI
}

declare global {
  interface Window {
    api?: ElectronAPI
  }
}

export {}
