<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, toRaw, watch } from 'vue'
import RecordingWindow from './components/RecordingWindow.vue'
import ActivityList from './components/ActivityList.vue'
import DateiManager from './components/DateiManager.vue'
import Settings from './components/Settings.vue'

// Stores
import { useActivityStore, getMissingFieldKeys, getMissingFields, getNextFollowUpQuestion, formatTime, formatActivity, type ActivityEntry } from './stores/activities'
import { useRecordingStore } from './stores/recording'
import { useChatStore, getLanguageLabel } from './stores/chat'

// Composables
import { useWhisper } from './composables/useWhisper'
import { useTTS } from './composables/useTTS'
import { useDrafts } from './composables/useDrafts'

type ViewTab = 'record' | 'list' | 'files' | 'settings'

// Stores
const activityStore = useActivityStore()
const recordingStore = useRecordingStore()
const chatStore = useChatStore()

// Composables
const { status: whisperStatus, loadingProgress, error: whisperError, init: initWhisper, transcribe } = useWhisper()
const { speak } = useTTS()
const { loadDrafts, setupAutoSave } = useDrafts()

// Local UI state
const currentView = ref<ViewTab>('record')
const chatContainer = ref<HTMLElement | null>(null)

// Keep chat container ref synced with store
watch(chatContainer, (el) => chatStore.setChatContainer(el))

// Auto-scroll when processing state changes
watch(() => recordingStore.isProcessing, () => chatStore.scrollToBottom())

// Active Excel files from config
const activeFileCount = ref(0)
const activeClients = ref<string[]>([])

const loadActiveFiles = async (): Promise<void> => {
  const files = await window.api?.config.getActiveFiles() || []
  activeFileCount.value = files.length
  activeClients.value = [...new Set(files.map(f => f.auftraggeber))]
}

// Editing/follow-up context for voice input
const editingContextText = computed(() => {
  // Follow-up question has priority
  if (recordingStore.isFollowUp && recordingStore.currentFollowUpQuestion) {
    return recordingStore.currentFollowUpQuestion
  }

  const editingId = recordingStore.editingEntryId
  if (!editingId) return undefined

  const entry = activityStore.getEntryById(editingId)
  if (!entry) return undefined

  const a = entry.activity
  const parts: string[] = []
  if (a.auftraggeber) parts.push(a.auftraggeber)
  if (a.thema) parts.push(a.thema)
  parts.push(a.beschreibung)
  if (a.minuten !== null) parts.push(formatTime(a.minuten))
  if (a.km && a.km > 0) parts.push(`${a.km}km`)
  return parts.join(' • ')
})

const handleStartRecording = (): void => {
  recordingStore.showOverlay()
}

const handleRecorded = async (blob: Blob): Promise<void> => {
  console.log('Recording completed:', blob.size, 'bytes')
  recordingStore.hideOverlay()
  recordingStore.setProcessing(true, 'transcribing')

  const isEditing = recordingStore.isEditing
  const isFollowUp = recordingStore.isFollowUp
  const editingId = recordingStore.editingEntryId
  const followUpId = recordingStore.followUpEntryId

  // Step 1: Transcribe
  const result = await transcribe(blob)

  if (!result) {
    chatStore.addErrorMessage('Transkription fehlgeschlagen')
    recordingStore.reset()
    return
  }

  // Add user message with transcription
  const messagePrefix = isFollowUp ? '\uD83D\uDCAC ' : (isEditing ? '\u270F\uFE0F ' : '')
  chatStore.addUserMessage(`${messagePrefix}${result.text}`, result.language, result.mode)

  console.log('Transcription:', result.text, 'Language:', result.language, 'Mode:', result.mode)

  // Step 2: Parse with LLM
  recordingStore.setProcessing(true, 'parsing')
  try {
    if (isFollowUp && followUpId && recordingStore.currentFollowUpQuestion) {
      // Follow-up mode: parse answer for missing fields
      const entry = activityStore.getEntryById(followUpId)
      if (entry) {
        const updatedActivity = await window.api?.llm.parseFollowUp(
          toRaw(entry.activity),
          result.text,
          getMissingFieldKeys(entry.activity),
          recordingStore.currentFollowUpQuestion
        )
        if (updatedActivity) {
          activityStore.updateEntry(followUpId, {
            activity: updatedActivity,
            transcript: entry.transcript + ` → ${result.text}`
          })

          chatStore.addAssistantMessage(`\u2705 Aktualisiert:\n${formatActivity(updatedActivity)}`, updatedActivity)

          // Check if still missing fields
          const nextQuestion = getNextFollowUpQuestion(updatedActivity)
          if (nextQuestion) {
            // More fields missing - continue follow-up
            recordingStore.startFollowUp(followUpId, nextQuestion.question)
            chatStore.addAssistantMessage(`\uD83C\uDF99 ${nextQuestion.question}`)
            // Speak the question (non-blocking)
            speak(nextQuestion.question)
            recordingStore.setProcessing(false)
            recordingStore.showOverlay()
            return
          } else {
            // All fields filled - done with follow-up
            console.log('Follow-up complete:', updatedActivity)
            recordingStore.clearFollowUp()
          }
        }
      }
    } else if (isEditing && editingId) {
      // Correction mode: update existing entry
      const entry = activityStore.getEntryById(editingId)
      if (entry) {
        const correctedActivity = await window.api?.llm.parseCorrection(
          toRaw(entry.activity),
          result.text
        )
        if (correctedActivity) {
          activityStore.updateEntry(editingId, {
            activity: correctedActivity,
            transcript: entry.transcript + ` → ${result.text}`
          })

          chatStore.addAssistantMessage(`\u270F\uFE0F Korrigiert:\n${formatActivity(correctedActivity)}`, correctedActivity)
          console.log('Corrected activity:', correctedActivity)
        }
      }
      recordingStore.clearEditing()
    } else {
      // New entry mode
      const activity = await window.api?.llm.parse(result.text)
      if (activity) {
        chatStore.addAssistantMessage(formatActivity(activity), activity)
        console.log('Parsed activity:', activity)

        // Create the entry
        const newEntry = activityStore.addEntry(activity, result.text)

        // Check if required fields are missing
        const nextQuestion = getNextFollowUpQuestion(activity)
        if (nextQuestion) {
          // Start follow-up flow
          recordingStore.startFollowUp(newEntry.id, nextQuestion.question)
          chatStore.addAssistantMessage(`\u26A0\uFE0F Fehlend: ${getMissingFields(activity).join(', ')}\n\n\uD83C\uDF99 ${nextQuestion.question}`)
          // Speak the question (non-blocking)
          speak(nextQuestion.question)
          recordingStore.setProcessing(false)
          recordingStore.showOverlay()
          return
        }
      }
    }
  } catch (err) {
    console.error('LLM parsing failed:', err)
    chatStore.addErrorMessage(err instanceof Error ? err.message : 'Parsing fehlgeschlagen')
    recordingStore.reset()
    return
  }

  recordingStore.setProcessing(false)
}

