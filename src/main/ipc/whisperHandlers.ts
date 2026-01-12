import { ipcMain, BrowserWindow } from 'electron'
import {
  initWhisper,
  transcribe,
  isWhisperReady,
  getWhisperMode,
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

export function registerWhisperHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle('whisper:init', async (): Promise<void> => {
    await initWhisper()
  })

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

  ipcMain.handle('whisper:getMode', async (): Promise<WhisperMode> => {
    return await getWhisperMode()
  })

  ipcMain.handle('whisper:isReady', async (): Promise<boolean> => {
    return await isWhisperReady()
  })

  // Keep for backwards compatibility, always returns false now
  ipcMain.handle('whisper:isLoading', (): boolean => {
    return false
  })
}
