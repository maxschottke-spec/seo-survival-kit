# L2 Quiet-Death-Detection — Design

**Datum:** 2026-06-13
**Status:** approved (brainstorming)
**Phase:** seo-survival-kit Phase 2 (Lessons→Runtime), Lesson 2 von 5
**Quelle:** `private/cases/case-001/patterns/2026-06-03-multi-update-sequence-lessons.md` (Lesson 2)
**Maturity:** N=1 (nur case-001) → `experimental_n1`, KEINE validierte Claim. Promotion erst nach N=2. Folgt dem in L1 etablierten `maturity`-Muster ([[2026-06-13-l1-pre-hit-baseline-design]]).

## Problem

`recovery-diagnose` und das Update-Korrelations-Modell sehen nur Declines, die mit Algorithmus-Updates korrelieren. Case-001 hat aber **11 Queries, die 60–86 % ihrer Klicks über 6–60 Wochen verloren haben — ohne jede Update-Korrelation**. Diese „stillen Tode" (SERP-Feature-Absorption durch AI Overviews oder Brand-Erosion) bleiben unter dem Radar und brauchen andere Gegenmaßnahmen als Update-Recovery.

`gsc-deep-dive` zieht heute nur einen **Snapshot** (top_queries über das Fenster aggregiert), keine **Pro-Query-Wochen-Zeitreihe** — die ist Voraussetzung, um monotonen Decline über Wochen zu erkennen.

## Ziel

`gsc-deep-dive` bekommt (1) eine Pro-Query-Wochen-Zeitreihe im Fetch und (2) einen zero-dep Detector, der Quiet-Death-Queries nach festen Kriterien flaggt, mit Update-Korrelation annotiert und als `experimental_n1` markiert.

## Entscheidungen (aus Brainstorming)

1. **Struktur:** `gsc-deep-dive`-Erweiterung (keine neue Top-Level-Skill; Skill-Count bleibt 18). Matcht den Handoff vom 10.06.
2. **Update-Korrelation:** annotieren statt hart filtern — `update_correlation: "none" | "partial"`, beide ausgewiesen.
3. **Experimental:** `maturity: "experimental_n1"` (L1-Muster).
4. **Kriterien:** fix aus dem Lessons-Doc (s.u.).
5. **Selbst gewählte Parameter (vom User bestätigt):** 480-Tage-Fenster, Top-200-Query-Cap, rollierendes 4-Wochen-Mittel als Monotonie-/Verlust-Maß.

## Komponente 1 — Fetch-Erweiterung (`gsc-fetch.example.js`)

`searchAnalytics(token, dimensions, …)` ist bereits generisch. Neuer Call mit `dimensions: ['date','query']` über das Langfenster; Ergebnis pro Query in ISO-Wochen aggregiert:

```json
"query_weekly_series": [
  { "query": "matratzen marken", "weeks": [ { "iso_week": "2025-W31", "clicks": 48 }, { "iso_week": "2025-W32", "clicks": 41 } ] }
]
```

