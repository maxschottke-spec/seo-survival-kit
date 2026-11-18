# Cost Disclosure

Most of the nineteen skills cost nothing to run. A few call paid APIs. The first table lists every skill with the keys it reads and what happens without them; the rest of this file breaks down `seo-outreach-report`, the only skill with a call-by-call cost table.

## All 19 skills: keys, cost per run, and what works without a key

Sources: the cost column of the README tables, the skill texts, and the environment variables the shipped scripts actually read. "not stated" means the repository gives no figure; nothing here is estimated beyond what those sources say. The recovery commands read no key themselves: they use whatever MCP servers (Sistrix, DataForSEO, Screaming Frog, Search Console) are configured in your Claude Code.

| Skill | Keys / access | Cost per run | Without the key |
|---|---|---|---|
| `rescue` | none | $0 | n/a (routing table only) |
| `seo-audit-free` | optional free Google PSI key (put into the URL, not an env var) | $0 | PSI often answers HTTP 429; use local Lighthouse (step 6 of the skill). Everything else works. |
| `post-core-update-recovery` | none; optional Sistrix / DataForSEO data if you have it | $0 | Works with a Google Search Console export (free path in the skill) |
| `ai-search-rescue` | none | $0 | n/a (framework) |
| `sistrix-monday-recovery-check` | none; needs CSV exports from the Sistrix UI, so a Sistrix account, but no API key | $0 | Try it with the bundled synthetic CSVs |
| `channel-economics-analyzer` | none | $0 (your CSVs) | n/a |
| `subscription-monetization-audit` | none | $0 (your CSV) | n/a |
| `psi-weekly-cron-baseline` | `GOOGLE_API_KEY` (free) | $0 | The script exits with "Missing GOOGLE_API_KEY" |
| `gsc-deep-dive` | `GSC_SERVICE_ACCOUNT_JSON` (path to a Google service-account file, free) | $0 | The script exits; export the CSVs by hand from the Search Console UI instead |
| `ai-citations-tracker` | `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` (one per surface you track) | OpenAI about $0.10 per year for 20 prompts weekly; Perplexity free tier | The script exits for a configured surface whose key is missing; the skill also describes logging results by hand |
| `target-keyword-set` | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | roughly $0.01–$0.10 (one Labs call) | `--fixture <file>` and `--selftest` run offline |
| `competitor-deep-audit` | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | about $0.10–$0.50 | The script exits with "Missing DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD" |
| `seo-outreach-report` | `SISTRIX_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `GOOGLE_API_KEY` | about 0.15–0.75 per domain (see below) | The fetch script does not check for the keys: calls without them fail and the report lacks that data, so do not run it without all four. Re-rendering a PDF from cached data needs no key. |
| `recovery-diagnose` | Sistrix + DataForSEO via MCP (optional) | README: ~$0.05–$0.50; no call-by-call breakdown in the repo | CSV fallbacks (`imports/` folder), lower `data_quality` |
| `recovery-crawl` | Screaming Frog via MCP (optional) | $0 | CSV import; without either the command ends with status `failed` |
| `recovery-audit` | none | $0 | n/a (reads local files) |
| `recovery-plan` | none | $0 | n/a (reads local files) |
| `recovery-monitor` | Sistrix + DataForSEO via MCP (optional) | README lists it as free; when the two MCPs are configured it calls them, and the repo states no figure for those calls | Enter the values by hand (`--vi`, `--keywords-t10`) or use the keywords CSV |
| `recovery-full` | as `recovery-diagnose` + `recovery-crawl` | README: ~$0.05–$0.50 | Runs on the CSV fallbacks |

Two more variable names appear in the repo, only inside sample adapter code in `seo-outreach-report/TOOLS.md` and in no shipped script: `AHREFS_API_TOKEN` and `XOVI_API_KEY`. They matter only if you rewrite the fetch script for those tools; TOOLS.md states plan prices, not a cost per run.

## `seo-outreach-report`: cost per domain

The skill calls **three external APIs**. Read this before running the pipeline on more than one or two domains so you don't get surprised.

One full audit (one domain) makes these calls:

| API | Calls per audit | Unit cost | Subtotal per audit |
|-----|-----------------|-----------|---------------------|
| **Sistrix Visibility Index** | 1 current + ~18 historical (per-month) + 1 overview = **~20 credits** | depends on your plan (€) | ~€0.10–€0.50 (Sistrix Toolbox API Tier dependent) |
| **DataForSEO Labs** | 5 calls (ranked_keywords + backlinks + domain_rank + competitors + referring_domains) | ~$0.005–$0.05 each | **~$0.05–$0.25** |
| **Google PageSpeed Insights v5** | 2 calls (mobile + desktop) | free with API key (25k/day quota) | **$0.00** |

**Realistic total per domain audit: about 0.15 – 0.75.** That is the sum of the two paid rows, €0.10–€0.50 for Sistrix plus $0.05–$0.25 for DataForSEO, with euro and dollar amounts added without conversion. (Up to v0.5.5 this line said "$0.05 – $0.50", which did not match the rows above it.) The Sistrix part is credits from your plan's allowance, not a separate invoice; the money that leaves your account per audit is the DataForSEO part.

Running 50 outreach audits ≈ 7.50 – 37.50 on the same basis, of which $2.50 – $12.50 is DataForSEO, plus your Sistrix subscription cost (which you pay regardless).

## How to keep costs low

1. **Re-use cached data** — the pipeline saves raw JSON to `~/.cache/seo-rescue/<slug>-raw.json` (mode 0700, per-user). If you re-render only the PDF (`seo-report-gen.js`), no API costs.
2. **Skip Sistrix history** if you only need the current VI — comment out the 18 monthly calls in `seo-audit-fetch-v2.js` if budget is tight.
3. **Batch domains in one pipeline run** — fixed overhead is the same, marginal cost per domain stays predictable.
4. **DataForSEO has a free trial** with $1 credit on signup — enough for ~5–20 audits to start.

## What's free

- **`post-core-update-recovery`** — pure framework skill, zero API calls. Always free.
- Every skill with `$0` in the table at the top.
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

If you're an SEO agency or freelancer doing client work, these costs are negligible compared to the value (one polished outreach PDF that lands a client = ROI in 1 deal). If you're casually testing on your own site, expect up to roughly 0.75 per audit and run it sparingly.
