# FEAT-009: Einträge-Liste UI

## Summary

Hauptfenster mit Liste der letzten Einträge zur Kontrolle.

## Acceptance Criteria

- [ ] Zeigt letzte 10 Einträge (alle Auftraggeber)
- [ ] Sortiert nach Datum (neueste zuerst)
- [ ] Zeigt: Datum, Auftraggeber, Thema, Beschreibung (gekürzt), Stunden
- [ ] Click auf Eintrag zeigt Details
- [ ] Button für neue Aktivität (startet Aufnahme)
- [ ] Button für Einstellungen

## Technical Details

### EntryList.vue

```vue
<template>
  <div class="entry-list">
    <h2>Letzte Einträge</h2>

    <table>
      <thead>
        <tr>
          <th>Datum</th>
          <th>Auftraggeber</th>
          <th>Thema</th>
          <th>Beschreibung</th>
          <th>Zeit</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in entries" :key="entry.id" @click="showDetails(entry)">
          <td>{{ formatDate(entry.datum) }}</td>
          <td>{{ entry.auftraggeber }}</td>
          <td>{{ entry.thema }}</td>
          <td>{{ truncate(entry.beschreibung, 40) }}</td>
          <td>{{ entry.stunden }}h</td>
        </tr>
      </tbody>
    </table>

    <div class="actions">
      <button @click="startRecording" class="primary">
        Neue Aktivität
      </button>
      <button @click="openSettings">
        Einstellungen
      </button>
    </div>
  </div>
</template>
```

### Entries Store (Pinia)

```typescript
export const useEntriesStore = defineStore('entries', {
  state: () => ({
    entries: [] as Entry[],
    loading: false
  }),

  actions: {
    async loadRecentEntries() {
      this.loading = true;
      const settings = await window.api.getSettings();

      const allEntries: Entry[] = [];
      for (const client of settings.clients) {
        const entries = await window.api.getRecentEntries(client.excelPath, 10);
        allEntries.push(...entries);
      }

      this.entries = allEntries
        .sort((a, b) => b.datum.getTime() - a.datum.getTime())
        .slice(0, 10);

      this.loading = false;
    }
  }
});
```

## Test Plan

1. App öffnen → Letzte 10 Einträge sichtbar
2. Einträge aus mehreren Excel-Dateien zusammengeführt
3. Neueste zuerst
4. Click zeigt Details
5. "Neue Aktivität" startet Aufnahme
