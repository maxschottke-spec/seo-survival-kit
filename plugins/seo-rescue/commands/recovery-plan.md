# Recovery Plan

## Zweck

Aus Diagnose-Befund und Crawl-Issues einen priorisierten, phasengerechten Action-Plan ableiten. Beruecksichtigt Recovery-Phase, Do-Not-Touch-Prinzip und Batch-Change-Limits. Der Plan setzt keine SEO-Aenderungen automatisch um. Er dient der menschlichen Freigabe.

## Change Governance

Mode: `audit_only`. Change Budget: 0. Keine Live-Shop-Writes.

Jede geplante Aenderung muss als Change Plan mit Risikopunkten ausgegeben werden (Format: `change-budget.schema.json`). Der Plan referenziert `SEO_CHANGE_GOVERNOR.md` fuer die Punkteberechnung. Human Approval Gate per `SAFE_LIVE_CHANGE_RULES.md`.

## Trigger

`/seo-rescue:recovery-plan <domain>`

## Input-Kontrakt

| Feld | Quelle | Pflicht |
|------|--------|---------|
| `domain` | CLI-Argument | ja |
| `befund.json` | Cache (recovery-diagnose) | nein (degradiert) |
| `issues.json` | Cache (recovery-crawl) | nein (degradiert) |

**Input-Flexibilitaet:**

| Verfuegbare Inputs | Plan-Typ |
|-------------------|---------|
| `befund.json` + `issues.json` | Vollstaendiger Plan (Diagnose + technische Issues) |
| Nur `befund.json` | Diagnose-Plan (ohne technische Issue-Details) |
| Nur `issues.json` | Technischer Plan (ohne VI/Keyword-Kontext) |
| Keines, aber `imports/` vorhanden | Minimaler Plan aus Import-Daten |
| Nichts verfuegbar | `failed` — Abbruch |

## Capabilities

Keine externen API-Calls — recovery-plan arbeitet ausschliesslich auf gecachten Artifacts und Referenzdokumenten.

## Ablauf

### Schritt 1: Domain normalisieren

Normalisiere den Input via `normalizeDomain()` aus `lib/safe.js`.

### Schritt 2: Run-ID generieren

Generiere eine eindeutige Run-ID fuer diesen Lauf:

```bash
node -e "const { randomUUID } = require('crypto'); console.log('plan-' + randomUUID().slice(0,8) + '-' + Date.now())"
```

### Schritt 3: Inputs laden

Lade `befund.json` und `issues.json` aus `~/.cache/seo-rescue/{slug}/`.

- `befund.json` fehlt → Warnung, weiter ohne Diagnose-Kontext (Plan eingeschraenkt)
- `befund.json` status=`failed` → Warnung, behandle wie fehlend
- `issues.json` fehlt → Warnung, Plan nur auf Basis der Diagnose
- `issues.json` status=`failed` → Warnung, Plan nur auf Basis der Diagnose
- Beide fehlen und kein Import-Verzeichnis → Status `failed`, Abbruch mit Hinweis: erst `recovery-diagnose` und/oder `recovery-crawl` ausfuehren

**Data-Quality der Inputs pruefen:**

Wenn `befund.json.data_quality = "poor"` ODER `issues.json.data_quality = "poor"`:
- Warnung eintragen: `"Eingabedaten haben schlechte Qualitaet — Plan basiert auf unvollstaendigen Daten"`
- Keine aggressiven Empfehlungen generieren

### Schritt 4: Recovery-Phase bestimmen

Referenz: `references/RECOVERY_SYSTEM.md`

Bestimme aktuelle Phase (R1–R5) basierend auf:
- VI-Trend (steigend/fallend/stabil)
- Keyword-Stabilitaet
- Recovery-Signale

Phase-Kriterien:
- R1: Protect Winners — VI faellt noch oder gerade gestoppt
- R2: Stabilize Rankings — VI stabil, aber unter Peak
- R3: Improve Internal Links — VI steigt langsam, Struktur-Issues dominant
- R4: Fix Intent Conflicts — Rankings kommen zurueck, Content-Mismatch sichtbar
- R5: Selective Expansion — Recovery weitgehend abgeschlossen, Wachstum moeglich

