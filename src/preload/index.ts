import { contextBridge, ipcRenderer } from 'electron'
import type { Activity, XlsxFileConfig, AppSettings, AppConfig, SaveResult, WhisperMode } from '@shared/types'

type RecordingCallback = () => void
type ProgressCallback = (progress: {
  status: string
  file?: string
  progress?: number
}) => void

type TranscriptionResult = {
  text: string
  language?: string
  mode: WhisperMode
}

type ScannedFile = {
  path: string
  filename: string
  auftraggeber: string | null
  jahr: number | null
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
    init: (): Promise<void> => {
      return ipcRenderer.invoke('whisper:init')
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
    getMode: (): Promise<WhisperMode> => {
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
    parseCorrection: (existingActivity: Activity, correctionTranscript: string): Promise<Activity> => {
      return ipcRenderer.invoke('llm:parseCorrection', existingActivity, correctionTranscript)
    },
    parseFollowUp: (
      existingActivity: Activity,
      userAnswer: string,
      missingFields: string[],
      question: string
    ): Promise<Activity> => {
      return ipcRenderer.invoke('llm:parseFollowUp', existingActivity, userAnswer, missingFields, question)
    },
    isReady: (): Promise<boolean> => {
      return ipcRenderer.invoke('llm:isReady')
    }
  },

  // Excel API
  excel: {
    setPath: (path: string): Promise<void> => {
      return ipcRenderer.invoke('excel:setPath', path)
    },
    getPath: (): Promise<string | null> => {
      return ipcRenderer.invoke('excel:getPath')
    },
    selectFile: (): Promise<string | null> => {
      return ipcRenderer.invoke('excel:selectFile')
    },
    saveActivity: (activity: Activity): Promise<SaveResult> => {
      return ipcRenderer.invoke('excel:saveActivity', activity)
    },
    openFile: (filePath: string): Promise<boolean> => {
      return ipcRenderer.invoke('excel:openFile', filePath)
    },
    getActivities: (month: number): Promise<Array<{
      row: number
      datum: string
      thema: string
      taetigkeit: string
      zeit: number | null
      km: number
      hotel: number
    }>> => {
      return ipcRenderer.invoke('excel:getActivities', month)
    }
  },

  // Config API
  config: {
    load: (): Promise<AppConfig> => {
      return ipcRenderer.invoke('config:load')
    },
    save: (config: AppConfig): Promise<void> => {
      return ipcRenderer.invoke('config:save', config)
    },
    get: (): Promise<AppConfig> => {
      return ipcRenderer.invoke('config:get')
    },
    setBasePath: (path: string): Promise<void> => {
      return ipcRenderer.invoke('config:setBasePath', path)
    },
    getBasePath: (): Promise<string> => {
      return ipcRenderer.invoke('config:getBasePath')
    },
    scanFiles: (): Promise<ScannedFile[]> => {
      return ipcRenderer.invoke('config:scanFiles')
    },
    updateFile: (path: string, updates: Partial<XlsxFileConfig>): Promise<void> => {
      return ipcRenderer.invoke('config:updateFile', path, updates)
    },
    getFiles: (): Promise<XlsxFileConfig[]> => {
      return ipcRenderer.invoke('config:getFiles')
    },
    getActiveFiles: (): Promise<XlsxFileConfig[]> => {
      return ipcRenderer.invoke('config:getActiveFiles')
    },
    findFile: (auftraggeber: string, jahr: number): Promise<XlsxFileConfig | null> => {
      return ipcRenderer.invoke('config:findFile', auftraggeber, jahr)
    },
    toggleFileActive: (path: string, active: boolean): Promise<void> => {
      return ipcRenderer.invoke('config:toggleFileActive', path, active)
    },
    removeFile: (path: string): Promise<void> => {
      return ipcRenderer.invoke('config:removeFile', path)
    },
    getSettings: (): Promise<AppSettings> => {
      return ipcRenderer.invoke('config:getSettings')
    },
    updateSettings: (updates: Partial<AppSettings>): Promise<AppSettings> => {
      return ipcRenderer.invoke('config:updateSettings', updates)
    }
  },

  // TTS API
  tts: {
    speak: (text: string, voice?: string): Promise<Uint8Array> => {
      return ipcRenderer.invoke('tts:speak', text, voice)
    },
    isReady: (): Promise<boolean> => {
      return ipcRenderer.invoke('tts:isReady')
    }
  },

  // Glossar API
  glossar: {
    load: (): Promise<boolean> => {
      return ipcRenderer.invoke('glossar:load')
    },
    getKnownTerms: (): Promise<{
      auftraggeber: string[]
      themen: string[]
      kunden: string[]
    } | null> => {
      return ipcRenderer.invoke('glossar:getKnownTerms')
    },
    normalize: (text: string): Promise<string> => {
      return ipcRenderer.invoke('glossar:normalize', text)
    },
    getEntries: (): Promise<Array<{
      kategorie: string
      begriff: string
      synonyme: string[]
    }>> => {
      return ipcRenderer.invoke('glossar:getEntries')
    },
    clearCache: (): Promise<void> => {
      return ipcRenderer.invoke('glossar:clearCache')
    },
    createFromData: (filePath: string, auftraggeber: string): Promise<boolean> => {
      return ipcRenderer.invoke('glossar:createFromData', filePath, auftraggeber)
    }
  },

  // Drafts API
  drafts: {
    load: (): Promise<Array<{
      id: number
      activity: Activity
      transcript: string
      timestamp: string
      saved: boolean
    }>> => {
      return ipcRenderer.invoke('drafts:load')
    },
    save: (drafts: Array<{
      id: number
      activity: Activity
      transcript: string
      timestamp: string
      saved: boolean
    }>): Promise<void> => {
      return ipcRenderer.invoke('drafts:save', drafts)
    },
    clear: (): Promise<void> => {
      return ipcRenderer.invoke('drafts:clear')
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
