---
description: "Audit all SEO changes made to a domain within a given period. Read-only audit_only mode."
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, mcp__*
---

# Recovery Audit

## Zweck

Auditiert alle SEO-Aenderungen an einer Domain innerhalb eines Zeitraums: Change-Inventar, fehlgeschlagene Versuche, unverifizierte Aenderungen, Risiko- und Approval-Compliance, Rollback-Readiness, Settlement-Gate-Status und Hypothesen-Registry. Read-only gegenueber dem Live-Shop — das Audit stellt fest, was passiert ist, und bewertet es; es aendert nichts.

## Change Governance

Mode: immer `audit_only`. Change Budget: 0. Keine Live-Shop-Writes. Schreibt nur Report-Artefakte nach `~/.cache/seo-rescue/{slug}/` (via `lib/safe.js`, siehe Schritt 9).

## Settlement Gate Awareness

Dieses Command ist read-only gegenueber dem Live-Shop — ein aktiver Settlement Gate (`references/SEO_SETTLEMENT_GATE.md`) blockiert es NIE. Sonderrolle: **`recovery-audit` ist der Writer der Gate-Datei** `~/.cache/seo-rescue/{slug}/recovery-gate.json` — alle anderen Commands (diagnose, plan, monitor, full) lesen sie nur. Die Gate-Detection selbst ist Teil des Ablaufs (Schritt 7).

## Trigger

```
/seo-rescue:recovery-audit <domain> [--days 14]
```

## Input-Kontrakt

| Feld | Quelle | Pflicht |
|------|--------|---------|
| `domain` | CLI-Argument | ja |
| `--days` | CLI-Flag | nein — Default: `14` |

`--days` definiert das Audit-Fenster: `period_end` = jetzt, `period_start` = jetzt minus `--days` Tage. Wird das Command vom Orchestrator (`recovery-full`) ohne Flag aufgerufen, gilt der Default 14.

## Ablauf

### Schritt 1: Domain normalisieren

Normalisiere den Input via `normalizeDomain()` aus `lib/safe.js` — gibt `input_domain`, `domain`, `canonical_domain`, `slug` zurueck.

### Schritt 2: Cache-Verzeichnis anlegen

`ensureDomainDir(slug)` — Modus 0700, Abbruch bei Symlink.

### Schritt 3: Run-ID generieren

Falls eine `run_id` vom Orchestrator (`recovery-full`) uebergeben wurde: diese unveraendert verwenden, KEIN eigenes Prefix erzeugen. Sonst generiere eine eindeutige Run-ID fuer diesen Lauf:

```bash
node -e "const { randomUUID } = require('crypto'); console.log('aud-' + randomUUID().slice(0,8) + '-' + Date.now())"
```

Speichere die Run-ID als `run_id`. Sie wird im Output-Schema mitgefuehrt.

### Schritt 4: Audit-Zeitraum bestimmen

`period_start` / `period_end` aus `--days` berechnen (Default 14) und im Output festhalten. Alle folgenden Schritte betrachten nur Aenderungen innerhalb dieses Fensters.

### Schritt 5: Change-History lesen oder rekonstruieren

Primaerquelle ist `~/.cache/seo-rescue/{slug}/change-history.ndjson`. Fehlt sie oder ist sie unvollstaendig, rekonstruiere aus diesen Quellen **in Prioritaetsreihenfolge**:

1. `~/.cache/seo-rescue/{slug}/change-history.ndjson` (primaer, audit-safe)
2. `~/.cache/seo-rescue/{slug}/snapshots/` (lokale CMS-Slot-Snapshots und andere Before/After-Artefakte; werden von externem Tooling erzeugt — read-if-present, fehlende Snapshots sind kein Fehler)
3. **Shopware-API-`updatedAt`-Felder** mit `--days`-Filter auf: `seo-url`, `category`, `product`, `cms-slot` (nicht zuverlaessig — siehe Audit-Gap-Marker), `system-config`, `dreisc-seo-redirect`
4. Shell-History / Claude-Conversation-Logs (falls zugreifbar)
5. Shopware-Ist-Zustand vs. bekannte Snapshots
6. Screaming-Frog-Crawl-Diffs (mehrere Crawls vergleichen, falls vorhanden)
7. Live-HTTP-Checks (aktueller Zustand)
8. DataForSEO- / Sistrix- / GSC-Snapshots
9. Manuelle Ableitung aus Operator-Gedaechtnis oder Notizen

**Rekonstruktions-Marker:** Jeder rekonstruierte Eintrag muss enthalten:

