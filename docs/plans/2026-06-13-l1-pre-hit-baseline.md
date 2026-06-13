# L1 Pre-Hit-Baseline-Selektion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `recovery-diagnose` wählt die Recovery-Baseline als historisches Peak-Plateau (statt letztes stabiles Plateau), erkennt Multi-Update-Erosion und meldet beides im neuen, als `experimental_n1` markierten Befund-Feld `pre_hit_baseline`.

**Architecture:** Schema-Erweiterung (`befund.schema.json`) + neuer Ablauf-Schritt im Pure-Markdown-Command `recovery-diagnose.md` + kurze Doku-Sektion in `RECOVERY_SYSTEM.md`. Verifikation via `claude plugin validate`, JSON-Parse-Check, und ein zero-dep Node-Struktur-Check gegen eine neue Fixture. Die R1–R5-Stage-Formel bleibt `vi_peak`-basiert (L4-Territorium).

**Tech Stack:** JSON Schema (draft 2020-12), Markdown (Command-Spec), Node.js (zero-dep Fixture-Check), `claude plugin validate`.

**Branch:** `feature/l1-pre-hit-baseline` (existiert, Spec committet `1b587fd`).

**Spec:** `docs/specs/2026-06-13-l1-pre-hit-baseline-design.md`

---

### Task 1: Schema — `pre_hit_baseline` in befund.schema.json

**Files:**
- Modify: `plugins/seo-rescue/schemas/befund.schema.json` (nach `settlement_gate_status`, ~Z.102)

- [ ] **Step 1: Property einhängen**

Ersetze exakt (Z.102–104, Ende von `settlement_gate_status` + schließende Klammern):

```json
      }
    }
  }
}
```

durch:

```json
      }
    },
    "pre_hit_baseline": {
      "type": "object",
      "description": "Pre-hit recovery baseline selection (Lesson 1, multi-update-sequence). EXPERIMENTAL N=1 — historical peak plateau, not last stable phase. Not used in the R1-R5 stage formula yet (see L4).",
      "required": ["value", "method", "source", "maturity"],
      "properties": {
        "value": { "type": ["number", "null"] },
        "unit": { "type": "string", "enum": ["clicks_per_week", "visibility_index"] },
        "method": { "type": "string", "enum": ["historical_peak", "last_plateau", "unavailable"] },
        "source": { "type": "string", "enum": ["gsc_csv", "sistrix_vi", "none"] },
        "maturity": { "type": "string", "enum": ["experimental_n1"] },
        "window_weeks": { "type": ["integer", "null"] },
        "window_limited": { "type": "boolean" },
        "erosion_vs_last_plateau_pct": { "type": ["number", "null"] },
        "multi_update_erosion_detected": { "type": "boolean" },
        "recovery_vs_baseline_pct": { "type": ["number", "null"] }
      }
    }
  }
}
```

Edit chirurgisch per Edit-Tool — **nie** per `json.dump`. `pre_hit_baseline` NICHT in das Top-Level-`required`-Array aufnehmen (graceful degradation).

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
const p=s.properties.pre_hit_baseline;
console.log(p && p.required.join(",")==="value,method,source,maturity" && p.properties.maturity.enum[0]==="experimental_n1" ? "OK" : "FAIL");
'
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/schemas/befund.schema.json
git commit -m "feat(schema): add pre_hit_baseline to befund.schema (L1, experimental_n1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Test-Fixture + zero-dep Struktur-Check

**Files:**
- Create: `plugins/seo-rescue/test-fixtures/ecommerce-recovery/befund-with-baseline.json`
- Create: `plugins/seo-rescue/test-fixtures/ecommerce-recovery/pre-hit-baseline.test.js`

- [ ] **Step 1: Fixture anlegen**

Erstelle `plugins/seo-rescue/test-fixtures/ecommerce-recovery/befund-with-baseline.json` (minimaler valider Befund mit Erosions-Fall):

