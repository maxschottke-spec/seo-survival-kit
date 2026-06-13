# L4a Stage-State-Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `recovery-diagnose` überlagert die rohe VI-Trend-Stage mit einer State-Machine (active-update-window + post-update-settlement Freeze, Hard-R1-Re-Entry) im neuen `stage_status`-Feld, markiert `experimental_n1`.

**Architecture:** Schema-Erweiterung (`befund.schema.json`) + neue Prosa-Logik im Pure-Markdown-Command `recovery-diagnose.md` + Doku-Sektion in `RECOVERY_SYSTEM.md`. Verifikation wie L1: `plugin validate`, JSON-Parse, Fixture + zero-dep Invarianten-Check, 55er-Suite. Additiv — `recovery_stage_estimate` bleibt der rohe Wert.

**Tech Stack:** JSON Schema (draft 2020-12), Markdown, Node.js (zero-dep Check), `claude plugin validate`.

**Branch:** `feature/l4a-stage-state-machine` (existiert, Spec committet `4703b13`).

**Spec:** `docs/specs/2026-06-13-l4a-stage-state-machine-design.md`

---

### Task 1: Schema — `stage_status` in befund.schema.json

**Files:**
- Modify: `plugins/seo-rescue/schemas/befund.schema.json` (nach `pre_hit_baseline`, ~Z.119)

- [ ] **Step 1: Property einhängen**

Ersetze exakt (Ende von `pre_hit_baseline` + schließende Klammern):

```json
        "recovery_vs_baseline_pct": { "type": ["number", "null"] }
      }
    }
  }
}
```

durch:

```json
        "recovery_vs_baseline_pct": { "type": ["number", "null"] }
      }
    },
    "stage_status": {
      "type": "object",
      "description": "Stage state machine (Lesson 4a, multi-update-sequence). EXPERIMENTAL N=1. Overlays freeze/re-entry rules on the raw recovery_stage_estimate.",
      "required": ["stage", "progression_allowed", "maturity"],
      "properties": {
        "stage": { "type": "string", "enum": ["R1", "R2", "R3", "R4", "R5"] },
        "raw_stage": { "type": ["string", "null"], "enum": ["R1", "R2", "R3", "R4", "R5", null] },
        "progression_allowed": { "type": "boolean" },
        "frozen_reason": { "type": ["string", "null"], "enum": ["active_update_window", "post_update_settlement", null] },
        "re_entry_detected": { "type": "boolean" },
        "re_entry_from": { "type": ["string", "null"], "enum": ["R1", "R2", "R3", "R4", "R5", null] },
        "active_update": { "type": ["string", "null"] },
        "days_since_rollout_end": { "type": ["integer", "null"] },
        "maturity": { "type": "string", "enum": ["experimental_n1"] }
      }
    }
  }
}
```

Edit chirurgisch — **nie** `json.dump`. `stage_status` NICHT in Top-Level-`required`.

