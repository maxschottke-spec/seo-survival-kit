# SISTRIX Monday Recovery Check — example-furniture-shop.test

**Date:** 2026-05-26 · **Comparison period:** 2026-05-19 → 2026-05-26 (7 days) · **Skill version:** 0.5.6

> Every count in this file was recomputed from the three example CSVs for v0.5.6 (the earlier version said "21 of 25 improved" and "Top-3 from 4 to 5"; the inputs give 20 of 25 and 1 to 3). The Recovery Signal Score in section 3 stays an illustrative figure, see the note there.

## 1. Executive Summary

The recovery is in mid-flight. Of the 25 keywords present in both exports, 20 improved, 4 declined and 1 is unchanged (the brand term at position 1). The flagship long-tail `office chair ergonomic 27 inch` moved from position 18 to position 2. The informational-guide cluster declined on four head terms (gaming-chair comparison, back-pain guide, ergonomic-definition guide, benefits guide), and three keywords from last week's export are no longer in this week's export, two of them previously in the Top 10. Visibility index is flat (0.85 → 0.84). Weighted by search volume and position, the gains in this sample are larger than the losses, so the flat index is read as lagging, with a concentrated loss in the guide cluster. **Recommended action: Protect.**

## 2. Recovery Stage

**Global stage:** Stage 4 (money keywords entering Top 5/Top 3 across the product cluster).

| Cluster | Stage | Key signal | Top keyword | Position | Trend |
|---|---|---|---|---|---|
| Product (office chairs) | Stage 4 | Flagship long-tail at Pos 2, 8 of 10 keywords in Top 12 | `office chair ergonomic 27 inch` | Pos 2 | Rising |
| Product (desks) | Stage 2 | 3 of 6 keywords now in Top 20 (0 of 6 a week ago) | `office desk small` | Pos 14 | Rising |
| Brand / navigational | Stage 5 | Brand anchor stable at Pos 1, reviews surface at Pos 3 | `example-furniture-shop` | Pos 1 | Stable |
| Informational guides | Stage 1 | Four head terms fell out of the Top 20 (one of them out of the Top 10) | `best office chair for back pain` | Pos 21 | Falling |
| Storage / accessories | Stage 1 | Pos 42 and 55, both 13 positions better than a week ago | `filing cabinet` | Pos 42 | Slowly rising |

Method: minimum-stage across commercially-important clusters. The "Informational guides" cluster pulls the global stage down from 4 to a more cautious read, but money-keyword-protection-weighted view gives Stage 4 because the protected commercial cluster is the operationally-meaningful one.

## 3. Recovery Signal Score

**Score: 68 / 100** — Strong recovery signal (61-80 band). Illustrative figure: `RECOVERY_SYSTEM.md` §10 lists the factors and weights but does not define how each factor is normalized, so a real run on the same CSVs can land some points higher or lower. The inputs in the table are exact.

