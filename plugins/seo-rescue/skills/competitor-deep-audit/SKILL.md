---
name: competitor-deep-audit
description: 'Use when an e-commerce or content site wants to deeply understand WHO their organic competitors are (often surprising — not the brands they think) and WHERE the competitors outrank them — e.g. "competitor analysis", "keyword gap analysis", "who outranks me", "Wettbewerber-Lücken", "wo verlieren wir gegen die Konkurrenz", "content opportunities from competitor SERPs". Produces a prioritized opportunity list (keyword + search volume + competitor URL + your current position) for the next content-roadmap quarter. Triggers also from "Sistrix Konkurrenten" or "DataForSEO competitors".'
user-invokable: true
argument-hint: '[domain]'
allowed-tools: [Read, Write, Bash(node:*), Bash(curl:*)]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.0'
  category: marketing
---

# Competitor Deep Audit

## Overview

Identifies the **real organic competitors** of a target domain (not who the owner thinks competes, but who actually shows up in their SERPs), then for the top 5–8 competitors pulls a **keyword-gap-analysis**: keywords where competitors rank top-10 but the target does not, sorted by search volume × estimated traffic.

Output: a prioritized 30–100-item opportunity list for the next content roadmap.

## When to use

- New SEO mandate intake — get the lay of the land
- Quarterly competitor review
- Content roadmap planning
- "Why aren't we ranking for X?" — find which competitor took the spot
- Validate / disprove gut-feel-competitor assumptions

**Don't use for:**
- Brand-positioning analysis (this is SEO-organic, not brand-share)
- Paid-search competitor analysis (different toolset — SEMrush Ads, SpyFu)
- Backlink-gap-analysis (separate workflow, use claude-seo:seo-backlinks)

## Prerequisites

- DataForSEO API credentials (Labs endpoints — `competitors_domain` + `domain_intersection`)
- Optional: Sistrix API for cross-validation (`domain.competitors.seo` — needs API-Pro tier)
- Target domain + DE-market focus (location_code 2276; adjust for other markets)

## Workflow

### Step 1 — Identify real competitors via SERP overlap

```js
const competitorsResp = await d4sPost('/v3/dataforseo_labs/google/competitors_domain/live', {
  target: 'example.com',
  language_code: 'de',
  location_code: 2276,
  limit: 25,
});
```

The response orders competitors by SERP-overlap (intersections) × keyword count × ETV. Top 5–8 entries = your real competitors.

**Surprise factor:** typically 30–60 % of real competitors are NOT the brands the owner names off the cuff. Often blogs, info-sites, marketplaces, or niche players that swallow long-tail traffic.

### Step 2 — For each top competitor, pull their ranked keywords

```js
const ranked = await d4sPost('/v3/dataforseo_labs/google/ranked_keywords/live', {
  target: 'competitor.com',
  language_code: 'de',
  location_code: 2276,
  limit: 500,  // wide net
  order_by: ['ranked_serp_element.serp_item.estimated_traffic_volume,desc'],
});
```

### Step 3 — Compute the gap

For each competitor's top-ranking keyword (position ≤ 10):
- Check if **your** domain ranks for it (call ranked_keywords for your domain too)
- If you rank > 20 (or don't rank at all): this is an opportunity
- Compute "opportunity score" = search_volume × (1 - your_position/100) × competitor_count_top10

Sort by opportunity score, take top 100, that's your roadmap.

### Step 4 — Cluster by content type

Bucket the opportunities:
- **Category pages missing** — keywords like "X-shop", "X-online-kaufen" with no matching category page
- **Product gaps** — competitor has product/variant you don't sell
- **Content/blog gaps** — competitor ranks with a guide/listicle, you have nothing
- **Quick-win wonky URLs** — you have a similar page that ranks poorly, just needs work

Output as a table:

| # | Keyword | SV | Your Pos | Best Competitor | Their Pos | Their URL | Gap Type | Action |
|---|---------|----|---------:|------------------|----------:|-----------|----------|--------|
| 1 | "outdoor jacke wasserdicht damen" | 5400 | — | bergfreunde.de | 3 | /jacken/.../damen-wasserdicht | category-missing | Build dedicated category page |
| 2 | "merino socken test 2026" | 880 | 47 | outdoor-magazin.de | 2 | /test/merino-socken-2026 | content/blog | Write tested-buyer-guide |

### Step 5 — Prioritize against capacity

A realistic content-roadmap fits 5–15 new pieces per quarter (depending on team size). From your top-100, pick:
- 3–5 high-volume category pages (highest impact)
- 5–10 blog/content gaps (medium impact, faster)
- 2–3 product-line expansions (if business allows)

## Cross-validation with Sistrix (optional)

```js
// Only available with Sistrix API-Pro tier — basic tier returns error_code 5001
const sxComp = await sistrix('domain.competitors.seo', {
  domain: 'example.com',
  country: 'de',
  num: 20,
});
```

Compare DataForSEO competitors vs Sistrix competitors — high overlap (>60 %) means your competitor set is robust. Low overlap → re-check both datasets, often signals a recent SERP volatility event.

## Common pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Treating Amazon / Wikipedia / Marketplaces as "competitors" | Filter them out — they're SERP-fixtures, not actionable competitors |
| Going after very high-volume head terms | Usually impossibly competitive — focus on 100-5000 SV mid-tail |
| Picking opportunities matching only blog content | If your URL slug structure is /blog/ then your e-commerce business may not benefit much from ranked blog posts — prefer category/product gaps |
| Ignoring intent mismatch | Competitor ranks for "X review" — but you sell X, not review X. Check intent alignment |
| Cost spiral | DataForSEO ranked_keywords with `limit: 500` per competitor × 8 competitors = 4000 results. Cost: ~$0.20–$0.40. Cap reasonably. |

## Cost estimate per audit

- DataForSEO competitors_domain (1 call): ~$0.01
- DataForSEO ranked_keywords (8 competitors × 1 call): ~$0.08–$0.40
- DataForSEO ranked_keywords for your domain (1 call): ~$0.01–$0.05
- **Total: ~$0.10–$0.50 per competitor audit**

## Output for stakeholders

The audit produces two files:

1. `competitor-audit-<date>.json` — raw data for further processing
2. `competitor-audit-<date>.md` — markdown report with:
   - Top 8 real competitors (table)
   - Top 30 keyword gaps (table)
   - 3 strategic recommendations (which page types to build, in what order)
   - Estimated effort/impact

For a sendable PDF version, pipe through the `seo-outreach-report` pipeline.

## Implementation

See `competitor-deep-audit.example.js` in this folder for a starter script. Configure target + competitors filter list (to exclude marketplaces/Wikipedia), run, get markdown report.

## Real-world anchor data (anonymized 2026)

- DE mattress shop: identified 11 high-volume keyword gaps (~140k total SV/month) where 5/6 competitors had a dedicated category page but the target had only product-level content. Strategy: consolidate + amplify existing weak pages instead of building 11 new pages. ROI estimate ~30× over 12 months.

## Related skills

- `seo-outreach-report` — for the polished decision-maker output
- `post-core-update-recovery` — when competitor analysis reveals broad authority gaps, not just URL gaps
- `claude-seo:seo-competitor-pages` — alternative implementation in claude-seo plugin (uses different methodology)
