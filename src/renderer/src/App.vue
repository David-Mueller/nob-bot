<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, toRaw, watch, nextTick } from 'vue'
import RecordingWindow from './components/RecordingWindow.vue'
import ActivityList from './components/ActivityList.vue'
import DateiManager from './components/DateiManager.vue'
import Settings from './components/Settings.vue'
import { useWhisper } from './composables/useWhisper'

type Activity = {
  auftraggeber: string | null
  thema: string | null
  beschreibung: string
  minuten: number | null
  km: number
  auslagen: number
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
  filePath?: string
  timestamp: Date
}

type ActivityEntry = {
  id: number
  activity: Activity
  transcript: string
  timestamp: Date
  saved: boolean
  savedFilePath?: string
}

type ViewTab = 'record' | 'list' | 'files' | 'settings'

const showRecording = ref(false)
const isProcessing = ref(false)
const processingStep = ref<'transcribing' | 'parsing' | null>(null)
const messages = ref<ChatMessage[]>([])
const entries = ref<ActivityEntry[]>([])
const currentView = ref<ViewTab>('record')
const editingEntry = ref<ActivityEntry | null>(null)
const chatContainer = ref<HTMLElement | null>(null)
let messageId = 0
let entryId = 0

// Auto-scroll chat to bottom when new messages arrive
const scrollChatToBottom = (): void => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

watch(messages, scrollChatToBottom, { deep: true })
watch(isProcessing, scrollChatToBottom)

// Count unsaved entries for badge
const unsavedCount = computed(() => entries.value.filter(e => !e.saved).length)

// Active Excel files from config
const activeFileCount = ref(0)
const activeClients = ref<string[]>([])

const loadActiveFiles = async (): Promise<void> => {
  const files = await window.api?.config.getActiveFiles() || []
  activeFileCount.value = files.length
  activeClients.value = [...new Set(files.map(f => f.auftraggeber))]
}

// Load saved drafts on startup
const loadDrafts = async (): Promise<void> => {
  const drafts = await window.api?.drafts.load() || []
  if (drafts.length > 0) {
    entries.value = drafts.map(d => ({
      ...d,
      timestamp: new Date(d.timestamp)
    }))
    // Find max id to continue from
    entryId = Math.max(...entries.value.map(e => e.id), 0)
    console.log(`[Drafts] Restored ${drafts.length} entries`)
  }
}

// Auto-save drafts when entries change
const saveDrafts = async (): Promise<void> => {
  const drafts = entries.value.map(e => ({
    ...toRaw(e),
    timestamp: e.timestamp.toISOString()
  }))
  await window.api?.drafts.save(drafts)
}

// Debounced watcher for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(entries, () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(saveDrafts, 1000)
}, { deep: true })

