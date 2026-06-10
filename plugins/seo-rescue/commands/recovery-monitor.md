---
description: "Weekly recovery tracking with VI, keyword data, and Change History effect tracking."
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, mcp__*
---

# Recovery Monitor

## Zweck

Woechentliches Recovery-Tracking. Holt aktuelle VI + Keyword-Daten, berechnet Recovery-Score, appendet an die History-Datei. Laeuft auch bei fehlenden Datenquellen durch und schreibt einen Partial-Eintrag — der Zeitstempel allein ist wertvoll fuer die Zeitreihe.

## Settlement Gate Awareness

Dieses Command ist read-only gegenueber dem Live-Shop (`audit_only`, Change Budget 0, schreibt nur Cache-Artefakte) — ein aktiver Settlement Gate (`references/SEO_SETTLEMENT_GATE.md`) blockiert es NIE. Es muss den Gate-State aber kennen und ausweisen:

1. Lies `~/.cache/seo-rescue/{slug}/recovery-gate.json`, falls vorhanden. **Writer dieser Datei ist `recovery-audit`** (siehe `commands/recovery-audit.md`, Settlement Gate Detection) — recovery-monitor liest sie nur. Fehlt die Datei, gilt der Gate als `never_triggered`: keine Warnung, normaler Ablauf.
2. Falls `settlement_gate_active = true`:
   - Monitoring laeuft normal weiter — read-only Tracking ist waehrend eines aktiven Gates immer erlaubt und ausdruecklich erwuenscht (der Gate braucht Re-Evaluation-Daten).
   - In den History-Eintrag (Top-Level) das Feld `settlement_gate_status` aufnehmen, gespiegelt aus der Gate-Datei:

     ```json
     "settlement_gate_status": {
       "active": true,
       "next_allowed_review_date": "2026-06-06",
       "unlock_status": "blocked"
     }
     ```

     (`unlock_status`: `blocked | partial | open`, direkt aus der Gate-Datei uebernommen.)
   - In der User-Ausgabe (Delta-Report) eine Zeile ausgeben: `Settlement Gate: AKTIV bis {next_allowed_review_date} — read-only Monitoring erlaubt, Live-Aenderungen blockiert`
   - Jeder Empfehlungstext darf KEINE sofortigen Live-Aenderungen vorschlagen. Naechste Schritte als "jetzt vorbereiten/Drafts erstellen, Ausfuehrung nach Gate-Re-Evaluation" formulieren (`prepare_now_execute_later`-Prinzip aus `SEO_SETTLEMENT_GATE.md`).
   - **Score-Bewegung waehrend aktivem Gate:** Wenn der Recovery Score stark gefallen ist (Drop > 15 Punkte gegenueber dem letzten History-Eintrag), KEINE korrigierende Live-Aktion empfehlen. Stattdessen empfehlen, die Beobachtung in die Gate-Re-Evaluation am `next_allowed_review_date` mitzunehmen — der Gate existiert genau dafuer, dass frisches Post-Batch-Rauschen nicht sofort beantwortet wird. Das gilt auch fuer Rollback-Empfehlungen aus der Change-History-Integration: Anomalies werden geflagged und fuer die Re-Evaluation dokumentiert; ob daraus ein Emergency-Rollback per `SEO_SETTLEMENT_GATE.md` section 7 wird, entscheidet der Operator.
3. Falls Gate-Datei fehlt oder `settlement_gate_active = false`: `settlement_gate_status: { "active": false }` in den History-Eintrag schreiben. Keine User-Ausgabe-Zeile noetig.

## Trigger

`/seo-rescue:recovery-monitor <domain>`

## Input-Kontrakt

| Feld | Quelle | Pflicht |
|------|--------|---------|
| `domain` | CLI-Argument | ja |

## Script CLI Contract

```bash
node scripts/recovery-monitor.js --domain <domain> --cache-dir <path>
```

| Exit Code | Bedeutung |
|-----------|-----------|
| `0` | Monitor-Eintrag geschrieben (complete oder partial) |
| `1` | Monitor fehlgeschlagen (kein Eintrag geschrieben) |
| `2` | Security-Abbruch (Symlink, Path-Traversal) |
| `3` | Lock-Timeout (anderer Command laeuft) |

## Ablauf

### Schritt 1: Domain normalisieren

Normalisiere den Input via `normalizeDomain()` aus `lib/safe.js` — gibt `input_domain`, `domain`, `canonical_domain`, `slug` zurueck.

### Schritt 2: Cache-Verzeichnis anlegen

