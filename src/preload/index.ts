import { contextBridge, ipcRenderer } from 'electron'

type RecordingCallback = () => void
type ProgressCallback = (progress: {
  status: string
  file?: string
  progress?: number
}) => void

interface TranscriptionResult {
  text: string
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

const api = {
  // Recording events
  onStartRecording: (callback: RecordingCallback): void => {
    ipcRenderer.on('start-recording', callback)
  },
  removeStartRecordingListener: (callback: RecordingCallback): void => {
    ipcRenderer.removeListener('start-recording', callback)
  },

  // Whisper API
  whisper: {
    init: (model?: string): Promise<void> => {
      return ipcRenderer.invoke('whisper:init', model)
    },
    transcribe: (pcmBuffer: ArrayBuffer, originalBlob?: ArrayBuffer): Promise<TranscriptionResult> => {
      return ipcRenderer.invoke('whisper:transcribe', pcmBuffer, originalBlob)
    },
    isReady: (): Promise<boolean> => {
      return ipcRenderer.invoke('whisper:isReady')
    },
    isLoading: (): Promise<boolean> => {
      return ipcRenderer.invoke('whisper:isLoading')
    },
    getMode: (): Promise<'cloud' | 'local' | 'none'> => {
      return ipcRenderer.invoke('whisper:getMode')
    },
    onProgress: (callback: ProgressCallback): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<ProgressCallback>[0]): void => {
        callback(progress)
      }
      ipcRenderer.on('whisper:progress', handler)
      return () => ipcRenderer.removeListener('whisper:progress', handler)
    }
  },

  // LLM API
  llm: {
    parse: (transcript: string, clients?: string[], themes?: string[]): Promise<Activity> => {
      return ipcRenderer.invoke('llm:parse', transcript, clients, themes)
    },
    isReady: (): Promise<boolean> => {
      return ipcRenderer.invoke('llm:isReady')
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Fallback for non-isolated context (dev only)
  ;(window as { api?: typeof api }).api = api
}

export type ElectronAPI = typeof api