- [ ] **Step 2: JSON-Parse-Check**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node -e "JSON.parse(require('fs').readFileSync('plugins/seo-rescue/schemas/befund.schema.json','utf8')); console.log('OK: valid JSON')"
```
Expected: `OK: valid JSON`

- [ ] **Step 3: Property-Präsenz verifizieren**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node -e '
const s=JSON.parse(require("fs").readFileSync("plugins/seo-rescue/schemas/befund.schema.json","utf8"));
const p=s.properties.stage_status;
console.log(p && p.required.join(",")==="stage,progression_allowed,maturity" && p.properties.stage.enum.length===5 ? "OK" : "FAIL");
'
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/schemas/befund.schema.json
git commit -m "feat(schema): add stage_status to befund.schema (L4a, experimental_n1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Fixture + zero-dep Invarianten-Check

**Files:**
- Create: `plugins/seo-rescue/test-fixtures/ecommerce-recovery/befund-with-stage-status.json`
- Create: `plugins/seo-rescue/test-fixtures/ecommerce-recovery/stage-status.test.js`

- [ ] **Step 1: Fixture anlegen (Re-Entry + Settlement-Freeze-Fall)**

Erstelle `plugins/seo-rescue/test-fixtures/ecommerce-recovery/befund-with-stage-status.json`:

```json
{
  "schema_version": "2.0",
  "run_id": "diag-fixture1-1718280000000",
  "status": "complete",
  "data_quality": "partial",
  "confidence": "medium",
  "providers_used": ["sistrix", "core_updates_md"],
  "missing_capabilities": [],
  "input_domain": "example.com",
  "domain": "example.com",
  "canonical_domain": null,
  "slug": "example-com",
  "timestamp": "2026-06-13T10:00:00Z",
  "warnings": ["stage-re-entry: frischer Hit hat Stage von R3 auf R1 zurueckgesetzt"],
  "errors": [],
  "source_notes": [],
  "vi_current": 0.108,
  "vi_peak": 0.215,
  "vi_drop_pct": -49.8,
  "vi_trend_4w_pct": -22.0,
  "vi_trend_12w_pct": -31.0,
  "core_update_correlation": "high",
  "core_update_name": "May 2026 Core Update",
  "keywords_total": 890,
  "position_distribution": { "t3": 8, "t10": 42, "t20": 110, "t50": 380, "t100": 890 },
  "quick_wins": [],
  "top_losers": [],
  "backlink_profile": null,
  "diagnosis": "core-update",
  "severity": "high",
  "recovery_stage_estimate": "R3",
  "settlement_gate_status": { "active": false },
  "summary_de": "Frischer Core-Update-Hit hat die zuvor erreichte Stage R3 zurueckgeworfen; Stage-Progression ist waehrend des Settlements eingefroren.",
  "stage_status": {
    "stage": "R1",
    "raw_stage": "R3",
    "progression_allowed": false,
    "frozen_reason": "post_update_settlement",
    "re_entry_detected": true,
    "re_entry_from": "R3",
    "active_update": null,
    "days_since_rollout_end": 11,
    "maturity": "experimental_n1"
  }
}
```

- [ ] **Step 2: Invarianten-Check schreiben**

Erstelle `plugins/seo-rescue/test-fixtures/ecommerce-recovery/stage-status.test.js`:

```js
'use strict';
// Zero-dependency structural + invariant check for the L4a stage_status befund field.
const fs = require('fs');
const path = require('path');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'befund.schema.json'), 'utf8'));
const befund = JSON.parse(fs.readFileSync(path.join(__dirname, 'befund-with-stage-status.json'), 'utf8'));

const def = schema.properties.stage_status;
const obj = befund.stage_status;

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name); failed++; }
}

check('schema defines stage_status as object', def && def.type === 'object');
check('stage_status NOT in top-level required', !(schema.required || []).includes('stage_status'));
check('fixture has stage_status', !!obj);

for (const key of def.required) {
  check('required key present: ' + key, obj && Object.prototype.hasOwnProperty.call(obj, key));
}

check('stage in enum', def.properties.stage.enum.includes(obj.stage));
check('frozen_reason in enum', def.properties.frozen_reason.enum.includes(obj.frozen_reason));
check('maturity is experimental_n1', obj.maturity === 'experimental_n1');

// Invariants (the L4a state-machine contract)
check('re_entry_detected => stage R1', !obj.re_entry_detected || obj.stage === 'R1');
check('frozen_reason set => progression not allowed', obj.frozen_reason === null || obj.progression_allowed === false);
check('progression allowed => frozen_reason null', !obj.progression_allowed || obj.frozen_reason === null);

console.log('\n' + (failed === 0 ? 'PASS: stage_status fixture conforms + invariants hold' : 'FAIL: ' + failed + ' check(s) failed'));
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 3: Check ausführen**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/stage-status.test.js
```
Expected: alle `✓`, `PASS: stage_status fixture conforms + invariants hold`, Exit 0.

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/test-fixtures/ecommerce-recovery/befund-with-stage-status.json plugins/seo-rescue/test-fixtures/ecommerce-recovery/stage-status.test.js
git commit -m "test(L4a): fixture + zero-dep invariant check for stage_status

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: recovery-diagnose.md — stage_status-Berechnung (Schritt 10)

**Files:**
- Modify: `plugins/seo-rescue/commands/recovery-diagnose.md` (Schritt 10, nach der Stage-Tabelle ~Z.332, vor „Deutschsprachige Zusammenfassung")

- [ ] **Step 1: stage_status-Logik nach der Stage-Tabelle einfügen**

Ersetze exakt:

```
| `null` | Nicht bestimmbar (VI-Daten fehlen) |