`ensureDomainDir(slug)` — Modus 0700, Abbruch bei Symlink.

### Schritt 3: Run-ID generieren

Generiere eine eindeutige Run-ID fuer diesen Lauf:

```bash
node -e "const { randomUUID } = require('crypto'); console.log('mon-' + randomUUID().slice(0,8) + '-' + Date.now())"
```

Speichere die Run-ID als `run_id`. Sie wird im Output-Schema mitgefuehrt.

### Schritt 4: Sistrix VI abrufen

Rufe Sistrix API fuer aktuellen VI-Wert auf.

Falls nicht verfuegbar:
- Warnung eintragen: `"Sistrix nicht erreichbar — VI-Komponente faellt aus Score"`
- `vi = null`
- Weiter — Monitor laeuft auch ohne VI durch

### Schritt 5: DataForSEO ranked_keywords abrufen

Rufe DataForSEO MCP `ranked_keywords/live` auf (location 2276, Deutschland).

Extrahiere:
- `keywords_t10`: Anzahl Keywords in Top-10
- `keywords_total`: Gesamtzahl rankender Keywords

Falls DataForSEO MCP nicht verfuegbar:
- Pruefe ob `~/.cache/seo-rescue/{slug}/imports/keywords.csv` existiert (CSV-Fallback)
- Falls CSV verfuegbar: Keywords aus CSV laden, `source_notes` eintragen
- Falls beides nicht verfuegbar: Warnung, `keywords_t10 = null`
- Weiter — Monitor laeuft auch ohne Keyword-Daten durch

### Schritt 6: Issue-Daten-Aktualitaet pruefen

Pruefe ob `~/.cache/seo-rescue/{slug}/issues.json` existiert und sein Timestamp aktuell ist (< 7 Tage alt).

Setze `issue_data_fresh`:
- `true`: issues.json existiert und ist < 7 Tage alt
- `false`: issues.json fehlt, status=failed, oder > 7 Tage alt

Hinweis: Wenn `issue_data_fresh = false`, wird `issues_fixed` im Score auf `null` gesetzt — keine Claim ueber Issue-Reduktion ohne frische Crawl-Daten.

### Schritt 7: Score berechnen und History schreiben

Rufe das Helper-Script auf:

```bash
node -e "
const { writeMonitorEntry, formatDeltaReport } = require('./plugins/seo-rescue/scripts/recovery-monitor.js');
const { entry, lastEntry } = writeMonitorEntry(inputDomain, domain, slug, vi, keywordsT10, keywordsTotal, issueDataFresh, warnings, errors);
console.log(formatDeltaReport(entry, lastEntry));
"
```

Falls keine aktuellen Daten vorhanden (weder VI noch Keywords):
- Schreibe trotzdem einen Eintrag mit `status: "partial"`, `data_quality: "poor"`
- Score-Berechnung mit verfuegbaren Komponenten; bei weniger als 2 Komponenten: `score: null`
- Der Zeitstempel allein hat Wert fuer die Zeitreihe

## Recovery-Score-Formel (deterministisch)

> **Abgrenzung:** Dies ist der automatisierte **Recovery Score** (5 Komponenten, kontinuierlich, aus gecachten Artifacts). Er ist NICHT identisch mit dem **Recovery Signal Score** aus `RECOVERY_SYSTEM.md` section 10 / `sistrix-monday-recovery-check` (woechentlich, CSV-first, andere Faktoren). Beide sind 0–100, duerfen aber nicht in einer Zeitreihe gemischt oder miteinander verglichen werden. In Reports immer benennen, welcher Score gemeint ist.

Der Score wird aus 5 Komponenten berechnet. Jede Komponente liefert einen Wert 0–100. Der Gesamt-Score ist der gewichtete Durchschnitt ueber **alle verfuegbaren** Komponenten.

| Komponente | Gewicht | Berechnung | Quelle |
|-----------|---------|-----------|--------|
| `vi_trend` | 30% | `100 * clamp((vi_trend_4w_pct + 50) / 100, 0, 1)` — 50% Trend = Score 100 | Sistrix |
| `keyword_stability` | 25% | `100 * (keywords_t10_current / keywords_t10_baseline)` — capped at 100 | DataForSEO |
| `quick_win_progress` | 20% | `100 * (quick_wins_moved_up / quick_wins_total)` — Anteil Quick-Wins die Positionen gewonnen haben | DataForSEO Delta |
| `issue_reduction` | 15% | `100 * clamp(1 - (open_issues / baseline_issues), 0, 1)` — nur wenn `issue_data_fresh = true` | issues.json |
| `backlink_quality` | 10% | `100 * clamp(1 - (spam_score / 100), 0, 1)` | DataForSEO Backlinks |

