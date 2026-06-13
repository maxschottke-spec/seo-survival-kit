# Recovery-Command Konsistenz-Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Settlement-Gate-Output von `recovery-plan` auf den nested `settlement_gate_status`-Mirror von diagnose/monitor angleichen, das Schema dafür ergänzen, und die fehlenden Sektionen (`Change Governance`, `Ausgabe an den User`) in `recovery-monitor` nachziehen.

**Architecture:** Reine Doc-/Schema-Edits in `plugins/seo-rescue/` — keine Laufzeit-Code-Änderungen. Verifikation über `claude plugin validate` (Plugin + Marketplace), JSON-Parse-Check auf das editierte Schema, und die bestehende 55er-Test-Suite als Regressionsnetz.

**Tech Stack:** Markdown (Command-Specs), JSON Schema (draft 2020-12), `claude plugin validate`, Node.js (Parse-Check + Test-Suite).

**Branch:** `feature/recovery-consistency-sweep` (existiert bereits, Spec ist committet).

**Spec:** `docs/specs/2026-06-13-recovery-consistency-sweep-design.md`

---

### Task 1: recovery-plan.md — Gate-Output auf nested Mirror umbauen

**Files:**
- Modify: `plugins/seo-rescue/commands/recovery-plan.md` (Sektion „Pflichtfelder im Output bei aktivem Gate", ~Z.44–60; Sektion „Verhalten bei aktivem Gate", ~Z.40)

- [ ] **Step 1: JSON-Beispiel in „Pflichtfelder im Output bei aktivem Gate" umbauen**

Ersetze den exakten Block (aktuell Z.44–60):

```json
{
  "settlement_gate_active": true,
  "live_changes_allowed": false,
  "next_allowed_review_date": "2026-06-06",
  "allowed_now": [
    "act-001 (audit)",
    "act-002 (rico-briefing)"
  ],
  "blocked_now": [
    "act-003 (title-rewrite — blocked_until_re_eval)",
    "act-004 (cms-slot-patch — blocked_until_re_eval)"
  ],
  "emergency_exceptions": [],
  "reason": "major_batch_settlement_window"
}
```

durch:

```json
{
  "settlement_gate_status": {
    "active": true,
    "next_allowed_review_date": "2026-06-06",
    "unlock_status": "blocked"
  },
  "live_changes_allowed": false,
  "allowed_now": [
    "act-001 (audit)",
    "act-002 (rico-briefing)"
  ],
  "blocked_now": [
    "act-003 (title-rewrite — blocked_until_re_eval)",
    "act-004 (cms-slot-patch — blocked_until_re_eval)"
  ],
  "emergency_exceptions": [],
  "reason": "major_batch_settlement_window"
}
```

- [ ] **Step 2: Prosa in „Verhalten bei aktivem Gate" angleichen**

Ersetze den letzten Bullet (aktuell Z.40):

```
- `next_allowed_review_date` aus dem Gate-Objekt uebernehmen.
```

durch:

```
- `next_allowed_review_date` und `unlock_status` (`blocked | partial | open`) aus der Gate-Datei in den nested `settlement_gate_status`-Mirror uebernehmen (analog `recovery-diagnose`). Die operativen Plan-Felder (`live_changes_allowed`, `allowed_now`, `blocked_now`, `emergency_exceptions`, `reason`) bleiben flach daneben.
```

Hinweis: Die Bedingung `Wenn settlement_gate_active = true:` (Z.31) bleibt unverändert — sie referenziert das Feld der **Gate-Datei** (Quell-Format, flach), nicht den Output-Mirror.

- [ ] **Step 3: Verifizieren, dass keine flache `settlement_gate_active`-Zeile mehr im OUTPUT steht**

Run:
```bash
cd ~/Projekte/seo-survival-kit && grep -n "settlement_gate_active" plugins/seo-rescue/commands/recovery-plan.md
```
Expected: Nur noch Treffer in der **Lese-/Pre-Check-Prosa** (Z.~22, 24, 31 — Gate-Datei-Bezug), KEINE im JSON-Output-Block. Der ehemalige Output-Treffer (Z.46) ist weg.

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/commands/recovery-plan.md
git commit -m "fix(recovery-plan): nest settlement_gate_status mirror in gate output

Align with recovery-diagnose/recovery-monitor (Approach A: mirror-only nest).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: action-plan.schema.json — settlement_gate_status-Property ergänzen

