<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import RecordingWindow from './components/RecordingWindow.vue'
import ActivityList from './components/ActivityList.vue'
import { useWhisper } from './composables/useWhisper'

type Activity = {
  auftraggeber: string | null
  thema: string | null
  beschreibung: string
  stunden: number | null
  km: number | null
  auslagen: number | null
  datum: string | null
}

type WhisperMode = 'cloud' | 'local' | 'none'

type ChatMessage = {
  id: number
  type: 'user' | 'assistant' | 'error'
  content: string
  language?: string
  mode?: WhisperMode
  activity?: Activity
  timestamp: Date
}

type ActivityEntry = {
  id: number
  activity: Activity
  transcript: string
  timestamp: Date
  saved: boolean
}

type ViewTab = 'record' | 'list'

const showRecording = ref(false)
const isProcessing = ref(false)
const processingStep = ref<'transcribing' | 'parsing' | null>(null)
const messages = ref<ChatMessage[]>([])
const entries = ref<ActivityEntry[]>([])
const currentView = ref<ViewTab>('record')
const editingEntry = ref<ActivityEntry | null>(null)
let messageId = 0
let entryId = 0

// Count unsaved entries for badge
const unsavedCount = computed(() => entries.value.filter(e => !e.saved).length)

const {
  status: whisperStatus,
  loadingProgress,
  error: whisperError,
  init: initWhisper,
  transcribe
} = useWhisper()

const handleStartRecording = (): void => {
  showRecording.value = true
}

const addMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>): void => {
  messages.value.push({
    ...msg,
    id: ++messageId,
    timestamp: new Date()
  })
}

const handleRecorded = async (blob: Blob): Promise<void> => {
  console.log('Recording completed:', blob.size, 'bytes')
  showRecording.value = false
  isProcessing.value = true

  // Step 1: Transcribe
  processingStep.value = 'transcribing'
  const result = await transcribe(blob)

  if (!result) {
    addMessage({ type: 'error', content: 'Transkription fehlgeschlagen' })
    isProcessing.value = false
    processingStep.value = null
    return
  }

  // Add user message with transcription
  addMessage({
    type: 'user',
    content: result.text,
    language: result.language,
    mode: result.mode
  })

  console.log('Transcription:', result.text, 'Language:', result.language, 'Mode:', result.mode)

  // Step 2: Parse with LLM
  processingStep.value = 'parsing'
  try {
    const activity = await window.api?.llm.parse(result.text, ['IDT', 'LOTUS', 'ORLEN'], [])
    if (activity) {
      addMessage({
        type: 'assistant',
        content: formatActivity(activity),
        activity
      })
      console.log('Parsed activity:', activity)

      // Add to entries list
      entries.value.push({
        id: ++entryId,
        activity,
        transcript: result.text,
        timestamp: new Date(),
        saved: false
      })
    }
  } catch (err) {
    console.error('LLM parsing failed:', err)
    addMessage({
      type: 'error',
      content: err instanceof Error ? err.message : 'Parsing fehlgeschlagen'
    })
  }

  isProcessing.value = false
  processingStep.value = null
}

const handleCancelled = (): void => {
  showRecording.value = false
}

const formatActivity = (activity: Activity): string => {
  const parts: string[] = []
  if (activity.auftraggeber) parts.push(`**Auftraggeber:** ${activity.auftraggeber}`)
  if (activity.thema) parts.push(`**Thema:** ${activity.thema}`)
  parts.push(`**Beschreibung:** ${activity.beschreibung}`)
  if (activity.stunden !== null) parts.push(`**Zeit:** ${activity.stunden}h`)
  if (activity.km && activity.km > 0) parts.push(`**KM:** ${activity.km}`)
  if (activity.auslagen && activity.auslagen > 0) parts.push(`**Auslagen:** ${activity.auslagen}€`)
  if (activity.datum) parts.push(`**Datum:** ${activity.datum}`)
  return parts.join('\n')
}

