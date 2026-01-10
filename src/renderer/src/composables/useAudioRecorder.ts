import { ref, onUnmounted } from 'vue'

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'error'

export function useAudioRecorder() {
  const status = ref<RecordingStatus>('idle')
  const errorMessage = ref<string | null>(null)
  const audioBlob = ref<Blob | null>(null)

  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let stream: MediaStream | null = null

  const startRecording = async (): Promise<boolean> => {
    try {
      errorMessage.value = null
      audioChunks = []

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      })

      // Prefer webm for Whisper compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: mimeType })
        audioBlob.value = blob
        status.value = 'processing'
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        errorMessage.value = 'Aufnahmefehler'
        status.value = 'error'
      }

      mediaRecorder.start(100) // Collect data every 100ms
      status.value = 'recording'
      return true
    } catch (error) {
      console.error('Failed to start recording:', error)
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        errorMessage.value = 'Mikrofon-Zugriff verweigert'
      } else {
        errorMessage.value = 'Mikrofon nicht verfügbar'
      }
      status.value = 'error'
      return false
    }
  }

  const stopRecording = (): Blob | null => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }

    // Stop all tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }

    return audioBlob.value
  }

  const cancelRecording = (): void => {
    audioChunks = []
    audioBlob.value = null

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }

    status.value = 'idle'
  }

  const reset = (): void => {
    audioBlob.value = null
    errorMessage.value = null
    status.value = 'idle'
  }

  onUnmounted(() => {
    cancelRecording()
  })

  return {
    status,
    errorMessage,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    reset
  }
}