```json
{
  "schema_version": "2.0",
  "run_id": "diag-fixture0-1718280000000",
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
  "warnings": ["pre_hit_baseline: stabile Phase vor Hit ist selbst >15% unter historischem Peak — Multi-Update-Erosion"],
  "errors": [],
  "source_notes": [],
  "vi_current": 0.108,
  "vi_peak": 0.215,
  "vi_drop_pct": -49.8,
  "vi_trend_4w_pct": 1.2,
  "vi_trend_12w_pct": -8.4,
  "core_update_correlation": "high",
  "core_update_name": "May 2026 Core Update",
  "keywords_total": 890,
  "position_distribution": { "t3": 8, "t10": 42, "t20": 110, "t50": 380, "t100": 890 },
  "quick_wins": [],
  "top_losers": [],
  "backlink_profile": null,
  "diagnosis": "core-update",
  "severity": "high",
  "recovery_stage_estimate": "R2",
  "settlement_gate_status": { "active": false },
  "summary_de": "Core-Update-Schaden mit Multi-Update-Erosion: die stabile Phase vor dem Hit lag bereits 18% unter dem historischen Peak.",
  "pre_hit_baseline": {
    "value": 1250,
    "unit": "clicks_per_week",
    "method": "historical_peak",
    "source": "gsc_csv",
    "maturity": "experimental_n1",
    "window_weeks": 68,
    "window_limited": false,
    "erosion_vs_last_plateau_pct": -18,
    "multi_update_erosion_detected": true,
    "recovery_vs_baseline_pct": -37
  }
}
```

- [ ] **Step 2: Check-Skript schreiben (zero-dep)**

Erstelle `plugins/seo-rescue/test-fixtures/ecommerce-recovery/pre-hit-baseline.test.js`:

```js
'use strict';
// Zero-dependency structural check for the L1 pre_hit_baseline befund field.
// Validates the fixture against the schema's pre_hit_baseline contract without ajv.
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'befund.schema.json');
const fixturePath = path.join(__dirname, 'befund-with-baseline.json');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const befund = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const def = schema.properties.pre_hit_baseline;
const obj = befund.pre_hit_baseline;

let failed = 0;
function check(name, cond) {
  if (cond) { console.log('  ✓ ' + name); }
  else { console.log('  ✗ ' + name); failed++; }
}

check('schema defines pre_hit_baseline as object', def && def.type === 'object');
check('pre_hit_baseline NOT in top-level required', !(schema.required || []).includes('pre_hit_baseline'));
check('fixture has pre_hit_baseline', !!obj);

for (const key of def.required) {
  check('required key present: ' + key, obj && Object.prototype.hasOwnProperty.call(obj, key));
}

const enums = { method: def.properties.method.enum, source: def.properties.source.enum, maturity: def.properties.maturity.enum, unit: def.properties.unit.enum };
for (const [key, allowed] of Object.entries(enums)) {
  if (obj && obj[key] !== undefined) {
    check(key + ' in enum', allowed.includes(obj[key]));
  }
}

check('maturity is experimental_n1', obj && obj.maturity === 'experimental_n1');
check('erosion < -15 implies multi_update_erosion_detected', !(obj && obj.erosion_vs_last_plateau_pct < -15) || obj.multi_update_erosion_detected === true);
check('value null implies method unavailable', !(obj && obj.value === null) || obj.method === 'unavailable');

console.log('\n' + (failed === 0 ? 'PASS: pre_hit_baseline fixture conforms' : 'FAIL: ' + failed + ' check(s) failed'));
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 3: Check ausführen**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/pre-hit-baseline.test.js
```
Expected: alle `✓`, letzte Zeile `PASS: pre_hit_baseline fixture conforms`, Exit-Code 0.

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/test-fixtures/ecommerce-recovery/befund-with-baseline.json plugins/seo-rescue/test-fixtures/ecommerce-recovery/pre-hit-baseline.test.js
git commit -m "test(L1): fixture + zero-dep structural check for pre_hit_baseline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: recovery-diagnose.md — neuer Ablauf-Schritt + Renumber

