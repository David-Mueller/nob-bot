export type SaveResult = {
  success: boolean
  error?: string
  filePath?: string
}

export type WhisperMode = 'cloud' | 'local' | 'none'

export type ProgressCallback = (progress: number) => void
