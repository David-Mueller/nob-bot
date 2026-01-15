<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const emit = defineEmits<{
  filesChanged: []
}>()

type XlsxFileConfig = {
  path: string
  auftraggeber: string
  jahr: number
  active: boolean
}

type ScannedFile = {
  path: string
  filename: string
  auftraggeber: string | null
  jahr: number | null
}

type MergedFile = {
  path: string
  filename: string
  auftraggeber: string
  jahr: number
  active: boolean
  isNew: boolean
  missing: boolean
}

const basePath = ref('')
const isScanning = ref(false)
const scanError = ref<string | null>(null)
const files = ref<MergedFile[]>([])

// Editable values (local state before save)
const editedValues = ref<Record<string, { auftraggeber: string; jahr: number }>>({})

const hasChanges = computed(() => Object.keys(editedValues.value).length > 0)

const loadConfig = async (): Promise<void> => {
  const path = await window.api?.config.getBasePath()
  basePath.value = path || ''

  const configFiles = await window.api?.config.getFiles() || []

  // Convert to merged format (mark all as potentially missing until scan)
  files.value = configFiles.map(f => ({
    path: f.path,
    filename: f.path.split(/[/\\]/).pop() || f.path,
    auftraggeber: f.auftraggeber,
    jahr: f.jahr,
    active: f.active,
    isNew: false,
    missing: false  // Will be updated on scan
  }))
}

const browseFolder = async (): Promise<void> => {
  const path = await window.api?.config.browseFolder()
  if (path) {
    basePath.value = path
  }
}

const scanFiles = async (): Promise<void> => {
  if (!basePath.value) {
    scanError.value = 'Bitte zuerst einen Pfad eingeben'
    return
  }

  isScanning.value = true
  scanError.value = null

  try {
    // Save base path first
    await window.api?.config.setBasePath(basePath.value)

    // Scan for files
    const scanned = await window.api?.config.scanFiles() || []
    console.log('[DateiManager] Scanned files:', scanned)

    // Get existing config
    const existing = await window.api?.config.getFiles() || []
    const scannedPaths = new Set(scanned.map(f => f.path))

    // Merge scanned with existing
    const merged: MergedFile[] = []

    for (const f of scanned) {
      const existingFile = existing.find(e => e.path === f.path)

      if (existingFile) {
        // Use config values, but fall back to scanned values if config is empty
        merged.push({
          path: f.path,
          filename: f.filename,
          auftraggeber: existingFile.auftraggeber || f.auftraggeber || '',
          jahr: existingFile.jahr || f.jahr || new Date().getFullYear(),
          active: existingFile.active,
          isNew: false,
          missing: false
        })
      } else {
        // New file - use scanned values and save to config immediately
        const auftraggeber = f.auftraggeber || ''
        const jahr = f.jahr || new Date().getFullYear()

        await window.api?.config.updateFile(f.path, {
          auftraggeber,
          jahr,
          active: false
        })

        merged.push({
          path: f.path,
          filename: f.filename,
          auftraggeber,
          jahr,
          active: false,
          isNew: true,
          missing: false
        })
      }
    }

    // Add config files that weren't found on disk (missing)
    for (const f of existing) {
      if (!scannedPaths.has(f.path)) {
        merged.push({
          path: f.path,
          filename: f.path.split(/[/\\]/).pop() || f.path,
          auftraggeber: f.auftraggeber,
          jahr: f.jahr,
          active: false,  // Auto-deactivate missing files
          isNew: false,
          missing: true
        })
      }
    }

    files.value = merged
    editedValues.value = {}
  } catch (err) {
    scanError.value = err instanceof Error ? err.message : 'Scan fehlgeschlagen'
  } finally {
    isScanning.value = false
  }
}

const updateField = (path: string, field: 'auftraggeber' | 'jahr', value: string | number): void => {
  const file = files.value.find(f => f.path === path)
  if (!file) return

  if (!editedValues.value[path]) {
    editedValues.value[path] = {
      auftraggeber: file.auftraggeber,
      jahr: file.jahr
    }
  }

  if (field === 'auftraggeber') {
    editedValues.value[path].auftraggeber = value as string
  } else {
    editedValues.value[path].jahr = Number(value)
  }
}

const getDisplayValue = (path: string, field: 'auftraggeber' | 'jahr'): string | number => {
  if (editedValues.value[path]) {
    return editedValues.value[path][field]
  }
  const file = files.value.find(f => f.path === path)
  return file ? file[field] : ''
}