```json
{
  "reconstructed": true,
  "reconstruction_sources": ["..."],
  "reconstruction_confidence": "high|medium|low",
  "audit_source": "shopware_updatedAt_reconstruction"
}
```

Fehlt `change-history.ndjson` vollstaendig, setze im Audit-Output `"not_audit_safe_reconstruction": true`.

### Schritt 6: Audit-Felder erheben

Das Audit muss fuer jede erkannte Aenderung erfassen:

- Change-Inventar (Tabelle)
- Fehlgeschlagene Change-Versuche (API-500er, falsche Slugs)
- Unverifizierte Aenderungen (via API-State erkannt, aber nicht live-bestaetigt)
- Risiko-Bewertung (verbrauchte Risk Points gesamt)
- Approval-Compliance (Aenderungen ohne ordentliches Approval)
- Rollback-Readiness (Aenderungen ohne dokumentierten Rollback)
- **Erkannte Shopware-seo-url-Kollisionen** (Entities mit mehreren non-deleted Eintraegen pro foreignKey)
- **Erkannte DreiscSeo-301→404-Ketten**
- **Medical-/Compliance-Term-Flags**
- Empfehlungen (`keep | observe | fix | rollback | dev_ticket`)

### Schritt 7: Settlement-Gate-Detection

Das Audit muss erkennen:

- **Last Major Batch** — juengste Session, die die Trigger-Schwellen aus `references/SEO_SETTLEMENT_GATE.md` section 3 ueberschritten hat
- **Anzahl der Aenderungen** in diesem Batch
- **Verbrauchtes Change Budget** — Risk Points ueber den Batch summiert
- **Settlement-Gate-Status** — `active | ended | never_triggered`
- **Aktuelles Unlock-Level** — `blocked | partial | open` per `schemas/recovery-gate.schema.json`
- Ob aktuell weitere Live-Aenderungen erlaubt sind

Erkennt das Audit einen Major Batch, der nicht mit `triggered_settlement_gate: true` geloggt wurde:

1. Berechne `started_at`, `minimum_until`, `recommended_until`
2. Schreibe `~/.cache/seo-rescue/{slug}/recovery-gate.json` mit `settlement_gate_active: true` und rueckdatierten Werten — via `atomicWriteJSON()` unter Lock (siehe Schritt 9)
3. Appende ein `gate_activated`-Event an die `gate_history` der Gate-Datei (append-only, niemals bestehende Eintraege ueberschreiben)
4. Emittiere ein Finding `gate_activated_retroactively` mit Severity `high`

### Schritt 8: Hypothesis Registry aufbauen

Das Audit emittiert ein `hypothesis_registry`-Array. Fuer jede Ursachen-Attribution (bei erfolgreichen Aenderungen, fehlgeschlagenen Versuchen oder offenen Risiken) enthaelt die Registry einen Eintrag per `schemas/hypothesis-verification.schema.json`.

Das Audit selbst befoerdert keine Hypothese auf `verified` — es protokolliert nur den beobachteten Status:

- Change in `changes[]` mit dokumentierter Ursachen-Attribution, aber ohne Strong-Tier-Verifikationsquelle → Hypothese als `likely` erfassen, unabhaengig davon, ob die Aenderung erfolgreich wirkte
- Change mit zitierter Strong-Tier-Verifikation (File-Inspect, API-State, GSC URL Inspection, Staging-Reproduktion, Operator-/Developer-Review) → `verified` oder `fixed`, je nach Post-Deploy-Zustand
- `unverified_change` (Aenderung erfolgt, Ursache unklar) → `suspected`, mit beobachteter Evidenz
- Change in `changes[]` ohne jede Hypothesen-Verifikation deployed → zusaetzlich `audit_gap`-Eintrag mit Severity `high` und Marker `hypothesis_verification_missing`

Die Registry speist Downstream-Commands: `recovery-plan` liest sie, um zu bestimmen, welche geplanten Aktionen verifizierte Ursachen referenzieren (und damit live-fix-eligible sind) und welche nur suspected/likely referenzieren (und im Fix-Planning-Zustand bleiben muessen).

### Schritt 9: Outputs schreiben

Beide Artefakte via `lib/safe.js` schreiben — `acquireLock()` vor dem ersten Write, `atomicWriteJSON()` fuer JSON, `releaseLock()` danach; Abbruch bei Symlink im Cache-Pfad:

```
~/.cache/seo-rescue/{slug}/change-audit.json    (schema: seo-change-audit.schema.json)
~/.cache/seo-rescue/{slug}/change-audit.md      (menschenlesbarer Report)
```

Falls Schritt 7 die Gate-Datei geschrieben hat, geschieht das unter demselben Lock.

## Audit-Gap-Marker

