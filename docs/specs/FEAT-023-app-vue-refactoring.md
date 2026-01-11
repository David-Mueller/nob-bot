# FEAT-023: App.vue Refactoring

**Status: 📋 Backlog**
**Priorität: P1 - Hoch**
**Impact: Wartbarkeit, Testbarkeit**

## Problem

`App.vue` ist 870 Zeilen groß und verstößt gegen das Single Responsibility Principle (CODE-001).

### Aktuelle Verantwortlichkeiten

1. State Management (15+ refs)
2. IPC-Kommunikation
3. TTS-Playback
4. Activity-Formatierung
5. Follow-up Flow Logic
6. Draft-Persistenz
7. View-Routing (3 Views)
8. Chat-Nachrichten
9. Aufnahme-Steuerung

### Probleme

- Schwer testbar (alles gekoppelt)
- Schwer wartbar (Änderungen haben Seiteneffekte)
- Performance (alle Watchers in einem Scope)
- Code-Navigation erschwert

## Lösung

### 1. Pinia Stores extrahieren

```typescript
// src/renderer/src/stores/activities.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ActivityEntry = {
  id: number
  activity: Activity
  transcript: string
  timestamp: Date
  saved: boolean
  savedFilePath?: string
}

export const useActivityStore = defineStore('activities', () => {
  const entries = ref<ActivityEntry[]>([])
  const nextId = ref(1)

  const unsavedEntries = computed(() =>
    entries.value.filter(e => !e.saved)
  )

  const unsavedCount = computed(() => unsavedEntries.value.length)

  const latestEditableEntry = computed(() => {
    const unsaved = unsavedEntries.value
    return unsaved.length > 0 ? unsaved[unsaved.length - 1] : null
  })

  function addEntry(activity: Activity, transcript: string): ActivityEntry {
    const entry: ActivityEntry = {
      id: nextId.value++,
      activity,
      transcript,
      timestamp: new Date(),
      saved: false
    }
    entries.value.push(entry)
    return entry
  }

  function updateEntry(id: number, updates: Partial<ActivityEntry>): void {
    const entry = entries.value.find(e => e.id === id)
    if (entry) Object.assign(entry, updates)
  }

  function deleteEntry(id: number): void {
    const index = entries.value.findIndex(e => e.id === id)
    if (index !== -1) entries.value.splice(index, 1)
  }

  function markSaved(id: number, filePath: string): void {
    updateEntry(id, { saved: true, savedFilePath: filePath })
  }

  return {
    entries,
    unsavedEntries,
    unsavedCount,
    latestEditableEntry,
    addEntry,
    updateEntry,
    deleteEntry,
    markSaved
  }
})
```

```typescript
// src/renderer/src/stores/recording.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRecordingStore = defineStore('recording', () => {
  const isRecording = ref(false)
  const isProcessing = ref(false)
  const showRecordingOverlay = ref(false)

  // Follow-up state
  const isFollowUp = ref(false)
  const followUpEntryId = ref<number | null>(null)
  const currentFollowUpQuestion = ref<string | null>(null)

  function startRecording(): void {
    isRecording.value = true
    showRecordingOverlay.value = true
  }

  function stopRecording(): void {
    isRecording.value = false
  }

  function setProcessing(processing: boolean): void {
    isProcessing.value = processing
  }

  function startFollowUp(entryId: number, question: string): void {
    isFollowUp.value = true
    followUpEntryId.value = entryId
    currentFollowUpQuestion.value = question
  }

  function clearFollowUp(): void {
    isFollowUp.value = false
    followUpEntryId.value = null
    currentFollowUpQuestion.value = null
  }

  return {
    isRecording,
    isProcessing,
    showRecordingOverlay,
    isFollowUp,
    followUpEntryId,
    currentFollowUpQuestion,
    startRecording,
    stopRecording,
    setProcessing,
    startFollowUp,
    clearFollowUp
  }
})
```

```typescript
// src/renderer/src/stores/chat.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ChatMessage = {
  id: number
  type: 'user' | 'assistant' | 'error'
  content: string
  activity?: Activity
  filePath?: string
  timestamp: Date
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const nextId = ref(1)

  function addMessage(type: ChatMessage['type'], content: string, extras?: Partial<ChatMessage>): ChatMessage {
    const message: ChatMessage = {
      id: nextId.value++,
      type,
      content,
      timestamp: new Date(),
      ...extras
    }
    messages.value.push(message)
    return message
  }

  function addUserMessage(content: string): ChatMessage {
    return addMessage('user', content)
  }

  function addAssistantMessage(content: string, activity?: Activity, filePath?: string): ChatMessage {
    return addMessage('assistant', content, { activity, filePath })
  }

  function addErrorMessage(content: string): ChatMessage {
    return addMessage('error', content)
  }

  function clearMessages(): void {
    messages.value = []
  }

  return {
    messages,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    clearMessages
  }
})
```

### 2. Composables extrahieren

