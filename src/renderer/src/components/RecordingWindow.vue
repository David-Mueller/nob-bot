<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAudioRecorder } from '../composables/useAudioRecorder'

const emit = defineEmits<{
  (e: 'recorded', blob: Blob): void
  (e: 'cancelled'): void
}>()

const props = defineProps<{
  autoStart?: boolean
}>()

const { status, errorMessage, audioBlob, startRecording, stopRecording, cancelRecording, reset } =
  useAudioRecorder()

const recordingTime = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleStart = async (): Promise<void> => {
  recordingTime.value = 0
  const success = await startRecording()
  if (success) {
    timerInterval = setInterval(() => {
      recordingTime.value++
    }, 1000)
  }
}

const handleStop = (): void => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  stopRecording()
}

const handleCancel = (): void => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  cancelRecording()
  emit('cancelled')
}

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' && status.value === 'recording') {
    event.preventDefault()
    handleStop()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  }
}

watch(audioBlob, (blob) => {
  if (blob && status.value === 'processing') {
    emit('recorded', blob)
    reset()
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.autoStart) {
    handleStart()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})
</script>

<template>
  <div class="recording-window p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto">
    <!-- Status Indicator -->
    <div class="flex items-center justify-center gap-3 mb-6">
      <span
        v-if="status === 'recording'"
        class="w-4 h-4 bg-red-500 rounded-full animate-pulse"
      />
      <span
        v-else-if="status === 'processing'"
        class="w-4 h-4 bg-yellow-500 rounded-full animate-spin"
      />
      <span
        v-else-if="status === 'error'"
        class="w-4 h-4 bg-red-600 rounded-full"
      />
      <span
        v-else
        class="w-4 h-4 bg-green-500 rounded-full"
      />

      <span class="text-lg font-medium text-gray-700">
        <template v-if="status === 'idle'">Bereit</template>
        <template v-else-if="status === 'recording'">
          Aufnahme läuft... {{ formatTime(recordingTime) }}
        </template>
        <template v-else-if="status === 'processing'">Verarbeite...</template>
        <template v-else-if="status === 'error'">{{ errorMessage }}</template>
      </span>
    </div>

    <!-- Recording visualization -->
    <div
      v-if="status === 'recording'"
      class="h-16 bg-gray-100 rounded-lg mb-6 flex items-center justify-center"
    >
      <div class="flex gap-1 items-end h-8">
        <div
          v-for="i in 5"
          :key="i"
          class="w-2 bg-blue-500 rounded animate-pulse"
          :style="{
            height: `${Math.random() * 100}%`,
            animationDelay: `${i * 0.1}s`
          }"
        />
      </div>
    </div>

    <!-- Controls -->
    <div class="flex flex-col gap-4">
      <div v-if="status === 'idle'" class="flex justify-center">
        <button
          @click="handleStart"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/>
          </svg>
          Aufnahme starten
        </button>
      </div>

      <div v-else-if="status === 'recording'" class="flex justify-center gap-4">
        <button
          @click="handleStop"
          class="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Fertig (Enter)
        </button>
        <button
          @click="handleCancel"
          class="bg-gray-400 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Abbrechen (Esc)
        </button>
      </div>

      <div v-else-if="status === 'error'" class="flex justify-center">
        <button
          @click="reset"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>

    <!-- Keyboard hints -->
    <div class="mt-6 text-center text-sm text-gray-500">
      <span v-if="status === 'recording'">
        [Enter] Fertig &nbsp;|&nbsp; [Esc] Abbrechen
      </span>
      <span v-else>
        Strg+Shift+A für Schnellaufnahme
      </span>
    </div>
  </div>
</template>
