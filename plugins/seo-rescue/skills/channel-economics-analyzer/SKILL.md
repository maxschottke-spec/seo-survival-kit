---
name: channel-economics-analyzer
description: Use when an e-commerce business sells across multiple channels (own shop, Amazon, OTTO, eBay, Etsy, Zalando, etc.) and wants to know which channel is actually profitable vs which is bleeding money — e.g. "which channel makes money?", "is OTTO/Amazon worth it?", "channel break-even calculation", "marketplace profitability", "Kanal-Ökonomie", "soll ich den Channel zumachen?". Also triggers when ad budget allocation decisions are needed across channels, or when consolidating to fewer channels is being considered.
---

# Channel Economics Analyzer

## Overview

A simple-but-rigorous channel-level P&L calculator for multi-channel e-commerce businesses. Computes per-channel: revenue, COGS, ad-spend, marketplace fees, operating margin, break-even order count. Output: scorecard that names which channels are loss-making and the minimum monthly order volume needed for profitability.

**Core principle:** *Revenue is vanity, margin is sanity, cash is reality.* A €5k/month channel that loses €500/month is worse than no channel at all.

## When to use

- Multi-channel sellers (Direct-Shop + 1+ marketplace)
- Quarterly P&L review by channel
- "Should we keep this marketplace?" decisions
- Ad budget reallocation across channels
- Founder asks "is OTTO/Amazon actually profitable for us?"

**Don't use for:**
- Pure direct-to-consumer (no marketplace) — trivial
- Pure dropshipping with no COGS data
- New launch <90 days (insufficient data)

## Required data per channel (last 90 days)

| Data point | Source |
|-----------|--------|
| Gross revenue | Shop/marketplace order export |
| Refunds + chargebacks | Same export |
| COGS (manufacturing cost per unit × units) | ERP / spreadsheet |
| Marketplace fee % | Channel docs (Amazon: 15%, OTTO: 9-15%, eBay: 11%) |
| Ad spend on channel | Google Ads / Amazon Ads / OTTO Ads / Facebook Ads dashboards |
| Shipping cost per order | Shipping provider invoices |
| Returns processing cost | Internal time-cost estimate |
| Order count | Order export |

## The formula

```
NET_REVENUE = GROSS_REVENUE - REFUNDS
MARKETPLACE_FEE = NET_REVENUE × FEE_RATE
GROSS_PROFIT = NET_REVENUE - COGS - MARKETPLACE_FEE - SHIPPING_TOTAL
OPERATING_PROFIT = GROSS_PROFIT - AD_SPEND - RETURNS_HANDLING

CONTRIBUTION_PER_ORDER = (NET_REVENUE - COGS - MARKETPLACE_FEE - SHIPPING) / ORDERS
BREAK_EVEN_ORDERS = AD_SPEND_TOTAL / CONTRIBUTION_PER_ORDER

CHANNEL_HEALTH = OPERATING_PROFIT / NET_REVENUE × 100
```

Healthy channel: margin > 15 %. Risky: 5-15 %. Loss-making: < 5 % or negative.

## Workflow

### Step 1 — Define channels

Create `channels.json`:
```json
{
  "period_days": 90,
  "channels": [
    {
      "name": "direct-shop",
      "label": "Own shop (Shopware/Shopify)",
      "fee_rate": 0.029,
      "fee_label": "Payment provider 2.9 %",
      "currency": "EUR"
    },
    {
      "name": "amazon-de",
      "label": "Amazon DE",
      "fee_rate": 0.15,
      "fee_label": "Referral fee + FBA",
      "currency": "EUR"
    },
    {
      "name": "otto",
      "label": "OTTO Marketplace",
      "fee_rate": 0.11,
      "fee_label": "Verkaufsprovision",
      "currency": "EUR"
    }
  ]
}
```

### Step 2 — Pull per-channel data

For each channel, generate a CSV: `data/<channel-name>-period.csv` with columns:
```
order_id,date,gross_revenue,refunds,cogs,shipping,ad_spend,returns_cost
```