```typescript
// src/renderer/src/composables/useTTS.ts
import { ref } from 'vue'

export function useTTS() {
  const currentAudio = ref<HTMLAudioElement | null>(null)
  const isPlaying = ref(false)

  async function speak(text: string): Promise<void> {
    const isEnabled = await window.api?.tts.isEnabled()
    if (!isEnabled) return

    try {
      // Stop current audio
      if (currentAudio.value) {
        currentAudio.value.pause()
        currentAudio.value = null
      }

      const audioData = await window.api?.tts.speak(text)
      if (!audioData) return

      const blob = new Blob([audioData], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      audio.onended = () => {
        URL.revokeObjectURL(url)
        currentAudio.value = null
        isPlaying.value = false
      }

      audio.onerror = () => {
        URL.revokeObjectURL(url)
        currentAudio.value = null
        isPlaying.value = false
      }

      currentAudio.value = audio
      isPlaying.value = true
      await audio.play()
    } catch (err) {
      console.error('[TTS] Failed:', err)
      isPlaying.value = false
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
```

```typescript
// src/renderer/src/composables/useDrafts.ts
import { watch } from 'vue'
import { useActivityStore } from '../stores/activities'
import { toRaw } from 'vue'

export function useDrafts() {
  const activityStore = useActivityStore()

  async function loadDrafts(): Promise<void> {
    const saved = await window.api?.drafts.load()
    if (saved && saved.length > 0) {
      // Restore drafts...
    }
  }

  async function saveDrafts(): Promise<void> {
    const unsaved = activityStore.unsavedEntries
    if (unsaved.length === 0) {
      await window.api?.drafts.clear()
      return
    }

    const drafts = unsaved.map(e => ({
      activity: toRaw(e.activity),
      transcript: e.transcript,
      timestamp: e.timestamp.toISOString()
    }))
    await window.api?.drafts.save(drafts)
  }

  // Auto-save on changes
  watch(
    () => activityStore.entries,
    () => saveDrafts(),
    { deep: true }
  )

  return { loadDrafts, saveDrafts }
}
```

### 3. Komponenten extrahieren

```
src/renderer/src/components/
├── ChatMessages.vue      # Message-Liste
├── ChatInput.vue         # Input-Bereich mit Buttons
├── QuickActions.vue      # Save/Edit Buttons
├── ProcessingIndicator.vue
└── ViewTabs.vue          # Chat/Liste/Einstellungen Tabs
```

### 4. App.vue vereinfacht

```vue
<!-- src/renderer/src/App.vue (~200 Zeilen) -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useActivityStore } from './stores/activities'
import { useRecordingStore } from './stores/recording'
import { useChatStore } from './stores/chat'
import { useTTS } from './composables/useTTS'
import { useDrafts } from './composables/useDrafts'

// Components
import ChatMessages from './components/ChatMessages.vue'
import ChatInput from './components/ChatInput.vue'
import ActivityList from './components/ActivityList.vue'
import Settings from './components/Settings.vue'
import RecordingWindow from './components/RecordingWindow.vue'
import ViewTabs from './components/ViewTabs.vue'

// Stores
const activityStore = useActivityStore()
const recordingStore = useRecordingStore()
const chatStore = useChatStore()

// Composables
const { speak } = useTTS()
const { loadDrafts } = useDrafts()

// View state
const currentView = ref<'chat' | 'list' | 'settings'>('chat')

// Handlers
async function handleRecorded(audioBlob: Blob, mode: string) {
  // Simplified - delegates to stores
}

onMounted(async () => {
  await loadDrafts()
})
</script>

<template>
  <div class="h-screen bg-gray-100 flex flex-col">
    <ViewTabs v-model="currentView" />

    <main class="flex-1 overflow-hidden">
      <ChatMessages v-if="currentView === 'chat'" />
      <ActivityList v-else-if="currentView === 'list'" />
      <Settings v-else />
    </main>

    <ChatInput v-if="currentView === 'chat'" @record="recordingStore.startRecording" />

    <RecordingWindow
      v-if="recordingStore.showRecordingOverlay"
      @recorded="handleRecorded"
      @cancel="recordingStore.showRecordingOverlay = false"
    />
  </div>
</template>
```

## Akzeptanzkriterien

- [ ] App.vue unter 250 Zeilen
- [ ] 3 Pinia Stores (activities, recording, chat)
- [ ] 3+ Composables (TTS, Drafts, Whisper)
- [ ] 5+ kleine Komponenten
- [ ] Alle Tests bestehen
- [ ] Funktionalität unverändert

## Migration Steps

1. Pinia Stores erstellen (ohne App.vue zu ändern)
2. Composables extrahieren
3. Komponenten extrahieren
4. App.vue schrittweise umbauen
5. Tests für jeden Store/Composable

## Geschätzter Aufwand

- Stores: 2h
- Composables: 2h
- Komponenten: 3h
- Integration: 2h
- Testing: 2h

**Total: ~11h**