**Score-Regeln:**

- Mindestens 2 Komponenten muessen verfuegbar sein, sonst `score: null`
- Fehlende Komponenten werden aus dem gewichteten Durchschnitt herausgerechnet (normalisierte Gewichte)
- `issue_reduction` wird auf `null` gesetzt wenn `issue_data_fresh = false`
- `score` ist immer 0–100 oder `null`
- Beim ersten Lauf (kein Baseline): `quick_win_progress = null`, `keyword_stability` basiert auf absolutem Wert vs. befund.json-Baseline

## Output-Pfad

`~/.cache/seo-rescue/{slug}/history.ndjson` (append-only)

## Output-Schema

Jeder History-Eintrag in der NDJSON-Datei:

```json
{
  "schema_version": "2.0",
  "run_id": "mon-d4e5f6a7-1716820000000",
  "status": "complete",
  "data_quality": "good",
  "confidence": "high",
  "providers_used": ["sistrix", "dataforseo"],
  "missing_capabilities": [],
  "issue_data_fresh": true,
  "source_notes": [],
  "domain": "example.com",
  "timestamp": "2026-05-27T14:00:00Z",
  "warnings": [],
  "errors": [],
  "vi": 0.108,
  "keywords_t10": 124,
  "keywords_total": 890,
  "score": 62,
  "phase": "R2",
  "settlement_gate_status": { "active": false },
  "component_scores": {
    "vi_trend": { "value": 68, "weight": 0.30 },
    "keyword_stability": { "value": 71, "weight": 0.25 },
    "quick_win_progress": { "value": 45, "weight": 0.20 },
    "issue_reduction": { "value": 55, "weight": 0.15 },
    "backlink_quality": { "value": 80, "weight": 0.10 }
  }
}
```

## Delta-Report Format

```
Recovery Monitor — example.com — 2026-05-27
--------------------------------------------
VI:          0.108 (+2.3%)
Score:       62/100 (von 55) [+7]
Phase:       R2
Top-10:      120 Keywords (+5)
Score-Komponenten:
  VI-Trend:        68 (30%)
  Keyword-Stab.:   71 (25%)
  Quick-Win:       45 (20%)
  Issue-Redukt.:   55 (15%)  [Crawl frisch: ja]
  Backlink-Qual.:  80 (10%)
--------------------------------------------
Datenqualitaet: good | Confidence: high
Fehlende Capabilities: keine
```

## Fehlerbehandlung

| Fehler | Verhalten | Status |
|--------|----------|--------|
| Sistrix nicht erreichbar | Warnung, `vi = null`, Score ohne VI-Komponente | `partial` |
| DataForSEO nicht verfuegbar (MCP), kein CSV-Import | Warnung, Keyword-Komponenten = `null` | `partial` |
| DataForSEO nicht verfuegbar (MCP), CSV vorhanden | CSV-Fallback, `source_notes` eintragen | `partial` |
| Beide Datenquellen nicht verfuegbar | Eintrag mit `score: null`, `status: "partial"`, `data_quality: "poor"` | `partial` |
| `history.ndjson` corrupt | Warnung, kein Delta-Report, aktueller Eintrag wird geschrieben | `partial` |
| `befund.json` fehlt | Warnung, kein Baseline fuer Keyword-Stabilitaet | `partial` |
| Lock-Timeout 30s | Fehler eintragen (Exit Code 3), Abbruch | `failed` |
| Symlink im Cache-Pfad | Fehler eintragen (Exit Code 2), Abbruch | `failed` |
| Weniger als 2 Score-Komponenten verfuegbar | `score: null`; Eintrag trotzdem schreiben | `partial` |

Wichtig: Falls keine aktuellen Daten vorhanden sind (alle Quellen nicht erreichbar), wird trotzdem ein Eintrag mit `status: "partial"` und `data_quality: "poor"` geschrieben. Der Zeitstempel allein sichert die Zeitreihe.

## Validierungsregeln

- `score`: 0–100 oder `null`
- `phase`: `R1 | R2 | R3 | R4 | R5 | null`
- `vi`: > 0 oder `null`
- Jede NDJSON-Zeile mit `\n` terminiert und als JSON parsebar
- `schema_version` muss `"2.0"` sein
- `run_id` muss gesetzt und non-empty sein
- `issue_data_fresh` muss Boolean sein
- `component_scores` muss fuer alle verfuegbaren Komponenten gesetzt sein
- Gewichte in `component_scores` muessen sich auf 1.0 addieren (normalisiert)
- `data_quality`: `good | partial | poor`
- `confidence`: `high | medium | low | none`