**Deutschsprachige Zusammenfassung (`summary_de`):**
```

durch:

````
| `null` | Nicht bestimmbar (VI-Daten fehlen) |

**Stage-State-Machine (`stage_status`, experimental, N=1):**

Überlagert die rohe `recovery_stage_estimate` mit Freeze-/Re-Entry-Regeln (Lesson 4a). Markiert `maturity: "experimental_n1"`. Liest die Rollout-Fenster (Start/Ende) aus `../../references/CORE_UPDATES.md` — dieselbe Datei wie Schritt 8.

1. **Kein/veraltetes CORE_UPDATES.md** (Datei fehlt oder > 90 Tage alt): keine Freezes — `stage = recovery_stage_estimate`, `raw_stage = recovery_stage_estimate`, `progression_allowed: true`, `frozen_reason: null`, `re_entry_detected: false`, `re_entry_from: null`, `active_update: null`, `days_since_rollout_end: null`, `maturity: "experimental_n1"`. Fertig.
2. **active_update_window:** Liegt das heutige Datum innerhalb [Rollout-Start, Rollout-Ende] eines Eintrags → `frozen_reason: "active_update_window"`, `progression_allowed: false`, `active_update` = Update-Name.
3. **post_update_settlement:** sonst, liegt heute in (Rollout-Ende, Rollout-Ende + 28 Tage] des jüngsten Eintrags → `frozen_reason: "post_update_settlement"`, `progression_allowed: false`, `days_since_rollout_end` = Tage seit Rollout-Ende. Sonst `frozen_reason: null`, `progression_allowed: true`.
4. **Re-Entry:** endete das jüngste Update ≤ 28 Tage vor heute UND `vi_trend_4w_pct < -10` → `re_entry_detected: true`, `re_entry_from` = `recovery_stage_estimate`, effektive `stage = "R1"`. Sonst `re_entry_detected: false`, `re_entry_from: null`, `stage = recovery_stage_estimate`.
   (Re-Entry und Freeze können gleichzeitig gelten: `stage = "R1"`, `progression_allowed` bleibt `false`.)
5. `raw_stage` ist immer = `recovery_stage_estimate`.

Dies ist NICHT der Settlement Gate (§12a / `SEO_SETTLEMENT_GATE.md`) — jener ist operator-batch-getriggert und blockt Live-Writes; `stage_status` friert nur die Stage-Bewertung ein.

**Deutschsprachige Zusammenfassung (`summary_de`):**
````

- [ ] **Step 2: Verifizieren**

Run:
```bash
cd ~/Projekte/seo-survival-kit && grep -n "Stage-State-Machine\|active_update_window\|post_update_settlement\|Re-Entry" plugins/seo-rescue/commands/recovery-diagnose.md | head
```
Expected: die neue Sektion + die drei Regeln erscheinen.

- [ ] **Step 3: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/commands/recovery-diagnose.md
git commit -m "feat(recovery-diagnose): stage state-machine computation step (L4a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: recovery-diagnose.md — Output-Schema, Ausgabe, Validierung, Graceful

**Files:**
- Modify: `plugins/seo-rescue/commands/recovery-diagnose.md` (Pflichtfelder ~Z.400; Output-Beispiel ~Z.479; Ausgabe ~Z.493; Validierung ~Z.539; Graceful ~Z.552)

- [ ] **Step 1: Pflichtfelder-Block ergänzen**

Ersetze exakt:

```
  },
  "summary_de": "<deutschsprachige Zusammenfassung>"
}
```

durch:

```
  },
  "stage_status": {
    "stage": "R1 | R2 | R3 | R4 | R5",
    "raw_stage": "R1 | R2 | R3 | R4 | R5 | null",
    "progression_allowed": false,
    "frozen_reason": "active_update_window | post_update_settlement | null",
    "re_entry_detected": false,
    "re_entry_from": "R1 | R2 | R3 | R4 | R5 | null",
    "active_update": "<string|null>",
    "days_since_rollout_end": "<integer|null>",
    "maturity": "experimental_n1"
  },
  "summary_de": "<deutschsprachige Zusammenfassung>"
}
```

- [ ] **Step 2: Output-Schema-Beispiel ergänzen**

Ersetze exakt:

```
  "summary_de": "Die Domain verzeichnete einen VI-Drop von 49.8% korrelierend mit dem March 2024 Core Update. ..."
}
```

durch:

```
  "stage_status": {
    "stage": "R1",
    "raw_stage": "R2",
    "progression_allowed": false,
    "frozen_reason": "post_update_settlement",
    "re_entry_detected": true,
    "re_entry_from": "R2",
    "active_update": null,
    "days_since_rollout_end": 9,
    "maturity": "experimental_n1"
  },
  "summary_de": "Die Domain verzeichnete einen VI-Drop von 49.8% korrelierend mit dem March 2024 Core Update. ..."
}
```

- [ ] **Step 3: „Ausgabe an den User" um Stage-Zeile ergänzen**

Ersetze exakt:

```
7. **Pre-Hit-Baseline** (experimentell, nur falls `pre_hit_baseline.method != "unavailable"`): `Pre-Hit-Baseline: {value} {unit} ({method} aus {source}, N=1 experimentell) | Erholung vs. Peak: {recovery_vs_baseline_pct}%`. Bei `multi_update_erosion_detected = true` zusaetzlich: `⚠ Multi-Update-Erosion: stabile Phase vor Hit {erosion_vs_last_plateau_pct}% unter historischem Peak`
```

durch:

```
7. **Pre-Hit-Baseline** (experimentell, nur falls `pre_hit_baseline.method != "unavailable"`): `Pre-Hit-Baseline: {value} {unit} ({method} aus {source}, N=1 experimentell) | Erholung vs. Peak: {recovery_vs_baseline_pct}%`. Bei `multi_update_erosion_detected = true` zusaetzlich: `⚠ Multi-Update-Erosion: stabile Phase vor Hit {erosion_vs_last_plateau_pct}% unter historischem Peak`
8. **Stage-Status** (experimentell): `Stage: {stage_status.stage} (roh: {stage_status.raw_stage}) | Progression: {progression_allowed ? "erlaubt" : "eingefroren — " + frozen_reason}`. Bei `re_entry_detected = true` zusaetzlich: `⚠ Stage-Re-Entry: frischer Hit hat Stage von {re_entry_from} auf R1 zurueckgesetzt`
```

- [ ] **Step 4: „Naechster Schritt" auf Nummer 10 anheben**

Die Liste hat aktuell Punkt 8 = Settlement Gate, Punkt 9 = Naechster Schritt (nach L1). Der neue Stage-Status-Punkt (Step 3) belegt jetzt 8; Settlement Gate und Naechster Schritt rücken auf 9 bzw. 10. Ersetze exakt:

```
8. **Settlement Gate** (nur falls `settlement_gate_status.active = true`): `Settlement Gate: AKTIV bis {next_allowed_review_date} — read-only Diagnose erlaubt, Live-Aenderungen blockiert`
9. **Naechster Schritt:** Empfehle basierend auf der Diagnose das naechste /seo-rescue:-Command:
```

durch:

```
9. **Settlement Gate** (nur falls `settlement_gate_status.active = true`): `Settlement Gate: AKTIV bis {next_allowed_review_date} — read-only Diagnose erlaubt, Live-Aenderungen blockiert`
10. **Naechster Schritt:** Empfehle basierend auf der Diagnose das naechste /seo-rescue:-Command:
```

- [ ] **Step 5: Validierungsregeln ergänzen**

Ersetze exakt:

```
- `pre_hit_baseline.method`, `.source`, `.unit` muessen im jeweiligen Schema-Enum liegen
```

durch:

```
- `pre_hit_baseline.method`, `.source`, `.unit` muessen im jeweiligen Schema-Enum liegen
- `stage_status.maturity` muss `"experimental_n1"` sein
- `stage_status.re_entry_detected = true` ⇒ `stage_status.stage = "R1"`
- `stage_status.frozen_reason != null` ⇒ `stage_status.progression_allowed = false`
```

- [ ] **Step 6: Graceful-Degradation-Zeile ergänzen**

Ersetze exakt:

```
| Keine verwertbare Zeitreihe / CSV ohne `date`-Spalte / Reihe < 8 Perioden | `pre_hit_baseline.method = "unavailable"`, `.value = null`, Warnung; Diagnose laeuft normal weiter |
```

durch:

```
| Keine verwertbare Zeitreihe / CSV ohne `date`-Spalte / Reihe < 8 Perioden | `pre_hit_baseline.method = "unavailable"`, `.value = null`, Warnung; Diagnose laeuft normal weiter |
| CORE_UPDATES.md fehlt oder > 90 Tage alt | `stage_status` ohne Freezes: `progression_allowed = true`, `frozen_reason = null`, `re_entry_detected = false`, `stage = recovery_stage_estimate` |
```

- [ ] **Step 7: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/commands/recovery-diagnose.md
git commit -m "docs(recovery-diagnose): wire stage_status into output/validation/degradation (L4a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: RECOVERY_SYSTEM.md — §4c Stage State Machine

**Files:**
- Modify: `plugins/seo-rescue/references/RECOVERY_SYSTEM.md` (nach §4b, vor `## 5. Recovery Risk Engine`)

