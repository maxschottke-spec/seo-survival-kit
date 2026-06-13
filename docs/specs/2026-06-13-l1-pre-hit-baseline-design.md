# L1 Pre-Hit-Baseline-Selektion — Design

**Datum:** 2026-06-13
**Status:** approved (brainstorming)
**Phase:** seo-survival-kit Phase 2 (Lessons→Runtime), Lesson 1 von 5
**Quelle:** `private/cases/case-001/patterns/2026-06-03-multi-update-sequence-lessons.md` (Lesson 1)
**Maturity:** N=1 (nur case-001) → wird als `experimental_n1` markiert, KEINE validierte Claim. Promotion erst nach N=2.

## Problem

`recovery-diagnose` bewertet die Recovery-Stage gegen `vi_peak` (Maximum über VI-Snapshots), aber nur über ein ~6-Monats-Sistrix-Fenster. Bei einer **Multi-Update-Sequenz** (case-001: 5 Updates über 14 Monate) ist das „letzte stabile Plateau vor dem jüngsten Hit" selbst bereits durch frühere Updates erodiert. Eine Stage-Bewertung gegen dieses erodierte Plateau überschätzt die Erholung — die Recovery wird gegen einen lokalen Trog gemessen statt gegen den wahren historischen Peak.

**Lesson-1-Befund (case-001):** Stage-3-Recovery wurde gegen ~1.077 Klicks/Woche (Feb 2026) bewertet — dieses Niveau war aber schon durch die Dez-2025→Feb-2026-Discover-Sequenz gedrückt. Der wahre Pre-Hit-Baseline lag bei 1.150–1.300 Klicks/Woche (Sommer/Herbst 2025).

## Ziel

`recovery-diagnose` wählt die Baseline als **historisches Peak-Plateau** (nicht letztes stabiles Plateau), erkennt Multi-Update-Erosion und meldet beides in einem neuen, als experimentell markierten Befund-Feld `pre_hit_baseline`.

## Entscheidungen (aus Brainstorming)

1. **Experimental-Marking:** feld-internes `maturity`-Property (`"experimental_n1"`) — setzt das Muster für L2–L5.
2. **Datenquelle:** source-adaptiv, längste verfügbare Reihe — GSC-CSV bevorzugt (klick-basiert, bis 16 Mon.), sonst Sistrix-VI.
3. **Ein Feld statt zwei:** `method`/`source`/`window` leben **in** `pre_hit_baseline`; das im Handoff genannte separate `baseline_method`-Feld entfällt (DRY).
4. **Stage-Formel bleibt vorerst `vi_peak`-basiert** — baseline-basierte Stages sind L4. `recovery_vs_baseline_pct` ist die Brücke.

## Datenfluss

