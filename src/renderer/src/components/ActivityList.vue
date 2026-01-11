<script setup lang="ts">
import { computed } from 'vue'

type Activity = {
  auftraggeber: string | null
  thema: string | null
  beschreibung: string
  minuten: number | null
  km: number
  auslagen: number
  datum: string | null
}

type ActivityEntry = {
  id: number
  activity: Activity
  transcript: string
  timestamp: Date
  saved: boolean
  savedFilePath?: string
}

const props = defineProps<{
  entries: ActivityEntry[]
}>()

const emit = defineEmits<{
  (e: 'save', entry: ActivityEntry): void
  (e: 'edit', entry: ActivityEntry): void
  (e: 'delete', entry: ActivityEntry): void
  (e: 'openFile', filePath: string): void
}>()

const sortedEntries = computed(() => {
  return [...props.entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
})

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format YYYY-MM-DD to German date format
const formatActivityDate = (datum: string): string => {
  const date = new Date(datum)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const getStatusColor = (entry: ActivityEntry): string => {
  if (entry.saved) return 'bg-green-100 border-green-300'
  const requiredMissing = getRequiredMissing(entry.activity)
  if (requiredMissing.length > 0) return 'bg-red-50 border-red-300'
  const optionalMissing = getOptionalMissing(entry.activity)
  if (optionalMissing.length > 0) return 'bg-yellow-50 border-yellow-300'
  return 'bg-white border-gray-200'
}

// Required fields that block saving
const getRequiredMissing = (activity: Activity): string[] => {
  const missing: string[] = []
  if (activity.auftraggeber === null) missing.push('Auftraggeber')
  if (activity.thema === null) missing.push('Thema')
  return missing
}

// Optional fields that are missing (for warning display only)
const getOptionalMissing = (activity: Activity): string[] => {
  const missing: string[] = []
  if (activity.minuten === null) missing.push('Zeit')
  return missing
}

// Format minutes to readable format
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
</script>

<template>
  <div class="activity-list">
    <!-- Empty State -->
    <div
      v-if="entries.length === 0"
      class="text-center py-12 text-gray-500"
    >
      <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p class="text-sm">Noch keine Aktivitäten erfasst</p>
    </div>

    <!-- Entry List -->
    <div v-else class="space-y-3">
      <div
        v-for="entry in sortedEntries"
        :key="entry.id"
        :class="[
          'rounded-lg border p-4 transition-shadow hover:shadow-md',
          getStatusColor(entry)
        ]"
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            <span
              v-if="entry.saved"
              class="text-xs bg-green-500 text-white px-2 py-0.5 rounded"
            >
              Gespeichert
            </span>
            <span
              v-else-if="getRequiredMissing(entry.activity).length > 0"
              class="text-xs bg-red-500 text-white px-2 py-0.5 rounded"
            >
              Pflichtfelder fehlen
            </span>
            <span
              v-else-if="getOptionalMissing(entry.activity).length > 0"
              class="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded"
            >
              Unvollständig
            </span>
            <span
              v-else
              class="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"
            >
              Bereit
            </span>
          </div>
          <span class="text-xs text-gray-500">{{ formatDate(entry.timestamp) }}</span>
        </div>

        <!-- Activity Details -->
        <div class="space-y-1 text-sm">
          <div class="flex gap-4">
            <div v-if="entry.activity.auftraggeber" class="flex-1">
              <span class="text-gray-500">Auftraggeber:</span>
              <span class="ml-1 font-medium">{{ entry.activity.auftraggeber }}</span>
            </div>
            <div v-if="entry.activity.thema" class="flex-1">
              <span class="text-gray-500">Thema:</span>
              <span class="ml-1 font-medium">{{ entry.activity.thema }}</span>
            </div>
          </div>

          <div>
            <span class="text-gray-500">Beschreibung:</span>
            <span class="ml-1">{{ entry.activity.beschreibung }}</span>
          </div>

          <div class="flex gap-4 text-gray-600">
            <span v-if="entry.activity.datum">
              <span class="text-gray-500">Datum:</span> {{ formatActivityDate(entry.activity.datum) }}
            </span>
            <span v-if="entry.activity.minuten !== null">
              <span class="text-gray-500">Zeit:</span> {{ formatTime(entry.activity.minuten) }}
            </span>
            <span v-if="entry.activity.km && entry.activity.km > 0">
              <span class="text-gray-500">KM:</span> {{ entry.activity.km }}
            </span>
            <span v-if="entry.activity.auslagen && entry.activity.auslagen > 0">
              <span class="text-gray-500">Auslagen:</span> {{ entry.activity.auslagen }}€
            </span>
          </div>
        </div>

        <!-- Required Fields Warning -->
        <div
          v-if="getRequiredMissing(entry.activity).length > 0"
          class="mt-2 text-xs text-red-700"
        >
          ❌ Pflichtfelder: {{ getRequiredMissing(entry.activity).join(', ') }}
        </div>

        <!-- Optional Fields Info -->
        <div
          v-else-if="getOptionalMissing(entry.activity).length > 0"
          class="mt-2 text-xs text-yellow-700"
        >
          ⚠️ Optional: {{ getOptionalMissing(entry.activity).join(', ') }}
        </div>

        <!-- Transcript Preview -->
        <div class="mt-2 text-xs text-gray-400 truncate" :title="entry.transcript">
          "{{ entry.transcript }}"
        </div>

        <!-- Actions -->
        <div class="mt-3 flex gap-2">
          <button
            v-if="!entry.saved"
            @click="emit('save', entry)"
            :disabled="getRequiredMissing(entry.activity).length > 0"
            class="text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Speichern
          </button>
          <button
            v-if="entry.saved && entry.savedFilePath"
            @click="emit('openFile', entry.savedFilePath!)"
            class="text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-1"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Excel öffnen
          </button>
          <button
            v-if="!entry.saved"
            @click="emit('edit', entry)"
            class="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            Bearbeiten
          </button>
          <button
            @click="emit('delete', entry)"
            class="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
