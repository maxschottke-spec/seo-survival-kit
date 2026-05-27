# Recovery Workflow — Troubleshooting

## Haeufige Fehler

### MCP-Server nicht erreichbar

**Symptom:** Command meldet "MCP not available" oder aehnlich.

**Loesung:**
- Pruefen ob Screaming Frog MCP Server laeuft
- Pruefen ob DataForSEO MCP Server konfiguriert ist
- Der Command laeuft trotzdem weiter mit Fallback-Daten (CSV, lokaler Crawler)

### API-Keys fehlen

**Symptom:** Warnings wie "Sistrix API not available".

**Loesung:**
- Keys sind optional. Der Workflow funktioniert im Minimal-Modus.
- Fuer bessere Datenqualitaet: Keys in .env oder Environment setzen (siehe SETUP.md)

### Cache-Lock haengt

**Symptom:** "acquireLock: timeout" Fehler.

**Loesung:**
- Stale Locks werden automatisch nach 10 Minuten entfernt
- Manuell: `rm ~/.cache/seo-rescue/{domain-slug}/.lock`
- Pruefen ob ein anderer Command noch laeuft (PID in Lock-Datei)

### Korrupte JSON-/NDJSON-Dateien

**Symptom:** "invalid JSON" Fehler beim Lesen.

**Loesung:**
- Die betroffene Datei loeschen oder umbenennen
- Command erneut ausfuehren — erzeugt die Datei neu
- `history.ndjson`: einzelne korrupte Zeilen verhindern nicht das Schreiben neuer Eintraege

### Schema-Validierung schlaegt fehl

**Symptom:** "Schema validation failed" Warnung.

**Loesung:**
- Artefakt wurde nicht final geschrieben
- Pruefen welche Felder fehlen (in `errors` Array)
- Command mit mehr Datenquellen erneut ausfuehren

### Domain wird falsch normalisiert

**Symptom:** www-/non-www-Verwechslung.

**Loesung:**
- `www.example.com` und `example.com` sind getrennte Domains
- Den exakten Hostname verwenden, der in Google rankt
- `canonical_domain` kann spaeter projektseitig gesetzt werden

### Keine Datenquellen verfuegbar

**Symptom:** "failed" Status, keine Outputs.

**Loesung:**
1. GSC CSV-Exporte anlegen (siehe FALLBACKS.md)
2. Oder manuelle Keyword-/Backlink-CSVs erstellen
3. Command erneut ausfuehren

## Output-Felder interpretieren

### warnings

Nicht-kritische Hinweise. Der Output ist nutzbar, aber einzelne Aspekte koennten unvollstaendig sein.

### errors

Kritische Fehler. Wenn `status: "failed"`, beschreiben die Errors warum.

### missing_capabilities

Welche Daten-Capabilities nicht verfuegbar waren. Hilft einzuschaetzen, welche API-Anbindung den groessten Qualitaetssprung bringen wuerde.

### data_quality und confidence

- `good` + `high`: Alle wichtigen Daten frisch und vollstaendig
- `partial` + `medium`: Nutzbar, aber einzelne Aspekte fehlen
- `poor` + `low`: Nur Minimal-Daten, Ergebnis stark eingeschraenkt