Falls VI-Daten fehlen: Phase aus Keyword-Daten schaetzen oder auf `null` setzen.

### Schritt 5: Do-Not-Touch-Liste erstellen

Identifiziere stabile Top-10 Keywords aus `befund.json`.

Diese URLs/Keywords duerfen NICHT angefasst werden waehrend der Recovery.

Kriterien: Position 1–10, stabil (keine grosse Bewegung), relevantes Volumen.

Falls keine Keyword-Daten verfuegbar: Leere Do-Not-Touch-Liste, Warnung eintragen.

### Schritt 6: Issues priorisieren

Referenz: `references/DECISION_ENGINE.md`

Priorisiere nach: Impact x Aufwand x Risiko

Reihenfolge:
1. Protect Winners (R1) — Nichts anfassen was rankt
2. Stop Bleeding — 404s fixen, Redirect-Chains aufloesen, Canonical-Fehler korrigieren
3. Quick Wins — Keywords Pos 4–20 mit hohem Volumen staerken
4. Authority Building — Content-Luecken schliessen, E-E-A-T staerken
5. Expansion — Neue Keywords nur wenn R1–R4 stabil

**Evidence-Pflicht:**

Jede Aktion im Plan benoetigt ein `evidence`-Array mit mindestens einem Eintrag:

```json
{
  "action": "404-Redirect auf /neue-url/ setzen",
  "evidence": [
    "issues.json: broken_internal_link — 23 betroffene URLs",
    "befund.json: diagnosis=technical"
  ]
}
```

Aktionen ohne Hard-Data (keine Zahlen aus befund.json oder issues.json) erhalten `risk = "yellow"` oder hoeher — niemals automatisch `"green"`.

### Schritt 7: 30/60/90-Tage-Plan generieren

Ordne jede Massnahme einem Zeitfenster zu:
- 30d: Kritische Fixes (404s, Canonicals, Redirects)
- 60d: Quick Wins und Internal-Link-Verbesserungen
- 90d: Authority Building und Content-Verbesserungen

### Schritt 8: Risiko bewerten

Bewerte jede Massnahme mit Recovery-Risiko:
- `green`: Sicher, kein Risiko fuer bestehende Rankings — nur wenn klare Hard-Data-Evidence vorhanden
- `yellow`: Vorsicht, koennte Rankings temporaer beeinflussen; oder Aktion basiert auf unvollstaendigen Daten
- `red`: Riskant, nur mit Monitoring und Rollback-Plan
- `black`: Nicht empfohlen waehrend aktiver Recovery

**Batch-Change-Limit:**

- Max. 3–5 URL-Aenderungen/Tag wenn `risk != "green"`
- Ausnahme: 404-Redirect-Fixes duerfen gebundelt werden, wenn die Ziel-URLs eindeutig korrekt sind (z.B. direkte Produktseiten-Redirects auf aktive Nachfolger-URLs mit hoher Confidence)
- Bei `data_quality = "poor"` aus den Inputs: Batch-Limit auf max. 3 URLs/Tag reduzieren

**Hinweis:** Bei `data_quality = "poor"` in den Eingabedaten keine Aktionen mit `risk = "green"` setzen.

### Schritt 9: Human Approval Gate

Jeder generierte Plan benoetigt explizite menschliche Freigabe vor der Umsetzung.

Setze im Output-Objekt:
- `requires_human_approval: true`
- `implementation_status: "proposed"`

Das System setzt KEINE SEO-Aenderungen automatisch um. Der Plan ist eine Entscheidungsvorlage.

### Schritt 10: Action-Plan schreiben

Assembliere alle Daten in JSON gemaess `schemas/action-plan.schema.json`. Atomic write via `acquireLock` + `atomicWriteJSON` + `releaseLock`.

## Output-Pfad

`~/.cache/seo-rescue/{slug}/action-plan.json`

## Output-Schema