const handleCancelled = (): void => {
  recordingStore.reset()
}

// Open Excel file in system default application
const handleOpenFile = async (filePath: string): Promise<void> => {
  await window.api?.excel.openFile(filePath)
}

// Entry list handlers
const handleSaveEntry = async (entry: ActivityEntry): Promise<void> => {
  console.log('Saving entry:', entry)

  const result = await window.api?.excel.saveActivity(toRaw(entry.activity))

  if (result?.success) {
    activityStore.markSaved(entry.id, result.filePath!)
    chatStore.addAssistantMessage(
      `\u2705 Aktivität "${entry.activity.beschreibung}" wurde gespeichert.`,
      undefined,
      result.filePath
    )
  } else {
    chatStore.addErrorMessage(`Speichern fehlgeschlagen: ${result?.error || 'Unbekannter Fehler'}`)
  }
}

const handleEditEntry = (entry: ActivityEntry): void => {
  recordingStore.startEditing(entry.id)
  recordingStore.showOverlay()
  console.log('Editing entry via voice:', entry)
}

const handleDeleteEntry = (entry: ActivityEntry): void => {
  activityStore.deleteEntry(entry.id)
}

// Handle Enter key to start recording
const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'Enter' && !recordingStore.showRecordingOverlay && !recordingStore.isProcessing && whisperStatus.value === 'ready') {
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
  await loadDrafts()
  setupAutoSave()
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
            v-if="activityStore.unsavedCount > 0"
            class="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center"
          >
            {{ activityStore.unsavedCount }}
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
        v-if="chatStore.messages.length === 0 && !recordingStore.showRecordingOverlay && !recordingStore.isProcessing"
        class="h-full flex flex-col items-center justify-center text-gray-500"
      >
        <svg class="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p class="text-sm">Klicke auf den Mikrofon-Button</p>
        <p class="text-xs mt-1">oder drücke Cmd+Shift+R</p>
      </div>

      <!-- Messages -->
      <template v-for="msg in chatStore.messages" :key="msg.id">
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
      <div v-if="recordingStore.isProcessing" class="flex justify-start">
        <div class="bg-white border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            {{ recordingStore.processingStep === 'transcribing' ? 'Transkribiere...' : 'Analysiere...' }}
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else-if="currentView === 'list'" class="flex-1 overflow-y-auto p-4">
      <ActivityList
        :entries="activityStore.entries"
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
      v-if="recordingStore.showRecordingOverlay"
      :auto-start="true"
      :editing-context="editingContextText"
      @recorded="handleRecorded"
      @cancelled="handleCancelled"
      class="absolute inset-0 z-10"
    />

    <!-- Input Area (only in record view) -->
    <div v-if="currentView === 'record'" class="bg-white border-t p-4 space-y-2">
      <!-- Quick Actions for latest unsaved entry -->
      <div v-if="activityStore.latestEditableEntry" class="flex gap-2">
        <!-- Quick Save Button (only if entry is complete) -->
        <button
          v-if="activityStore.latestSaveableEntry && activityStore.latestSaveableEntry.id === activityStore.latestEditableEntry.id"
          @click="handleSaveEntry(activityStore.latestSaveableEntry)"
          class="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <span class="truncate">Speichern: {{ activityStore.latestSaveableEntry.activity.beschreibung.substring(0, 25) }}{{ activityStore.latestSaveableEntry.activity.beschreibung.length > 25 ? '...' : '' }}</span>
        </button>

        <!-- Quick Edit Button -->
        <button
          @click="handleEditEntry(activityStore.latestEditableEntry)"
          :class="[
            'flex items-center justify-center gap-2 font-medium py-2.5 px-4 rounded-xl transition-colors',
            activityStore.latestSaveableEntry && activityStore.latestSaveableEntry.id === activityStore.latestEditableEntry.id
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
        :disabled="whisperStatus !== 'ready' || recordingStore.isProcessing"
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
