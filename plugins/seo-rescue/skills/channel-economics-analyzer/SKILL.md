---
name: channel-economics-analyzer
description: 'Use when an e-commerce business sells across multiple channels (own shop, Amazon, OTTO, eBay, Etsy, Zalando, etc.) and wants to know which channel is actually profitable vs which is bleeding money — e.g. "which channel makes money?", "is OTTO/Amazon worth it?", "channel break-even calculation", "marketplace profitability", "Kanal-Ökonomie", "soll ich den Channel zumachen?". Also triggers when ad budget allocation decisions are needed across channels, or when consolidating to fewer channels is being considered.'
user-invokable: true
argument-hint: '[channels.json path?]'
allowed-tools: [Read, Write, Bash(node:*)]
license: MIT
metadata:
  author: Max Schottke
  version: '0.3.3'
  category: marketing
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

Create `channels.json` — only the channels you actually sell on. Use the [Channel fee reference table](#channel-fee-reference-table) below for the right `fee_rate` per channel.

```json
{
  "period_days": 90,
  "channels": [
    {
      "name": "direct-shop",
      "label": "Own shop (Shopware/Shopify/WooCommerce)",
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
    },
    {
      "name": "kaufland",
      "label": "Kaufland.de",
      "fee_rate": 0.12,
      "fee_label": "Kategorie-abhängig 8-15 %",
      "currency": "EUR"
    },
    {
      "name": "ebay-de",
      "label": "eBay DE",
      "fee_rate": 0.11,
      "fee_label": "Verkaufsprovision + Listing-Fees",
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

## Channel fee reference table

Typical fee ranges as observed in public marketplace documentation and seller-community reports as of Q1 2026. **These are starting estimates, not authoritative data.** Marketplace fees vary by:

- Category and product type within the marketplace
- Seller-tier or volume agreement
- Currency, region, and shipping setup
- Whether fulfillment is by the marketplace (e.g. FBA) or by the seller
- Promotional periods and seller-incentive programs

**Always verify against your current seller agreement and recent invoices** before basing any business decision on these numbers. The fees change at least annually, and individual seller contracts often deviate from the public defaults. The table is a working hypothesis for the initial P&L draft — replace the values with your actual contract terms before drawing conclusions.

### DACH Marketplaces

| Channel | Typical commission | Notes |
|---------|-------------------:|-------|
| Amazon DE | 8–15 % (kategorie-abhängig) | + FBA-Fees wenn Fulfillment by Amazon |
| OTTO | 9–15 % | Auch Service-Gebühr für Versand-Logistik möglich |
| Kaufland.de (ehem. real.de) | 8–15 % | Stark wachsender Marketplace, Möbel/Garten + 11 % im Schnitt |
| eBay DE | 8–13 % + Listing-Fees | Auktion vs. Festpreis-Variante macht großen Unterschied |
| Zalando Partner Program | 18–25 % | Mode-fokussiert, hohe Returns-Rate (40-60 % bei Mode) |
| About You | 20–25 % | Mode/Lifestyle, eher kuratiert |
| Galeria.de | 12–18 % | Kaufhof-Erbe, traditionelle Handelsmargen |
| Avocadostore | 15–20 % | Nachhaltigkeits-Filter, kleinere Reichweite aber höhere Margen |
| manomano | 15–20 % | DIY/Garten/Bau, B2C + B2B Mix |
| Limango/Outletcity | 25–35 % | Outlet-Modell, Margen vs. Volumen-Trade |
| Bonprix / OTTO Group | 15–20 % | Mode/Home, Konzern-spezifische Bedingungen |
| MyToys / Spielzeug-Marketplaces | 18–25 % | Saisonalität (Q4-Peak) macht Jahresrechnung anders |

### EU Marketplaces (außerhalb DACH)

| Channel | Typical commission | Notes |
|---------|-------------------:|-------|
| Bol.com (NL/BE) | 12–17 % + Selektivität | NL/BE Marktführer, deutsche Anbieter willkommen |
| CDiscount (FR) | 8–15 % + monatliche Subscription | FR-Marktführer #2 nach Amazon |
| Allegro (PL) | 8–15 % | PL Nr.1, EU-Cross-border attraktiv |
| Mirakl-powered marketplaces | varies | Mediamarkt, Carrefour, Decathlon nutzen Mirakl |
| ManoMano FR/IT/ES/UK | 15–20 % | DIY-Pan-EU |
| Spartoo | 15–20 % | Schuh-Marketplace EU |
| LightInTheBox / Wish (eu) | 25–40 % | Niedrigpreis-Mass-Market |

### US Marketplaces

| Channel | Typical commission | Notes |
|---------|-------------------:|-------|
| Amazon US | 8–15 % | Größter, aber gesättigter Markt |
| Walmart Marketplace | 6–15 % | Niedrigere Fees als Amazon, aber strenge Performance-Anforderungen |
| eBay US | 12–15 % + Listing-Fees | Higher than DE due to Promoted Listings pressure |
| Etsy | 6.5 % + Listing $0.20 + Payment 3 % + Optionale Etsy-Ads | Drei Gebühren, in Wirklichkeit ~13-17 % effektiv |
| Wayfair | 15–25 % | Möbel-spezifisch, eigenes Drop-Ship-Modell ("CastleGate") |
| Target Plus | varies, einladungs-basiert | Premium-Channel, kuratiert |

### Social-Commerce-Channels

| Channel | Typical commission | Notes |
|---------|-------------------:|-------|
| TikTok Shop DE | 5–8 % + Provision für Creator-Affiliate | EU-Rollout Q4 2024, schnell wachsend bei <€50-Produkten |
| Instagram Shop / Meta | 5 % | Nur direkter Checkout, sonst Traffic-Treiber zum Direct-Shop |
| Pinterest Shop | 0 % (für Direct-Listings) | Eher Discovery-Channel, kein eigener Checkout-Komission |
| YouTube Shopping | 0–10 % (variabel) | Hauptsächlich Affiliate-Hebel über Creator |
| Live-Commerce (Showroom, ShopShops) | 15–25 % | Im DACH kleine Reichweite, in CN/US wachsend |

### B2B / Wholesale Channels

| Channel | Typical commission | Notes |
|---------|-------------------:|-------|
| Alibaba.com (B2B) | 0 % Listing + 5 % Trade Assurance | Globaler B2B-Marketplace, niedrige Stückkosten gefragt |
| Faire | 25 % first order + 15 % repeat | EU/US Wholesale-Marketplace für Boutiquen |
| Ankorstore | 12–25 % | EU B2B-Wholesale, Fokus auf Concept-Stores |
| eBay B2B | 11–13 % | Industrie/Surplus, weniger Konkurrenz als Consumer-eBay |
| Alibaba/AliExpress for Business | 5–8 % | Wenn du selbst aus CN sourcen lässt |

### Direct-Shop-Channels (kein Marketplace, aber separate Kanäle)

| Channel | Typical "fee" | Notes |
|---------|-------------------:|-------|
| Shopify | 2.9 % + €0.30 PSP (Stripe) | Plus Subscription $39-$2000/Monat |
| Shopware Cloud | 2-3 % PSP + Subscription | Self-hosted = nur PSP-Fee |
| WooCommerce / WordPress | 2-3 % PSP | Sehr niedrige Fixkosten, aber Hosting/Plugin-Verantwortung |
| Klarna direct | 2.99 % + €0.39 + 0.5 % cross-border | Plus K1-Fees für Buyer-Financing-Variante |
| PayPal direct | 2.49 % + €0.35 | Niedriger bei Verkäufer-Volumen >€100k/Mo |
| Stripe direct | 1.5 % + €0.25 (EU cards) | Niedrigste PSP-Fees für reine Karten-Zahlungen |

### Affiliate / Performance-Channels (extra layer auf jedem Channel)

| Channel | Typical commission you pay | Notes |
|---------|-------------------:|-------|
| Awin / TradeDoubler | 5–15 % auf vermittelte Sales | Plus Plattform-Fee von ~30 % auf die Affiliate-Auszahlung |
| Influencer-Codes | 10–20 % via Code | Plus Sponsoring-Fee fix vor Sale |
| Google Shopping | CPC ~€0.15–€1.20 (kategorie-abhängig) | Inklusive Margins nur als CPA-äquivalent berechnen |
| Idealo Direktkauf | 5–8 % | Preisvergleichs-getriebener Channel, dünne Margen typisch |
| billiger.de / Preisroboter | CPC oder 3–7 % CPA | Ähnlich Idealo, Marken-spezifisch |

## Common channel-specific gotchas

| Channel | Hidden cost |
|---------|-------------|
| Amazon FBA | Storage fees scale with low-velocity SKUs — old inventory eats margin. Aged-inventory-surcharge nach 6 Monaten verdoppelt sich |
| Amazon advertising | "Sponsored Products" auto-bid burns budget on irrelevant terms — always negative-keyword. Plus: Brand-Cannibalization (du bewirbst dein eigenes Brand-Keyword teurer als ohne PPC) |
| OTTO | Returns rate often 2-3× direct shop (sizing mismatches). Plus: "Strafgebühren" für SLA-Verletzungen (verspätete Verarbeitung) |
| Kaufland.de | Schedule-Compliance strikt — verspätete Lieferung führt zu Account-Suspend |
| eBay | Auction volatility skews per-order margin. Promoted-Listings sind quasi-erzwungen seit 2024 (ohne kein organischer Traffic) |
| Zalando | Heavy commission tier (20-25%) makes most price-aggressive SKUs unprofitable. Plus Zalando-Logistik-Pflicht in vielen Kategorien |
| About You | Hohe Returns durch Mode-Sizing. Marken-Approval-Prozess langwierig |
| Etsy | Listing fees + ads + transaction fees stack up — calculate all three. Etsy-Offsite-Ads sind 15 % EXTRA Fee bei Sales von Externals |
| Wayfair | Drop-Ship-Modell heißt: du trägst Inventory-Risk, Wayfair nimmt 15-25 % Cut |
| TikTok Shop | Returns extrem hoch (Impulse-Buying), Returns-Logistics oft Verkäufer-pflicht |
| Instagram/Meta Shop | Reach-Algorithmus bevorzugt Reels — statische Posts sehen kaum Sales |
| Bol.com | Selektive Verifikation — kann Wochen dauern bis Listings live sind |
| CDiscount | Monatliche Pauschal-Fees ~€40 + Provision, lohnt sich erst ab €1k Umsatz/Monat |
| Faire (Wholesale) | First-Order-Cut 25 % schreckt viele Boutiquen ab — Repeat-Mechanik einplanen |
| Alibaba B2B | Trade-Assurance-Pflicht für Bezahlung, sonst hohes Buyer-Default-Risiko |
| Direct shop | Payment provider fees (Klarna, PayPal) often 2-3% — don't forget. Plus: Currency-Conversion-Fees bei Cross-Border |
| Idealo Direktkauf | Preis-Race-to-Bottom — wenn du deine Marge senkst, ziehen alle nach |
| Affiliate (Awin/TradeDoubler) | Last-Cookie-Wins-Attribution oft unfair zu organischem Traffic — über-credited Affiliate-Sales fressen Marge |
| Google Shopping | CPC-Inflation in saturierten Kategorien (Matratzen, Möbel, Elektronik) — ROAS oft <1 |

## Recommended channel-portfolio templates

Picking which channels to start with depends on your category. Patterns we've seen work:

### E-commerce shop (DACH-fokussiert)
- Direct-Shop (Anker, höchste Marge)
- Amazon DE (Reichweite, aber Marge-Killer)
- 1 weitere DACH-Marketplace (OTTO oder Kaufland je nach Kategorie)
- Optional: Idealo Direktkauf falls Preis-führend in Kategorie

### Mode/Lifestyle
- Direct-Shop
- Zalando Partner ODER About You (nicht beide — kannibalisieren sich)
- Instagram/TikTok Shop (Social-Commerce-Test)
- Optional: Etsy (für handmade-Subkategorie)

### Möbel/Home
- Direct-Shop
- OTTO (DACH-Standard für Möbel)
- Kaufland.de (wachsend in Möbel-Kategorie)
- Wayfair (US/EU-Drop-Ship-Test wenn international skalierbar)

### Niche/Sustainability
- Direct-Shop
- Avocadostore (Nachhaltigkeits-Filter)
- Faire / Ankorstore (B2B-Wholesale an Concept-Stores)
- Etsy (handmade/customized)

### B2B / Industrie
- Direct-Shop mit B2B-Bereich (eingeloggte Großhändler-Preise)
- Alibaba.com (international sourcing-Channel)
- eBay B2B (Surplus/Restposten)
- Branchenspezifische Marketplaces (z.B. Conrad B2B, Mercateo)

**Anti-Pattern:** "Wir sind auf allen Marketplaces" — jeder Channel braucht eigene SKU-Pflege, Customer-Service, Returns-Handling. Mehr Channels = mehr Fixkosten. Bei <€500k Jahresumsatz: max 3 Channels gleichzeitig.

## Real-world anchor data (anonymized 2026)

- Mid-size DE matresses shop: OTTO channel went from break-even to −€500/mo when monthly orders fell from 30 to 12. Decision: cap ads at €500/mo, hold for 6 months, decide.
- Same shop: Direct channel margin 39 %, Amazon margin 18 %, OTTO margin 12 % (declining). Capital allocation reshuffled toward Direct.

## Implementation

A starter script is provided in this folder as `channel-economics.example.js`. It expects `channels.json` + per-channel CSVs in `./data/` and prints the report to stdout. Customize fee rates and the report template for your business.

## Related skills

- `seo-outreach-report` — if the question is "why does my channel not get more traffic", this comes first; channel-economics tells you whether traffic is even monetizable
- `claude-mem:knowledge-agent` — for tracking decisions and revisiting in 60-90 days