**Files:**
- Modify: `plugins/seo-rescue/commands/recovery-diagnose.md` (neuer Schritt vor Z.281; Renumber Z.281 + Z.327)

- [ ] **Step 1: Neuen Schritt 9 einfügen + Diagnosis-Klassifikation auf 10 umbenennen**

Ersetze exakt:

```
### Schritt 9: Diagnosis-Klassifikation
```

durch:

````
### Schritt 9: Pre-Hit-Baseline-Selektion (experimental, N=1)

Bestimmt die Recovery-Baseline als **historisches Peak-Plateau** statt als letztes stabiles Plateau vor dem Hit. Ergebnis geht ins Feld `pre_hit_baseline`. **Markiert als `maturity: "experimental_n1"`** — N=1-Heuristik (Lesson 1, case-001), KEINE validierte Metrik. Verändert die Stage-Schätzung (Schritt 10) NICHT.

1. **Zeitreihe wählen (source-adaptiv, längste verfügbare Reihe):**
   - GSC-CSV-Import `~/.cache/seo-rescue/{slug}/imports/gsc-performance.csv` mit Spalten `date,clicks` vorhanden → wöchentliche Klick-Reihe über den vollen CSV-Range. `source: "gsc_csv"`, `unit: "clicks_per_week"`.
   - sonst die Sistrix-VI-Snapshots aus Schritt 4 → `source: "sistrix_vi"`, `unit: "visibility_index"`.
   - sonst keine Reihe → `pre_hit_baseline: { "value": null, "unit": "clicks_per_week", "method": "unavailable", "source": "none", "maturity": "experimental_n1", "window_weeks": null, "window_limited": false, "erosion_vs_last_plateau_pct": null, "multi_update_erosion_detected": false, "recovery_vs_baseline_pct": null }`. Warnung eintragen. Weiter mit Schritt 10.
2. **Mindestlänge:** Hat die Reihe < 8 Perioden, ist keine belastbare Plateau-Erkennung möglich → wie der „keine Reihe"-Fall behandeln (`method: "unavailable"`).
3. **Peak-Plateau bestimmen:** Bilde den rollierenden 4-Perioden-Mittelwert über die Reihe. `value` = Maximum dieses Mittelwerts (höchstes *gehaltenes* Niveau, kein Einzel-Spike). `method: "historical_peak"`.
4. **Letztes stabiles Plateau vor jüngstem Hit:** Identifiziere den letzten signifikanten Drop (Periode-über-Periode-Rückgang > 15 % ODER ein in `../../references/CORE_UPDATES.md` dokumentiertes Update-Fenster). `last_stable_plateau` = Mittelwert der ~4 Perioden direkt davor.
5. **Erosion berechnen:** `erosion_vs_last_plateau_pct = round((last_stable_plateau - value) / value * 100)`. Ist der Wert `< -15`: `multi_update_erosion_detected: true`, Warnung `"pre_hit_baseline: stabile Phase vor Hit ist selbst >15% unter historischem Peak — Multi-Update-Erosion"` eintragen, und einen Satz dazu in `summary_de` aufnehmen. Sonst `false`.
6. **Fortschritt melden:** `recovery_vs_baseline_pct = round((current - value) / value * 100)`, wobei `current` der jüngste Reihen-Wert ist (jüngster Klick-Wochenwert bzw. `vi_current`). Reines Reporting.
7. **Fenster-Ehrlichkeit:** `window_weeks` = Anzahl Perioden der genutzten Reihe. `window_limited: true`, falls `window_weeks < 52` (z.B. Sistrix-6-Monats-Fenster) — signalisiert, dass ein früherer Peak abgeschnitten sein könnte.

### Schritt 10: Diagnosis-Klassifikation
````

- [ ] **Step 2: Befund-schreiben-Schritt auf 11 umbenennen**

Ersetze exakt:

```
### Schritt 10: Befund schreiben
```

durch:

```
### Schritt 11: Befund schreiben
```