Neuer Ablauf-Schritt in `recovery-diagnose.md` (eingefügt vor der bisherigen Stage-Schätzung, „Schritt 9"):

1. **Reihe wählen (source-adaptiv):**
   - GSC-CSV-Import `~/.cache/seo-rescue/{slug}/imports/gsc-performance.csv` mit Spalten `date,clicks` vorhanden → wöchentliche Klick-Reihe, voller CSV-Range (bis 16 Mon.). `source: "gsc_csv"`, `unit: "clicks_per_week"`.
   - sonst Sistrix-VI-Snapshots aus Schritt 4 → `source: "sistrix_vi"`, `unit: "visibility_index"`.
   - sonst → `pre_hit_baseline: { value: null, method: "unavailable", source: "none", maturity: "experimental_n1", ... }`; Warnung eintragen.
2. **Peak-Plateau bestimmen:** höchstes *gehaltenes* Niveau = Maximum des rollierenden 4-Perioden-Mittelwerts (kein Einzel-Spike). → `value`.
3. **Letztes stabiles Plateau vor jüngstem Hit:** Mittelwert des Fensters direkt vor dem letzten signifikanten Drop (Drop = Periode-über-Periode-Rückgang > 15 % oder dokumentiertes Update-Fenster aus `CORE_UPDATES.md`).
4. **Erosion berechnen:** `erosion_vs_last_plateau_pct = round((last_stable_plateau − value) / value * 100)`. Bei `< −15` → `multi_update_erosion_detected: true`, Warnung `"pre_hit_baseline: stabile Phase vor Hit ist selbst >15% unter historischem Peak — Multi-Update-Erosion"`, und ein Satz in `summary_de`.
5. **Fortschritt melden:** `recovery_vs_baseline_pct = round((current − value) / value * 100)` (current = `vi_current` bzw. jüngster Klick-Wochenwert). Nur Reporting — verändert die R1–R5-Schätzung NICHT.
6. **Fenster-Ehrlichkeit:** `window_weeks` = Länge der genutzten Reihe; `window_limited: true` wenn die Reihe < 52 Wochen ist (Sistrix-6-Mon.-Fall) — signalisiert, dass ein früherer Peak abgeschnitten sein könnte.

## Schema (`befund.schema.json`)

Neues Property unter `properties` (nicht `required`):

```json
"pre_hit_baseline": {
  "type": "object",
  "description": "Pre-hit recovery baseline selection (Lesson 1, multi-update-sequence). EXPERIMENTAL N=1 — historical peak plateau, not last stable phase. Not used in R1-R5 stage formula yet (see L4).",
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
```

Hinweis: `maturity`-Enum bewusst auf `experimental_n1` beschränkt — spätere Werte (`experimental_n2`, `validated`) werden bei Promotion ergänzt. Das Feld ist der einzige Schema-Eingriff; bestehende Felder (`vi_peak`, `recovery_stage_estimate`) bleiben unangetastet.

## Weitere Edits

- **`recovery-diagnose.md`:**
  - Neuer Ablauf-Schritt (Datenfluss oben), korrekte Neu-Nummerierung der Folgeschritte.
  - `## Output-Schema`-Beispiel um `pre_hit_baseline` ergänzen.
  - `## Ausgabe an den User`: neue Zeile `Pre-Hit-Baseline: {value} {unit} ({method}, {source}) | Erholung vs. Peak: {recovery_vs_baseline_pct}%` + bei Erosion `⚠ Multi-Update-Erosion: stabile Phase vor Hit −{erosion}% unter Peak`.
  - `## Validierungsregeln`: `pre_hit_baseline.maturity` muss `experimental_n1` sein; `value: null` ⇒ `method: "unavailable"`.
  - `## Graceful-Degradation-Regeln`: keine Reihe / CSV ohne `date`-Spalte / Reihe < 8 Perioden ⇒ `method: "unavailable"`, `value: null`, Warnung; Diagnose läuft normal weiter.
- **`RECOVERY_SYSTEM.md`:** kurze Sektion „Pre-Hit Baseline Selection (experimental, N=1)" — Methodik (Peak-Plateau vs. letztes Plateau), Erosions-Flag, Maturity-Gate, expliziter Hinweis „noch nicht in der Stage-Formel (L4)".

## Testing / Validierung

`recovery-diagnose` ist ein Pure-Markdown-Command (Claude führt es aus) — kein Laufzeit-Code, keine Unit-Tests im klassischen Sinn. Verifikation:

- `claude plugin validate plugins/seo-rescue` + `claude plugin validate .` → `✔`
- JSON-Parse-Check auf `befund.schema.json`
- Neue Test-Fixture `plugins/seo-rescue/test-fixtures/ecommerce-recovery/befund-with-baseline.json` mit gefülltem `pre_hit_baseline` (inkl. Erosions-Fall).
- Zero-Dep-Struktur-Check (Node, kein npm/ajv): liest Fixture + Schema, prüft dass alle `required`-Keys von `pre_hit_baseline` vorhanden sind und `method`/`source`/`maturity`/`unit` im jeweiligen Enum liegen. Als ausführbares Skript ablegen, das mit Exit-Code != 0 bei Verletzung abbricht.
- 55er-Suite (`lib-safe-primitives.test.js`) als Regressionsnetz — bleibt grün (unberührt).

## Bewusst ausgeklammert (YAGNI)

- R1–R5-Stage-Formel-Umbau (= L4)
- GSC-API-Live-History statt CSV/VI (= L2-Domäne)
- Public-Abstraction nach `patterns/candidates/` (separater Governance-Schritt, erst nach Stage-4 + N=2)
- Separates `baseline_method`-Feld (Duplikation, bewusst weggelassen)

## Risiko

Niedrig–mittel. Reine Doc-/Schema-Edits + eine Fixture + ein kleines Check-Skript. Hauptrisiken: (1) JSON-Syntaxbruch im Schema → Parse-Check + `plugin validate`; (2) unklare Plateau-Heuristik → durch konkrete Schwellen (4-Perioden-Mittel, >15 % Drop, <8 Perioden ⇒ unavailable) abgesichert; (3) Überdehnung in L4-Territorium → durch explizite Abgrenzung (Stage-Formel unangetastet) vermieden.