## Graceful-Degradation-Regeln

| Szenario | Verhalten |
|---------|-----------|
| Nur VI verfuegbar | Score aus 1 Komponente → `score: null` |
| VI + Keywords verfuegbar | Score aus 2–3 Komponenten → `score` berechnen |
| Alle Quellen fehlen | `score: null`; Eintrag trotzdem schreiben |
| `issue_data_fresh = false` | `issue_reduction = null`; aus Score-Gewichten herausrechnen |
| Erste Messung (kein Baseline) | `quick_win_progress = null`; aus Score herausrechnen |

## Change History Integration

`recovery-monitor` integriert die Change-History (`change-history.ndjson`) um den Effekt von Live-Aenderungen zu messen. Diese Integration ist read-only — der Monitor schreibt nicht in die Change-History.

### Lese-Pfad

```
~/.cache/seo-rescue/{slug}/change-history.ndjson
~/.cache/seo-rescue/{slug}/snapshots/cms-slots/*.json (read-only references)
```

### Was der Monitor mit Change-History tut

1. **Effekt-Tracking pro Change**: Fuer jeden Change-Eintrag mit `decision: "observe"` oder `decision: "keep"` aus den letzten 28 Tagen, prueft der Monitor ob der erwartete Effekt eingetreten ist.

2. **Effekt-Metriken**:
   - URL-Status live nach 7d / 14d / 28d (sollte konsistent mit `post_checks` sein)
   - Keyword-Bewegung der betroffenen URL (DataForSEO ranked_keywords delta)
   - Click/Impression-Trend (GSC, falls verfuegbar)
   - Inlink-Anzahl-Trend (Screaming Frog, falls neuer Crawl vorhanden)

3. **Anomalie-Erkennung**:
   - Wenn eine Change live ist aber URL plotzlich 404 zeigt → `unexpected_revert` Anomaly
   - Wenn ein 301 plotzlich 200 zeigt (Redirect verloren) → `redirect_lost` Anomaly
   - Wenn Canonical sich aendert → `canonical_drift` Anomaly
   - Wenn ein deaktivierter DreiscSeo Redirect wieder aktiv wird → `dreiscseo_reactivated` Anomaly

4. **Audit-Gap-Erkennung**:
   - Wenn change-history.ndjson fehlt → flagge im Monitor-Eintrag `change_history_present: false`
   - Wenn neue Aenderungen sichtbar via API updatedAt aber nicht in change-history → `audit_gap: untracked_change`

### Monitor-Output-Erweiterung

```json
{
  "change_effects": [
    {
      "change_id": "change-001",
      "url": "/affected-url/",
      "days_since_change": 7,
      "expected_status": 301,
      "current_status": 301,
      "effect_observed": "consistent_with_plan",
      "anomalies": []
    }
  ],
  "audit_health": {
    "change_history_present": true,
    "total_tracked_changes_28d": 12,
    "untracked_changes_detected": 0,
    "anomalies_detected": 0
  }
}
```

### Trigger fuer Rollback-Empfehlung

Der Monitor empfiehlt einen Rollback, wenn:
- Eine Change live ist UND eine Anomaly entdeckt wurde
- Die URL hat seit der Change Keyword-Verluste >20% (DataForSEO)
- Die URL hat seit der Change Click-Verluste >20% (GSC)
- Die URL zeigt unerwartete Status-Codes

Der Monitor schreibt selbst nichts zurueck — er flagged nur. Rollback bleibt eine manuelle Operator-Entscheidung mit explizitem Approval per `SAFE_LIVE_CHANGE_RULES.md`.

## Referenzen

- `scripts/recovery-monitor.js` — Score-Berechnung + Delta-Report; deterministischer Score-Algorithmus
- `schemas/history.schema.json` — Output-Schema
- `schemas/recovery-gate.schema.json` — Gate-State-Schema (`recovery-gate.json`)
- `references/SEO_CHANGE_HISTORY.md` — Change-History NDJSON Format
- `references/SEO_CHANGE_GOVERNOR.md` — Governance Rules
- `references/SEO_SETTLEMENT_GATE.md` — Settlement-Gate-Definition, Exceptions, Unlock-Kriterien
- `lib/safe.js` — `normalizeDomain()`, `safeSlug()`, `ensureDomainDir()`, `acquireLock()`, `releaseLock()`, `atomicWriteJSON()`, `readChangeHistory()` (neu)