// Editing/follow-up context for voice input
const editingContextText = computed(() => {
  // Follow-up question has priority
  if (followUpEntry.value && currentFollowUpQuestion.value) {
    return currentFollowUpQuestion.value
  }

  if (!editingEntry.value) return undefined
  const a = editingEntry.value.activity
  const parts: string[] = []
  if (a.auftraggeber) parts.push(a.auftraggeber)
  if (a.thema) parts.push(a.thema)
  parts.push(a.beschreibung)
  if (a.minuten !== null) parts.push(formatTime(a.minuten))
  if (a.km && a.km > 0) parts.push(`${a.km}km`)
  return parts.join(' • ')
})

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

  const isEditing = editingEntry.value !== null
  const isFollowUp = followUpEntry.value !== null

  // Step 1: Transcribe
  processingStep.value = 'transcribing'
  const result = await transcribe(blob)

  if (!result) {
    addMessage({ type: 'error', content: 'Transkription fehlgeschlagen' })
    isProcessing.value = false
    processingStep.value = null
    editingEntry.value = null
    followUpEntry.value = null
    currentFollowUpQuestion.value = null
    return
  }

  // Add user message with transcription
  const messagePrefix = isFollowUp ? '💬 ' : (isEditing ? '✏️ ' : '')
  addMessage({
    type: 'user',
    content: `${messagePrefix}${result.text}`,
    language: result.language,
    mode: result.mode
  })

  console.log('Transcription:', result.text, 'Language:', result.language, 'Mode:', result.mode)

  // Step 2: Parse with LLM
  processingStep.value = 'parsing'
  try {
    if (isFollowUp && followUpEntry.value && currentFollowUpQuestion.value) {
      // Follow-up mode: parse answer for missing fields
      const updatedActivity = await window.api?.llm.parseFollowUp(
        toRaw(followUpEntry.value.activity),
        result.text,
        getMissingFieldKeys(followUpEntry.value.activity),
        currentFollowUpQuestion.value
      )
      if (updatedActivity) {
        followUpEntry.value.activity = updatedActivity
        followUpEntry.value.transcript += ` → ${result.text}`

        addMessage({
          type: 'assistant',
          content: `✅ Aktualisiert:\n${formatActivity(updatedActivity)}`,
          activity: updatedActivity
        })

        // Check if still missing fields
        const nextQuestion = getNextFollowUpQuestion(updatedActivity)
        if (nextQuestion) {
          // More fields missing - continue follow-up
          currentFollowUpQuestion.value = nextQuestion.question
          addMessage({
            type: 'assistant',
            content: `🎤 ${nextQuestion.question}`
          })
          // Speak the question (non-blocking)
          speakQuestion(nextQuestion.question)
          isProcessing.value = false
          processingStep.value = null
          showRecording.value = true
          return
        } else {
          // All fields filled - done with follow-up
          console.log('Follow-up complete:', updatedActivity)
          followUpEntry.value = null
          currentFollowUpQuestion.value = null
        }
      }
    } else if (isEditing && editingEntry.value) {
      // Correction mode: update existing entry
      // toRaw() needed to remove Vue proxy for IPC serialization
      const correctedActivity = await window.api?.llm.parseCorrection(
        toRaw(editingEntry.value.activity),
        result.text
      )
      if (correctedActivity) {
        // Update the entry
        editingEntry.value.activity = correctedActivity
        editingEntry.value.transcript += ` → ${result.text}`

        addMessage({
          type: 'assistant',
          content: `✏️ Korrigiert:\n${formatActivity(correctedActivity)}`,
          activity: correctedActivity
        })
        console.log('Corrected activity:', correctedActivity)
      }
      editingEntry.value = null
    } else {
      // New entry mode
      const activity = await window.api?.llm.parse(result.text)
      if (activity) {
        addMessage({
          type: 'assistant',
          content: formatActivity(activity),
          activity
        })
        console.log('Parsed activity:', activity)

        // Create the entry
        const newEntry: ActivityEntry = {
          id: ++entryId,
          activity,
          transcript: result.text,
          timestamp: new Date(),
          saved: false
        }
        entries.value.push(newEntry)

        // Check if required fields are missing
        const nextQuestion = getNextFollowUpQuestion(activity)
        if (nextQuestion) {
          // Start follow-up flow
          followUpEntry.value = newEntry
          currentFollowUpQuestion.value = nextQuestion.question
          addMessage({
            type: 'assistant',
            content: `⚠️ Fehlend: ${getMissingFields(activity).join(', ')}\n\n🎤 ${nextQuestion.question}`
          })
          // Speak the question (non-blocking)
          speakQuestion(nextQuestion.question)
          isProcessing.value = false
          processingStep.value = null
          showRecording.value = true
          return
        }
      }
    }
  } catch (err) {
    console.error('LLM parsing failed:', err)
    addMessage({
      type: 'error',
      content: err instanceof Error ? err.message : 'Parsing fehlgeschlagen'
    })
    editingEntry.value = null
    followUpEntry.value = null
    currentFollowUpQuestion.value = null
  }

  isProcessing.value = false
  processingStep.value = null
}

