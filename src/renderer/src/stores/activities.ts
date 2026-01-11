import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Activity, ActivityEntry } from '@shared/types'

// Re-export types for consumers that import from this module
export type { Activity, ActivityEntry }

// Required fields configuration with German labels and follow-up questions
export const REQUIRED_FIELDS: { key: keyof Activity; label: string; question: string }[] = [
  { key: 'auftraggeber', label: 'Auftraggeber', question: 'Für welchen Auftraggeber war das?' },
  { key: 'thema', label: 'Thema', question: 'Um welches Thema oder Projekt ging es?' },
  { key: 'minuten', label: 'Zeit', question: 'Wie lange hat das gedauert?' }
]

export const useActivityStore = defineStore('activities', () => {
  const entries = ref<ActivityEntry[]>([])
  const nextId = ref(1)

  const unsavedEntries = computed(() =>
    entries.value.filter(e => !e.saved)
  )

  const unsavedCount = computed(() => unsavedEntries.value.length)

  // Get the latest unsaved entry (for quick edit in chat)
  const latestEditableEntry = computed(() => {
    const unsaved = unsavedEntries.value
    return unsaved.length > 0 ? unsaved[unsaved.length - 1] : null
  })

  // Get the latest complete unsaved entry (for quick save in chat)
  const latestSaveableEntry = computed(() => {
    const unsaved = unsavedEntries.value
    // Find the most recent one that is complete (no missing required fields)
    for (let i = unsaved.length - 1; i >= 0; i--) {
      const entry = unsaved[i]
      if (getMissingFieldKeys(entry.activity).length === 0) {
        return entry
      }
    }
    return null
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

  function getEntryById(id: number): ActivityEntry | undefined {
    return entries.value.find(e => e.id === id)
  }

  // Restore entries from drafts (used on app load)
  function restoreFromDrafts(drafts: Array<{ id: number; activity: Activity; transcript: string; timestamp: string; saved: boolean }>): void {
    entries.value = drafts.map(d => ({
      ...d,
      timestamp: new Date(d.timestamp)
    }))
    // Find max id to continue from
    nextId.value = Math.max(...entries.value.map(e => e.id), 0) + 1
  }

  return {
    entries,
    unsavedEntries,
    unsavedCount,
    latestEditableEntry,
    latestSaveableEntry,
    addEntry,
    updateEntry,
    deleteEntry,
    markSaved,
    getEntryById,
    restoreFromDrafts
  }
})

// Helper functions for missing fields (used outside store context)
export function getMissingFieldKeys(activity: Activity): string[] {
  return REQUIRED_FIELDS
    .filter(f => activity[f.key] === null)
    .map(f => f.key)
}

export function getMissingFields(activity: Activity): string[] {
  return REQUIRED_FIELDS
    .filter(f => activity[f.key] === null)
    .map(f => f.label)
}

// Build combined follow-up question for ALL missing fields
export function getNextFollowUpQuestion(activity: Activity): { question: string; missingFields: string[] } | null {
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

// Format minutes to hh:mm or mm min
export function formatTime(minutes: number): string {
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

// Format activity to string for display
export function formatActivity(activity: Activity): string {
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
