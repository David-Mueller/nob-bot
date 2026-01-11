import { ref } from 'vue'

export function useTTS() {
  const currentAudio = ref<HTMLAudioElement | null>(null)
  const isPlaying = ref(false)

  async function speak(text: string): Promise<void> {
    try {
      // Check if TTS is enabled in settings
      const settings = await window.api?.config.getSettings()
      if (!settings?.ttsEnabled) {
        console.log('[TTS] Disabled in settings')
        return
      }

      const isReady = await window.api?.tts.isReady()
      if (!isReady) {
        console.log('[TTS] Not ready (no API key)')
        return
      }

      const audioData = await window.api?.tts.speak(text, settings.ttsVoice)
      console.log('[TTS] Received audio data:', audioData?.length, 'bytes')

      if (audioData && audioData.length > 0) {
        // Stop any currently playing audio
        if (currentAudio.value) {
          currentAudio.value.pause()
          currentAudio.value = null
        }

        // Convert Uint8Array to Blob (cast needed for TS compatibility)
        const blob = new Blob([audioData as unknown as BlobPart], { type: 'audio/mpeg' })
        console.log('[TTS] Created blob:', blob.size, 'bytes, type:', blob.type)

        const url = URL.createObjectURL(blob)
        console.log('[TTS] Blob URL:', url)

        currentAudio.value = new Audio(url)
        currentAudio.value.volume = 1.0

        console.log('[TTS] Audio element created, readyState:', currentAudio.value.readyState)

        // Clean up blob URL when done
        currentAudio.value.onended = () => {
          console.log('[TTS] Audio ended')
          URL.revokeObjectURL(url)
          currentAudio.value = null
          isPlaying.value = false
        }

        currentAudio.value.onerror = (e) => {
          console.error('[TTS] Audio playback error:', e, currentAudio.value?.error)
          URL.revokeObjectURL(url)
          currentAudio.value = null
          isPlaying.value = false
        }

        currentAudio.value.oncanplay = () => {
          console.log('[TTS] Audio can play, duration:', currentAudio.value?.duration)
        }

        currentAudio.value.onplay = () => {
          console.log('[TTS] Audio play event fired')
        }

        try {
          isPlaying.value = true
          await currentAudio.value.play()
          console.log('[TTS] play() resolved successfully')
        } catch (playError) {
          console.error('[TTS] play() failed:', playError)
          isPlaying.value = false
        }
      } else {
        console.warn('[TTS] No audio data received')
      }
    } catch (err) {
      console.error('[TTS] Failed to speak:', err)
      isPlaying.value = false
      // Non-blocking - continue without TTS
    }
  }

  function stop(): void {
    if (currentAudio.value) {
      currentAudio.value.pause()
      currentAudio.value = null
      isPlaying.value = false
    }
  }

  return { speak, stop, isPlaying }
}
