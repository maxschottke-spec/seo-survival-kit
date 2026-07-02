# Synthetic SISTRIX Monday Recovery Check

Worked example for the [`sistrix-monday-recovery-check`](../../plugins/seo-rescue/skills/sistrix-monday-recovery-check/SKILL.md) skill. All data here is synthetic.

## Scenario

A furniture ecommerce shop in active recovery from a Google Core Update reshuffle. Two SISTRIX keyword exports a week apart. The recovery has produced strong gains in the product-detail cluster (one head term moved from position 18 to position 2) while two informational head terms lost ground, leaving the visibility index roughly flat. The pattern is the classic Winner/Loser neutralization that this skill exists to make visible.

| Field | Value |
|---|---|
| Domain | `example-furniture-shop.test` |
| Current export | `input-current.example.csv` (week of 2026-05-26) |
| Previous export | `input-previous.example.csv` (week of 2026-05-19) |
| Money keywords | `money-keywords.example.csv` |
| Important keyword | `office chair ergonomic 27 inch` (current pos 2, previous pos 18) |
| VI current | 0.84 |
| VI previous | 0.85 |
| Expected output | `expected-output.example.md` |

All three CSV files use a representative shape. A real SISTRIX UI export will have more rows (typically several hundred to several thousand depending on the keyword set) and may carry additional columns. The skill normalizes column names case-insensitively and accepts both the English and German export forms.

## Input shape — SISTRIX keyword CSV

The skill expects these columns at minimum:

| Column | Required | Notes |
|---|---|---|
| `keyword` | yes | The keyword string |
| `position` | yes | Current rank in the SERP |
| `url` | yes | The ranking URL on the operator's domain |
| `search_volume` | recommended | Monthly volume from SISTRIX |
| `previous_position` | optional | Only present in some SISTRIX export types |
| `intent` | optional | SISTRIX intent classification |
| `cpc` | optional | |
| `competition` | optional | |
| `serp_features` | optional | |

Missing optional columns degrade gracefully: the section that needed that data is marked `(data not in export)`.

## Input shape — money-keywords CSV

| Column | Required | Notes |
|---|---|---|
| `keyword` | yes | Must match (case-insensitive) a keyword in the SISTRIX export |
| `intent` | yes | `transactional`, `commercial-investigation`, `navigational`, or `informational` |
| `priority` | yes | `high`, `medium`, or `low` |
| `notes` | optional | Free-text — appears in the protection table's last column |

If no money-keywords CSV is supplied, the skill falls back to heuristic identification (volume × transactional-intent signal) and clearly labels the picks as heuristic.

## Expected output

The expected-output file shows the 17-section report structure for this scenario. Compare a real run's output against it to verify the skill produced all required sections (with `(not provided)` markers where data was absent).

Some sections in the example show low/medium confidence because:

- No GSC export was supplied alongside (Section 11 marked `(GSC export not provided)`)
- No CR/revenue data was supplied (Section 10 omitted entirely)
- Sample is ~25 keywords (the skill flags this as small but workable)

In a real-world run with GSC + CR data the confidence rises to `high` and Sections 10 and 11 fill in.

## Privacy

All values are synthetic. The TLD is `.test` (RFC 2606 reserved). Money figures, URLs, and intent labels do not correspond to any real shop.

## Notes for skill development

This folder is also the regression check during the v0.5.2 polish cycle (planned as v0.5.1): any change to the skill output contract that would break the shape of `expected-output.example.md` must be reflected here, and the example should be re-rendered. A future v0.6+ evaluation harness will diff the actual skill output against this expected file as a structural assertion (not a numeric equality check — the numbers in the expected file are themselves heuristic).