const getLanguageLabel = (lang?: string): string => {
  const labels: Record<string, string> = {
    german: 'Deutsch',
    polish: 'Polnisch',
    english: 'Englisch',
    de: 'Deutsch',
    pl: 'Polnisch',
    en: 'Englisch'
  }
  return lang ? labels[lang.toLowerCase()] || lang : 'Unbekannt'
}

const getMissingFields = (activity: Activity): string[] => {
  const missing: string[] = []
  if (activity.auftraggeber === null) missing.push('Auftraggeber')
  if (activity.thema === null) missing.push('Thema')
  if (activity.stunden === null) missing.push('Zeit')
  return missing
}

// Entry list handlers
const handleSaveEntry = async (entry: ActivityEntry): Promise<void> => {
  // TODO: Save to Excel via IPC
  console.log('Saving entry:', entry)
  entry.saved = true
  addMessage({
    type: 'assistant',
    content: `✅ Aktivität "${entry.activity.beschreibung}" wurde gespeichert.`
  })
}

const handleEditEntry = (entry: ActivityEntry): void => {
  editingEntry.value = entry
  // TODO: Open edit modal
  console.log('Editing entry:', entry)
}

const handleDeleteEntry = (entry: ActivityEntry): void => {
  const index = entries.value.findIndex(e => e.id === entry.id)
  if (index !== -1) {
    entries.value.splice(index, 1)
  }
}

onMounted(() => {
  window.api?.onStartRecording(handleStartRecording)
  initWhisper()
})

onUnmounted(() => {
  window.api?.removeStartRecordingListener(handleStartRecording)
})
</script>