**Files:**
- Modify: `plugins/seo-rescue/schemas/action-plan.schema.json` (Top-Level `properties`, nach `expected_impact`, ~Z.66)

- [ ] **Step 1: Property einhängen**

Die Datei hat `expected_impact` als letztes Property in `properties` (Z.59–66). Ändere die schließende Zeile von `expected_impact` so, dass danach `settlement_gate_status` folgt. Ersetze exakt (Z.66–67):

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
    "settlement_gate_status": {
      "type": "object",
      "description": "Settlement-Gate awareness mirror (read from recovery-gate.json, written by recovery-audit). active:false when no gate file exists.",
      "required": ["active"],
      "properties": {
        "active": { "type": "boolean" },
        "next_allowed_review_date": { "type": "string" },
        "unlock_status": { "type": "string", "enum": ["blocked", "partial", "open"] }
      }
    }
  }
}
```

Der Definitionsblock ist **byte-identisch** zu dem in `befund.schema.json` und `history.schema.json`. NICHT in `required` aufnehmen (Gate kann fehlen). Edit chirurgisch per Edit-Tool — **nie** per `json.dump`.

- [ ] **Step 2: JSON-Parse-Check**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node -e "JSON.parse(require('fs').readFileSync('plugins/seo-rescue/schemas/action-plan.schema.json','utf8')); console.log('OK: valid JSON')"
```
Expected: `OK: valid JSON`

- [ ] **Step 3: Mirror-Definition gegen befund/history gegenchecken (identische Shape)**

Run:
```bash
cd ~/Projekte/seo-survival-kit/plugins/seo-rescue && node -e '
const fs=require("fs");
const pick=f=>JSON.stringify(JSON.parse(fs.readFileSync(f,"utf8")).properties.settlement_gate_status);
const a=pick("schemas/action-plan.schema.json"), b=pick("schemas/befund.schema.json"), c=pick("schemas/history.schema.json");
console.log(a===b && b===c ? "OK: alle drei identisch" : "MISMATCH\n"+a+"\n"+b+"\n"+c);
'
```
Expected: `OK: alle drei identisch`

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/schemas/action-plan.schema.json
git commit -m "fix(schema): add settlement_gate_status to action-plan.schema

Matches befund/history mirror definition; covers recovery-plan gate output.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: recovery-monitor.md — Change Governance + Ausgabe an den User

**Files:**
- Modify: `plugins/seo-rescue/commands/recovery-monitor.md` (neue Sektion nach `## Zweck` ~Z.10; neue Sektion nach `## Delta-Report Format` ~Z.207)

- [ ] **Step 1: `## Change Governance` nach `## Zweck` einfügen**

Füge nach dem `## Zweck`-Absatz (nach Z.10, vor `## Settlement Gate Awareness` in Z.12) ein:

```markdown
## Change Governance

Mode: `read_only`. Change Budget: 0. Keine Live-Shop-Writes. Schreibt nur History-Artefakte (`history.ndjson`, append-only, via `lib/safe.js`).

Wenn `change-history.ndjson` existiert, wird sie fuer die Change-History-Integration gelesen und im Eintrag referenziert (siehe `## Change History Integration`). Jede Score-Bewegung traegt Quelle und Confidence.

```

(Mirror der `## Change Governance`-Sektion aus `recovery-diagnose.md`, angepasst auf den read-only Monitor.)

- [ ] **Step 2: `## Ausgabe an den User` nach `## Delta-Report Format` einfügen**

