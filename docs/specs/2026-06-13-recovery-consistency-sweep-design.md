# Recovery-Command Konsistenz-Sweep — Design

**Datum:** 2026-06-13
**Status:** approved (brainstorming)
**Scope:** Konsistenz-Schulden aus dem Phase-2-Handoff (10.06.) abräumen — Gate-Output-Shape und fehlende Command-Sektionen vereinheitlichen.

## Problem

Drei Divergenzen zwischen den Recovery-Commands in `plugins/seo-rescue/`:

1. **Gate-Shape-Divergenz.** `recovery-diagnose` (→ `befund`) und `recovery-monitor` (→ `history`) schreiben den Settlement-Gate-Status **nested** als `settlement_gate_status: { active, next_allowed_review_date, unlock_status }` — identisch in `befund.schema.json` und `history.schema.json`. `recovery-plan` schreibt ihn **flach** (`settlement_gate_active`, `live_changes_allowed`, `next_allowed_review_date`) und `action-plan.schema.json` deckt den Gate-Output gar nicht ab.

2. **Sektions-Divergenz.** `diagnose` und `plan` haben beide `## Change Governance` und `## Ausgabe an den User`. `recovery-monitor` hat keines von beiden (nur `## Delta-Report Format` als faktische User-Ausgabe).

3. **Naming (klein).** `diagnose`/`monitor`: `## Settlement Gate Awareness`; `plan`: `## Settlement Gate Pre-Check`. Inhaltlich gerechtfertigt — bleibt.

**Nicht im Scope (Quell-Format):** Die Gate-Datei `~/.cache/seo-rescue/{slug}/recovery-gate.json` (geschrieben von `recovery-audit`, beschrieben durch `recovery-gate.schema.json`) bleibt flach mit `settlement_gate_active`. Geändert werden nur die **Output-Spiegel** der Commands, die diese Datei lesen.

## Entscheidung: Approach A — nur Mirror nesten

Der geteilte Awareness-Mirror (`settlement_gate_status: { active, next_allowed_review_date, unlock_status }`) wird über alle drei Commands konsistent. Plan-spezifische operative Felder (`live_changes_allowed`, `allowed_now`, `blocked_now`, `emergency_exceptions`, `reason`) bleiben als plan-eigene Output-Semantik **flach daneben** — sie existieren in diagnose/monitor nicht und sind daher keine zu vereinheitlichende Divergenz.

Verworfen: (B) alles unter `settlement_gate_status` nesten (invasiver, `active` redundant), (C) getrenntes `gate_plan`-Objekt (zwei Gate-Objekte, mehr Fläche). Begründung: A löst die echte Divergenz (den Mirror) bei kleinstem Eingriff, YAGNI.

## Änderungen

### 1. `commands/recovery-plan.md`

- **Sektion „Pflichtfelder im Output bei aktivem Gate"** (~Z.44–60): JSON-Beispiel umbauen, sodass der Awareness-Mirror nested ist:

  ```json
  {
    "settlement_gate_status": {
      "active": true,
      "next_allowed_review_date": "2026-06-06",
      "unlock_status": "blocked"
    },
    "live_changes_allowed": false,
    "allowed_now": ["act-001 (audit)", "act-002 (rico-briefing)"],
    "blocked_now": ["act-003 (title-rewrite — blocked_until_re_eval)"],
    "emergency_exceptions": [],
    "reason": "major_batch_settlement_window"
  }
  ```

- **Sektion „Verhalten bei aktivem Gate"** (~Z.29–40): Prosa angleichen — `next_allowed_review_date` **und** neu `unlock_status` aus dem Gate-Objekt in den nested Mirror spiegeln (analog `recovery-diagnose` Schritt 2). `unlock_status` (`blocked | partial | open`) direkt aus der Gate-Datei übernehmen.

### 2. `schemas/action-plan.schema.json`

- `settlement_gate_status`-Property ergänzen mit **identischem Definitionsblock** wie in `befund.schema.json` / `history.schema.json`:

  ```json
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
  ```

- **Umsetzungs-Vorabschritt:** Prüfen, ob `action-plan.schema.json` auf Top-Level die volle Plan-Ausgabe oder nur das Action-Array beschreibt. Danach richtet sich die genaue Einhängung des Property (Top-Level-`properties` vs. ein umschließendes Output-Objekt). Edit chirurgisch — **nie** per `json.dump` (reformatiert die ganze Datei).

### 3. `commands/recovery-monitor.md`

- `## Change Governance` ergänzen (nach `## Zweck`), Wortlaut aus `recovery-diagnose` gespiegelt und an den read-only-Monitor angepasst:
  > Mode: `read_only`. Change Budget: 0. Keine Live-Shop-Writes. Schreibt nur History-Artefakte (NDJSON via `lib/safe.js`).
- `## Ausgabe an den User` ergänzen: beschreibt, was monitor dem User ausgibt — den Delta-Report gemäß `## Delta-Report Format` plus die Gate-Awareness-Zeile bei aktivem Gate (`Settlement Gate: AKTIV bis {next_allowed_review_date} …`, analog diagnose). `## Delta-Report Format` bleibt als Format-Spezifikation bestehen und wird referenziert.

## Validierung

- `claude plugin validate plugins/seo-rescue` → `✔ Validation passed`
- `claude plugin validate .` → `✔ Validation passed`
- `node plugins/seo-rescue/test-fixtures/ecommerce-recovery/lib-safe-primitives.test.js` → 55/55
- JSON-Parse-Check auf `action-plan.schema.json` nach dem Edit (z.B. `node -e "JSON.parse(require('fs').readFileSync('…'))"`)
- Kein Re-Sync von `~/.claude/skills/post-core-update-recovery/` nötig (LESSONS/SKILL unangetastet)

## Bewusst ausgeklammert (YAGNI)

- Gate-**Datei**-Format (`recovery-gate.json` / `recovery-gate.schema.json`) — Quell-Format, unverändert
- Plan-Sektions-Naming (`Pre-Check` vs `Awareness`) — semantisch gerechtfertigt
- Issue #28 (DECISION_ENGINE-Konsolidierung) = v0.6-Material
- Kein Release/Tag — Eintrag unter CHANGELOG `[Unreleased]`, Bündelung mit Phase 2

## Risiko

Niedrig. Reine Doc-/Schema-Edits ohne Laufzeit-Code. Einziges echtes Fehlerrisiko: JSON-Syntaxbruch in `action-plan.schema.json` → durch Parse-Check + `plugin validate` abgefangen.