const toggleActive = async (file: MergedFile): Promise<void> => {
  const newActive = !file.active

  // Get current values (edited or from file)
  const currentAuftraggeber = editedValues.value[file.path]?.auftraggeber ?? file.auftraggeber
  const currentJahr = editedValues.value[file.path]?.jahr ?? file.jahr

  // Always save full data to ensure auftraggeber/jahr are persisted
  await window.api?.config.updateFile(file.path, {
    auftraggeber: currentAuftraggeber,
    jahr: currentJahr,
    active: newActive
  })

  // Update local state
  file.auftraggeber = currentAuftraggeber
  file.jahr = currentJahr
  file.active = newActive
  file.isNew = false

  // Clear any pending edits
  delete editedValues.value[file.path]

  // Notify parent that files changed
  emit('filesChanged')
}

const saveFile = async (file: MergedFile): Promise<void> => {
  const edits = editedValues.value[file.path]
  if (edits) {
    await window.api?.config.updateFile(file.path, {
      auftraggeber: edits.auftraggeber,
      jahr: edits.jahr
    })

    file.auftraggeber = edits.auftraggeber
    file.jahr = edits.jahr
    delete editedValues.value[file.path]
  }
}

const removeFile = async (file: MergedFile): Promise<void> => {
  await window.api?.config.removeFile(file.path)
  files.value = files.value.filter(f => f.path !== file.path)
}

onMounted(loadConfig)
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-800">Datei-Verwaltung</h2>
    </div>

    <!-- Path Input -->
    <div class="flex gap-2">
      <input
        v-model="basePath"
        type="text"
        placeholder="Pfad zu XLSX-Dateien (z.B. D:\C-Con\AL-kas)"
        class="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        @click="browseFolder"
        class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
        title="Ordner auswählen"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
      </button>
      <button
        @click="scanFiles"
        :disabled="isScanning"
        class="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
      >
        <svg v-if="isScanning" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        {{ isScanning ? 'Scanne...' : 'Scannen' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="scanError" class="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
      {{ scanError }}
    </div>

    <!-- Files Table -->
    <div v-if="files.length > 0" class="border rounded-lg overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-2 text-left font-medium text-gray-600">Dateiname</th>
            <th class="px-4 py-2 text-left font-medium text-gray-600">Auftraggeber</th>
            <th class="px-4 py-2 text-left font-medium text-gray-600 w-24">Jahr</th>
            <th class="px-4 py-2 text-center font-medium text-gray-600 w-32">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="file in files"
            :key="file.path"
            :class="[
              file.missing ? 'bg-red-50' : file.active ? 'bg-green-50' : file.isNew ? 'bg-yellow-50' : 'bg-white'
            ]"
          >
            <td class="px-4 py-2">
              <div class="font-medium text-gray-900">{{ file.filename }}</div>
              <div class="text-xs text-gray-500 truncate max-w-xs" :title="file.path">
                {{ file.path }}
              </div>
            </td>
            <td class="px-4 py-2">
              <input
                type="text"
                :value="getDisplayValue(file.path, 'auftraggeber')"
                @input="(e) => updateField(file.path, 'auftraggeber', (e.target as HTMLInputElement).value)"
                @blur="saveFile(file)"
                class="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                :class="editedValues[file.path] ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'"
              />
            </td>
            <td class="px-4 py-2">
              <input
                type="number"
                :value="getDisplayValue(file.path, 'jahr')"
                @input="(e) => updateField(file.path, 'jahr', (e.target as HTMLInputElement).value)"
                @blur="saveFile(file)"
                class="w-20 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                :class="editedValues[file.path] ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'"
              />
            </td>
            <td class="px-4 py-2 text-center">
              <template v-if="file.missing">
                <span class="px-3 py-1 text-xs font-medium rounded-full bg-red-500 text-white">
                  Fehlt
                </span>
                <button
                  @click="removeFile(file)"
                  class="ml-2 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:underline"
                  title="Aus Konfiguration entfernen"
                >
                  ✕
                </button>
              </template>
              <button
                v-else
                @click="toggleActive(file)"
                :class="[
                  'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                  file.active
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                ]"
              >
                {{ file.active ? 'Aktiv' : 'Inaktiv' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isScanning" class="text-center py-8 text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <p class="text-sm">Keine Dateien gefunden</p>
      <p class="text-xs mt-1">Gib einen Pfad ein und klicke auf "Scannen"</p>
    </div>

    <!-- Legend -->
    <div class="flex gap-4 text-xs text-gray-500">
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
        <span>Aktiv</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span>
        <span>Neu erkannt</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded bg-white border border-gray-300"></span>
        <span>Inaktiv</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded bg-red-100 border border-red-300"></span>
        <span>Fehlt</span>
      </div>
    </div>
  </div>
</template>
