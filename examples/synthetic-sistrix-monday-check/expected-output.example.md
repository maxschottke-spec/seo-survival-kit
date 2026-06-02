# SISTRIX Monday Recovery Check — example-furniture-shop.test

**Date:** 2026-05-26 · **Comparison period:** 2026-05-19 → 2026-05-26 (7 days) · **Skill version:** 0.5.1-dev

## 1. Executive Summary

The recovery is in mid-flight. The transactional / product-detail cluster moved up materially (21 of 25 tracked keywords improved their position, including the flagship long-tail `office chair ergonomic 27 inch` from position 18 to position 2). The informational-guide cluster declined on four head terms (gaming-chair-comparison, back-pain guide, ergonomic-definition guide, benefits guide). Visibility index is flat (0.85 → 0.84) because the four informational losers carry meaningful aggregate volume that offsets the smaller-volume product-page wins. This is a positive recovery signal masked by Winner/Loser neutralization. **Recommended action: Protect.**

## 2. Recovery Stage

**Global stage:** Stage 4 (money keywords entering Top 5/Top 3 across the product cluster).

| Cluster | Stage | Key signal | Top keyword | Position | Trend |
|---|---|---|---|---|---|
| Product (office chairs) | Stage 4 | Flagship long-tail at Pos 2, 6 of 7 product LPs in Top 12 | `office chair ergonomic 27 inch` | Pos 2 | Rising |
| Product (desks) | Stage 2 | Entering Top 20 on multiple variant queries | `office desk small` | Pos 14 | Rising |
| Brand / navigational | Stage 5 | Brand anchor stable at Pos 1, reviews surface at Pos 3 | `example-furniture-shop` | Pos 1 | Stable |
| Informational guides | Stage 1 | Lost Top 10 / Top 20 on four head terms | `best office chair for back pain` | Pos 21 | Falling |
| Storage / accessories | Stage 1 | Pos 40-60 range, modest week-on-week gains | `filing cabinet` | Pos 42 | Slowly rising |

Method: minimum-stage across commercially-important clusters. The "Informational guides" cluster pulls the global stage down from 4 to a more cautious read, but money-keyword-protection-weighted view gives Stage 4 because the protected commercial cluster is the operationally-meaningful one.

## 3. Recovery Signal Score

**Score: 68 / 100** — Strong recovery signal (61-80 band).

| Factor | Score | Notes |
|---|---|---|
| Top-3 count delta | + | +1 (from 4 to 5: `office chair ergonomic 27 inch` entered) |
| Top-10 count delta | + + | +3 (multiple product LPs crossed the line) |
| Money-keyword Top-10 ratio | + + | 6 of 7 commercial money keywords now Top 12, vs. 2 of 7 a week ago |
| Winner-Loser visibility balance | − | Loser informational head terms have meaningful aggregate volume |
| Cluster-stage minimum | − | Informational cluster at Stage 1 holds the floor low |
| VI delta | 0 | Flat (−0.01); neutralized signal, not a negative one |
| Returned vs. lost keyword ratio | n/a | (this synthetic sample shows 0 returned / 3 lost; in a real ≥100-keyword export this factor would contribute) |
| GSC click trend | n/a | (GSC export not provided) |
| CR trend | n/a | (CR data not provided) |
| AI citation delta | n/a | (not measured this run; would normally come from [[ai-citations-tracker]]) |
| Stability across last 4 Mondays | n/a | (first run; needs 4 weeks of history) |
| Brand-cluster stability | + | Pos 1 anchor stable, reputation surface at Pos 3 |

Score renormalized across the 7 contributing factors. The 4 `n/a` factors would lift confidence rather than the score itself.

## 4. Visibility Index Interpretation

VI moved 0.85 → 0.84 (−1.2 %), classified as **Neutralized**: clear keyword-level recovery in product clusters is being offset by losses on four high-volume informational head terms. The flat VI is the expected indicator-lag pattern; do not draw the conclusion that "nothing is working" — the product cluster is actively recovering.

If the informational losses are not addressed in the next 2-3 Mondays, the VI will stay flat even as transactional rankings keep improving, which can mask the genuine business recovery from non-SEO stakeholders reading the SISTRIX UI directly. Surface this explicitly to the operator's team.

## 5. Top Keyword Winners

| Keyword | URL | Previous | Current | Δ | Volume | Visibility Impact |
|---|---|---|---|---|---|---|
| `office chair ergonomic 27 inch` | `/office-chair-ergo-27` | 18 | 2 | +16 | 4 400 | high |
| `mesh office chair` | `/office-chairs/mesh` | 20 | 12 | +8 | 5 400 | medium |
| `adjustable office chair` | `/office-chairs/adjustable` | 19 | 10 | +9 | 4 400 | medium |
| `office chair ergonomic` | `/office-chairs` | 11 | 5 | +6 | 9 900 | high |
| `office chair lumbar support` | `/office-chairs/lumbar` | 17 | 9 | +8 | 3 300 | medium |
| `office desk small` | `/desks/small` | 26 | 14 | +12 | 2 900 | low-medium |
| `oak desk` | `/desks/oak` | 45 | 33 | +12 | 1 600 | low |
| `office chair with footrest` | `/office-chairs/footrest` | 29 | 18 | +11 | 1 300 | low |
| `desk chair` | `/office-chairs` | 16 | 11 | +5 | 18 100 | high |
| `ergonomic desk chair black` | `/office-chairs/black` | 14 | 7 | +7 | 2 900 | medium |