| # | Factor (RECOVERY_SYSTEM.md §10) | Direction | Input from the two exports |
|---|---|---|---|
| 1 | Returned keywords | 0 | 0 returned, 3 no longer in the export |
| 2 | Top 50 growth | − | 26 → 24 (−2) |
| 3 | Top 20 growth | − | 18 → 16 (−2) |
| 4 | Top 10 growth | + + | 6 → 9 (+3): six keywords entered, one fell out, two are no longer in the export |
| 5 | Top 3 growth | + + | 1 → 3 (+2): `office chair ergonomic 27 inch` at 2, `example-furniture-shop reviews` at 3 |
| 6 | Money keyword recovery | + + | 10 of 11 money keywords improved, 1 unchanged at Pos 1; 6 of 9 transactional money keywords now Top 10 (0 of 9 a week ago) |
| 7 | Affected URL recovery | n/a | (first run; needs last week's loser list) |
| 8 | GSC impression growth | n/a | (GSC export not provided) |
| 9 | GSC click growth | n/a | (GSC export not provided) |
| 10 | Visibility index trend | 0 | 0.85 → 0.84 (−1.2 %), flat |
| 11 | Loser neutralization risk | − | Medium: net balance positive, losses concentrated (see section 9) |
| 12 | Wrong URL / cannibalization risk | 0 | No money keyword ranks on a guide or blog URL |
| 13 | Tracking / data confidence | cap | Medium: 25 keywords, no GSC, first run |

The Top 50 and Top 20 counts fall although 20 keywords improved, because three keywords dropped out of the export. Counted over the 25 keywords present in both exports, both counts rise by one. Factors 7 to 9 are `n/a`; the score is renormalized across the factors that were measured.

## 4. Visibility Index Interpretation

VI moved 0.85 → 0.84 (−1.2 %), classified as **Lagging**, with a neutralization component: keyword positions improved materially (Top 10 from 6 to 9, Top 3 from 1 to 3) and the index does not reflect it yet. The losses on four informational head terms and the three keywords that left the export are real, but in this sample they are smaller than the gains (section 9). Do not draw the conclusion that "nothing is working".

The index is computed by SISTRIX over its own keyword set, not over these 25 keywords. If the VI stays flat over the next 2-3 Mondays while the tracked keywords keep improving, look for losses outside the export before trusting either number. Surface this explicitly to the operator's team.

## 5. Top Keyword Winners

Top 10 by position gain:

| Keyword | URL | Previous | Current | Δ | Volume | Visibility Impact |
|---|---|---|---|---|---|---|
| `office chair ergonomic 27 inch` | `/office-chair-ergo-27` | 18 | 2 | +16 | 4 400 | high |
| `filing cabinet` | `/storage/filing` | 55 | 42 | +13 | 2 900 | none yet (below Top 20) |
| `office bookshelf` | `/storage/bookshelves` | 68 | 55 | +13 | 1 900 | none yet (below Top 20) |
| `office desk small` | `/desks/small` | 26 | 14 | +12 | 2 900 | low |
| `oak desk` | `/desks/oak` | 45 | 33 | +12 | 1 600 | none yet (below Top 20) |
| `office chair with footrest` | `/office-chairs/footrest` | 29 | 18 | +11 | 1 300 | low |
| `standing desk converter` | `/desks/converters` | 33 | 22 | +11 | 4 400 | none yet (below Top 20) |
| `office chair under 300` | `/office-chairs/budget` | 24 | 15 | +9 | 1 900 | low |
| `office desk wood` | `/desks/wood` | 28 | 19 | +9 | 3 300 | low |
| `adjustable office chair` | `/office-chairs/adjustable` | 19 | 10 | +9 | 4 400 | low-medium |

By visibility impact (search volume × expected CTR at the new position minus at the old one) two keywords carry most of the gain: `office chair ergonomic 27 inch` (18 → 2) and `office chair ergonomic` (11 → 5, volume 9 900). The largest keyword by volume, `desk chair` (18 100), improved from 16 to 11 and adds little until it reaches the Top 10.

## 6. Top Keyword Losers

| Keyword | URL | Previous | Current | Δ | Volume | Visibility Impact |
|---|---|---|---|---|---|---|
| `what is an ergonomic chair` | `/guides/what-is-ergonomic` | 15 | 45 | −30 | 2 900 | medium |
| `ergonomic chair benefits` | `/guides/benefits` | 18 | 38 | −20 | 1 900 | low-medium |
| `gaming chair vs office chair` | `/guides/gaming-vs-office` | 12 | 32 | −20 | 4 400 | medium-high |
| `best office chair for back pain` | `/guides/back-pain` | 8 | 21 | −13 | 8 100 | high |

No longer in this week's export (present last week): `office chair leather` (was Pos 9), `small office furniture` (was Pos 11), `ergonomic office setup` (was Pos 7). These warrant a separate cannibalization / indexation check.

## 7. Money Keyword Protection List

| Keyword | Current Pos | Previous Pos | Δ | URL | Intent | Priority | Recommendation | What Not To Change |
|---|---|---|---|---|---|---|---|---|
| `office chair ergonomic 27 inch` | 2 | 18 | +16 | `/office-chair-ergo-27` | transactional | high | **Protect** | Title, H1, URL, canonical, internal-link template — winning state is fragile |
| `office chair ergonomic` | 5 | 11 | +6 | `/office-chairs` | transactional | high | Protect | Category page meta + faceted navigation structure |
| `desk chair` | 11 | 16 | +5 | `/office-chairs` | transactional | high | Strengthen (internal links from product LPs) | Don't change the canonical to a different category page |
| `office chair lumbar support` | 9 | 17 | +8 | `/office-chairs/lumbar` | transactional | high | Protect | Filter page content + schema |
| `ergonomic desk chair black` | 7 | 14 | +7 | `/office-chairs/black` | transactional | medium | Protect | Color-facet template |
| `mesh office chair` | 12 | 20 | +8 | `/office-chairs/mesh` | transactional | medium | Strengthen (snippet tuning) | Don't merge with parent category |
| `high back office chair` | 8 | 15 | +7 | `/office-chairs/high-back` | transactional | medium | Protect | Type-facet template |
| `adjustable office chair` | 10 | 19 | +9 | `/office-chairs/adjustable` | transactional | medium | Strengthen | Don't rewrite product descriptions on winning LPs |
| `office chair under 300` | 15 | 24 | +9 | `/office-chairs/budget` | transactional | medium | Observe | Approaching Top 10 — leave alone |
| `example-furniture-shop` | 1 | 1 | 0 | `/` | navigational | high | Protect | Homepage title, schema, internal-link structure |
| `example-furniture-shop reviews` | 3 | 4 | +1 | `/reviews` | navigational | medium | Protect | Reviews-page structure + AggregateRating schema |

## 8. URL-Level Recovery Table

"Gained Kw" counts keywords of that URL whose position improved, "Lost Kw" those whose position declined or that left the export.

| URL | URL Type | Gained Kw | Lost Kw | Top-10 Δ | Top-3 Δ | Visibility Δ | Recommended Action |
|---|---|---|---|---|---|---|---|
| `/office-chair-ergo-27` | product | 1 | 0 | +1 | +1 (Pos 2) | high (+) | **Protect** |
| `/office-chairs` | category | 2 | 0 | +1 | 0 | high (+) | Protect |
| `/office-chairs/lumbar` | category-facet | 1 | 0 | +1 | 0 | low (+) | Protect |
| `/office-chairs/high-back` | category-facet | 1 | 0 | +1 | 0 | low (+) | Protect |
| `/office-chairs/black` | category-facet | 1 | 0 | +1 | 0 | low (+) | Protect |
| `/office-chairs/adjustable` | category-facet | 1 | 0 | +1 | 0 | low-medium (+) | Strengthen |
| `/office-chairs/mesh` | category-facet | 1 | 0 | 0 | 0 | 0 (Pos 12, still outside Top 10) | Strengthen |
| `/office-chairs/budget` | category-facet | 1 | 0 | 0 | 0 | low (+) | Observe |
| `/office-chairs/footrest` | category-facet | 1 | 0 | 0 | 0 | low (+) | Observe |
| `/guides/back-pain` | guide | 0 | 1 | −1 (left Top 10) | 0 | high (−) | **Investigate** |
| `/guides/gaming-vs-office` | guide | 0 | 1 | 0 | 0 | low-medium (−) | Investigate |
| `/guides/what-is-ergonomic` | guide | 0 | 1 | 0 | 0 | low (−) | Investigate |
| `/guides/benefits` | guide | 0 | 1 | 0 | 0 | low (−) | Investigate |
| `/guides/ergonomic-setup` | guide | 0 | 1 (left export) | −1 | 0 | medium (−) | Investigate |
| `/guides/small-spaces` | guide | 0 | 1 (left export) | 0 | 0 | low (−) | Investigate |
| `/office-chairs/leather` | category-facet | 0 | 1 (left export) | −1 | 0 | low-medium (−) | Investigate |
| `/desks/...` (6 URLs) | category | 6 | 0 | 0 | 0 | low (+) | Strengthen |
| `/storage/...` (2 URLs) | category | 2 | 0 | 0 | 0 | none yet (+) | Observe |
| `/` | homepage | 0 | 0 | 0 | 0 | 0 | Protect |
| `/reviews` | brand | 1 | 0 | 0 | +1 (Pos 3) | low (+) | Protect |
| `/about` | brand | 1 | 0 | 0 | 0 | 0 | Protect |

Column check: Top-10 Δ sums to +3 (six in, three out), Top-3 Δ to +2, as in section 3.

## 9. Winner/Loser Neutralization summary

Severity per `RECOVERY_SYSTEM.md` §8: **Medium** (gains exist, losses are concentrated).

Raw counts:

- Winners: 20 keywords, 86 300 search volume in total, average gain 8.5 positions
- Losers: 4 keywords, 17 300 search volume in total, average loss 20.75 positions
- Left the export: 3 keywords, 10 400 search volume in total (previous positions 7, 9 and 11)

Weighted by the rule-of-thumb expected-CTR table (search volume × expected CTR at the current position minus at the previous one; positions below 20 count as zero):

- Gains: about +1 530 estimated monthly clicks, 85 % of it from the five largest winners (`office chair ergonomic 27 inch` and `office chair ergonomic` alone account for about +1 140)
- Losses: about −640, 89 % of it from the five largest (`best office chair for back pain` 8 → 21 alone about −240; the three keywords that left the export together about −260)
- Net: about +890

The balance in this sample is positive, so the losers do not cancel the gains here. They are concentrated, though: the whole negative side sits in the guide cluster and in three keywords that disappeared. The position-to-CTR relation is non-linear, which is why 8 of the 20 winners add nothing yet by this table: they moved inside one CTR band or are still below position 20 (`oak desk` 45 → 33), while one loss from position 8 costs more than several of the smaller gains together.

**Possible cause** of the informational decline (not established by this run): the guide pages may have been deprioritized by the Core Update in favor of more authoritative comparison or research sources for those query intents. That would be independent of the product-LP recovery. Cross-check with [[ai-citations-tracker]] history and with the GSC data for the guide URLs before acting on it.

## 10. Conversion Rate Validation

(CR data not provided. Skipped per skill contract — no placeholder inserted.)

## 11. GSC Cross-Check

(GSC export not provided. Skipped per skill contract.)

If a GSC export covering 2026-05-19 → 2026-05-26 is supplied next Monday, the expected pattern would be:

- Impressions: rising on product-LP queries
- Clicks: rising more slowly than impressions (CTR catch-up lag)
- Average position: improving on the transactional cluster, declining on the guide cluster
- This would lift the Confidence rating from `medium` to `high` and contribute to the Recovery Signal Score factors currently marked `n/a`.

## 12. Recommended Action

**Protect.**

Rationale: important rankings are back across the product cluster (6 of 9 transactional money keywords now Top 10, 8 of 9 in the Top 12; flagship long-tail entered Top 3). The winning state is fragile — winning URLs should be left alone this week. The informational losses warrant `Investigate`, not `Correct`, because the pattern is consistent with a Core-Update authority reshuffle rather than a technical break.

## 13. What Not To Touch

On these winning URLs **do not**:

- Rewrite titles or H1s on `/office-chair-ergo-27`, `/office-chairs`, `/office-chairs/lumbar`, `/office-chairs/high-back`, `/office-chairs/black`, `/office-chairs/adjustable`, `/office-chairs/mesh`
- Change URLs (slug, path depth)
- Change canonicals
- Add or remove `noindex`
- Remove inbound internal links to these URLs from category templates
- Restructure the product-LP content order or sections
- Delete adjacent / supporting content (other product LPs, the parent category page)
- Swap the template these pages use without a deliberate reason

The pattern this section guards against: an operator under pressure who sees the rankings recover and tries to "optimize" the winning page further, breaking the very state that produced the recovery.

## 14. Next 7-Day Monitoring Plan

- Monitor SISTRIX positions Wed and Fri to catch 48-72h stability
- Watch for Top-3 stability on `office chair ergonomic 27 inch` (Pos 2 is fragile; can drop on volatility)
- Confirm product availability on the flagship LP — out-of-stock + recovering ranking is a known CR-killer
- Track GSC impressions + clicks daily for the product cluster
- Strengthen internal links from `/office-chairs` (category) and supporting product LPs to `/office-chair-ergo-27` (deepest gain)
- Check snippets on `/office-chairs/budget` (approaching Top 10 — CTR is the next lever)
- Investigate the `/guides/back-pain` decline: check for SERP-feature changes, competitor authority moves, content freshness signals
- Document any changes implemented this week with exact dates so next Monday's attribution is clean

## 15. Next Monday Checklist

Bring to the next Monday check:

- [ ] Fresh SISTRIX export covering 2026-05-26 → 2026-06-02
- [ ] GSC impressions / clicks / CTR / position for the same week (per query and per page)
- [ ] List of changes implemented since this report with dates
- [ ] Product availability status for the flagship LPs
- [ ] Any pricing changes on protected URLs
- [ ] CR data per URL if available (will activate Section 10)
- [ ] AI citations delta from [[ai-citations-tracker]] if it has been running ≥4 weeks
- [ ] Note any SERP-feature changes observed on losing-guide queries

## 16. Confidence Level

**Medium.**

Reasons confidence is not high:

- Sample of ~25 keywords is small (real recovery tracking should use the full SISTRIX export, typically several hundred to several thousand keywords)
- No GSC cross-check available
- No CR or revenue data available
- First Monday run for this operator (no 4-week trend to compare against)

Reasons confidence is not low:

- The direction is consistent across all product-cluster URLs (every one of them improved)
- Money keyword recovery is broad (not a single-keyword fluke)
- Brand cluster is stable (no signs of penalty or technical break)

## 17. Data Limitations

- Search volume figures are from SISTRIX export (provider snapshot, may lag actual demand by weeks)
- The CTR values used in Section 9 are the rule-of-thumb expected-CTR table from `commands/recovery-diagnose.md` (Schritt 11), not a measured curve; the actual CTR for this domain can differ considerably at any given position, and the table has no value below position 20
- The Recovery Signal Score is a calibrated heuristic, not a forecast. It does not predict next-week ranking.
- The cluster classification is heuristic (URL-slug-based). If the operator can supply a manual URL-type mapping it improves Section 8 accuracy.
- The Recovery Signal Score figure is illustrative (see section 3)
- The four informational decliners may share a common root cause (Core-Update authority reshuffle) or may have independent causes; this run cannot distinguish. The `Investigate` action in Section 12 is what cracks that question.
