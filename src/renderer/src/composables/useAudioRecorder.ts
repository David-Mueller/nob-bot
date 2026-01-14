import { ref, onUnmounted } from 'vue'

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'error'

export function useAudioRecorder() {
  const status = ref<RecordingStatus>('idle')
  const errorMessage = ref<string | null>(null)
  const audioBlob = ref<Blob | null>(null)
  const audioLevels = ref<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let stream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let animationId: number | null = null

  const updateAudioLevels = (): void => {
    if (!analyser) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)

    // Voice-optimized frequency bands (17 bands)
    // Fine resolution in low frequencies, coarser in high
    // With fftSize=256 and sampleRate=16000, each bin ≈ 62.5Hz
    const bandRanges = [
      [0, 1],     // ~0-62Hz
      [1, 2],     // ~62-125Hz
      [2, 3],     // ~125-190Hz
      [3, 4],     // ~190-250Hz
      [4, 5],     // ~250-310Hz
      [5, 6],     // ~310-375Hz
      [6, 7],     // ~375-440Hz
      [7, 8],     // ~440-500Hz
      [8, 10],    // ~500-625Hz
      [10, 12],   // ~625-750Hz
      [12, 15],   // ~750-940Hz
      [15, 19],   // ~940-1190Hz
      [19, 24],   // ~1190-1500Hz
      [24, 32],   // ~1500-2000Hz
      [32, 44],   // ~2000-2750Hz
      [44, 60],   // ~2750-3750Hz
      [60, 80],   // ~3750-5000Hz
    ]

    const levels: number[] = []

    for (const [start, end] of bandRanges) {
      let sum = 0
      const count = end - start
      for (let j = start; j < end && j < dataArray.length; j++) {
        sum += dataArray[j]
      }
      // Normalize to 0-1 range (reduced sensitivity to avoid clipping)
      const avg = sum / count / 255
      levels.push(Math.min(1, avg * 1.2))
    }

    audioLevels.value = levels
    animationId = requestAnimationFrame(updateAudioLevels)
  }

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

      // Set up audio analyser for visualization
      audioContext = new AudioContext()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Start level monitoring
      updateAudioLevels()

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

  const cleanupAudio = (): void => {
    // Stop animation
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    // Close audio context
    if (audioContext) {
      audioContext.close()
      audioContext = null
      analyser = null
    }

    // Reset levels
    audioLevels.value = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    // Stop all tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }
  }

  const stopRecording = (): Blob | null => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }

    cleanupAudio()
    return audioBlob.value
  }

  const cancelRecording = (): void => {
    audioChunks = []
    audioBlob.value = null

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }

    cleanupAudio()
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
    audioLevels,
    startRecording,
    stopRecording,
    cancelRecording,
    reset
  }
}
