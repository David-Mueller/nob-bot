import { ref, onMounted, onUnmounted } from 'vue'

export type WhisperStatus = 'unloaded' | 'loading' | 'ready' | 'transcribing' | 'error'
export type WhisperMode = 'cloud' | 'none'

export type TranscribeResult = {
  text: string
  language?: string
  mode: WhisperMode
}

export function useWhisper() {
  const status = ref<WhisperStatus>('unloaded')
  const loadingProgress = ref(0)
  const loadingFile = ref<string | null>(null)
  const transcript = ref<string | null>(null)
  const detectedLanguage = ref<string | null>(null)
  const lastMode = ref<WhisperMode>('none')
  const error = ref<string | null>(null)

  const handleProgress = (progress: { status: string; file?: string; progress?: number }): void => {
    if (progress.status === 'progress' && progress.progress !== undefined) {
      loadingProgress.value = Math.round(progress.progress)
    }
    if (progress.file) {
      loadingFile.value = progress.file
    }
  }

  const init = async (): Promise<boolean> => {
    if (!window.api?.whisper) {
      error.value = 'Whisper API not available'
      status.value = 'error'
      return false
    }

    try {
      error.value = null
      status.value = 'loading'

      await window.api.whisper.init()
      status.value = 'ready'
      return true
    } catch (err) {
      console.error('Failed to init Whisper:', err)
      error.value = err instanceof Error ? err.message : 'OpenAI API key not configured'
      status.value = 'error'
      return false
    }
  }

  const transcribe = async (audioBlob: Blob): Promise<TranscribeResult | null> => {
    if (!window.api?.whisper) {
      error.value = 'Whisper API not available'
      return null
    }

    try {
      error.value = null
      transcript.value = null

      // Check if Whisper is ready
      const isReady = await window.api.whisper.isReady()
      if (!isReady) {
        await init()
      }

      status.value = 'transcribing'

      // Get original blob as ArrayBuffer (for cloud API)
      const originalBlobBuffer = await audioBlob.arrayBuffer()

      // Also decode to PCM for local fallback
      const audioContext = new AudioContext({ sampleRate: 16000 })
      const audioBuffer = await audioContext.decodeAudioData(originalBlobBuffer.slice(0))

      // Get mono channel (Whisper expects mono)
      const channelData = audioBuffer.getChannelData(0)

      // Resample to 16kHz if needed
      let samples: Float32Array
      if (audioBuffer.sampleRate !== 16000) {
        const ratio = audioBuffer.sampleRate / 16000
        const newLength = Math.round(channelData.length / ratio)
        samples = new Float32Array(newLength)
        for (let i = 0; i < newLength; i++) {
          samples[i] = channelData[Math.round(i * ratio)]
        }
      } else {
        samples = channelData
      }

      await audioContext.close()

      // Send both PCM and original blob to backend
      // Cloud API uses original blob, local uses PCM
      const pcmBuffer = new Float32Array(samples).buffer as ArrayBuffer
      const result = await window.api.whisper.transcribe(pcmBuffer, originalBlobBuffer)

      transcript.value = result.text
      detectedLanguage.value = result.language ?? null
      lastMode.value = result.mode

      status.value = 'ready'
      return {
        text: result.text,
        language: result.language,
        mode: result.mode
      }
    } catch (err) {
      console.error('Transcription failed:', err)
      error.value = err instanceof Error ? err.message : 'Transcription failed'
      status.value = 'error'
      return null
    }
  }

  const checkStatus = async (): Promise<void> => {
    if (!window.api?.whisper) return

    const isReady = await window.api.whisper.isReady()
    const isLoading = await window.api.whisper.isLoading()

    if (isReady) {
      status.value = 'ready'
    } else if (isLoading) {
      status.value = 'loading'
    } else {
      status.value = 'unloaded'
    }
  }

  const getMode = async (): Promise<WhisperMode> => {
    if (!window.api?.whisper) return 'none'
    return await window.api.whisper.getMode()
  }

  let removeProgressListener: (() => void) | null = null

  onMounted(() => {
    removeProgressListener = window.api?.whisper?.onProgress(handleProgress) ?? null
    checkStatus()
  })

  onUnmounted(() => {
    removeProgressListener?.()
  })

  return {
    status,
    loadingProgress,
    loadingFile,
    transcript,
    detectedLanguage,
    lastMode,
    error,
    init,
    transcribe,
    checkStatus,
    getMode
  }
}