- Fenster-Default **480 Tage** (~16 Mon., GSC-Retention-Max), via neuer Config-Key `weekly_series_days` (Default 480).
- **Row-Cap (kein Silent-Truncate, „no silent caps"-Regel):** Reihe auf die Top-**200** Queries nach Gesamt-Klicks im Fenster begrenzen. Eine stderr-Log-Zeile gibt aus, wie viele Queries ausgelassen wurden (`[quiet-death] weekly series capped to top 200 queries; N omitted`).
- ISO-Wochen-Bucketing: Datum → ISO-Jahr+Woche (`YYYY-Www`), Klicks pro (query, week) summiert.
- Bei API-Fehler des Zusatz-Calls: `query_weekly_series: []`, Warnung — der bestehende Snapshot-Teil bleibt unberührt.

Hinweis: Diese Fetch-Erweiterung wird NICHT unit-getestet (braucht GSC-Creds, konsistent mit dem ungetesteten `gsc-fetch.example.js`).

## Komponente 2 — Detector (`quiet-death-detect.example.js`, neu, zero-dep)

Liest einen Snapshot mit `query_weekly_series` + `CORE_UPDATES.md`. Netzfrei → voll offline testbar.

**Struktur für Testbarkeit:** reine Funktionen via `module.exports = { detectQuietDeath, parseUpdateWindows, isoWeekToDate, classifyPattern }`; CLI-Wrapper unter `if (require.main === module)`.

**Kriterien pro Query-Reihe (alle müssen erfüllt sein):**
1. **Start-Klicks ≥ 5:** Mittel der ersten 4 Wochen (oder so vieler wie vorhanden, min. 1) ≥ 5.
2. **Verlust ≥ 50 %:** `loss_pct = round((end_mean − start_mean) / start_mean * 100)` mit start_mean = erstes 4-Wochen-Mittel, end_mean = letztes 4-Wochen-Mittel; Kriterium erfüllt wenn `loss_pct ≤ −50`.
3. **Monotoner Decline ≥ 6 Wochen:** Bilde das rollierende 4-Wochen-Mittel über die Reihe. Bestimme die längste zusammenhängende Spanne, in der dieses Mittel nicht-steigend ist (jeder Wert ≤ Vorwert, kleine Toleranz +2 % erlaubt um Rauschen zu glätten). `decline_weeks` = Länge dieser Spanne in Wochen; Kriterium erfüllt wenn `decline_weeks ≥ 6`.

**Update-Korrelation:**
- Bestimme den größten Einzel-Wochen-Drop in der Reihe (max. negativer Wochen-über-Wochen-Schritt).
- `parseUpdateWindows(CORE_UPDATES.md)` liefert Update-Fenster (Start/Ende-Daten).
- Liegt die Drop-Woche **±1 Woche** in einem Update-Fenster → `update_correlation: "partial"`, sonst `"none"`. Beide Fälle bleiben in der Liste.

**Pattern-Hinweis (leichtgewichtig, optional):**
- Query enthält ein Token aus Config `brand_terms` (Array, optional) → `pattern_hint: "brand_erosion"`.
- sonst falls die Query/zugehörige Page im `search_appearance` ein AI-Overview-Signal trägt → `"serp_feature_absorption"`.
- sonst → `"generic_erosion"`.

**Output** → `gsc-history/<sanitized-site>-quiet-death-<YYYY-MM-DD>.json`:

```json
{
  "maturity": "experimental_n1",
  "criteria": { "min_start_clicks": 5, "min_loss_pct": 50, "min_decline_weeks": 6, "rolling_window": 4 },
  "window_weeks": 68,
  "queries_analyzed": 200,
  "flagged_count": 11,
  "quiet_death_queries": [
    { "query": "...", "start_clicks": 48, "end_clicks": 9, "loss_pct": -81, "decline_weeks": 59, "update_correlation": "none", "pattern_hint": "brand_erosion" }
  ]
}
```

Plus stderr-Summary (`[quiet-death] {site}: {flagged_count}/{queries_analyzed} queries flagged ({none}× none, {partial}× partial update-correlation)`).

## Komponente 3 — SKILL.md

- Neue Zeile in der „What gets pulled"-Tabelle: `query_weekly_series` | searchanalytics date+query, weekly-bucketed, top 200 | per-query weekly click series for quiet-death detection.
- Neue Sektion „Quiet-Death Detection (experimental, N=1)": was es ist, der Detector-Befehl (`node quiet-death-detect.example.js <snapshot.json>`), die Kriterien-Tabelle, die `update_correlation`-Semantik, die `brand_terms`-Config, der `maturity`-Vorbehalt.
- Version-Bump in der Frontmatter (`0.5.2` → `0.5.3`).

## Testing / Validierung

- `claude plugin validate plugins/seo-rescue` + `claude plugin validate .` → `✔`
- Neue Fixture `plugins/seo-rescue/test-fixtures/ecommerce-recovery/gsc-quiet-death-fixture.json`: Snapshot mit synthetischer `query_weekly_series` — eine klare Quiet-Death-Query (monotoner Decline, kein Update), eine update-korrelierte Decline-Query, eine gesunde Query (kein Flag).
- Neue Fixture `core-updates-fixture.md`: minimaler CORE_UPDATES.md-Auszug mit einem Update-Fenster, gegen das `update_correlation` getestet wird.
- `quiet-death-detect.test.js` (zero-dep): `require()`t den Detector, ruft `detectQuietDeath(fixture, updateWindows)` und prüft: (a) genau die Quiet-Death-Query ist geflaggt, (b) die gesunde Query nicht, (c) die update-korrelierte Query hat `update_correlation: "partial"`, (d) `pattern_hint` korrekt, (e) `parseUpdateWindows` liest das Fixture-Fenster. Exit-Code ≠ 0 bei Verletzung.
- 55er-Suite (`lib-safe-primitives.test.js`) als Regressionsnetz.

## Bewusst ausgeklammert (YAGNI)

- Befund-Integration in `recovery-diagnose` (`quiet_death_queries`-Feld) — spätere eigene Entscheidung; L2 bleibt im gsc-deep-dive-Output.
- Unit-Test der Fetch-Erweiterung (braucht GSC-Creds).
- L3/L4/L5.

## Risiko

Niedrig–mittel. Detector ist netzfrei und voll testbar. Hauptrisiken: (1) Monotonie-Heuristik zu strikt/lasch → durch konkrete Schwellen + Rausch-Toleranz (+2 %) und Fixture-Tests abgesichert; (2) GSC-Row-Limit bei date×query → durch Top-200-Cap + Log abgefangen; (3) `parseUpdateWindows`-Fragilität gegenüber CORE_UPDATES.md-Format → eigener Fixture-Test + graceful: kein Fenster geparst ⇒ alle `update_correlation: "none"` (Detector läuft weiter).