const handleCancelled = (): void => {
  showRecording.value = false
  editingEntry.value = null
  followUpEntry.value = null
  currentFollowUpQuestion.value = null
}

const formatActivity = (activity: Activity): string => {
  const parts: string[] = []
  if (activity.auftraggeber) parts.push(`**Auftraggeber:** ${activity.auftraggeber}`)
  if (activity.thema) parts.push(`**Thema:** ${activity.thema}`)
  parts.push(`**Beschreibung:** ${activity.beschreibung}`)
  if (activity.minuten !== null) parts.push(`**Zeit:** ${formatTime(activity.minuten)}`)
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

// Format minutes to hh:mm or mm min
const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) {
    return `${h}h`
  }
  return `${h}h ${m}min`
}

// Required fields configuration with German labels and follow-up questions
const REQUIRED_FIELDS: { key: keyof Activity; label: string; question: string }[] = [
  { key: 'auftraggeber', label: 'Auftraggeber', question: 'Für welchen Auftraggeber war das?' },
  { key: 'thema', label: 'Thema', question: 'Um welches Thema oder Projekt ging es?' },
  { key: 'minuten', label: 'Zeit', question: 'Wie lange hat das gedauert?' }
]

// Get missing required fields (internal keys for IPC)
const getMissingFieldKeys = (activity: Activity): string[] => {
  return REQUIRED_FIELDS
    .filter(f => activity[f.key] === null)
    .map(f => f.key)
}

// Get missing fields with German labels for display
const getMissingFields = (activity: Activity): string[] => {
  return REQUIRED_FIELDS
    .filter(f => activity[f.key] === null)
    .map(f => f.label)
}

// Get the latest complete unsaved entry (for quick save in chat)
const latestSaveableEntry = computed(() => {
  const unsaved = entries.value.filter(e => !e.saved)
  // Find the most recent one that is complete (no missing required fields)
  for (let i = unsaved.length - 1; i >= 0; i--) {
    const entry = unsaved[i]
    if (getMissingFieldKeys(entry.activity).length === 0) {
      return entry
    }
  }
  return null
})

// Get the latest unsaved entry (for quick edit in chat)
const latestEditableEntry = computed(() => {
  const unsaved = entries.value.filter(e => !e.saved)
  return unsaved.length > 0 ? unsaved[unsaved.length - 1] : null
})

// Build combined follow-up question for ALL missing fields
const getNextFollowUpQuestion = (activity: Activity): { question: string; missingFields: string[] } | null => {
  const missingKeys = getMissingFieldKeys(activity)
  if (missingKeys.length === 0) return null

  // Question fragments for each field
  const questionParts: Record<string, string> = {
    auftraggeber: 'welcher Auftraggeber',
    thema: 'welches Thema',
    minuten: 'wie lange'
  }

  let question: string
  if (missingKeys.length === 1) {
    const field = REQUIRED_FIELDS.find(f => f.key === missingKeys[0])
    question = field?.question || `Was ist ${missingKeys[0]}?`
  } else {
    // Combine: "Welcher Auftraggeber und wie lange?"
    const parts = missingKeys.map(k => questionParts[k] || k)
    const lastPart = parts.pop()
    question = parts.length > 0
      ? `${parts.join(', ')} und ${lastPart}?`
      : `${lastPart}?`
    // Capitalize first letter
    question = question.charAt(0).toUpperCase() + question.slice(1)
  }

  return {
    question,
    missingFields: missingKeys
  }
}

// Follow-up state
const followUpEntry = ref<ActivityEntry | null>(null)
const currentFollowUpQuestion = ref<string | null>(null)

// TTS - speak follow-up questions
// Keep reference to prevent garbage collection
let currentAudio: HTMLAudioElement | null = null

