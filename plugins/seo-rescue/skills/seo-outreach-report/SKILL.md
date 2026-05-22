---
name: seo-outreach-report
description: 'Use when generating a polished single-PDF outreach pitch or cold-acquisition document for a third-party domain owner — NOT a technical site audit, but a sales-ready, decision-maker-friendly snapshot in plain language for non-SEO-experts (shop owners, founders, executives). Triggers include "send the owner of X.de an SEO snapshot", "outreach pitch", "cold email PDF for prospect", "generate a report for the owner", "show X.de their SEO status", "make a PDF for non-technical decision maker about their SEO". USE THIS instead of `claude-seo:seo-audit` when the audience is a non-technical decision-maker and the goal is communication, not technical depth. USE THIS instead of `make-pdf` when the input is a domain (not a markdown file) and you need editorial narrative + Sistrix/DataForSEO/PSI data integrated.'
---

# SEO Outreach Report

## Overview

Generates a 10-chapter PDF report per domain for non-technical decision-makers. Data sources: Sistrix VI, DataForSEO Labs (rankings + competitors + backlinks), Google PSI v5 (lab + CrUX). Renders via Chrome-headless without puppeteer.

**Output:** `~/Downloads/SEO-Auswertung-<domain>-<YYYY-MM-DD>.pdf` (~1 MB per report)

## When to use

- A shop owner / executive needs SEO clarity
- Cold outreach to potential clients with a data-driven hook
- Multi-domain audit for competitive analysis or portfolio review
- You need a printable, sendable snapshot

**Don't use for:**
- Deep technical SEO audit (too much detail, wrong audience)
- Your own domain optimization — work directly with the data, no PDF needed
- Pure keyword research

## Pipeline (4 steps)

```
seo-audit-fetch-v2.js  →  ~/.cache/seo-rescue/<slug>-raw.json     (Sistrix + DataForSEO + PSI)
seo-extract-v2.js      →  ~/.cache/seo-rescue/<slug>-summary.json (KPIs, top keywords, quick wins)
seo-onpage.js          →  ~/.cache/seo-rescue/seo-onpage.json     (title, H1, schema from local HTML)
seo-report-gen.js      →  ~/Downloads/SEO-Auswertung-<domain>-<date>.pdf
```

Cache directory `~/.cache/seo-rescue/` is created mode `0700` (owner-only). Override with `SEO_CACHE_DIR=/path` if needed.

The scripts in this skill folder are self-contained. Prerequisite: a `.env` file (any path) with:

```
SISTRIX_API_KEY=...       # https://www.sistrix.de/ (API tier must include VI endpoint)
DATAFORSEO_LOGIN=...      # https://dataforseo.com/ — pay-per-call
DATAFORSEO_PASSWORD=...
GOOGLE_API_KEY=...        # https://console.cloud.google.com/ — enable PageSpeed Insights API
```

Recommended path convention: `~/.config/seo-outreach-report/.env` or `./.env` in your working directory. See `.env.example` in this skill folder.

## Quick start (adding a new domain)

1. Edit `audit-config.json` (copy from `audit-config.example.json`):
   ```json
   {
     "targets": [
       { "slug": "newslug", "domain": "example.de", "host": "https://example.de/", "label": "Example Company" }
     ],
     "narrative": {
       "newslug": { "headline": "...", "business_one_liner": "...", "diagnose": [...], "fazit": [...], "action_plan": [...] }
     }
   }
   ```

2. Cache the homepage HTML locally for on-page analysis (cache dir is auto-created):
   ```bash
   CACHE_DIR="${SEO_CACHE_DIR:-$HOME/.cache/seo-rescue}"
   mkdir -p "$CACHE_DIR" && chmod 700 "$CACHE_DIR"
   curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "https://example.de/" > "$CACHE_DIR/newslug-home.html"
   ```

3. Run the pipeline:
   ```bash
   ENV_PATH=/path/to/your/.env  # or ~/.config/seo-outreach-report/.env
   node --env-file="$ENV_PATH" seo-audit-fetch-v2.js newslug
   node seo-extract-v2.js
   node seo-onpage.js
   node seo-report-gen.js
   ```

## Report structure (10 chapters)

1. **Cover** with data-driven headline
2. **Executive summary for decision-makers** — 4 KPI gauges + top 5 prioritized actions
3. **Status quo** — neutral inventory (no judgment)
4. **Google visibility over time** — 18-month VI chart + plain-language interpretation
5. **Where you rank today** — top 15 keywords + quick wins (positions 4–20)
6. **Competitors** — DataForSEO competitors with click estimates
7. **Website speed** — PSI mobile + desktop with traffic-light gauges
8. **What Google understands about your site** — key signals (title, meta, H1, schema, images)
9. **Trust + backlinks** — backlink KPIs + top referring domains
10. **Conclusion + action plan 30/60/90 days** — per item: what, why, how, who, cost, expected impact

## Language rule

Written for decision-makers without SEO knowledge. No unexplained abbreviations (LCP/CLS/INP/TBT/CWV → expand on first mention). For examples of good sentences, see `seo-report-gen.js` → functions `lightLCP`, `lightCLS` and the per-domain conclusion text.

## Common pitfalls

| Problem | Solution |
|---------|----------|
| WebFetch returns 403 (Cloudflare) | Use `curl -A "Mozilla/5.0 (Macintosh; ...) Chrome/120.0"` directly |
| Sistrix history empty | History workaround via 18× monthly calls — see `seo-audit-fetch-v2.js` |
| PSI quota exhausted | Set `GOOGLE_API_KEY` (enable PageSpeed Insights API in GCP), don't call without key |
| PDF looks cut off | Don't forget `page-break-before: always` between chapters + `@page { size: A4 }` |
| Quick wins list empty | Domain may not rank high enough — loosen filter from `position > 3 && <= 20 && sv >= 100` |

## Audit history

First use: 2026-05-21 on four real domains (DE mattress shop, foam-cushion manufacturer, news publisher, camper-mattress brand). PDFs ran in under 5 minutes of total pipeline time per domain.

## Alternative tools (Ahrefs, SEMrush, XOVI, Moz, Majestic, Searchmetrics)

If you **already subscribe to a different SEO tool** and don't want to also pay for Sistrix/DataForSEO — see [TOOLS.md](./TOOLS.md). Adapter patterns for 8+ alternative tools including migration examples (Sistrix→XOVI, DataForSEO→Ahrefs, etc.) and a budget-tier tool comparison matrix.

Short version:
- **Backlinks:** DataForSEO → Ahrefs/SEMrush/Majestic (drop-in)
- **Keywords:** DataForSEO Labs → Ahrefs/SEMrush (drop-in) or Sistrix Pro tier
- **Visibility:** Sistrix → XOVI (DE-focused) or Searchmetrics (global)
- **Crawl:** standard regex → Screaming Frog (MCP available)
- **Performance:** PSI v5 (free) → Lighthouse CLI as fallback

## Shop-system specific notes

See [SHOP-SYSTEMS.md](./SHOP-SYSTEMS.md) for platform-specific integration — Shopware, Shopify, WooCommerce, Magento, Gambio, JTL, OXID, Webflow, Wix, Squarespace, Custom/Headless. Where title/meta/schema/canonicals/redirects are maintained per system, plus known gotchas.
