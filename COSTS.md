# Cost Disclosure

The `seo-outreach-report` skill calls **three external APIs** that may incur costs. Read this before running the pipeline on more than one or two domains so you don't get surprised.

## Per-domain cost estimate

One full audit (one domain) makes these calls:

| API | Calls per audit | Unit cost | Subtotal per audit |
|-----|-----------------|-----------|---------------------|
| **Sistrix Visibility Index** | 1 current + ~18 historical (per-month) + 1 overview = **~20 credits** | depends on your plan (€) | ~€0.10–€0.50 (Sistrix Toolbox API Tier dependent) |
| **DataForSEO Labs** | 5 calls (ranked_keywords + backlinks + domain_rank + competitors + referring_domains) | ~$0.005–$0.05 each | **~$0.05–$0.25** |
| **Google PageSpeed Insights v5** | 2 calls (mobile + desktop) | free with API key (25k/day quota) | **$0.00** |

**Realistic total per domain audit: $0.05 – $0.50** depending on Sistrix tier.

Running 50 outreach audits ≈ $2.50 – $25 plus your Sistrix subscription cost (which you pay regardless).

## How to keep costs low

1. **Re-use cached data** — the pipeline saves raw JSON to `~/.cache/seo-rescue/<slug>-raw.json` (mode 0700, per-user). If you re-render only the PDF (`seo-report-gen.js`), no API costs.
2. **Skip Sistrix history** if you only need the current VI — comment out the 18 monthly calls in `seo-audit-fetch-v2.js` if budget is tight.
3. **Batch domains in one pipeline run** — fixed overhead is the same, marginal cost per domain stays predictable.
4. **DataForSEO has a free trial** with $1 credit on signup — enough for ~5–20 audits to start.

## What's free

- **`post-core-update-recovery`** — pure framework skill, zero API calls. Always free.
- **Reading the SKILL.md / LESSONS.md** — also free.
- Anything that only invokes the framework guidance, not the pipeline.

## What's NOT included

This plugin does not include API credentials. You bring your own:

- Sistrix Toolbox account: from ~€100/month for the basic Toolbox; API access typically requires a separate API tier
- DataForSEO: pay-as-you-go, $25 minimum first deposit
- Google PSI: free, requires GCP account + API key

## Cost monitoring tip

For Sistrix: the API responses include a `"credits": [{"used": N}]` field. The fetch scripts log this — keep an eye on it in your terminal.

For DataForSEO: their dashboard shows real-time spend.

## TL;DR

If you're an SEO agency or freelancer doing client work, these costs are negligible compared to the value (one polished outreach PDF that lands a client = ROI in 1 deal). If you're casually testing on your own site, expect roughly €0.50 per audit and run it sparingly.
