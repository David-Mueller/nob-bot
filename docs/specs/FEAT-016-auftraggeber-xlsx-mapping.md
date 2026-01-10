# FEAT-016: Auftraggeber-XLSX-Mapping

## Goal

Auftraggeber automatisch der korrekten Excel-Datei zuordnen durch LLM-basierte Extraktion von Name und Jahr aus Dateinamen, mit UI zur Verwaltung aktivierter Dateien.

## Context

- Eine XLSX-Datei pro Auftraggeber pro Jahr
- Dateinamen beginnen mit "LV", enthalten Auftraggeber-Name und Jahr
- Beispiele: "LV IDT 2025.xlsx", "LV IDT 2 0 2 6.xlsx"
- Standard-Pfad: `D:\C-Con\AL-kas\LV*.xlsx`

## Acceptance Criteria

### Config

- [ ] YAML-Config speichert Basis-Pfad (Pattern) fuer XLSX-Dateien
- [ ] Config-Datei wird beim Start geladen und bei Aenderung gespeichert
- [ ] Default-Pfad ist `D:\C-Con\AL-kas\LV*.xlsx`

### Datei-Scan

- [ ] System scannt Verzeichnis nach Pattern `LV*.xlsx`
- [ ] Fuer jede gefundene Datei wird LLM aufgerufen zur Extraktion von:
  - Auftraggeber-Name
  - Jahr (4-stellig)
- [ ] Scan-Ergebnis zeigt Liste mit Spalten: Dateiname, Auftraggeber (editierbar), Jahr (editierbar)
- [ ] Refresh-Button laedt Dateiliste neu

### Datei-Management UI

- [ ] Eigene View/Seite fuer Datei-Management
- [ ] Pfad-Eingabefeld (editierbar, wird in YAML gespeichert)
- [ ] Tabelle zeigt alle gefundenen XLSX-Dateien
- [ ] Pro Zeile: Dateiname, Auftraggeber-Textbox, Jahr-Textbox, Aktivieren/Ignorieren-Toggle
- [ ] Auftraggeber und Jahr koennen manuell ueberschrieben werden
- [ ] Aktivieren/Ignorieren-Status wird persistent gespeichert

### Zuordnungs-Logik

- [ ] Bei Voice-Input wird Auftraggeber gegen aktivierte Dateien gematcht
- [ ] Nur aktivierte XLSX-Dateien werden zum Beschreiben angeboten
- [ ] Unbekannter Auftraggeber: Dialog zeigt Liste aktivierter Dateien zur Auswahl

### Backup

- [ ] Vor jedem Schreibvorgang wird Backup erstellt
- [ ] Backup-Ordner liegt im selben Verzeichnis wie XLSX-Dateien
- [ ] Backup-Dateiname enthaelt Timestamp

## Plan

1. YAML-Config-Service erstellen (Pfad laden/speichern)
2. Datei-Scanner-Service implementieren (glob LV*.xlsx)
3. LLM-Prompt fuer Name/Jahr-Extraktion aus Dateiname erstellen
4. Type-Definitionen fuer XlsxFile (name, auftraggeber, jahr, aktiv)
5. Pinia-Store fuer Datei-Zustand (Liste, Aktivierungsstatus)
6. Vue-Komponente: DateiManager.vue mit Tabelle und Controls
7. Integration in Navigation (neue Route)
8. Auftraggeber-Matching bei Voice-Input integrieren
9. Backup-Service vor Schreibvorgaengen
10. E2E-Test: Scan -> Aktivieren -> Zuordnung

## UAT Plan

### Setup

1. Testordner mit 3 XLSX-Dateien anlegen:
   - `LV IDT 2025.xlsx`
   - `LV Musterfirma 2026.xlsx`
   - `LV Test GmbH 2025.xlsx`
2. App starten

### Steps

| # | Aktion | Erwartetes Ergebnis |
|---|--------|---------------------|
| 1 | Datei-Management oeffnen | View zeigt Pfad-Eingabe und leere Tabelle |
| 2 | Pfad eingeben und Scan ausloesen | 3 Dateien erscheinen mit LLM-extrahierten Werten |
| 3 | Auftraggeber "IDT" auf "IDT GmbH" aendern | Wert wird uebernommen |
| 4 | "IDT GmbH" aktivieren, andere ignorieren | Toggle-Status aendert sich |
| 5 | App neu starten | Einstellungen sind erhalten |
| 6 | Voice-Input mit Auftraggeber "IDT GmbH" | Korrekte XLSX wird automatisch gewaehlt |
| 7 | Voice-Input mit unbekanntem Auftraggeber | Auswahl-Dialog zeigt nur "IDT GmbH" |
| 8 | XLSX beschreiben | Backup-Datei wird erstellt |

### Evidence

- Screenshot: Datei-Management mit gefuellter Tabelle
- Screenshot: Aktivierungsstatus nach Neustart erhalten
- Log-Eintrag: Backup-Datei erstellt mit Timestamp
