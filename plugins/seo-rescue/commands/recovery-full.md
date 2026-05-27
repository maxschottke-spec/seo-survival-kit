# Recovery Full Workflow

## Zweck

Verkettung aller vier Recovery-Commands in einem Durchlauf. Ein Befehl fuer den vollstaendigen Recovery-Workflow von Diagnose bis Monitoring-Setup. Alle Schritte teilen eine gemeinsame `run_id` fuer end-to-end Traceability.

## Trigger

`/seo-rescue:recovery-full <domain>`

## Input-Kontrakt

| Feld | Quelle | Pflicht |
|------|--------|---------|
| `domain` | CLI-Argument | ja |

## Ablauf

### Schritt 1: Domain normalisieren + Run-ID generieren

Normalisiere den Input einmalig via `normalizeDomain()` aus `lib/safe.js`.

Die resultierenden Werte (`input_domain`, `domain`, `canonical_domain`, `slug`) werden an alle Sub-Commands weitergegeben.

Generiere eine gemeinsame `run_id` fuer den gesamten Workflow:

```bash
node -e "const { randomUUID } = require('crypto'); console.log('full-' + randomUUID().slice(0,8) + '-' + Date.now())"
```

Diese `run_id` wird in ALLE Sub-Command-Outputs eingebettet (befund.json, issues.json, action-plan.json, history.ndjson-Eintrag). Sie ermoeglichen spaetere Korrelation aller Artifacts aus einem Full-Run.

### Schritt 2: Diagnose ausfuehren

Gib aus: `"[1/4] Starte Diagnose fuer {domain}..."`

Lies und befolge `commands/recovery-diagnose.md`. Uebergib die gemeinsame `run_id`.

Nach Abschluss:
- Lies `~/.cache/seo-rescue/{slug}/befund.json`
- Gib Kurz-Befund aus: VI, Diagnosis, Severity, data_quality
- Sammle `warnings` und `errors` fuer die Gesamtzusammenfassung
- Pruefe status:
  - `"failed"` — Pruefe ob alternative Datenquellen (CSV-Imports) vorhanden sind. Falls JA: Warnung, weiter mit eingeschraenktem Workflow. Falls NEIN: Abbruch des gesamten Workflows. Ohne jede Datengrundlage kein sinnvoller Fortschritt.
  - `"partial"` — Warnung, weitermachen.
  - `"complete"` — Weitermachen.

### Schritt 3: Crawl ausfuehren

Gib aus: `"[2/4] Starte Crawl..."`

Lies und befolge `commands/recovery-crawl.md`. Uebergib die gemeinsame `run_id`.

Nach Abschluss:
- Lies `~/.cache/seo-rescue/{slug}/issues.json`
- Gib Issue-Summary aus: critical/high/medium/low, crawler_provider
- Sammle `warnings` und `errors` fuer die Gesamtzusammenfassung
- Pruefe status:
  - `"failed"` — Warnung eintragen. Versuche lokalen Crawler oder CSV-Import-Fallback (gemaess `commands/recovery-crawl.md`). Falls Fallback ebenfalls fehlschlaegt: Warnung, weiter mit Plan nur auf Basis der Diagnose.
  - `"partial"` / `"complete"` — Weitermachen.

### Schritt 4: Action-Plan erstellen

Gib aus: `"[3/4] Erstelle Action-Plan..."`

Lies und befolge `commands/recovery-plan.md`. Uebergib die gemeinsame `run_id`.

Nach Abschluss:
- Lies `~/.cache/seo-rescue/{slug}/action-plan.json`
- Gib Top-5 Massnahmen mit Evidence aus
- Pruefe status:
  - `"failed"` — Warnung. Weiter mit Monitoring. Manuellen Plan empfehlen.
  - `"partial"` / `"complete"` — Weitermachen.

### Schritt 5: Monitoring einrichten

Gib aus: `"[4/4] Richte Monitoring ein..."`

Lies und befolge `commands/recovery-monitor.md` (initialer Baseline-Check). Uebergib die gemeinsame `run_id`.

Nach Abschluss:
- Gib Recovery-Score aus (oder Hinweis wenn `score: null`)
- Sammle `warnings` und `errors` fuer die Gesamtzusammenfassung

### Schritt 6: Zusammenfassung ausgeben

Gib aus: `"Recovery-Workflow abgeschlossen."`

Zeige vollstaendige Zusammenfassung:

```
Recovery Full — example.com — 2026-05-27
Run-ID: full-a1b2c3d4-1716820000000
=========================================
SCHRITT-STATUS:
  [1] Diagnose:  complete  (data_quality: good)
  [2] Crawl:     partial   (data_quality: partial, crawler: screaming_frog_mcp)
  [3] Plan:      complete  (data_quality: partial)
  [4] Monitor:   complete  (data_quality: good)

TOP BEFUND:
  Diagnose:   core-update | Severity: high | VI-Drop: -34.2%
  Confidence: medium

TOP ISSUES:
  Critical: 2 | High: 8 | Medium: 9 | Low: 4

TOP-5 AKTIONEN:
  1. [green/30d] 404-Redirects setzen (14 URLs)
  2. [yellow/30d] Canonical-Fehler korrigieren (6 URLs)
  3. [yellow/60d] Quick-Win Keywords Pos 4-10 staerken (8 Keywords)
  4. [yellow/60d] Orphan-Pages intern verlinken (12 Pages)
  5. [red/90d] Content-Refresh fuer thin-content Pages (23 Pages)

RECOVERY-SCORE: 62/100 | Phase: R2

ARTIFACTS:
  ~/.cache/seo-rescue/example-com/befund.json
  ~/.cache/seo-rescue/example-com/issues.json
  ~/.cache/seo-rescue/example-com/action-plan.json
  ~/.cache/seo-rescue/example-com/history.ndjson

GESAMMELTE WARNUNGEN (3):
  - "Sistrix-Backlink-Endpoint lieferte leere Daten"
  - "Crawl-Timeout nach 8 Minuten — 312 von 500 URLs gecrawlt"
  - "CORE_UPDATES.md aelter als 90 Tage — Korrelation max. 'low'"

PROVIDERS VERWENDET:
  sistrix, dataforseo, screaming_frog_mcp

FEHLENDE CAPABILITIES:
  backlink_summary (DataForSEO-Backlink-Endpoint nicht erreichbar)

EINGESCHRAENKTE ERGEBNISSE:
  - Backlink-Profil fehlt — backlink_quality Score-Komponente nicht berechnet
  - Crawl-Daten partial — moegliche Issues uebersprungen

NAECHSTE MANUELLE SCHRITTE:
  1. Plan in action-plan.json pruefen und freigeben (requires_human_approval: true)
  2. Woechentlich: /seo-rescue:recovery-monitor {domain}
  3. Nach Umsetzung 30d-Aktionen: /seo-rescue:recovery-crawl {domain} (neuer Crawl)
=========================================
```

## Gesamtstatus-Logik

| Bedingung | Gesamtstatus |
|-----------|-------------|
| Alle 4 Commands = `complete` | `complete` |
| Mindestens ein nicht-kritischer Command = `partial` oder `failed`, aber Diagnose hat Daten | `partial` |
| Diagnose = `failed` UND keine alternative Datenquelle (kein CSV-Import) | `failed` |
| Diagnose = `failed` ABER CSV-Import vorhanden | `partial` (eingeschraenkter Workflow) |

## Fehlerbehandlung

| Fehler | Verhalten |
|--------|----------|
| Diagnose `failed`, kein CSV-Import | Abbruch des gesamten Workflows. Klarer Hinweis: Datenquellen einrichten oder CSV-Import anlegen. |
| Diagnose `failed`, CSV-Import vorhanden | Warnung, eingeschraenkter Workflow mit CSV-Daten. |
| Crawl `failed` | Warnung. Fallback-Versuch (lokaler Crawler oder CSV). Weiter mit Plan auf Basis der Diagnose. |
| Plan `failed` | Warnung. Weiter mit Monitoring. Hinweis: Manuellen Plan erstellen. |
| Monitor `failed` | Warnung. Workflow als `partial` abgeschlossen. Hinweis: Monitor manuell ausfuehren. |
| Jeder Command `partial` | Weitermachen. Warnings sammeln und in Zusammenfassung ausgeben. |
| Run-ID nicht generierbar | Warnun, UUID-Fallback `full-fallback-{timestamp}` verwenden. |

## Gesammelte Warnings/Errors

Alle `warnings` und `errors` aus den Sub-Commands werden gesammelt und am Ende in der Zusammenfassung ausgegeben. Kein Sub-Command-Warning wird stillschweigend verschluckt.

## Validierungsregeln

- `run_id` ist in allen 4 Sub-Command-Outputs identisch
- Gesamtstatus-Logik wird nach Abschluss aller Schritte deterministisch berechnet
- Die Zusammenfassung listet immer: Status pro Schritt, Top-Befund, Top-Issues, Top-5 Aktionen, Score, Artifact-Pfade, Warnungen, Provider, fehlende Capabilities, eingeschraenkte Ergebnisse, naechste manuelle Schritte

## Referenzen

- `commands/recovery-diagnose.md` — Schritt 2
- `commands/recovery-crawl.md` — Schritt 3
- `commands/recovery-plan.md` — Schritt 4
- `commands/recovery-monitor.md` — Schritt 5
- `lib/safe.js` — `normalizeDomain()`
