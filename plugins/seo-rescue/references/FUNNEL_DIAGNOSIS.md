# Funnel Diagnosis Methodology

When organic clicks drop, the first operator question is: **is the decline only top-of-funnel (less traffic, same quality), or is the funnel itself broken (same traffic, fewer conversions)?** The answer determines whether the work belongs in SEO/acquisition or in on-site UX/CRO/stock/pricing. Getting this wrong wastes weeks on the wrong layer.

This methodology gives a decisive answer with a small amount of data and is **read-only** — it produces no live changes and is therefore Settlement-Gate-compatible.

## The decision

```
Sessions ↓ AND Purchases ↓ proportionally  →  top-of-funnel only (acquisition problem)
Sessions ↓ AND Purchases ↓ MORE than sessions  →  also a funnel problem
Sessions flat AND Purchases ↓  →  pure funnel problem
```

The signal lives in the **Session→Purchase conversion-rate delta**, not in the absolute numbers.

| CR delta (recent vs baseline) | Interpretation | Where to look |
|---|---|---|
| Δ < ±5% | CR flat — pure top-of-funnel | SEO / AIO / SERP volatility / brand decay |
| Δ −5% to −15% | Mixed; mild funnel softness | SERP/intent shift bringing lower-intent clicks |
| Δ < −15% | Significant funnel erosion | On-site: UX, stock, pricing, checkout breakage, trust signals |

## Required data

Two weekly time-series, 90 days, **both filtered to the same channel** (or both unfiltered for the all-channels read):

- Sessions per week
- Funnel-event counts: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`
- Derived: stage-to-stage conversion ratios

Compute "recent" as the most recent 2 complete weeks; "baseline" as the 4 weeks before that. Both windows must contain at least one **fully-completed ISO week** — partial in-progress weeks distort the recent average toward zero.

## How to read the all-channels vs organic split

| Layer | Reliability | What it shows |
|---|---|---|
| **All channels** | High (large N) | Whether the funnel itself is healthy |
| **Organic only** | Often noisy (small N for ecommerce mid-size shops) | Whether the organic visitor intent has shifted |

If all-channels CR is flat but organic CR is significantly worse, the SEO/AIO channel is bringing lower-intent clicks — the funnel works, but the queries are off-target. This is a content/AIO problem, not an on-site problem.

If all-channels CR drops alongside sessions, an on-site defect is the more probable explanation.

## Common false signals

| Signal | What it looks like | What it usually means | Validation |
|---|---|---|---|
| **Incomplete current week** | "Recent" sessions drop 40% week-over-week | The current ISO week is mid-week, only 50% of the volume has accrued | Re-run the analysis the Sunday/Monday after the last full ISO week |
| **Thin organic sample** | Organic CR swings 50%+ between weeks | Absolute purchase counts are 0-5 per week; a single buy moves the percentage 20%+ | Use all-channels read for the headline; require at least 20 purchases/week per slice for organic CR to be load-bearing |
| **Stage-skipping events** | `view_item` > `sessions` (e.g., ratio >100%) | The same session views multiple items — expected for ecommerce | Treat `view_item/sessions` as a depth-of-engagement signal, not a strict conversion stage |
| **Stage misalignment** | `begin_checkout` > `add_to_cart` | Some checkouts start from cart-skip flows (re-orders, deep links) | Inspect funnel by transaction-flow, not strict stage gating |

## Methodology compatibility with Settlement Gate

Funnel diagnosis is a **read-only** action:

- No live changes
- No new optimization
- Compatible with active Settlement Gate
- Counts as evidence for the `data` unlock criterion in `references/SEO_SETTLEMENT_GATE.md` section 9.2

When the Settlement Gate is active and the operator pressures with "warum sind Klicks niedrig?", funnel diagnosis is the **right tool** because it determines whether the existing diagnosis stands or needs to be revised — and it does so without burning the Settlement Gate.

## When the result confirms top-of-funnel

The post-batch settlement plan stands unchanged. Continue to wait for the click evaluation window. The headline metric to watch is whether **traffic recovers** — once it does, the same flat CR multiplies through to revenue.

Do not add on-site experiments or UX work to "compensate" for the traffic drop. The funnel is not the bottleneck.

## When the result shows funnel erosion

Open a separate diagnostic track:

| Signal | Investigate |
|---|---|
| view_item → cart drop | Product page change, stock status, pricing, image quality |
| cart → checkout drop | Cart UX change, shipping cost surprise, payment-method availability |
| checkout → purchase drop | Payment processor error, trust signal regression, validation errors |

This work runs **outside** the SEO Settlement Gate because it is on-site UX/CRO, not SEO live writes. But the work is still bounded by Change Governor rules for any on-site modifications.

## Output schema

A minimal funnel-diagnosis output, machine-readable:

```json
{
  "schema_version": "1.0",
  "window": { "startDate": "...", "endDate": "..." },
  "all_channels": {
    "weekly": [{ "week": "202621", "sessions": 451, "view_item": 560, "add_to_cart": 29, "begin_checkout": 17, "purchase": 10, "cr_session_to_purchase_pct": 2.22 }],
    "recent_vs_baseline": {
      "comparison": {
        "sessions": { "recent_avg": 284, "baseline_avg": 480, "delta_pct": -40.9 },
        "purchase": { "recent_avg": 6, "baseline_avg": 10, "delta_pct": -40.0 },
        "cr_session_to_purchase_pct": { "recent_avg": 1.97, "baseline_avg": 2.06, "delta_pct": -4.5 }
      }
    }
  },
  "organic_only": { "...": "same shape" },
  "diagnosis": "top_of_funnel_only | mixed | funnel_erosion"
}
```

## Implementation hint

GA4 Data API dimension for ISO week is **`isoYearIsoWeek`** (not `isoYearWeek`). See `references/plugins/GA4_DATA_API.md` for other gotchas.

The minimal request:

```json
{
  "dateRanges": [{ "startDate": "90daysAgo", "endDate": "today" }],
  "dimensions": [{ "name": "isoYearIsoWeek" }, { "name": "eventName" }],
  "metrics": [{ "name": "eventCount" }, { "name": "sessions" }],
  "dimensionFilter": {
    "andGroup": {
      "expressions": [
        { "filter": { "fieldName": "eventName", "inListFilter": { "values": ["page_view","view_item","add_to_cart","begin_checkout","add_payment_info","purchase"] } } }
      ]
    }
  }
}
```

For an organic-only read, add a second filter expression on `sessionDefaultChannelGroup` with `stringFilter: { value: "Organic Search", matchType: "EXACT" }`.

## See also

- `references/SEO_SETTLEMENT_GATE.md` — Read-only actions during gate
- `references/DECISION_ENGINE.md` — Evidence weighting
- `references/RECOVERY_SYSTEM.md` § Appendix A — False signal library
- `references/plugins/GA4_DATA_API.md` — GA4 Data API quirks