- [ ] **Step 1: Sektion einfügen**

Ersetze exakt:

```
**Abgrenzung:** Dieses Signal ist bisher reines Reporting im Feld `pre_hit_baseline`. Die R1–R5-Stage-Formel bleibt VI-Peak-basiert; die Umstellung der Stage-Logik auf baseline-relative Bewertung inkl. Stage-Re-Entry ist separat (Lesson 4).

---

## 5. Recovery Risk Engine
```

durch:

```
**Abgrenzung:** Dieses Signal ist bisher reines Reporting im Feld `pre_hit_baseline`. Die R1–R5-Stage-Formel bleibt VI-Peak-basiert; die Umstellung der Stage-Logik auf baseline-relative Bewertung inkl. Stage-Re-Entry ist separat (Lesson 4).

---

## 4c. Stage State Machine (experimental, N=1)

> **Maturity:** `experimental_n1` — abgeleitet aus einem einzigen Fall (case-001, Lesson 4). KEINE validierte Methode. Promotion erst nach N=2.

Die lineare R1→R5-Sequenz (§4) ist der Happy-Path. Bei Multi-Update-Sequenzen ist sie unvollständig: Schaden kann wiederkehren, während der Operator schon Erholung misst. Case-001 wurde als „Stage 3 stabil" bewertet — einen Tag später schloss ein neues Core Update seinen Rollout ab und warf die Site auf Stage 1.

`recovery-diagnose` (Schritt 10) überlagert die rohe Stage daher mit einer State-Machine und schreibt das Ergebnis nach `stage_status`:

- **active_update_window** — läuft heute ein Rollout (heute ∈ [Start, Ende] eines `CORE_UPDATES.md`-Eintrags), wird die Progression eingefroren (`progression_allowed: false`).
- **post_update_settlement** — bis 28 Tage nach Rollout-Ende des jüngsten Updates bleibt die Progression eingefroren; Google justiert nach, die Stage-Bewertung ist unzuverlässig.
- **Stage-Re-Entry** — ein frischer Major-Hit (jüngstes Update endete ≤ 28 Tage, VI-4-Wochen-Trend < −10 %) setzt die effektive Stage hart auf R1 zurück (`re_entry_detected`), statt die Erholung weiter hochzuzählen.

`recovery_stage_estimate` bleibt der rohe VI-Trend-Wert (`stage_status.raw_stage`); `stage_status.stage` ist der effektive Wert nach den Regeln.

**Abgrenzung zum Settlement Gate (§12a):** Der Settlement Gate ist operator-batch-getriggert und blockt Live-Writes. `post_update_settlement` ist rollout-getriggert und friert nur die Stage-Bewertung ein — kein Write-Block, andere Trigger.

**Noch offen (Lesson 4b):** Kumulative Schadens-Verfolgung über Update-Sequenzen, Multi-Hit-Progressions-Formel (≥ 2 Hits / 90 Tage) und ein „time-since-last-major-hit"-Gate.

---

## 5. Recovery Risk Engine
```