- [ ] **Step 3: Verifizieren, dass die Schritt-Nummerierung lückenlos ist**

Run:
```bash
cd ~/Projekte/seo-survival-kit && grep -n "^### Schritt" plugins/seo-rescue/commands/recovery-diagnose.md
```
Expected: Schritt 1–11 in Reihenfolge, mit `Schritt 9: Pre-Hit-Baseline-Selektion`, `Schritt 10: Diagnosis-Klassifikation`, `Schritt 11: Befund schreiben`.

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/commands/recovery-diagnose.md
git commit -m "feat(recovery-diagnose): add pre-hit-baseline selection step (L1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: recovery-diagnose.md — Output-Schema, Ausgabe, Validierung, Graceful

**Files:**
- Modify: `plugins/seo-rescue/commands/recovery-diagnose.md` (Output-Schema ~Z.372; Ausgabe ~Z.462; Validierung ~Z.505; Graceful ~Z.519)

- [ ] **Step 1: Output-Schema-Beispiel ergänzen**

Ersetze exakt:

```
  "settlement_gate_status": { "active": false },
  "summary_de": "<deutschsprachige Zusammenfassung>"
}
```

durch:

```
  "settlement_gate_status": { "active": false },
  "pre_hit_baseline": {
    "value": "<number|null>",
    "unit": "clicks_per_week | visibility_index",
    "method": "historical_peak | last_plateau | unavailable",
    "source": "gsc_csv | sistrix_vi | none",
    "maturity": "experimental_n1",
    "window_weeks": "<integer|null>",
    "window_limited": false,
    "erosion_vs_last_plateau_pct": "<number|null>",
    "multi_update_erosion_detected": false,
    "recovery_vs_baseline_pct": "<number|null>"
  },
  "summary_de": "<deutschsprachige Zusammenfassung>"
}
```

- [ ] **Step 2: „Ausgabe an den User" um Baseline-Zeile ergänzen**

Ersetze exakt:

```
6. **Fehlende Capabilities** (falls vorhanden): `Fehlende Daten: {missing_capabilities.join(', ')}`
7. **Settlement Gate** (nur falls `settlement_gate_status.active = true`): `Settlement Gate: AKTIV bis {next_allowed_review_date} — read-only Diagnose erlaubt, Live-Aenderungen blockiert`
```

durch:

```
6. **Fehlende Capabilities** (falls vorhanden): `Fehlende Daten: {missing_capabilities.join(', ')}`
7. **Pre-Hit-Baseline** (experimentell, nur falls `pre_hit_baseline.method != "unavailable"`): `Pre-Hit-Baseline: {value} {unit} ({method} aus {source}, N=1 experimentell) | Erholung vs. Peak: {recovery_vs_baseline_pct}%`. Bei `multi_update_erosion_detected = true` zusaetzlich: `⚠ Multi-Update-Erosion: stabile Phase vor Hit {erosion_vs_last_plateau_pct}% unter historischem Peak`
8. **Settlement Gate** (nur falls `settlement_gate_status.active = true`): `Settlement Gate: AKTIV bis {next_allowed_review_date} — read-only Diagnose erlaubt, Live-Aenderungen blockiert`
```