Sources:
- Amazon: Seller Central → Reports → Payments → Date Range Reports
- OTTO: OTTO Partner Connect → Berichte → Auszahlungen
- Shop: order export from Shopware/Shopify admin
- Ads: Google Ads/Amazon Ads/OTTO Ads campaign reports

### Step 3 — Run the analyzer

```bash
node channel-economics.js
```

Output (per channel):

```
══════════════════════════════════════════════════════════
DIRECT-SHOP (last 90 days)
══════════════════════════════════════════════════════════
  Gross Revenue:      €48,200
  Refunds:            €1,840 (3.8%)
  Net Revenue:        €46,360
  COGS:               €18,544 (40%)
  Marketplace Fee:    €1,344 (2.9%)
  Shipping:           €3,200
  Gross Profit:       €23,272 (50.2% margin)
  Ad Spend:           €4,200
  Returns Handling:   €920
  Operating Profit:   €18,152 (39.2% margin)  ✅ HEALTHY
  
  Orders:             420
  Contribution / Order: €55.42
  Break-Even Orders:  77/mo (you did 140 — well above)

══════════════════════════════════════════════════════════
OTTO (last 90 days)
══════════════════════════════════════════════════════════
  Gross Revenue:      €8,400
  Net Revenue:        €7,980
  COGS:               €3,192
  Marketplace Fee:    €878 (11%)
  Shipping:           €560
  Gross Profit:       €3,350 (42% margin)
  Ad Spend:           €1,800
  Returns Handling:   €240
  Operating Profit:   €1,310 (16.4% margin)  ⚠️ RISKY
  
  Orders:             68 (22.6/mo)
  Contribution / Order: €49.26
  Break-Even Orders:  37/mo (you did 22.6 — below break-even)
  
  Recommendation: Cap OTTO ad spend at €500/mo OR commit to scaling
  to 40+ orders/mo. Current state burns €490/mo on a small order base.
```

### Step 4 — Decide

Decision matrix:

| Channel state | Action |
|---------------|--------|
| Healthy (margin > 15 %) | Reinvest ad spend, scale slowly |
| Risky (5–15 %) | Cap ad spend at break-even, optimize ops |
| Loss-making (< 5 %) | Reduce ad spend to €0, decide in 60 days |
| Negative AND low volume | Wind down channel |

**Anti-pattern:** keeping a loss-making channel "for brand visibility" without a measurable brand ROI proxy.

## Common channel-specific gotchas

| Channel | Hidden cost |
|---------|-------------|
| Amazon FBA | Storage fees scale with low-velocity SKUs — old inventory eats margin |
| Amazon advertising | "Sponsored Products" auto-bid burns budget on irrelevant terms — always negative-keyword |
| OTTO | Returns rate often 2-3× direct shop (sizing mismatches) |
| eBay | Auction volatility skews per-order margin |
| Zalando | Heavy commission tier (20-25%) makes most price-aggressive SKUs unprofitable |
| Etsy | Listing fees + ads + transaction fees stack up — calculate all three |
| Direct shop | Payment provider fees (Klarna, PayPal) often 2-3% — don't forget |

## Real-world anchor data (anonymized 2026)

- Mid-size DE matresses shop: OTTO channel went from break-even to −€500/mo when monthly orders fell from 30 to 12. Decision: cap ads at €500/mo, hold for 6 months, decide.
- Same shop: Direct channel margin 39 %, Amazon margin 18 %, OTTO margin 12 % (declining). Capital allocation reshuffled toward Direct.

## Implementation

A starter script is provided in this folder as `channel-economics.example.js`. It expects `channels.json` + per-channel CSVs in `./data/` and prints the report to stdout. Customize fee rates and the report template for your business.

## Related skills

- `seo-outreach-report` — if the question is "why does my channel not get more traffic", this comes first; channel-economics tells you whether traffic is even monetizable
- `claude-mem:knowledge-agent` — for tracking decisions and revisiting in 60-90 days
