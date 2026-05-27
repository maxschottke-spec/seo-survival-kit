# Recovery Monitor

## Zweck
Woechentliches Recovery-Tracking. Holt aktuelle VI + Keyword-Daten, berechnet Recovery-Score, appendet an die History-Datei.

## Trigger
`/seo-rescue:recovery-monitor <domain>`

## Ablauf

### Schritt 1: Domain normalisieren
normalizeDomain from lib/safe.js — returns input_domain, domain, canonical_domain, slug.

### Schritt 2: Cache-Verzeichnis anlegen
ensureDomainDir(slug)

### Schritt 3: Sistrix VI abrufen
Rufe Sistrix API auf fuer aktuellen VI-Wert.
Falls nicht verfuegbar: Warnung, vi = null.

### Schritt 4: DataForSEO ranked_keywords abrufen
Rufe DataForSEO MCP `ranked_keywords/live` auf (location 2276, Germany).
Zaehle Keywords in Top-10: keywords_t10.
Falls DataForSEO MCP nicht verfuegbar: Fallback auf direkten API-Call via fetch.
Falls beides nicht verfuegbar: Status = failed, Abbruch.

### Schritt 5: Score berechnen und History schreiben
Rufe das Helper-Script auf:
```bash
node -e "
const { writeMonitorEntry, formatDeltaReport } = require('./plugins/seo-rescue/scripts/recovery-monitor.js');
const { entry, lastEntry } = writeMonitorEntry(inputDomain, domain, slug, vi, keywordsT10, warnings, errors);
console.log(formatDeltaReport(entry, lastEntry));
"
```

## Recovery-Score-Gewichtung

| Komponente | Gewicht |
|-----------|---------|
| VI-Trend | 30% |
| Keyword-Position-Stabilitaet | 25% |
| Quick-Win-Fortschritt | 20% |
| Issue-Reduktion | 15% |
| Backlink-Qualitaet-Trend | 10% |

## Output-Pfad
`~/.cache/seo-rescue/{slug}/history.ndjson` (append-only)

## Delta-Report Format
```
Recovery Monitor — example.com — 2026-05-27
--------------------------------------------
VI:          0.108 (+2.3%)
Score:       62/100 (von 55)
Phase:       R2
Top-10:      120 Keywords (+5)
--------------------------------------------
```

## Fehlerbehandlung
| Fehler | Verhalten | Status |
|--------|----------|--------|
| Sistrix nicht erreichbar | Warnung, vi=null, Score ohne VI | partial |
| DataForSEO nicht verfuegbar (MCP+fetch) | Fehler, Monitoring unmoeglich | failed |
| history.ndjson corrupt | Warnung, kein Delta, aktueller Eintrag wird geschrieben | partial |
| befund.json fehlt | Warnung, kein Baseline | partial |
| Lock-Timeout 30s | Fehler, Abbruch | failed |

## Validierungsregeln
- score: 0-100
- phase: R1|R2|R3|R4|R5
- vi > 0 oder null
- Jede NDJSON-Zeile mit \n terminiert und als JSON parsebar

## Referenzen
- scripts/recovery-monitor.js — Score-Berechnung + Delta-Report
- schemas/history.schema.json — Output-Schema