```json
{
  "schema_version": "2.0",
  "run_id": "plan-c3d4e5f6-1716820000000",
  "status": "complete",
  "data_quality": "partial",
  "confidence": "medium",
  "providers_used": [],
  "missing_capabilities": [],
  "requires_human_approval": true,
  "implementation_status": "proposed",
  "domain": "example.com",
  "timestamp": "2026-05-27T14:00:00Z",
  "warnings": [],
  "errors": [],
  "current_phase": "R2",
  "do_not_touch": ["example.com/top-produkt/", "example.com/kategorie-a/"],
  "batch_limit": 5,
  "actions": [
    {
      "id": "act-001",
      "title": "404-Redirects auf Nachfolger-URLs setzen",
      "type": "technical",
      "priority": 1,
      "impact": "high",
      "effort": "low",
      "risk": "green",
      "phase": "30d",
      "evidence": ["issues.json: broken_internal_link — 14 URLs mit 404"],
      "affected_urls": 14
    }
  ]
}
```

## Ausgabe an den User

Nach erfolgreichem Schreiben des Plans, gib folgende Informationen aus:

1. **Status-Zeile:** `[recovery-plan] {domain} — Status: {status} | Phase: {current_phase}`
2. **Human-Approval-Hinweis:** `Dieser Plan erfordert menschliche Freigabe vor der Umsetzung (implementation_status: proposed)`
3. **Datenqualitaet:** `Datenqualitaet: {data_quality} | Confidence: {confidence}`
4. **Plan-Summary:** `Actions: {actions.length} | 30d: {count_30d} | 60d: {count_60d} | 90d: {count_90d}`
5. **Top-5-Aktionen:** Listenformat mit Prioritaet, Titel, Impact, Risiko, Evidence
6. **Batch-Limit:** `Empfohlenes Batch-Limit: {batch_limit} URL-Aenderungen/Tag`

## Fehlerbehandlung

| Fehler | Verhalten | Status |
|--------|-----------|--------|
| `befund.json` fehlt | Warnung, Plan ohne Diagnose-Kontext | `partial` |
| `befund.json` status=`failed` | Warnung, behandle wie fehlend | `partial` |
| `issues.json` fehlt | Warnung, Plan nur auf Basis der Diagnose | `partial` |
| Beide fehlen, kein Import | Fehler, Abbruch | `failed` |
| `data_quality = "poor"` in Inputs | Warnung, keine aggressiven Empfehlungen | `partial` |
| Lock nicht erwerbbar (Timeout 30s) | Fehler eintragen, Abbruch | `failed` |

## Validierungsregeln

- `current_phase`: `R1 | R2 | R3 | R4 | R5 | null`
- `actions[].risk`: `green | yellow | red | black`
- `actions[].impact`: `critical | high | medium | low`
- `actions[].effort`: `low | medium | high`
- `actions` sortiert nach `priority` aufsteigend
- `batch_limit` gesetzt wenn `risk != "green"` bei mindestens einer Aktion
- `requires_human_approval`: immer `true`
- `implementation_status`: immer `"proposed"` (nie auto-implementiert)
- `schema_version` muss `"2.0"` sein
- `run_id` muss gesetzt und non-empty sein
- Jede Aktion mit `risk = "green"` muss mindestens einen `evidence`-Eintrag mit Hard-Data haben
- Aktionen ohne Hard-Data erhalten `risk` mind. `"yellow"`

## Graceful-Degradation-Regeln

| Szenario | Verhalten |
|---------|-----------|
| Nur `befund.json` verfuegbar | Diagnose-Plan; keine technischen Issue-Aktionen |
| Nur `issues.json` verfuegbar | Technischer Plan; keine VI/Keyword-Aktionen |
| Keine Inputs | `failed` |
| `data_quality = "poor"` | Keine `risk = "green"` Aktionen; explizite Vorbehalte |

## Referenzen

- `references/RECOVERY_SYSTEM.md` — Phasen R1–R5, Risk Matrix, Do-Not-Touch, Batch-Change-Limits
- `references/DECISION_ENGINE.md` — Priorisierung, Evidence-Weighting, Profitabilitaetssignale
- `schemas/action-plan.schema.json` — Output-Schema