Typische Luecken, die das Audit explizit flaggen muss:

| Marker | Beschreibung | Severity |
|---|---|---|
| `cms_slot_missing_snapshot` | CMS-Slot-PATCH via Crawl/State erkannt, aber kein Snapshot | high |
| `previous_session_not_available` | Fruehere Claude-Session hat keine geloggte History | medium |
| `dreiscseo_state_not_tracked` | DreiscSeo-Redirect-Aenderung ohne Log | medium |
| `shopware_api_no_updatedAt` | Entity exponiert `updatedAt` nicht zuverlaessig | medium |
| `manual_admin_change` | Aenderung via Shopware-Admin-UI, nicht API | high |
| `external_redirect_layer` | Nginx-/CDN-Regel ausserhalb von Shopware | high |
| `hypothesis_verification_missing` | Change ohne jede Hypothesen-Verifikation deployed (Schritt 8) | high |

## Output-Pfad

```
~/.cache/seo-rescue/{slug}/change-audit.json
~/.cache/seo-rescue/{slug}/change-audit.md
~/.cache/seo-rescue/{slug}/recovery-gate.json   (nur bei retroaktiver Gate-Aktivierung, Schritt 7)
```

## Output-Schema

Pflichtfelder per `schemas/seo-change-audit.schema.json`:

- `schema_version` (muss `"1.0.0"` sein)
- `run_id`
- `domain`
- `period_start`, `period_end`
- `status`
- `data_quality`
- `confidence`
- `not_audit_safe_reconstruction`
- `sources_checked` (Array konsultierter Quellen)
- `missing_sources` (Array nicht verfuegbarer Quellen)
- `changes` (Array der Change-Log-Eintraege)
- `failed_change_attempts` (API-Fehler, falsche Slugs etc.)
- `unverified_changes` (erkannt, aber nicht live-bestaetigt)
- `audit_gaps` (explizite Gap-Marker mit Severity)
- `findings` (synthetisierte Beobachtungen)
- `risks` (aktuelle Risiken, severity-klassifiziert)
- `tickets` (erzeugte Dev-/Operator-Tickets)
- `monitoring_plan` (Post-Audit-Monitoring-Plan)
- `rollback_matrix` (Rollback-Methode pro Change)
- `summary` (Aggregat-Statistik)
- `settlement_gate` (Settlement-Gate-Status-Block per `schemas/recovery-gate.schema.json`)
- `hypothesis_registry` (Array per `schemas/hypothesis-verification.schema.json`, ein Eintrag pro identifizierter Root Cause; Pflicht fuer jeden Change in `changes[]` oder `unverified_changes[]` mit Ursachen-Attribution)

Der `settlement_gate`-Block im Audit-Output:

```json
{
  "settlement_gate": {
    "settlement_gate_active": true,
    "started_at": "2026-05-27T19:43:00Z",
    "minimum_until": "2026-06-02T00:00:00Z",
    "recommended_until": "2026-06-06T00:00:00Z",
    "unlock_status": "blocked",
    "missing_unlock_criteria": [
      "time_minimum_until_passed",
      "gsc_post_batch_pull",
      "screaming_frog_post_batch_crawl",
      "re_evaluation_report_written"
    ],
    "allowed_actions": [
      "read_only_analysis",
      "rollback_plan",
      "schema_draft",
      "briefing"
    ],
    "blocked_actions": [
      "title_rewrite",
      "new_internal_links",
      "cms_slot_patch",
      "category_deactivation",
      "linkblock_reduction"
    ],
    "next_allowed_review_date": "2026-06-06",
    "retroactively_activated": false
  }
}
```

Dieser Block ist auch dann Pflicht, wenn kein Settlement Gate aktiv ist. In dem Fall sind alle Flags `false` / `null` / `"never_triggered"`, und das Audit haelt explizit fest, dass im Zeitraum kein Major Batch erkannt wurde.

## Ausgabe an den User

Nach erfolgreichem Schreiben der Artefakte, gib aus:

1. **Audit-Zusammenfassung** — Zeitraum, Anzahl Changes / failed attempts / unverified changes, verbrauchte Risk Points, `data_quality` und `confidence`.
2. **Settlement-Gate-Status** — eine Zeile: aktiv/ended/never_triggered, `unlock_status`, `next_allowed_review_date`; bei retroaktiver Aktivierung (Schritt 7) deutlich hervorheben: `Settlement Gate RETROAKTIV AKTIVIERT — Finding gate_activated_retroactively (high)`.
3. **Top-Findings und -Risiken** — die severity-hoechsten Eintraege aus `findings` und `risks`, plus alle `audit_gaps` mit Severity `high`.
4. **Empfehlungsverteilung** — Anzahl pro `keep | observe | fix | rollback | dev_ticket`.
5. **Pfade** der geschriebenen Artefakte (`change-audit.json`, `change-audit.md`, ggf. `recovery-gate.json`).

