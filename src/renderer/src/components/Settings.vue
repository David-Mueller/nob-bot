<script setup lang="ts">
import { ref, onMounted, toRaw } from 'vue'

type AppSettings = {
  hotkey: string
  openaiApiKey: string
  whisperModel: 'tiny' | 'base' | 'small'
  ttsEnabled: boolean
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

const settings = ref<AppSettings>({
  hotkey: 'CommandOrControl+Shift+R',
  openaiApiKey: '',
  whisperModel: 'base',
  ttsEnabled: false,
  ttsVoice: 'nova'
})

const saving = ref(false)
const saved = ref(false)
const error = ref<string | null>(null)

const loadSettings = async (): Promise<void> => {
  try {
    const loaded = await window.api?.config.getSettings()
    if (loaded) {
      settings.value = loaded
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
    error.value = 'Einstellungen konnten nicht geladen werden'
  }
}

const saveSettings = async (): Promise<void> => {
  saving.value = true
  saved.value = false
  error.value = null

  try {
    await window.api?.config.updateSettings(toRaw(settings.value))
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to save settings:', err)
    error.value = 'Speichern fehlgeschlagen'
  } finally {
    saving.value = false
  }
}

const showApiKey = ref(false)

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="p-4 space-y-6">
    <h2 class="text-lg font-semibold text-gray-800">Einstellungen</h2>

    <!-- Hotkey -->
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        Globaler Hotkey
      </label>
      <input
        v-model="settings.hotkey"
        type="text"
        class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        placeholder="z.B. CommandOrControl+Shift+R"
      />
      <p class="text-xs text-gray-500">
        Tastenkombination zum Starten der Aufnahme. Änderungen werden nach Neustart wirksam.
      </p>
    </div>

    <!-- OpenAI API Key -->
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        OpenAI API Key
      </label>
      <div class="relative">
        <input
          v-model="settings.openaiApiKey"
          :type="showApiKey ? 'text' : 'password'"
          class="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
          placeholder="sk-..."
        />
        <button
          type="button"
          @click="showApiKey = !showApiKey"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
        >
          <svg v-if="showApiKey" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>
      </div>
      <p class="text-xs text-gray-500">
        Für Whisper Cloud und LLM. Falls leer, wird .env verwendet.
      </p>
    </div>

    <!-- Whisper Model -->
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        Whisper Modell (Lokal)
      </label>
      <select
        v-model="settings.whisperModel"
        class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <option value="tiny">Tiny (~75MB, schnell)</option>
        <option value="base">Base (~150MB, empfohlen)</option>
        <option value="small">Small (~500MB, beste Qualität)</option>
      </select>
      <p class="text-xs text-gray-500">
        Modell für lokale Transkription. Größere Modelle sind genauer aber langsamer.
      </p>
    </div>

    <!-- TTS Settings -->
    <div class="space-y-4 p-4 bg-gray-50 rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <label class="block text-sm font-medium text-gray-700">
            Sprachausgabe (TTS)
          </label>
          <p class="text-xs text-gray-500">
            Rückfragen werden vorgelesen
          </p>
        </div>
        <button
          type="button"
          @click="settings.ttsEnabled = !settings.ttsEnabled"
          :class="[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            settings.ttsEnabled ? 'bg-blue-500' : 'bg-gray-300'
          ]"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              settings.ttsEnabled ? 'translate-x-6' : 'translate-x-1'
            ]"
          />
        </button>
      </div>

      <div v-if="settings.ttsEnabled" class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Stimme
        </label>
        <select
          v-model="settings.ttsVoice"
          class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="nova">Nova (weiblich, warm)</option>
          <option value="alloy">Alloy (neutral)</option>
          <option value="echo">Echo (männlich)</option>
          <option value="fable">Fable (britisch)</option>
          <option value="onyx">Onyx (männlich, tief)</option>
          <option value="shimmer">Shimmer (weiblich, klar)</option>
        </select>
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex items-center gap-3">
      <button
        @click="saveSettings"
        :disabled="saving"
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
      >
        {{ saving ? 'Speichern...' : 'Speichern' }}
      </button>
      <span v-if="saved" class="text-green-600 text-sm">
        ✓ Gespeichert
      </span>
      <span v-if="error" class="text-red-600 text-sm">
        {{ error }}
      </span>
    </div>

    <!-- Info -->
    <div class="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
      <p class="font-medium mb-1">Hinweis:</p>
      <ul class="list-disc list-inside space-y-1">
        <li>Hotkey-Änderungen erfordern einen Neustart der App</li>
        <li>API-Key wird sicher in der Konfigurationsdatei gespeichert</li>
        <li>Cloud-Transkription ist schneller und genauer als lokal</li>
      </ul>
    </div>
  </div>
</template>
