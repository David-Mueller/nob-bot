import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useRecordingStore = defineStore('recording', () => {
  const isRecording = ref(false)
  const isProcessing = ref(false)
  const processingStep = ref<'transcribing' | 'parsing' | null>(null)
  const showRecordingOverlay = ref(false)

  // Follow-up state
  const isFollowUp = ref(false)
  const followUpEntryId = ref<number | null>(null)
  const currentFollowUpQuestion = ref<string | null>(null)

  // Editing state (for voice corrections)
  const editingEntryId = ref<number | null>(null)

  const isEditing = computed(() => editingEntryId.value !== null)

  function startRecording(): void {
    isRecording.value = true
    showRecordingOverlay.value = true
  }

  function stopRecording(): void {
    isRecording.value = false
    showRecordingOverlay.value = false
  }

  function showOverlay(): void {
    showRecordingOverlay.value = true
  }

  function hideOverlay(): void {
    showRecordingOverlay.value = false
  }

  function setProcessing(processing: boolean, step: 'transcribing' | 'parsing' | null = null): void {
    isProcessing.value = processing
    processingStep.value = step
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

  function startEditing(entryId: number): void {
    editingEntryId.value = entryId
  }

  function clearEditing(): void {
    editingEntryId.value = null
  }

  function reset(): void {
    isRecording.value = false
    isProcessing.value = false
    processingStep.value = null
    showRecordingOverlay.value = false
    clearFollowUp()
    clearEditing()
  }

  return {
    isRecording,
    isProcessing,
    processingStep,
    showRecordingOverlay,
    isFollowUp,
    followUpEntryId,
    currentFollowUpQuestion,
    editingEntryId,
    isEditing,
    startRecording,
    stopRecording,
    showOverlay,
    hideOverlay,
    setProcessing,
    startFollowUp,
    clearFollowUp,
    startEditing,
    clearEditing,
    reset
  }
})
