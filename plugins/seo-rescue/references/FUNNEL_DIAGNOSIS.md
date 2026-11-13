# Funnel Diagnosis Methodology

When organic clicks drop, the first operator question is: **is the decline only top-of-funnel (less traffic, same quality), or is the funnel itself broken (same traffic, fewer conversions)?** The answer determines whether the work belongs in SEO/acquisition or in on-site UX/CRO/stock/pricing. Getting this wrong wastes weeks on the wrong layer.

This methodology gives a decisive answer with a small amount of data and is **read-only** — it produces no live changes and is therefore Settlement-Gate-compatible.

## Step 0: is it an SEO problem at all, and can the numbers carry the answer?

Run these checks before the funnel decision below. Each one comes from a diagnosis that pointed at the wrong layer for days because the check was skipped (experimental, N=1 unless marked; **Maturity:** `experimental_n1`).

1. **Orders and revenue come from the order system.** Never count purchases from analytics or from an ad platform. Both usually sit on the same on-site tagging, so when they agree, that is a correlated failure and not a confirmation. The order system is the third, independent source; reconcile the other two against it.
2. **Compute a dated capture rate (observed in two cases).** Analytics purchases ÷ shop orders, analytics sessions ÷ platform sessions, analytics organic sessions ÷ Search Console clicks, each for the same window. In consent-gated shops this rate can sit far below 100 % and it moves over time, for example after a banner redesign. Report the rate next to every analytics-derived number. If it moved inside the comparison window, the window is not comparable.
3. **A capture rate belongs to the system it was measured on.** Do not transfer analytics under-coverage to the ad platform ("real ROAS is twice as high"). Ad platforms attribute across devices and long click windows and can over-count. Check platform conversions against shop orders that carry that platform's source code.
4. **Split the lost clicks by source before blaming SEO.** Lay Search Console clicks, paid clicks per platform and the ad-spend timeline next to orders. If organic clicks are flat, paid clicks fell by about the missing volume and orders per click are stable, reduced paid traffic is the best-supported hypothesis; check referral, direct and email the same way before adopting it. This is a correlation read, not a causal test; say so in the output.
5. **Put the promotion calendar in the same table.** Value, start, end, automatic versus code. Read start and end times live from the shop, not from notes. A discount that starts or ends inside the window explains order jumps that otherwise get assigned to ads or SEO.
6. **Judge a weak week against the long band.** For a shop with a few orders per day, compare the week with the distribution of roughly the last half year of comparable weeks and report how many were equally weak or weaker. Week-over-week swings of a third are within noise at that volume. Calibrated window lengths and the dispersion test are engagement-specific.
7. **Use order date for demand questions, never invoice date.** Clearing a delivery backlog produces fake growth months on an invoice basis. Check the status distribution first (cancelled, drafts) and keep gross and net strictly apart.
8. **Remove orders that are not demand.** Cancelled orders, duplicate payment attempts and your own test orders stay in analytics and ad platforms as conversions. Match every platform-reported purchase that feeds a decision to an order ID and its current state.

**Gate for the decision table below.** A low but stable capture rate is workable: the table applies, with the rate stated. If the capture rate is unknown, unstable inside the window, or visibly unrepresentative (one device or source missing), the conversion-rate thresholds are not load-bearing. Use orders from the order system over clicks (Search Console plus paid) as the ratio instead, and return `inconclusive` rather than one of the three diagnoses when that series does not separate them.

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

The 2-versus-4-week comparison is a first read for shops with enough volume. Below roughly 20 purchases per week in the analytics data, which a small shop with partial consent coverage may never reach, the short window produces apparent collapses out of noise. In that case use the long band from Step 0.6.

