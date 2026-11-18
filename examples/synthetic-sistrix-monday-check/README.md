# Synthetic SISTRIX Monday Recovery Check

Worked example for the [`sistrix-monday-recovery-check`](../../plugins/seo-rescue/skills/sistrix-monday-recovery-check/SKILL.md) skill. All data here is synthetic.

## Scenario

A furniture ecommerce shop in active recovery from a Google Core Update reshuffle. Two SISTRIX keyword exports a week apart. The recovery has produced strong gains in the product-detail cluster (one head term moved from position 18 to position 2) while four informational head terms lost ground and three keywords left the export, with the visibility index roughly flat. Recomputed from the CSVs, 20 of the 25 shared keywords improved, 4 declined and 1 is unchanged; weighted by volume and position the gains outweigh the losses, so the expected output reads the flat index as lagging, with concentrated losses in the guide cluster.

| Field | Value |
|---|---|
| Domain | `example-furniture-shop.test` |
| Current export | `input-current.example.csv` (week of 2026-05-26, 25 keywords) |
| Previous export | `input-previous.example.csv` (week of 2026-05-19, 28 keywords) |
| Money keywords | `money-keywords.example.csv` |
| Important keyword | `office chair ergonomic 27 inch` (current pos 2, previous pos 18) |
| VI current | 0.84 |
| VI previous | 0.85 |
| Expected output | `expected-output.example.md` |

All three CSV files use a representative shape. A real SISTRIX UI export will have more rows (typically several hundred to several thousand depending on the keyword set) and may carry additional columns. The skill normalizes column names case-insensitively and accepts both the English and German export forms.

## Try it

From a clone of the repository, in Claude Code:

```
/seo-rescue:sistrix-monday-recovery-check examples/synthetic-sistrix-monday-check/input-current.example.csv examples/synthetic-sistrix-monday-check/input-previous.example.csv example-furniture-shop.test examples/synthetic-sistrix-monday-check/money-keywords.example.csv
```

Tell Claude the two index values from the table above (0.84 and 0.85). The same three CSVs and the expected output also ship inside the plugin, under `skills/sistrix-monday-recovery-check/examples/`, so the example works from an installed plugin without a clone.

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

Column names are matched without regard to case, and spaces, underscores and hyphens count as the same (`Search Volume`, `search_volume` and `search-volume` are one column). Comma and semicolon are both accepted as separators, UTF-8 with or without BOM. The full rule is in the skill's `SKILL.md`, section "Column names, separator, encoding".

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

This folder is the reference for the skill's output shape: any change to the skill output contract that would break the shape of `expected-output.example.md` must be reflected here, and the example should be re-rendered. A future v0.6+ evaluation harness will diff the actual skill output against this expected file as a structural assertion (not a numeric equality check for the score and the impact labels, which are heuristic; the counts are exact and are checked by `plugins/seo-rescue/test-fixtures/ecommerce-recovery/monday-example.test.js`).