const speakQuestion = async (question: string): Promise<void> => {
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

    const audioData = await window.api?.tts.speak(question, settings.ttsVoice)
    console.log('[TTS] Received audio data:', audioData?.length, 'bytes')

    if (audioData && audioData.length > 0) {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause()
        currentAudio = null
      }

      // Convert Uint8Array to Blob (cast needed for TS compatibility)
      const blob = new Blob([audioData as unknown as BlobPart], { type: 'audio/mpeg' })
      console.log('[TTS] Created blob:', blob.size, 'bytes, type:', blob.type)

      const url = URL.createObjectURL(blob)
      console.log('[TTS] Blob URL:', url)

      currentAudio = new Audio(url)
      currentAudio.volume = 1.0

      console.log('[TTS] Audio element created, readyState:', currentAudio.readyState)

      // Clean up blob URL when done
      currentAudio.onended = () => {
        console.log('[TTS] Audio ended')
        URL.revokeObjectURL(url)
        currentAudio = null
      }

      currentAudio.onerror = (e) => {
        console.error('[TTS] Audio playback error:', e, currentAudio?.error)
        URL.revokeObjectURL(url)
        currentAudio = null
      }

      currentAudio.oncanplay = () => {
        console.log('[TTS] Audio can play, duration:', currentAudio?.duration)
      }

      currentAudio.onplay = () => {
        console.log('[TTS] Audio play event fired')
      }

      try {
        await currentAudio.play()
        console.log('[TTS] play() resolved successfully')
      } catch (playError) {
        console.error('[TTS] play() failed:', playError)
      }
    } else {
      console.warn('[TTS] No audio data received')
    }
  } catch (err) {
    console.error('[TTS] Failed to speak:', err)
    // Non-blocking - continue without TTS
  }
}

// Open Excel file in system default application
const handleOpenFile = async (filePath: string): Promise<void> => {
  await window.api?.excel.openFile(filePath)
}

// Entry list handlers
const handleSaveEntry = async (entry: ActivityEntry): Promise<void> => {
  console.log('Saving entry:', entry)

  // toRaw() needed to remove Vue proxy for IPC serialization
  const result = await window.api?.excel.saveActivity(toRaw(entry.activity))

  if (result?.success) {
    entry.saved = true
    entry.savedFilePath = result.filePath
    addMessage({
      type: 'assistant',
      content: `✅ Aktivität "${entry.activity.beschreibung}" wurde gespeichert.`,
      filePath: result.filePath
    })
  } else {
    addMessage({
      type: 'error',
      content: `Speichern fehlgeschlagen: ${result?.error || 'Unbekannter Fehler'}`
    })
  }
}

const handleEditEntry = (entry: ActivityEntry): void => {
  editingEntry.value = entry
  showRecording.value = true
  console.log('Editing entry via voice:', entry)
}

const handleDeleteEntry = (entry: ActivityEntry): void => {
  const index = entries.value.findIndex(e => e.id === entry.id)
  if (index !== -1) {
    entries.value.splice(index, 1)
  }
}

// Handle Enter key to start recording
const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'Enter' && !showRecording.value && !isProcessing.value && whisperStatus.value === 'ready') {
    // Don't trigger if user is typing in an input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    e.preventDefault()
    handleStartRecording()
  }
}

onMounted(async () => {
  window.api?.onStartRecording(handleStartRecording)
  window.addEventListener('keydown', handleKeyDown)
  initWhisper()
  loadActiveFiles()
  loadDrafts()
})

