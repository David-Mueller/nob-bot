import { ipcMain, BrowserWindow } from 'electron'
import {
  initWhisper,
  transcribe,
  isWhisperReady,
  isWhisperLoading,
  getWhisperMode,
  type WhisperModel,
  type TranscriptionResult,
  type WhisperMode
} from '../services/whisper'

function toArrayBuffer(data: ArrayBuffer | Buffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) {
    return data
  } else if (Buffer.isBuffer(data)) {
    return new Uint8Array(data).buffer as ArrayBuffer
  } else if (data instanceof Uint8Array) {
    return new Uint8Array(data).buffer as ArrayBuffer
  }
  throw new Error('Invalid data type')
}

export function registerWhisperHandlers(mainWindow: BrowserWindow): void {
  // Initialize Whisper model
  ipcMain.handle(
    'whisper:init',
    async (_event, model?: WhisperModel): Promise<void> => {
      await initWhisper(model, (progress) => {
        mainWindow.webContents.send('whisper:progress', progress)
      })
    }
  )

  // Transcribe audio - accepts PCM data and original blob for cloud
  ipcMain.handle(
    'whisper:transcribe',
    async (
      _event,
      pcmData: ArrayBuffer | Buffer | Uint8Array,
      originalBlob?: ArrayBuffer | Buffer | Uint8Array
    ): Promise<TranscriptionResult> => {
      const pcmBuffer = toArrayBuffer(pcmData)
      const blobBuffer = originalBlob ? toArrayBuffer(originalBlob) : undefined

      return await transcribe(pcmBuffer, blobBuffer)
    }
  )

  // Get current whisper mode
  ipcMain.handle('whisper:getMode', (): WhisperMode => {
    return getWhisperMode()
  })

  // Check if Whisper is ready
  ipcMain.handle('whisper:isReady', (): boolean => {
    return isWhisperReady()
  })

  // Check if Whisper is loading
  ipcMain.handle('whisper:isLoading', (): boolean => {
    return isWhisperLoading()
  })
}
