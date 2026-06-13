# L4a Stage-State-Machine — Design

**Datum:** 2026-06-13
**Status:** approved (brainstorming)
**Phase:** seo-survival-kit Phase 2 (Lessons→Runtime), Lesson 4, Slice a von 2
**Quelle:** `private/cases/case-001/patterns/2026-06-03-multi-update-sequence-lessons.md` (Lesson 4)
**Maturity:** N=1 (nur case-001) → `experimental_n1`, KEINE validierte Claim. Folgt dem L1/L2-Muster.

## Problem

Case-001 wurde an Tag N als „Stage 3 stabil" bewertet. An Tag N+1 schloss ein neues Core Update seinen Rollout ab und warf die Site auf Stage 1 zurück. Das aktuelle Stage-Modell (`RECOVERY_SYSTEM.md` §4) ist **strikt linear R1→R5** und kennt weder Re-Entry noch ein Einfrieren während laufender/settlender Rollouts. `recovery-diagnose` berechnet `recovery_stage_estimate` aus dem VI-Trend — **ohne Gedächtnis** und ohne Wissen, ob gerade ein Rollout läuft.

## Ziel

`recovery-diagnose` überlagert die rohe Stage mit einer State-Machine, die drei Realitäten abbildet:
1. **active_update_window** — ein Rollout läuft → Progression einfrieren.
2. **post_update_settlement** — Rollout fertig, ~28 Tage Daten-Settling → Progression einfrieren.
3. **Re-Entry** — frischer Major-Hit → effektive Stage hart auf R1.

Ergebnis in einem neuen Feld `stage_status`, additiv (roher `recovery_stage_estimate` bleibt).

## Entscheidungen (aus Brainstorming)