- [ ] **Step 2: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/references/RECOVERY_SYSTEM.md
git commit -m "docs(RECOVERY_SYSTEM): stage state-machine section 4c (L4a, experimental)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: CHANGELOG + Validierungs-Gate

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Added`)

- [ ] **Step 1: CHANGELOG-Eintrag**

Ersetze exakt:

```
### Added

- **L2 Quiet-Death-Detection**
```

durch:

```
### Added

- **L4a Stage-State-Machine** (Phase 2, experimental N=1) — `recovery-diagnose` overlays a stage state machine on the raw `recovery_stage_estimate`: it freezes stage progression during an active update rollout (`active_update_window`) or its 28-day settlement (`post_update_settlement`), and hard-resets the effective stage to R1 on a fresh major hit (`re_entry_detected`). New `stage_status` field in `befund.schema.json`, marked `maturity: experimental_n1`. Distinct from the §12a Settlement Gate (operator-batch write-block). Cumulative-damage / multi-hit formula is the follow-up slice (L4b).
- **L2 Quiet-Death-Detection**
```

- [ ] **Step 2: Alle Fixture-Checks + Regressions-Suite**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/stage-status.test.js | tail -1 && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/pre-hit-baseline.test.js | tail -1 && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/quiet-death-detect.test.js | tail -1 && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/lib-safe-primitives.test.js | tail -3
```
Expected: `PASS: stage_status ...`, `PASS: pre_hit_baseline ...`, `PASS: quiet-death ...`, `Passed: 55  Failed: 0  Total: 55`

