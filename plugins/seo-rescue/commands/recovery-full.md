# Recovery Full Workflow

## Zweck
Verkettung aller vier Recovery-Commands in einem Durchlauf. Ein Befehl fuer den vollstaendigen Recovery-Workflow von Diagnose bis Monitoring-Setup.

## Trigger
`/seo-rescue:recovery-full <domain>`

## Ablauf

### Schritt 1: Domain normalisieren
Normalisiere den Input einmalig via `normalizeDomain()` aus `lib/safe.js`.
Die resultierenden Werte (input_domain, domain, canonical_domain, slug) werden an alle Sub-Commands weitergegeben.

### Schritt 2: Diagnose ausfuehren
Gib aus: "Starte Diagnose fuer {domain}..."
Lies und befolge `commands/recovery-diagnose.md`.
Nach Abschluss:
- Lies `~/.cache/seo-rescue/{slug}/befund.json`
- Gib Kurz-Befund aus: VI, Diagnosis, Severity
- Pruefe status:
  - "failed" → Abbruch des gesamten Workflows. Ohne Diagnose kein sinnvoller Fortschritt.
  - "partial" → Warnung, weitermachen.
  - "complete" → Weitermachen.

### Schritt 3: Crawl ausfuehren
Gib aus: "Starte Crawl..."
Lies und befolge `commands/recovery-crawl.md`.
Nach Abschluss:
- Lies `~/.cache/seo-rescue/{slug}/issues.json`
- Gib Issue-Summary aus: critical/high/medium/low
- Pruefe status:
  - "failed" → Warnung. Weiter mit Plan auf Basis nur der Diagnose.
  - "partial"/"complete" → Weitermachen.

### Schritt 4: Action-Plan erstellen
Gib aus: "Erstelle Action-Plan..."
Lies und befolge `commands/recovery-plan.md`.
Nach Abschluss:
- Lies `~/.cache/seo-rescue/{slug}/action-plan.json`
- Gib Top-5 Massnahmen aus
- Pruefe status:
  - "failed" → Warnung. Weiter mit Monitoring. Manuellen Plan empfehlen.
  - "partial"/"complete" → Weitermachen.

### Schritt 5: Monitoring einrichten
Gib aus: "Richte Monitoring ein..."
Lies und befolge `commands/recovery-monitor.md` (initialer Baseline-Check).
Nach Abschluss:
- Gib Recovery-Score aus.

### Schritt 6: Zusammenfassung
Gib aus: "Recovery-Workflow abgeschlossen."
Zeige Zusammenfassung:
- Befund: Diagnosis + Severity + VI-Drop
- Top-Issues: critical + high Counts
- Top-3 Actions: Hoechste Prioritaet
- Recovery-Score: Aktueller Score + Phase
- Hinweis: "Fuehre woechentlich `/seo-rescue:recovery-monitor {domain}` aus um den Recovery-Fortschritt zu tracken."

## Gesamtstatus-Logik
- complete: Alle 4 Commands = complete
- partial: Mindestens ein Command = partial, keiner = failed (ausser Crawl/Plan/Monitor)
- failed: Diagnose = failed

## Fehlerbehandlung
| Fehler | Verhalten |
|--------|----------|
| Diagnose failed | Abbruch. Ohne Diagnose kein sinnvoller Fortschritt. |
| Crawl failed | Warnung. Weiter mit Plan auf Basis nur der Diagnose. |
| Plan failed | Warnung. Weiter mit Monitoring. Manuellen Plan empfehlen. |
| Monitor failed | Warnung. Workflow als partial abgeschlossen. |
| Jeder Command partial | Weitermachen. Warnings sammeln und am Ende zusammenfassen. |