onUnmounted(() => {
  window.api?.removeStartRecordingListener(handleStartRecording)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="h-screen bg-gray-100 flex flex-col">
    <!-- Header -->
    <header class="bg-white border-b px-4 py-3">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h1 class="text-lg font-semibold text-gray-800">NoB-Con Aktivitäten</h1>
          <p class="text-xs text-gray-500">Cmd+Shift+R / Strg+Shift+R</p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Config Status - click to go to Dateien tab -->
          <button
            @click="currentView = 'files'"
            :class="[
              'text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors',
              activeFileCount > 0
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            ]"
            :title="activeFileCount > 0 ? `Aktive Auftraggeber: ${activeClients.join(', ')}` : 'Keine Dateien konfiguriert'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {{ activeFileCount > 0 ? `${activeFileCount} Datei${activeFileCount > 1 ? 'en' : ''}` : 'Keine Dateien' }}
          </button>

          <!-- Whisper Status -->
          <span
            v-if="whisperStatus === 'loading'"
            class="text-xs text-blue-600 flex items-center gap-1"
          >
            <span class="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin" />
            {{ loadingProgress }}%
          </span>
          <span
            v-else-if="whisperStatus === 'ready'"
            class="text-xs text-green-600"
          >
            ✓
          </span>
          <span
            v-else-if="whisperError"
            class="text-xs text-red-600"
          >
            ✗
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
        <button
          @click="currentView = 'files'"
          :class="[
            'flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors',
            currentView === 'files'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          Dateien
        </button>
        <button
          @click="currentView = 'settings'"
          :class="[
            'flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors',
            currentView === 'settings'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Record View (Chat) -->
    <div v-if="currentView === 'record'" ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
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

        <!-- Assistant Message (Parsed Activity or Text) -->
        <div v-else-if="msg.type === 'assistant'" class="flex justify-start">
          <div class="max-w-[80%]">
            <div class="bg-white border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <!-- Activity card -->
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
                <p v-if="msg.activity.minuten !== null">
                  <span class="font-medium text-gray-600">Zeit:</span>
                  <span class="ml-1">{{ formatTime(msg.activity.minuten) }}</span>
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
              <!-- Text message (e.g. follow-up questions, success messages) -->
              <div v-else class="text-sm">
                <p class="whitespace-pre-line">{{ msg.content }}</p>
                <!-- Open file link for save confirmations -->
                <button
                  v-if="msg.filePath"
                  @click="handleOpenFile(msg.filePath!)"
                  class="mt-2 flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline text-xs"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                  Excel öffnen
                </button>
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
    <div v-else-if="currentView === 'list'" class="flex-1 overflow-y-auto p-4">
      <ActivityList
        :entries="entries"
        @save="handleSaveEntry"
        @edit="handleEditEntry"
        @delete="handleDeleteEntry"
        @open-file="handleOpenFile"
      />
    </div>

    <!-- Files View -->
    <div v-else-if="currentView === 'files'" class="flex-1 overflow-y-auto">
      <DateiManager />
    </div>

    <!-- Settings View -->
    <div v-else-if="currentView === 'settings'" class="flex-1 overflow-y-auto">
      <Settings />
    </div>

    <!-- Recording Overlay -->
    <RecordingWindow
      v-if="showRecording"
      :auto-start="true"
      :editing-context="editingContextText"
      @recorded="handleRecorded"
      @cancelled="handleCancelled"
      class="absolute inset-0 z-10"
    />

    <!-- Input Area (only in record view) -->
    <div v-if="currentView === 'record'" class="bg-white border-t p-4 space-y-2">
      <!-- Quick Actions for latest unsaved entry -->
      <div v-if="latestEditableEntry" class="flex gap-2">
        <!-- Quick Save Button (only if entry is complete) -->
        <button
          v-if="latestSaveableEntry && latestSaveableEntry.id === latestEditableEntry.id"
          @click="handleSaveEntry(latestSaveableEntry)"
          class="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <span class="truncate">Speichern: {{ latestSaveableEntry.activity.beschreibung.substring(0, 25) }}{{ latestSaveableEntry.activity.beschreibung.length > 25 ? '...' : '' }}</span>
        </button>

        <!-- Quick Edit Button -->
        <button
          @click="handleEditEntry(latestEditableEntry)"
          :class="[
            'flex items-center justify-center gap-2 font-medium py-2.5 px-4 rounded-xl transition-colors',
            latestSaveableEntry && latestSaveableEntry.id === latestEditableEntry.id
              ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
              : 'flex-1 bg-amber-500 hover:bg-amber-600 text-white'
          ]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          <span class="truncate">Bearbeiten</span>
        </button>
      </div>

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