## 6. Top Keyword Losers

| Keyword | URL | Previous | Current | Δ | Volume | Visibility Impact |
|---|---|---|---|---|---|---|
| `what is an ergonomic chair` | `/guides/what-is-ergonomic` | 15 | 45 | −30 | 2 900 | medium |
| `ergonomic chair benefits` | `/guides/benefits` | 18 | 38 | −20 | 1 900 | low-medium |
| `gaming chair vs office chair` | `/guides/gaming-vs-office` | 12 | 32 | −20 | 4 400 | medium-high |
| `best office chair for back pain` | `/guides/back-pain` | 8 | 21 | −13 | 8 100 | high |

Lost from previous export entirely (no longer ranking in Top 100): `office chair leather`, `small office furniture`, `ergonomic office setup`. These warrant a separate cannibalization / indexation check.

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

| URL | URL Type | Gained Kw | Lost Kw | Top-10 Δ | Top-3 Δ | Visibility Δ | Recommended Action |
|---|---|---|---|---|---|---|---|
| `/office-chair-ergo-27` | product | 1 | 0 | +1 (Pos 2 entered) | +1 | high (+) | **Protect** |
| `/office-chairs` | category | 2 | 0 | +1 | 0 | high (+) | Protect |
| `/office-chairs/lumbar` | category-facet | 1 | 0 | +1 | 0 | medium (+) | Protect |
| `/office-chairs/mesh` | category-facet | 1 | 0 | +1 | 0 | medium (+) | Strengthen |
| `/office-chairs/high-back` | category-facet | 1 | 0 | +1 | 0 | medium (+) | Protect |
| `/office-chairs/black` | category-facet | 1 | 0 | +1 | 0 | medium (+) | Protect |
| `/office-chairs/adjustable` | category-facet | 1 | 0 | +1 | 0 | medium (+) | Strengthen |
| `/office-chairs/budget` | category-facet | 0 | 0 | 0 | 0 | low (+) | Observe |
| `/office-chairs/footrest` | category-facet | 0 | 0 | 0 | 0 | low (+) | Observe |
| `/guides/back-pain` | guide | 0 | 1 | −1 (left Top 10) | 0 | high (−) | **Investigate** |
| `/guides/what-is-ergonomic` | guide | 0 | 0 | 0 | 0 | medium (−) | Investigate |
| `/guides/gaming-vs-office` | guide | 0 | 0 | 0 | 0 | medium (−) | Investigate |
| `/guides/benefits` | guide | 0 | 0 | 0 | 0 | low (−) | Investigate |
| `/desks/...` (multiple) | category | 3 | 0 | 0 | 0 | low-medium (+) | Strengthen |
| `/storage/...` (multiple) | category | 2 | 0 | 0 | 0 | low (+) | Observe |
| `/` | homepage | 0 | 0 | 0 | 0 | 0 | Protect |
| `/reviews` | brand | 1 | 0 | 0 | 0 | low (+) | Protect |
| `/about` | brand | 0 | 0 | 0 | 0 | 0 | Protect |

## 9. Winner/Loser Neutralization summary

The product cluster is producing many small-to-medium position gains. The guide cluster is losing on a small number of high-volume head terms. Aggregate visibility math:

- Winners (top 10 listed above): ~31 500 search volume × average gain of 9 positions
- Losers (4 head terms): ~17 300 search volume × average loss of 21 positions

The position-to-CTR curve is non-linear: losses from positions 5-15 (`back pain` guide 8 → 21) cost more visibility per unit search volume than gains from positions 15-25 (`oak desk` 45 → 33). This is why the index can be flat or negative while keyword-count direction is clearly positive.

**Likely root cause** of the informational decline: the guide pages may have been deprioritized by the Core Update in favor of more authoritative comparison or research sources for those query intents. The product-LP recovery is independent and reflects the operator's Authority-First / E-E-A-T work landing on the transactional cluster first. Cross-check with [[ai-citations-tracker]] history — AI mentions on the guide topics moving sideways or down would confirm this read.

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

Rationale: important rankings are back across the product cluster (6 of 7 commercial money keywords now Top 12; flagship long-tail entered Top 3). The winning state is fragile — winning URLs should be left alone this week. The informational losses warrant `Investigate`, not `Correct`, because the pattern is consistent with a Core-Update authority reshuffle rather than a technical break.

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

- The Winner/Loser pattern is clear-cut and consistent across all product-cluster URLs
- Money keyword recovery is broad (not a single-keyword fluke)
- Brand cluster is stable (no signs of penalty or technical break)

## 17. Data Limitations

- Search volume figures are from SISTRIX export (provider snapshot, may lag actual demand by weeks)
- The CTR curve used in Section 9's neutralization math is the standard SISTRIX position-to-CTR curve; the actual curve for this domain may differ by 10-30 % at any given position
- The Recovery Signal Score is a calibrated heuristic, not a forecast. It does not predict next-week ranking.
- The cluster classification is heuristic (URL-slug-based). If the operator can supply a manual URL-type mapping it improves Section 8 accuracy.
- The four informational decliners may share a common root cause (Core-Update authority reshuffle) or may have independent causes; this run cannot distinguish. The `Investigate` action in Section 12 is what cracks that question.