- [ ] **Step 3: Plugin + Marketplace validieren**

Run:
```bash
cd ~/Projekte/seo-survival-kit && claude plugin validate plugins/seo-rescue && claude plugin validate .
```
Expected: zweimal `✔ Validation passed`

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add CHANGELOG.md
git commit -m "docs(changelog): note L4a stage-state-machine [Unreleased]

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (vom Plan-Autor)

**Spec-Coverage:**
- Spec „Komponente 1 — RECOVERY_SYSTEM §4c" → Task 5 ✓
- Spec „Komponente 2 — befund.schema stage_status" → Task 1 ✓
- Spec „Komponente 3 — recovery-diagnose Schritt 10 + Output/Ausgabe/Validierung/Graceful" → Task 3 + Task 4 ✓
- Spec „Abgrenzung §12a" → in Task 3 Step 1 (Prosa) + Task 5 (Sektion) ✓
- Spec „Testing" (Fixture, Invarianten-Check, plugin validate, 55er) → Task 2 + Task 6 ✓
- Spec „CHANGELOG" → Task 6 ✓
- Spec „Bewusst ausgeklammert" (plan/monitor-Wiring, L4b, R-Level-Formel, re_entry_from aus History) → keine Tasks, korrekt.

**Platzhalter-Scan:** keine TBD/TODO; alle Edits + Fixture + Test-Code vollständig. Konkrete Trigger (≤28 Tage, vi_trend_4w < −10, heute ∈ [Start,Ende]) ausgeschrieben.

**Typ-/Namens-Konsistenz:** `stage_status`-Feldnamen (`stage/raw_stage/progression_allowed/frozen_reason/re_entry_detected/re_entry_from/active_update/days_since_rollout_end/maturity`) durchgängig identisch in Task 1 (Schema), 2 (Fixture+Invarianten), 3 (Berechnungs-Prosa), 4 (Output/Ausgabe/Validierung). Enums konsistent: stage `R1..R5`, frozen_reason `active_update_window|post_update_settlement|null`, maturity `experimental_n1`. Invarianten in Task 2 (Test) == Validierungsregeln in Task 4 Step 5.
