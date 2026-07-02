---
name: sistrix-monday-recovery-check
description: 'CSV-first weekly recovery review during an active SEO recovery. No SISTRIX API key required. Compares current and previous SISTRIX keyword exports and produces a structured Monday Check report with Recovery Signal Score, per-cluster recovery stage, winner/loser neutralization analysis, money-keyword protection list, URL-level recovery table, optional GSC cross-check, optional conversion-rate validation, and one of six recommended actions (Observe / Protect / Strengthen / Investigate / Correct / Escalate) with an explicit What-Not-To-Touch guard for winning URLs. Triggers from "Monday recovery check", "SISTRIX recovery review", "weekly Monday SEO ritual", "compare this Monday SISTRIX to last Monday", "is the visibility index lagging behind ranking gains", "winner-loser neutralization check", "are my money keywords protected". Full output contract in SISTRIX_MONDAY_RECOVERY_CHECK.md; operational detail in RECOVERY_SYSTEM.md sections 4-10.'
user-invokable: true
argument-hint: '[current-csv] [previous-csv] [domain?] [money-keywords-csv?]'
allowed-tools: [Read, Write, Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.2'
  category: marketing
---

# SISTRIX Monday Recovery Check

## Overview

During an active SEO recovery, every Monday the operator asks the same questions: did rankings recover, are money keywords holding, are winners and losers offsetting each other, is the visibility index lagging behind actual ranking gains. Without structure, the answer is ad-hoc and biased toward whatever the operator opens first in the SISTRIX UI.

This skill turns the Monday review into a fixed 17-section report so the same questions get answered consistently week over week. The full methodology lives in [SISTRIX_MONDAY_RECOVERY_CHECK.md](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md) (canonical spec) and [RECOVERY_SYSTEM.md](../../../../RECOVERY_SYSTEM.md) (operational detail for sections 4-10). This SKILL.md is the runnable skill that executes that workflow against the operator's CSV exports.

## When to use

- A domain in an active recovery from a Google Core Update or AI Overview reshuffle and the operator wants a weekly structured pulse
- A new SISTRIX export landed and the operator wants to know "is the recovery working" without manually eyeballing 12 charts
- The operator suspects winner/loser neutralization is masking actual recovery and wants the numbers
- The operator is about to make a content or template change to a winning URL and wants a "what not to touch" check first
- An agency client deliverable: a consistent Monday report format the client can read in 5 minutes

**Don't use for:**

- Brand-new recovery diagnosis (use [[post-core-update-recovery]] for the initial diagnostic)
- A one-off audit (use [[seo-outreach-report]] for the full decision-maker PDF instead)
- Pre-recovery baselining (run [[psi-weekly-cron-baseline]] alongside instead — that is the technical-health pulse, this skill is the ranking pulse)
- Decisions about specific URL templates or code (this skill produces direction; the operator's team handles execution)

## CSV-first contract

The skill does not require a SISTRIX API key. It accepts CSV exports produced from the SISTRIX UI's Keywords table. The operator exports the current week's CSV, the previous week's CSV, and optionally a money-keywords CSV.

### Expected CSV shape

A SISTRIX keyword export usually carries at minimum: `Keyword`, `Position`, `URL`, `Search Volume`, `Competition`, `SERP Features`, and optionally `Previous Position`, `CPC`, and `Intent`. Column names vary by SISTRIX UI version and export type. The skill normalizes column names case-insensitively and accepts the German export form (`Keyword`, `Position`, `URL`, `Suchvolumen`, `Wettbewerb`, `SERP-Features`) as well.

If a CSV is missing one of the optional fields, the skill degrades gracefully: the section that needed that field is marked "(data not in export)" rather than producing a fabricated number.

### Path arguments

```
/seo-rescue:sistrix-monday-recovery-check ./sistrix-exports/example-shop-2026-05-26.csv ./sistrix-exports/example-shop-2026-05-19.csv example-shop.test
```

If money keyword tracking is desired:

```
/seo-rescue:sistrix-monday-recovery-check ./sistrix-exports/current.csv ./sistrix-exports/previous.csv example-shop.test ./money-keywords.csv
```

The CSVs themselves are gitignored under the existing `sistrix-exports/`, `*_sistrix*.csv`, `*_keywords*.csv` rules in [.gitignore](../../../../.gitignore). Do not commit operator exports.

## How Claude executes the workflow

This is a pure-Markdown framework skill. Claude reads the two CSVs via the Read tool, applies the methodology below, and writes the resulting report to `./output/sistrix-monday-checks/<sanitized-domain>-<YYYY-MM-DD>.md`.

### Step 1 — Load and validate inputs

1. Read the current-week CSV. Detect column names. Build a normalized keyword table: `{keyword, position, url, search_volume, intent?, previous_position?}`.
2. Read the previous-week CSV. Same normalization. Build the same shape.
3. If either CSV has fewer than ~50 rows, warn the operator that the sample may be too small for reliable Winner/Loser analysis (real recovery tracking should use the full SISTRIX export, typically several hundred to several thousand keywords) and offer to continue anyway.
4. Build the keyword-keyed merge: `keywords_both = current ∩ previous`, `keywords_returned = current \ previous`, `keywords_lost = previous \ current`.

### Step 2 — Visibility Index interpretation

If the operator provided current and previous VI values inline (the SISTRIX UI shows them on the domain overview), classify the delta as `Rising / Falling / Flat / Lagging / Neutralized` per [SISTRIX_MONDAY_RECOVERY_CHECK.md §1](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md). The "Lagging" diagnosis fires when individual keyword positions improve materially but the index does not yet reflect the gains. The "Neutralized" diagnosis fires when winners exist but are offset by larger losses on a few head terms.

If no VI value is supplied, mark the VI section "(value not supplied; infer from keyword distribution only)".

### Step 3 — Keyword recovery distribution

Compute for both exports:

- Top 100, Top 50, Top 20, Top 10, Top 5, Top 3 counts
- Newly-returned (`keywords_returned`)
- Lost (`keywords_lost`)
- Improved (in both, current position lower than previous)
- Declined (in both, current position higher than previous)

Output as a single table with current-week, previous-week, delta, and delta-percent columns. The Top 3 and Top 10 deltas are the most operationally meaningful — flag them visually if they meaningfully changed.

### Step 4 — Winner/Loser neutralization

Apply the detection logic from [RECOVERY_SYSTEM.md §5](../../../../RECOVERY_SYSTEM.md). The pattern: many small gains being offset by a few large head-term losses. Output:

- Top 10 winners by position gain
- Top 10 winners by commercial value (`search_volume * intent_weight`)
- Top 10 winners by visibility impact (`search_volume * ctr_curve(position)`)
- Top 10 losers by position loss
- Top 10 losers by visibility impact
- A 1-2 sentence interpretation of why the index might be flat or moving counter to keyword direction

The CTR curve uses the standard SISTRIX position-to-CTR curve as documented in [RECOVERY_SYSTEM.md §5](../../../../RECOVERY_SYSTEM.md); if the operator provided GSC CTR data per query, prefer that.

### Step 5 — Money keyword protection

If the operator provided a money-keywords CSV (schema: `keyword,intent,priority,notes`), join against the current export and emit the protection table per [SISTRIX_MONDAY_RECOVERY_CHECK.md §4](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md). For each money keyword:

| Keyword | Current Pos | Previous Pos | Δ | URL | Intent | Priority | Recommendation | What Not To Change |

If no money-keyword CSV was provided, heuristically identify candidates by combining search volume, transactional intent signals (presence of keywords like "kaufen", "buy", "price", "günstig", category names supplied by the operator), and the operator's domain category if known. Mark these "(heuristic — confirm with operator)".

### Step 6 — URL-level recovery

Group all current-export keywords by ranking URL. For each URL with ≥3 keywords or any Top-10 keyword:

- Number of gained keywords
- Number of lost keywords
- Top 10 changes (count + sample list)
- Top 3 changes
- Commercial-keyword changes (intersection with money list if supplied)
- Visibility impact estimate (sum of `search_volume * ctr_delta`)
- URL type (category, product, guide, blog, homepage, comparison, brand, unknown — infer from URL slug heuristics; mark "unknown" if no clear pattern)
- Recommended action: Observe / Protect / Strengthen / Investigate / Correct

### Step 7 — Per-cluster recovery stage classification

Cluster the keyword set by URL type, by URL path prefix, or by topic heuristic (whichever is most coherent given the data). For each cluster, assign Stage 0-5 per [SISTRIX_MONDAY_RECOVERY_CHECK.md §6](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md):

- Stage 0: no recovery signal
- Stage 1: keywords return to Top 100 / Top 50
- Stage 2: keywords enter Top 20
- Stage 3: important keywords enter Top 10
- Stage 4: money keywords enter Top 5 / Top 3
- Stage 5: visibility index, GSC clicks, and revenue follow

Output the per-cluster table from the spec. Also emit a global stage as the minimum stage across commercially-important clusters (the weighted-average option is available if the operator prefers; mark which method was used).

### Step 8 — Recovery Signal Score (0-100)

Apply the twelve-factor scoring from [RECOVERY_SYSTEM.md §10](../../../../RECOVERY_SYSTEM.md). Interpretation buckets:

- 0-20: no meaningful recovery
- 21-40: weak early signal
- 41-60: early recovery, needs validation
- 61-80: strong recovery signal
- 81-100: strong recovery with business impact

If a factor's input data is missing, mark the factor `n/a` and renormalize the score across the available factors. Always report which factors contributed and which were absent — never invent a factor that wasn't measured.

### Step 9 — Optional GSC cross-check

If the operator provided a GSC export covering the same period (queries + pages with impressions, clicks, CTR, average position), join against the SISTRIX data and apply the interpretation patterns from [SISTRIX_MONDAY_RECOVERY_CHECK.md §11](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md):

- SISTRIX keywords improve but GSC impressions do not → likely low-volume keyword recovery or ranking volatility; check date range
- GSC impressions rise but clicks do not → snippets or SERP features may be compressing CTR
- GSC clicks rise but SISTRIX index flat → trust click data for revenue, SISTRIX for competitive position

If [[gsc-deep-dive]] data is present (`gsc-history/<sanitized-site>-<YYYY-MM-DD>.json` — same filename pattern `gsc-deep-dive` writes), use it directly. Otherwise prompt the operator to supply a manual GSC CSV export.

### Step 10 — Conversion-rate validation layer (optional)

If the operator supplied conversion-rate or revenue data (per URL or aggregate, with a baseline value), apply the VI-trend × CR-trend interpretation matrix from [SISTRIX_MONDAY_RECOVERY_CHECK.md §12](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md). Honor the `r-stockout-mutes-recovery` rule in [DECISION_ENGINE.md](../../../../DECISION_ENGINE.md): out-of-stock product pages get excluded from aggregate CR or flagged separately.

If no CR data is provided, skip this section entirely (do not invent a placeholder).

### Step 11 — Recommended action

Output one of six actions per [SISTRIX_MONDAY_RECOVERY_CHECK.md §8](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md):

- **Observe** — positive early signal, do not make large changes yet
- **Protect** — important rankings are back, avoid risky edits
- **Strengthen** — winners are promising, internal links / snippet tuning warranted
- **Investigate** — index flat because losers may be neutralizing gains
- **Correct** — wrong URLs ranking, cannibalization present, or technical blocker
- **Escalate** — rankings continue to fall despite changes

The action class is derived from the combination of Recovery Signal Score, Stage classification, money-keyword status, and Winner/Loser neutralization signal. Surface the rationale in two lines.

### Step 12 — What Not To Touch

If important keywords are in Top 3 or Top 10, explicitly enumerate the operations the operator should NOT do on the winning URLs this week (title rewrites, H1 rewrites, URL changes, canonical changes, noindex changes, removing internal links, radical content restructuring, deleting supporting content, changing templates without reason). See [SISTRIX_MONDAY_RECOVERY_CHECK.md §9](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md).

### Step 13 — Next-7-day monitoring plan

Concrete items per [SISTRIX_MONDAY_RECOVERY_CHECK.md §10](../../../../SISTRIX_MONDAY_RECOVERY_CHECK.md): monitor 48-72h for stability, protect winning URLs, strengthen internal links, check snippets, confirm product availability, check price/trust/delivery elements, track GSC impressions and clicks, document changes and dates.

### Step 14 — Next-Monday checklist

A bullet checklist of the data the operator should bring to next Monday's check (new SISTRIX export, GSC impressions/clicks for the past week, any changes implemented and their dates, any product availability events, any pricing changes).

### Step 15 — Confidence + limitations

Surface confidence level (low / medium / high) based on:

- Sample size of both exports
- Presence or absence of GSC cross-check
- Presence or absence of money-keyword CSV
- Presence or absence of CR data
- Whether enough time has elapsed since the previous export for ranking movement to be meaningful

Then list data limitations explicitly. This section is non-optional even if everything looks great — the score is a calibrated heuristic, not a forecast.

## Output contract

A single Markdown file at `./output/sistrix-monday-checks/<sanitized-domain>-<YYYY-MM-DD>.md` with these sections in order:

1. Executive Summary (3-4 lines)
2. Recovery Stage (global + per-cluster table)
3. Recovery Signal Score
4. Visibility Index Interpretation
5. Top Keyword Winners
6. Top Keyword Losers
7. Money Keyword Protection List
8. URL-Level Recovery Table
9. Winner/Loser Neutralization summary
10. Conversion Rate Validation (if CR data available)
11. GSC Cross-Check (if available)
12. Recommended Action (one of six)
13. What Not To Touch
14. Next 7-Day Monitoring Plan
15. Next Monday Checklist
16. Confidence Level
17. Data Limitations

Inputs that were not provided are marked `(not provided)` in the relevant section rather than skipped silently. The structure stays constant week-over-week so the operator can diff Monday-to-Monday.

**Domain sanitization rule** (applies to `<sanitized-domain>` and to the `<sanitized-site>` placeholder this skill consumes from `gsc-deep-dive`): the domain is lowercased; allowed characters are `[a-z0-9.-]`; leading dots are stripped; path separators (`/`, `\`), null bytes, and `..` sequences are rejected. A domain that fails sanitization aborts the run rather than falling back to a default. This applies whether Claude derives the filename via Read/Write tools or whether a future helper script computes it via `safeSlug()` in `plugins/seo-rescue/lib/safe.js`.

## Privacy

The CSVs the operator feeds in stay on the operator's machine. The skill writes its output to a gitignored directory by default. Files protected by [.gitignore](../../../../.gitignore):

- `sistrix-exports/`
- `gsc-exports/`
- `*_sistrix*.csv`
- `*_keywords*.csv` (underscore form)
- `money-keywords*.csv` and `*-keywords*.csv` (hyphen form — covers the example filename used in the path-argument section above)
- `*_visibility*.csv`
- `*_ranking*.csv`
- `output/` (covers `output/sistrix-monday-checks/` and any other skill that writes to this tree)

Synthetic `.example.csv` files inside `examples/` are explicitly allow-listed via a negation rule in `.gitignore` so contributors can ship demonstration data without it being shadowed by the keyword-list rules above.

If the operator is running in a sensitive-client-data mode (see [ARCHITECTURE.md §5](../../../../ARCHITECTURE.md#5-privacy-and-client-data)), the output filename is hashed and the path is mode-0700. If you run this skill in a fork or derived repository, verify the `output/` rule is present in your `.gitignore` before the first run.

## What this skill does not do

- Does not call the SISTRIX API. CSV-first only (as of v0.5.2, still true). Optional API integration is planned for the v0.9 beta.
- Does not predict rankings with certainty. The Recovery Signal Score is a calibrated heuristic; treat it as one input, not as a forecast.
- Does not recommend rewriting winning content. The What-Not-To-Touch section is explicit about this.
- Does not require API keys.
- Does not send any data outside the operator's machine.

## Related skills

- [[post-core-update-recovery]] — the initial diagnostic that decides whether the situation is a Core-Update pattern at all. Run this before starting weekly Monday checks.
- [[gsc-deep-dive]] — the GSC cross-check data source if the operator has GSC API access configured. The Monday check reads `gsc-history/<sanitized-site>-*.json` directly when present (same filename pattern that skill writes).
- [[psi-weekly-cron-baseline]] — the technical-health weekly pulse that runs alongside the Monday ranking pulse.
- [[ai-citations-tracker]] — AI citations are the possible-early-signal companion (hypothesis, N=1, currently unproven: AI mentions MAY move 2-6 weeks before classical SISTRIX VI; the pilot-case observation was rescinded on 2026-06-03 — log the signal, do not act on it alone). Per-cluster Stage classification exists because recovery propagates unevenly across clusters, independent of that hypothesis.
- [[seo-outreach-report]] — the 10-chapter PDF deliverable. The Monday check feeds the recovery section.

## Realistic expectations

- **First-run setup time:** 5-10 minutes (one export, one previous export, optional money-keyword list)
- **Per-run cost:** $0 (CSV-only, no API calls)
- **Time per run:** 1-2 minutes once Claude has the CSVs in context
- **First useful trend:** after 3-4 weekly runs (signal stabilizes over a few weeks)
- **Where it can be wrong:** small samples (<50 keywords in either export) produce unreliable Winner/Loser detection; the skill warns when this is the case
- **Where it cannot help:** if the recovery is being held back by something the SISTRIX export doesn't show (technical block, manual action, content quality issue at the page level), the Monday check will misclassify the cause. Pair with [[post-core-update-recovery]] and [[gsc-deep-dive]] for the full diagnostic surface.

## Synthetic example

A worked example with synthetic data ships at [`examples/synthetic-sistrix-monday-check/`](../../../../examples/synthetic-sistrix-monday-check/). The example uses:

- Domain: `example-furniture-shop.test`
- Important keyword: `office chair ergonomic 27 inch`
- Scenario: current position 2, previous position 18, 200+ keywords returned, visibility index flat, some head terms lost, GSC impressions rising, clicks not yet fully recovered

All data is synthetic. No real company names, no real exports, no real revenue numbers. The README in that folder shows the input CSV shape and the expected output Markdown.
