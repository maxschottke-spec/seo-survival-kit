# Recovery Plan

## Zweck
Aus Diagnose-Befund und Crawl-Issues einen priorisierten, phasengerechten Action-Plan ableiten. Beruecksichtigt Recovery-Phase, Do-Not-Touch-Prinzip und Batch-Change-Limits.

## Trigger
`/seo-rescue:recovery-plan <domain>`

## Voraussetzungen
- `befund.json` muss im Cache existieren (recovery-diagnose muss vorher gelaufen sein)
- `issues.json` im Cache ist optional (recovery-crawl muss nicht gelaufen sein)

## Ablauf

### Schritt 1: Domain normalisieren
(normalizeDomain from lib/safe.js)

### Schritt 2: Inputs laden
Lade befund.json und issues.json aus ~/.cache/seo-rescue/{slug}/.
- befund.json fehlt → Status failed, Abbruch mit Hinweis: erst recovery-diagnose ausfuehren
- befund.json status=failed → Status failed, Abbruch
- issues.json fehlt → Warnung, Plan nur auf Basis der Diagnose
- issues.json status=failed → Warnung, Plan nur auf Basis der Diagnose

### Schritt 3: Recovery-Phase bestimmen
Referenz: references/RECOVERY_SYSTEM.md
Bestimme aktuelle Phase (R1-R5) basierend auf:
- VI-Trend (steigend/fallend/stabil)
- Keyword-Stabilitaet
- Recovery-Signale

Phase-Kriterien:
- R1: Protect Winners — VI faellt noch oder gerade gestoppt
- R2: Stabilize Rankings — VI stabil, aber unter Peak
- R3: Improve Internal Links — VI steigt langsam, Struktur-Issues dominant
- R4: Fix Intent Conflicts — Rankings kommen zurueck, Content-Mismatch sichtbar
- R5: Selective Expansion — Recovery weitgehend abgeschlossen, Wachstum moeglich

### Schritt 4: Do-Not-Touch-Liste erstellen
Identifiziere stabile Top-10 Keywords aus befund.json.
Diese URLs/Keywords duerfen NICHT angefasst werden waehrend der Recovery.
Kriterien: Position 1-10, stabil (keine grosse Bewegung), relevantes Volumen.

### Schritt 5: Issues priorisieren
Referenz: references/DECISION_ENGINE.md
Priorisiere nach: Impact x Aufwand x Risiko

Reihenfolge:
1. Protect Winners (R1) — Nichts anfassen was rankt
2. Stop Bleeding — 404s fixen, Redirect-Chains aufloesen, Canonical-Fehler korrigieren
3. Quick Wins — Keywords Pos 4-20 mit hohem Volumen staerken
4. Authority Building — Content-Luecken schliessen, E-E-A-T staerken
5. Expansion — Neue Keywords nur wenn R1-R4 stabil

### Schritt 6: 30/60/90-Tage-Plan generieren
Ordne jede Massnahme einem Zeitfenster zu:
- 30d: Kritische Fixes (404s, Canonicals, Redirects)
- 60d: Quick Wins und Internal-Link-Verbesserungen
- 90d: Authority Building und Content-Verbesserungen

### Schritt 7: Risiko bewerten
Bewerte jede Massnahme mit Recovery-Risiko:
- green: Sicher, kein Risiko fuer bestehende Rankings
- yellow: Vorsicht, koennte Rankings temporaer beeinflussen
- red: Riskant, nur mit Monitoring und Rollback-Plan
- black: Nicht empfohlen waehrend aktiver Recovery

Batch-Change-Limit: max 3-5 URL-Aenderungen/Tag wenn risk != green

### Schritt 8: Action-Plan schreiben
Assembliere alle Daten in JSON gemaess schemas/action-plan.schema.json.
Atomic write via acquireLock + atomicWriteJSON + releaseLock.

## Output-Pfad
`~/.cache/seo-rescue/{slug}/action-plan.json`

## Validierungsregeln
- current_phase: R1|R2|R3|R4|R5
- actions[].risk: green|yellow|red|black
- actions[].impact: critical|high|medium|low
- actions[].effort: low|medium|high
- actions sortiert nach priority aufsteigend
- batch_limit gesetzt wenn risk != green

## Referenzen
- references/RECOVERY_SYSTEM.md — Phasen R1-R5, Risk Matrix, Do-Not-Touch
- references/DECISION_ENGINE.md — Priorisierung, Evidence-Weighting
- schemas/action-plan.schema.json — Output-Schema
