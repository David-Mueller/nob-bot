import { watch, toRaw } from 'vue'
import { useActivityStore } from '../stores/activities'

export function useDrafts() {
  const activityStore = useActivityStore()

  async function loadDrafts(): Promise<void> {
    const drafts = await window.api?.drafts.load() || []
    if (drafts.length > 0) {
      activityStore.restoreFromDrafts(drafts)
      console.log(`[Drafts] Restored ${drafts.length} entries`)
    }
  }

  async function saveDrafts(): Promise<void> {
    const drafts = activityStore.entries.map(e => ({
      id: e.id,
      activity: toRaw(e.activity),
      transcript: e.transcript,
      timestamp: e.timestamp.toISOString(),
      saved: e.saved
    }))
    await window.api?.drafts.save(drafts)
  }

  async function clearDrafts(): Promise<void> {
    await window.api?.drafts.clear()
  }

  // Setup auto-save watcher with debounce
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  function setupAutoSave(): void {
    watch(
      () => activityStore.entries,
      () => {
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(saveDrafts, 1000)
      },
      { deep: true }
    )
  }

  return { loadDrafts, saveDrafts, clearDrafts, setupAutoSave }
}