1. **Slice:** L4a = State-Machine (Re-Entry + active-window + settlement-freeze). Cumulative-Damage/Multi-Hit/time-since-last-hit = L4b (separat).
2. **Re-Entry:** Hard-Reset der effektiven `stage` auf R1 (Lesson-Kern „R3→R1 on new hit, not refusal"). `recovery_stage_estimate` (roh) bleibt unberührt.
3. **Scope:** nur `recovery-diagnose` + `RECOVERY_SYSTEM.md` + `befund.schema.json`. Plan/Monitor-Wiring = Folge-Slice.
4. **Settling-Fenster:** 28 Tage (Lesson-Wert).
5. **Experimental:** `maturity: "experimental_n1"`.

## Abgrenzung zur bestehenden Settlement Gate (§12a)

Lesson-4's „post_update_settlement" ist NICHT der **Settlement Gate** aus §12a:
- **Settlement Gate (§12a):** operator-batch-getriggert (>10 Changes etc.), Hard-Block auf Live-Writes, Writer = `recovery-audit`.
- **post_update_settlement (L4a):** update-rollout-getriggert (28 Tage nach Rollout-Ende), friert nur die **Stage-Bewertung** ein (kein Write-Block).

Gleiche „freeze"-Idee, anderer Trigger, anderer Effekt. Das Design hält beide getrennt; `stage_status` referenziert §12a NICHT.

## Komponente 1 — `RECOVERY_SYSTEM.md` §4c (neu)

Sektion „Stage State Machine (experimental, N=1)" direkt nach §4b (Pre-Hit Baseline):
- Maturity-Vorbehalt.
- Linear R1–R5 = Happy-Path; Realität: Schaden kann wiederkehren/überlappen.
- Die drei Regeln (active_update_window / post_update_settlement / Re-Entry) mit ihren Triggern.
- Explizite Abgrenzung gegen §12a.
- Hinweis: Multi-Hit-Kumulation + time-since-last-hit-Gate = L4b (noch offen).

## Komponente 2 — `befund.schema.json` `stage_status`

Neues Property unter `properties` (nicht `required`):

```json
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
```

`stage` nutzt das gleiche R1–R5-Enum wie `recovery_stage_estimate` (kein R0 — Re-Entry setzt auf R1).

## Komponente 3 — `recovery-diagnose.md` (Schritt 10 erweitern)

Nach der rohen `recovery_stage_estimate`-Schätzung berechnet diagnose `stage_status` (Prosa-Logik, da diagnose ein Claude-ausgeführtes Markdown-Command ist):

1. **Update-Fenster lesen:** aus `../../references/CORE_UPDATES.md` die Rollout-Fenster (Start/Ende) — dieselbe Datei, die Schritt 8 schon für die Korrelation nutzt. Ist die Datei > 90 Tage alt oder fehlt: keine Freezes, `progression_allowed: true`, `frozen_reason: null`, `re_entry_detected: false` (graceful, weiter).
2. **active_update_window:** heute ∈ [start, end] eines Eintrags → `frozen_reason: "active_update_window"`, `progression_allowed: false`, `active_update` = Update-Name.
3. **post_update_settlement:** sonst, heute ∈ (end, end+28 Tage] des jüngsten Eintrags → `frozen_reason: "post_update_settlement"`, `progression_allowed: false`, `days_since_rollout_end` setzen.
4. **Re-Entry:** jüngstes Update endete ≤ 28 Tage ∧ `vi_trend_4w_pct < -10` → `re_entry_detected: true`, `re_entry_from` = `recovery_stage_estimate`, effektive `stage = "R1"`. (Re-Entry und Freeze können gleichzeitig gelten: Stage = R1, progression_allowed bleibt false.)
5. **sonst:** `progression_allowed: true`, `frozen_reason: null`, `re_entry_detected: false`, `stage = raw_stage` (= `recovery_stage_estimate`).
6. `raw_stage` immer = `recovery_stage_estimate`; `maturity: "experimental_n1"`.

Weitere Edits in `recovery-diagnose.md`:
- `## Output-Schema`-Beispiel um `stage_status` ergänzen.
- `## Ausgabe an den User`: Zeile `Stage: {stage} (roh: {raw_stage}) | Progression: {progression_allowed ? "erlaubt" : "eingefroren — " + frozen_reason}`; bei `re_entry_detected`: `⚠ Stage-Re-Entry: frischer Hit hat Stage von {re_entry_from} auf R1 zurückgesetzt`.
- `## Validierungsregeln`: `re_entry_detected = true ⇒ stage = "R1"`; `frozen_reason != null ⇒ progression_allowed = false`; `stage_status.maturity = "experimental_n1"`.
- `## Graceful-Degradation-Regeln`: kein/veraltetes CORE_UPDATES.md → `stage_status` ohne Freezes (`progression_allowed: true`).

## Testing / Validierung

`recovery-diagnose` ist ein Pure-Markdown-Command (kein Laufzeit-Code). Verifikation wie L1:
- `claude plugin validate plugins/seo-rescue` + `claude plugin validate .` → `✔`
- JSON-Parse-Check auf `befund.schema.json`.
- Neue Fixture `plugins/seo-rescue/test-fixtures/ecommerce-recovery/befund-with-stage-status.json` (Re-Entry-Fall: `stage: "R1"`, `raw_stage: "R3"`, `re_entry_detected: true`, `frozen_reason: "post_update_settlement"`, `progression_allowed: false`).
- Zero-dep Struktur-/Invarianten-Check `stage-status.test.js`: alle `required`-Keys vorhanden; Enums gültig; Invarianten `re_entry_detected ⇒ stage=="R1"`, `frozen_reason!=null ⇒ progression_allowed==false`, `maturity=="experimental_n1"`. Exit ≠ 0 bei Verletzung.
- 55er-Suite als Regressionsnetz.

## Bewusst ausgeklammert (YAGNI)

- recovery-plan/-monitor-Wiring (Konsum von `progression_allowed`) — Folge-Slice.
- Cumulative-Damage / Multi-Hit-Formel / time-since-last-hit-Gate = L4b.
- Underlying R-Level-Formel unverändert außer Re-Entry-Override.
- `re_entry_from` aus History anreichern — bleibt vorerst `recovery_stage_estimate` (kein History-Read in diagnose dafür).

## Risiko

Niedrig–mittel. Doc-/Schema-Edits + Fixture + Check, kein Laufzeit-Code. Hauptrisiken: (1) Datums-/Fenster-Logik in Prosa mehrdeutig → konkrete Trigger (≤28 Tage, vi_trend_4w < −10, heute ∈ [start,end]) + Fixture-Invarianten; (2) Verwechslung mit §12a → eigener Abgrenzungs-Abschnitt; (3) JSON-Syntaxbruch → Parse-Check + plugin validate.