## Fehlerbehandlung

| Fehler | Verhalten | Status |
|--------|----------|--------|
| `change-history.ndjson` fehlt vollstaendig | Rekonstruktion per Schritt 5, `not_audit_safe_reconstruction: true`, Warnung | `partial` |
| `change-history.ndjson` corrupt (Zeile nicht parsebar) | Parsebare Zeilen verwenden, korrupte als `audit_gap` flaggen | `partial` |
| Shopware-API nicht erreichbar | Rekonstruktionsquelle 3 entfaellt, `missing_sources` eintragen | `partial` |
| Keine einzige Quelle verfuegbar | Leeres Audit mit `data_quality: "poor"`, `confidence: "none"`, Gap-Markern | `partial` |
| `recovery-gate.json` corrupt | Warnung, Gate-Status als `never_triggered` mit `audit_gap`-Eintrag behandeln, Datei NICHT ueberschreiben | `partial` |
| Lock-Timeout 30s | Fehler eintragen, Abbruch, keine Artefakte | `failed` |
| Symlink im Cache-Pfad | Fehler eintragen, Abbruch | `failed` |

## Validierungsregeln

- `schema_version` muss `"1.0.0"` sein
- `run_id` muss gesetzt und non-empty sein
- `period_start` < `period_end`; Fenster entspricht `--days`
- `settlement_gate`-Block immer vorhanden (auch bei `never_triggered`)
- Feldnamen des Gate-Blocks exakt per `schemas/recovery-gate.schema.json` (`settlement_gate_active`, `allowed_actions`, `blocked_actions`, `gate_history` in der Gate-Datei)
- Jeder rekonstruierte Change traegt die Rekonstruktions-Marker aus Schritt 5
- Jeder Change mit Ursachen-Attribution hat einen `hypothesis_registry`-Eintrag
- `data_quality`: `good | partial | poor`
- `confidence`: `high | medium | low | none`

## Graceful-Degradation-Regeln

| Szenario | Verhalten |
|---------|-----------|
| Change-History vollstaendig vorhanden | Normales Audit, `not_audit_safe_reconstruction: false` |
| Change-History unvollstaendig | Rekonstruktion ergaenzt, Marker pro Eintrag |
| Change-History fehlt komplett | Volle Rekonstruktion, `not_audit_safe_reconstruction: true` |
| Keine Quelle verfuegbar | Leeres, sauberes Audit mit Gap-Markern — der Zeitstempel und die dokumentierte Luecke haben eigenen Audit-Wert |
| `snapshots/` fehlt | Read-if-present — kein Fehler, Quelle entfaellt still |
| Gate-Datei fehlt | Gate-Status `never_triggered`; Detection in Schritt 7 kann sie neu anlegen |

## Integration mit anderen Commands

- `recovery-plan` referenziert Audit-Findings bei der Planung der naechsten Schritte und liest die `hypothesis_registry` (live-fix-eligible vs. fix-planning)
- `recovery-full` muss `recovery-audit` VOR jeder Aenderungsplanung ausfuehren
- `recovery-monitor` prueft mit der Audit-Baseline, ob Aenderungen die erwarteten Effekte zeigen, und liest die vom Audit geschriebene Gate-Datei

## Referenzen

- `references/SEO_CHANGE_HISTORY.md` — NDJSON-Logging-Spezifikation
- `references/SHOPWARE_SEO_PATTERNS.md` — Shopware-spezifische Rekonstruktionsmuster
- `references/DREISCSEO_PATTERNS.md` — DreiscSeo-Redirect-Audit-Muster
- `references/SEO_SETTLEMENT_GATE.md` — Settlement Gate, Major-Batch-Trigger-Schwellen, Unlock-Kriterien
- `references/HYPOTHESIS_VERIFICATION_GATE.md` — Hypothesen-Statusdefinitionen und Verifikationsquellen-Hierarchie
- `schemas/seo-change-audit.schema.json` — Output-JSON-Schema
- `schemas/recovery-gate.schema.json` — Gate-State-Schema
- `schemas/hypothesis-verification.schema.json` — Hypothesen-Registry-Eintrag-Schema
- `lib/safe.js` — `normalizeDomain()`, `safeSlug()`, `ensureDomainDir()`, `acquireLock()`, `releaseLock()`, `atomicWriteJSON()`, `readChangeHistory()`