Alongside the two series, collect: orders per day from the order system (order date, net, status-filtered), ad spend per platform per day, the promotion calendar, and the capture rate from Step 0.2.

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
| **Stage misalignment** | `begin_checkout` > `add_to_cart` | Either cart-skip flows (re-orders, deep links, express checkout) or the tag source under-records `add_to_cart` | Inspect funnel by transaction-flow; check how many buyers have an `add_to_cart` event at all |
| **Partial day** | The last day or the running day looks like a collapse | The running day is incomplete, the latest Search Console day is still filling up, and an unprocessed analytics day shows traffic as "Unassigned" with zero engagement | Exclude the running day or cut every comparison day at the same clock time; re-read the last days before reporting |
| **Purchases vanish, sessions hold** | Purchase events drop sharply, sessions and page views are stable | Three competing hypotheses: the order-confirmation step stopped firing (checkout incident, payment-plugin change, deploy), event-specific instrumentation or consent behaviour changed, or orders really fell. A general consent drop is the least likely of these, because it would lower sessions too | Reconcile analytics purchases with shop orders before, during and after; check the purchase event on the confirmation page. Until settled, mark the window unusable for ROAS and funnel conclusions |
| **Capture rate shift** | Conversion rate moves by double digits without an on-site change | Consent banner changed, tag plugin changed, or a tag source was added or removed | Recompute the capture rate per week; a tag or banner change inside the window invalidates the before/after comparison |
| **Double-counted events** | Views and carts rise while purchases fall | A second tag source sends the same event (often with a different item-ID format) | Per day: item-ID formats, events per session, `view_item`/`page_view` ratio |
| **Denominator inflation** | Conversion rate drops, orders are stable | Bot wave, one publisher sending non-buying traffic, or your own crawls counted as sessions | Segment by source and device; check bot share; exclude own crawler traffic |
| **AI-assistant referrals** | Add-to-cart rate jumps or collapses on product pages | Referrals from AI assistants can add to cart at very high rates without buying; their arrival or disappearance looks like a product-page break (experimental, N=1) | Segment AI referrals as their own source; read device segments separately |
| **Organic booked as Direct** | Search Console shows clicks on a URL, analytics shows no organic landings there | A locale or app-driven redirect chain strips the search referrer for browsers while Googlebot gets a clean 200 (observed in a second case) | Compare Search Console clicks with analytics organic landings per URL |
| **Matching totals** | Two aggregates fit a hypothesis exactly | Coincidence. Totals that match are not a mechanism | Disaggregate to daily level before naming a root cause |

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

**When orders stop or thin out abruptly, get the checkout tested before theorizing.** The diagnosis itself stays read-only: check the payment provider's status and webhook configuration, then request a live test. The live test is a separate, operator-approved action and not part of this methodology's read-only scope: one real end-to-end purchase per major payment method, including the guest form. A form counts as working only after it has been submitted. Automated or headless walkthroughs that stop before payment authorization prove nothing, and some failures only hit a subset of customers (for example a specific address or account constellation). An order gap far outside the shop's normal gap distribution is a breakage signal, not a demand signal.

**For every suspected on-site cause, check the prior state.** If the same state was already live during a period with normal sales, the hypothesis drops to low confidence; it survives only if something it depends on changed since (traffic mix, stock, payment mix). Split the funnel by device and source first; a cause that should hit everyone but leaves large segments stable needs a reason for that.

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
  "measurement": {
    "capture_rate_pct": 54.0,
    "capture_rate_basis": "analytics purchases / shop orders, same window",
    "capture_rate_stable": true,
    "orders_source": "order_system | analytics_only",
    "orders_per_1000_clicks": { "recent_avg": 13.4, "baseline_avg": 13.0 },
    "baseline_mode": "2v4_weeks | long_band",
    "weeks_in_band_equal_or_weaker": null,
    "promotion_in_window": false,
    "paid_click_delta_pct": null
  },
  "confidence": "high | medium | low",
  "diagnosis": "top_of_funnel_only | mixed | funnel_erosion | inconclusive"
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

The request above covers only the analytics side. The Step 0 inputs come from elsewhere: orders from the order system export, clicks from Search Console and the ad platforms, the promotion calendar from the shop. For the long band (Step 0.6) pull roughly half a year of weekly orders from the order system; the 90-day analytics window is not long enough.

For an organic-only read, add a second filter expression on `sessionDefaultChannelGroup` with `stringFilter: { value: "Organic Search", matchType: "EXACT" }`.

## See also

- `references/SEO_SETTLEMENT_GATE.md` — Read-only actions during gate
- `references/DECISION_ENGINE.md` — Evidence weighting
- `references/RECOVERY_SYSTEM.md` § Appendix A — False signal library
- `references/plugins/GA4_DATA_API.md` — GA4 Data API quirks