<template>
  <div class="h-screen bg-gray-100 flex flex-col">
    <!-- Header -->
    <header class="bg-white border-b px-4 py-3">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h1 class="text-lg font-semibold text-gray-800">Aktivitäten</h1>
          <p class="text-xs text-gray-500">Cmd+Shift+R / Strg+Shift+R</p>
        </div>
        <div class="flex items-center gap-2">
          <span
            v-if="whisperStatus === 'loading'"
            class="text-xs text-blue-600 flex items-center gap-1"
          >
            <span class="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin" />
            Whisper {{ loadingProgress }}%
          </span>
          <span
            v-else-if="whisperStatus === 'ready'"
            class="text-xs text-green-600"
          >
            Bereit
          </span>
          <span
            v-else-if="whisperError"
            class="text-xs text-red-600"
          >
            Fehler
          </span>
        </div>
      </div>

      <!-- View Tabs -->
      <div class="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          @click="currentView = 'record'"
          :class="[
            'flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors',
            currentView === 'record'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          Erfassen
        </button>
        <button
          @click="currentView = 'list'"
          :class="[
            'flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors relative',
            currentView === 'list'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          Liste
          <span
            v-if="unsavedCount > 0"
            class="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center"
          >
            {{ unsavedCount }}
          </span>
        </button>
      </div>
    </header>

    <!-- Record View (Chat) -->
    <div v-if="currentView === 'record'" class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Empty State -->
      <div
        v-if="messages.length === 0 && !showRecording && !isProcessing"
        class="h-full flex flex-col items-center justify-center text-gray-500"
      >
        <svg class="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p class="text-sm">Klicke auf den Mikrofon-Button</p>
        <p class="text-xs mt-1">oder drücke Cmd+Shift+R</p>
      </div>

      <!-- Messages -->
      <template v-for="msg in messages" :key="msg.id">
        <!-- User Message (Transcription) -->
        <div v-if="msg.type === 'user'" class="flex justify-end">
          <div class="max-w-[80%]">
            <div class="bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2">
              <p class="text-sm">{{ msg.content }}</p>
            </div>
            <div class="flex items-center justify-end gap-2 mt-1 text-xs text-gray-500">
              <span
                v-if="msg.mode"
                :class="msg.mode === 'cloud' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'"
                class="px-2 py-0.5 rounded"
              >
                {{ msg.mode === 'cloud' ? 'Cloud' : 'Lokal' }}
              </span>
              <span v-if="msg.language" class="bg-gray-200 px-2 py-0.5 rounded">
                {{ getLanguageLabel(msg.language) }}
              </span>
              <span>{{ msg.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>
          </div>
        </div>

        <!-- Assistant Message (Parsed Activity) -->
        <div v-else-if="msg.type === 'assistant'" class="flex justify-start">
          <div class="max-w-[80%]">
            <div class="bg-white border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div v-if="msg.activity" class="space-y-1 text-sm">
                <p v-if="msg.activity.auftraggeber">
                  <span class="font-medium text-gray-600">Auftraggeber:</span>
                  <span class="ml-1">{{ msg.activity.auftraggeber }}</span>
                </p>
                <p v-if="msg.activity.thema">
                  <span class="font-medium text-gray-600">Thema:</span>
                  <span class="ml-1">{{ msg.activity.thema }}</span>
                </p>
                <p>
                  <span class="font-medium text-gray-600">Beschreibung:</span>
                  <span class="ml-1">{{ msg.activity.beschreibung }}</span>
                </p>
                <p v-if="msg.activity.stunden !== null">
                  <span class="font-medium text-gray-600">Zeit:</span>
                  <span class="ml-1">{{ msg.activity.stunden }}h</span>
                </p>
                <p v-if="msg.activity.km && msg.activity.km > 0">
                  <span class="font-medium text-gray-600">KM:</span>
                  <span class="ml-1">{{ msg.activity.km }}</span>
                </p>
                <p v-if="msg.activity.auslagen && msg.activity.auslagen > 0">
                  <span class="font-medium text-gray-600">Auslagen:</span>
                  <span class="ml-1">{{ msg.activity.auslagen }}€</span>
                </p>
                <p v-if="msg.activity.datum">
                  <span class="font-medium text-gray-600">Datum:</span>
                  <span class="ml-1">{{ msg.activity.datum }}</span>
                </p>

                <!-- Missing Fields Warning -->
                <div
                  v-if="getMissingFields(msg.activity).length > 0"
                  class="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700 border border-yellow-200"
                >
                  Fehlend: {{ getMissingFields(msg.activity).join(', ') }}
                </div>
              </div>
            </div>
            <p class="mt-1 text-xs text-gray-500">
              {{ msg.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}
            </p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-else-if="msg.type === 'error'" class="flex justify-center">
          <div class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
            {{ msg.content }}
          </div>
        </div>
      </template>

      <!-- Processing Indicator -->
      <div v-if="isProcessing" class="flex justify-start">
        <div class="bg-white border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            {{ processingStep === 'transcribing' ? 'Transkribiere...' : 'Analysiere...' }}
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else class="flex-1 overflow-y-auto p-4">
      <ActivityList
        :entries="entries"
        @save="handleSaveEntry"
        @edit="handleEditEntry"
        @delete="handleDeleteEntry"
      />
    </div>

    <!-- Recording Overlay -->
    <RecordingWindow
      v-if="showRecording"
      :auto-start="true"
      @recorded="handleRecorded"
      @cancelled="handleCancelled"
      class="absolute inset-0 z-10"
    />

    <!-- Input Area (only in record view) -->
    <div v-if="currentView === 'record'" class="bg-white border-t p-4">
      <button
        @click="handleStartRecording"
        :disabled="whisperStatus !== 'ready' || isProcessing"
        class="w-full flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <span v-if="whisperStatus === 'ready'">Neue Aktivität aufnehmen</span>
        <span v-else-if="whisperStatus === 'loading'">Whisper lädt...</span>
        <span v-else>Nicht bereit</span>
      </button>
    </div>
  </div>
</template>