Hinweis: Der bisherige Punkt 8 („Naechster Schritt") wird dadurch faktisch zu Punkt 9. Da die Liste manuell nummeriert ist und der „Naechster Schritt"-Block ohnehin mit `8.` beginnt, ersetze in Step 3 auch dessen Nummer.

- [ ] **Step 3: „Naechster Schritt"-Nummer auf 9 anheben**

Ersetze exakt:

```
8. **Naechster Schritt:** Empfehle basierend auf der Diagnose das naechste /seo-rescue:-Command:
```

durch:

```
9. **Naechster Schritt:** Empfehle basierend auf der Diagnose das naechste /seo-rescue:-Command:
```

- [ ] **Step 4: Validierungsregeln ergänzen**

Ersetze exakt:

```
- `missing_capabilities` muss ein Array sein

Bei einem Validierungsfehler: Warnung eintragen und Wert auf den naechsten gueltigen Wert korrigieren (z.B. negative t3 auf 0 setzen) oder Abbruch wenn Korrektur nicht moeglich.
```

durch:

```
- `missing_capabilities` muss ein Array sein
- `pre_hit_baseline.maturity` muss `"experimental_n1"` sein
- Falls `pre_hit_baseline.value = null`, muss `pre_hit_baseline.method = "unavailable"` sein
- `pre_hit_baseline.method`, `.source`, `.unit` muessen im jeweiligen Schema-Enum liegen

Bei einem Validierungsfehler: Warnung eintragen und Wert auf den naechsten gueltigen Wert korrigieren (z.B. negative t3 auf 0 setzen) oder Abbruch wenn Korrektur nicht moeglich.
```

- [ ] **Step 5: Graceful-Degradation-Zeile ergänzen**

Ersetze exakt:

```
| Nur GSC-CSV als Quelle | `data_quality = "poor"`, `confidence = "low"` |
```

durch:

```
| Nur GSC-CSV als Quelle | `data_quality = "poor"`, `confidence = "low"` |
| Keine verwertbare Zeitreihe / CSV ohne `date`-Spalte / Reihe < 8 Perioden | `pre_hit_baseline.method = "unavailable"`, `.value = null`, Warnung; Diagnose laeuft normal weiter |
```

- [ ] **Step 6: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/commands/recovery-diagnose.md
git commit -m "docs(recovery-diagnose): wire pre_hit_baseline into output/validation/degradation (L1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: RECOVERY_SYSTEM.md — Methodik-Sektion

**Files:**
- Modify: `plugins/seo-rescue/references/RECOVERY_SYSTEM.md` (neue Sektion; Anker in Step 1 ermitteln)

- [ ] **Step 1: Geeigneten Anker finden**

Run:
```bash
cd ~/Projekte/seo-survival-kit && grep -n "^## \|^# " plugins/seo-rescue/references/RECOVERY_SYSTEM.md
```
Erwartung: Liste der Top-Level-Sektionen. Wähle die Sektion, die Baseline/Stage-Bewertung behandelt (z.B. „Recovery Signal Score" / „URL Recovery Analysis" / Stage-Definitionen). Die neue Sektion wird unmittelbar **nach** der Stage-Definitions-Sektion eingefügt.

- [ ] **Step 2: Sektion einfügen**

Füge nach der in Step 1 gewählten Sektion (vor der nächsten `## `-Überschrift) ein:

```markdown
## Pre-Hit Baseline Selection (experimental, N=1)

> **Maturity:** `experimental_n1` — abgeleitet aus einem einzigen Fall (case-001, Multi-Update-Sequenz über 14 Monate). KEINE validierte Methode. Promotion zu `validated` erst nach N=2-Bestätigung (zweiter Fall) + Reverse-ID-Check.

Bei einer **Multi-Update-Sequenz** (mehrere Algorithmus-Updates über Monate) ist das „letzte stabile Plateau vor dem jüngsten Hit" oft selbst schon durch frühere Updates erodiert. Eine Recovery-Bewertung gegen dieses erodierte Plateau überschätzt die Erholung.

`recovery-diagnose` (Schritt 9) wählt die Baseline daher als **historisches Peak-Plateau**:

1. Längste verfügbare Zeitreihe nutzen (GSC-Klicks bevorzugt, sonst Sistrix-VI).
2. Peak-Plateau = Maximum des rollierenden 4-Perioden-Mittelwerts (kein Einzel-Spike).
3. Erosions-Flag: liegt das letzte stabile Plateau vor dem Hit > 15 % unter dem Peak, ist das ein Multi-Update-Erosions-Signal (`multi_update_erosion_detected`).
4. Fortschritt wird gegen den wahren Peak gemeldet (`recovery_vs_baseline_pct`).

**Abgrenzung:** Dieses Signal ist bisher reines Reporting im Feld `pre_hit_baseline`. Die R1–R5-Stage-Formel bleibt VI-Peak-basiert; die Umstellung der Stage-Logik auf baseline-relative Bewertung inkl. Stage-Re-Entry ist separat (Lesson 4).
```

- [ ] **Step 3: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/references/RECOVERY_SYSTEM.md
git commit -m "docs(RECOVERY_SYSTEM): pre-hit baseline selection methodology section (L1, experimental)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: CHANGELOG + Validierungs-Gate

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Added`)

- [ ] **Step 1: CHANGELOG-Eintrag**

Ersetze exakt:

```
## [Unreleased]

### Fixed
```

durch:

```
## [Unreleased]

### Added

- **L1 Pre-Hit-Baseline-Selektion** (Phase 2, experimental N=1) — `recovery-diagnose` selects the recovery baseline as the historical peak plateau instead of the last stable phase before the hit, flags multi-update erosion (`multi_update_erosion_detected`), and reports progress against the true peak (`recovery_vs_baseline_pct`). New `pre_hit_baseline` field in `befund.schema.json`, marked `maturity: experimental_n1`. The R1-R5 stage formula is unchanged (stays VI-peak-based; baseline-relative staging is Lesson 4).

### Fixed
```

- [ ] **Step 2: Plugin + Marketplace validieren**

Run:
```bash
cd ~/Projekte/seo-survival-kit && claude plugin validate plugins/seo-rescue && claude plugin validate .
```
Expected: zweimal `✔ Validation passed`

- [ ] **Step 3: Fixture-Check + Regressions-Suite**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/pre-hit-baseline.test.js && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/lib-safe-primitives.test.js | tail -3
```
Expected: `PASS: pre_hit_baseline fixture conforms` und `Passed: 55  Failed: 0  Total: 55`

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add CHANGELOG.md
git commit -m "docs(changelog): note L1 pre-hit-baseline selection [Unreleased]

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (vom Plan-Autor)

**Spec-Coverage:**
- Spec „Datenfluss" (source-adaptiv, Peak-Plateau, Erosion, Fortschritt, Fenster-Ehrlichkeit) → Task 3 Step 1 ✓
- Spec „Schema" (`pre_hit_baseline`, nicht required, `maturity`-Enum) → Task 1 ✓
- Spec „Weitere Edits / recovery-diagnose" (Output-Schema, Ausgabe, Validierung, Graceful) → Task 4 ✓
- Spec „Weitere Edits / RECOVERY_SYSTEM" → Task 5 ✓
- Spec „Testing/Validierung" (plugin validate, parse-check, Fixture + zero-dep check, 55er-Suite) → Task 2 + Task 6 ✓
- Spec „CHANGELOG" → Task 6 ✓
- Spec „Bewusst ausgeklammert" (Stage-Formel/L4, GSC-API/L2, patterns/candidates, separates baseline_method) → keine Tasks, korrekt.

**Platzhalter-Scan:** keine TBD/TODO; alle Edit-Inhalte und Schwellen (4-Perioden-Mittel, >15 %, <8 Perioden, <52 Wochen) konkret ausgeschrieben. Einziger „im Step zu ermittelnder" Wert: der RECOVERY_SYSTEM-Anker (Task 5 Step 1) — bewusst, da Sektionsstruktur dort erst gelesen werden muss; mit konkretem grep-Befehl + Auswahlkriterium versehen.

**Typ-/Namens-Konsistenz:** Feldnamen durchgängig identisch in Task 1 (Schema), 2 (Fixture+Check), 3 (Schritt-Logik), 4 (Output/Validierung): `value/unit/method/source/maturity/window_weeks/window_limited/erosion_vs_last_plateau_pct/multi_update_erosion_detected/recovery_vs_baseline_pct`. Enums konsistent: method `historical_peak|last_plateau|unavailable`, source `gsc_csv|sistrix_vi|none`, unit `clicks_per_week|visibility_index`, maturity `experimental_n1`.