Füge nach dem Delta-Report-Codeblock (nach Z.207 ` ``` `, vor `## Fehlerbehandlung` in Z.209) ein:

```markdown
## Ausgabe an den User

Nach erfolgreichem Append des History-Eintrags, gib folgende Informationen aus:

1. **Delta-Report** im Format aus `## Delta-Report Format` — VI, Score mit Delta, Phase, Top-10-Keywords, Score-Komponenten, Datenqualitaet und Confidence.
2. **Settlement-Gate-Zeile** (nur falls `settlement_gate_status.active = true`): `Settlement Gate: AKTIV bis {next_allowed_review_date} — read-only Monitoring erlaubt, Live-Aenderungen blockiert`
3. **Score-Bewegungs-Hinweis** bei Drop > 15 Punkten waehrend aktivem Gate: keinen korrigierenden Live-Vorschlag ausgeben, sondern die Beobachtung fuer die Gate-Re-Evaluation am `next_allowed_review_date` vermerken (siehe `## Settlement Gate Awareness`).

```

- [ ] **Step 3: Sektions-Parität gegen diagnose/plan verifizieren**

Run:
```bash
cd ~/Projekte/seo-survival-kit/plugins/seo-rescue && for c in diagnose plan monitor; do echo "--- $c ---"; grep -E "^## (Change Governance|Ausgabe an den User)" commands/recovery-$c.md; done
```
Expected: Alle drei Commands listen **sowohl** `## Change Governance` **als auch** `## Ausgabe an den User`.

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/commands/recovery-monitor.md
git commit -m "docs(recovery-monitor): add Change Governance + Ausgabe an den User sections

Section parity with recovery-diagnose/recovery-plan.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: CHANGELOG [Unreleased]-Eintrag

**Files:**
- Modify: `CHANGELOG.md` (Abschnitt `[Unreleased]`; falls nicht vorhanden, oberhalb des neuesten Release-Headers anlegen)

- [ ] **Step 1: Aktuelle CHANGELOG-Struktur prüfen**

Run:
```bash
cd ~/Projekte/seo-survival-kit && sed -n '1,30p' CHANGELOG.md
```
Erwartung: Keep-a-Changelog-Format. Prüfe, ob ein `## [Unreleased]`-Block existiert.

- [ ] **Step 2: Eintrag ergänzen**

Falls `## [Unreleased]` existiert, unter `### Fixed` (anlegen falls nötig) ergänzen; sonst `## [Unreleased]` mit `### Fixed` neu oberhalb des neuesten `## [x.y.z]`-Headers einfügen:

```markdown
### Fixed

- Recovery-command consistency: `recovery-plan` gate output now uses the nested `settlement_gate_status` mirror (matching `recovery-diagnose`/`recovery-monitor`), `action-plan.schema.json` covers it, and `recovery-monitor` gained the `Change Governance` and `Ausgabe an den User` sections for section parity.
```

- [ ] **Step 3: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add CHANGELOG.md
git commit -m "docs(changelog): note recovery-command consistency sweep [Unreleased]

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Validierung (Gesamt-Gate)

**Files:** keine — nur Verifikation.

- [ ] **Step 1: Plugin validieren**

Run:
```bash
cd ~/Projekte/seo-survival-kit && claude plugin validate plugins/seo-rescue
```
Expected: `✔ Validation passed`

- [ ] **Step 2: Marketplace validieren**

Run:
```bash
cd ~/Projekte/seo-survival-kit && claude plugin validate .
```
Expected: `✔ Validation passed`

- [ ] **Step 3: Regressions-Test-Suite**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/lib-safe-primitives.test.js
```
Expected: 55/55 Tests grün (kein Exit-Code ≠ 0).

- [ ] **Step 4: Working Tree sauber, alle Commits da**

Run:
```bash
cd ~/Projekte/seo-survival-kit && git status -sb && echo "---" && git log --oneline -6
```
Expected: Working tree clean; die 4 Implementierungs-Commits (plan, schema, monitor, changelog) + Spec-Commit auf `feature/recovery-consistency-sweep`.

---

## Self-Review (vom Plan-Autor)

**Spec-Coverage:**
- Spec §1 (Gate-Shape, plan) → Task 1 ✓
- Spec §2 (action-plan.schema) → Task 2 ✓ (+ Vorabschritt „Top-Level vs Array" geklärt: Schema ist Top-Level-Objekt mit `properties`, `additionalProperties` nicht gesetzt → Property als Sibling von `expected_impact`, plan-operative Felder bleiben toleriert)
- Spec §3 (monitor-Sektionen) → Task 3 ✓
- Spec „Validierung" → Task 5 ✓
- Spec „CHANGELOG [Unreleased]" → Task 4 ✓
- Spec „Bewusst ausgeklammert" → keine Tasks (korrekt): Gate-Datei-Format, Sektions-Naming, Issue #28, Release/Tag.

**Platzhalter-Scan:** keine TBD/TODO; alle Edit-Inhalte vollständig ausgeschrieben.

**Typ-/Namens-Konsistenz:** `settlement_gate_status` mit Feldern `active` / `next_allowed_review_date` / `unlock_status` durchgängig identisch in Task 1, 2, 3. Enum `blocked | partial | open` konsistent.
