---
name: ai-citations-tracker
description: 'Use when you need to **measure** (not just describe) brand citation frequency across AI search surfaces over time. Runs a configurable brand-mention prompt set weekly against ChatGPT (OpenAI API), Perplexity (Sonar API), and optionally Google AI Mode / AI Overviews / Bing Copilot / Claude.ai (manual workflow). Stores NDJSON history for trend analysis. Triggers from "track AI citations", "AI Overview citation tracker", "ChatGPT brand mention monitoring", "Perplexity citation tracking", "AI-Sichtbarkeit messen", "wie oft erwähnt ChatGPT meine Marke". Complements [[ai-search-rescue]]: that skill is the framework, this skill is the measurement loop.'
user-invokable: true
argument-hint: '[setup | run | analyze]'
allowed-tools: [Read, Write, Bash(node:*), Bash(curl:*), Bash(launchctl:*), Bash(crontab:*)]
license: MIT
metadata:
  author: Max Schottke
  version: '0.4.1'
  category: marketing
---

# AI Citations Tracker

## Overview

Most "AI search visibility" advice is descriptive ("you should rank in AI Overviews"). This skill is the measurement loop: a weekly cron job that asks the same brand-mention prompts to AI surfaces, parses the answers for your brand vs competitors, and logs results to NDJSON for trend analysis.

This is the **leading-indicator** companion to [[post-core-update-recovery]]:
- Classical Sistrix VI / GSC clicks lag Google by 3-5 days
- AI citation counts often start moving **2-6 weeks before** classical SERP recovery shows up
- If your AI citations are climbing while VI is flat, recovery is on track. If both are flat, the authority signals from [[ai-search-rescue]] Tactic 4 (Author + Person-Schema) need more time or aren't reaching the model retrieval layer.

## When to use

- A site running active Core-Update recovery — track AI citations as the leading recovery indicator
- A brand wanting to know whether ChatGPT / Perplexity / AI Overviews actually mention them (most brands don't measure this — they guess)
- An agency reporting to clients on "AI search visibility" — needs hard numbers, not vibes
- A YMYL / B2B vendor whose buyers research via ChatGPT before contact sales — citation frequency is a direct lead-gen signal

**Don't use for:**
- One-off citation snapshots (use the manual workflow in [[ai-search-rescue]] instead — no cron needed)
- Pure SERP ranking tracking (use [[seo-outreach-report]] + [[competitor-deep-audit]])
- Optimizing the content itself (that's [[ai-search-rescue]] — this skill measures, that skill optimizes)

## Architecture

```
ai-citations-config.json   (your prompts + competitors + API keys via env)
  ↓
ai-citations-fetch.example.js   (run weekly via cron)
  ↓
ai-citations-history.ndjson    (append-only, per-week records)
  ↓
your trend chart / Sistrix-style overlay
```

The script is **opt-in per AI surface**: skip surfaces where you don't have API access. Default: ChatGPT (OpenAI API) + Perplexity (Sonar API). Manual workflow appended for Google AI Mode / AI Overviews / Bing Copilot / Claude.ai (no stable public APIs for those as of 2026-05).

## Config template

`ai-citations-config.json` (gitignored — see [SECURITY.md](../../../../SECURITY.md)):

```json
{
  "brand": "Your Brand",
  "brand_variants": ["Your Brand", "your-brand.com", "yourbrand"],
  "competitors": ["competitor-a.com", "competitor-b.de", "competitor-c.io"],
  "prompts": [
    "Was ist die beste Matratze für Rückenschläfer in Deutschland?",
    "Wo kaufe ich orthopädische Matratzen?",
    "Vergleich von Matratzenmarken in Deutschland",
    "Welche Matratzenmarke produziert in Deutschland?"
  ],
  "surfaces": ["chatgpt", "perplexity"],
  "output_dir": "./ai-citations-history"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `brand` | yes | Canonical brand name as it appears in the wild |
| `brand_variants` | yes | Other strings the model might use (domain, abbreviations, common typos) — used for fuzzy match |
| `competitors` | yes | 3-15 domains for competitive context |
| `prompts` | yes | 10-30 prompts covering category, problem-aware, comparison, brand-aware queries |
| `surfaces` | yes | Subset of `["chatgpt", "perplexity"]` for now. Google AI Mode / AI Overviews / Bing Copilot are manual (see below) |
| `output_dir` | no | Default `./ai-citations-history` — must be relative, no `..` |

API keys (env-only, never in config — same pattern as [[psi-weekly-cron-baseline]]):

```bash
export OPENAI_API_KEY=sk-...
export PERPLEXITY_API_KEY=pplx-...
```

## Quick start

1. Copy `ai-citations-config.example.json` to `ai-citations-config.json` and customize. Put the file in a private location outside the plugin repo.
2. Get API keys:
   - **OpenAI:** [platform.openai.com](https://platform.openai.com/) → API keys → create. Typical cost: ~$0.0001 per prompt with `gpt-4o-mini`, so 20 prompts × 50 weeks ≈ $0.10/year.
   - **Perplexity:** [docs.perplexity.ai](https://docs.perplexity.ai/) → API keys → create. Free tier allows ~50 queries/day with the `sonar` model. Pro tier (~$5/mo) gives higher rate limits.
3. Run once manually: `node ai-citations-fetch.example.js`
4. Inspect the resulting `./ai-citations-history/history.ndjson` — one record per `(prompt, surface)` pair.
5. Schedule weekly via launchd / cron / GHA — see [[psi-weekly-cron-baseline]] for the cron-setup pattern.

## What gets logged

Per `(prompt, surface)` pair, the NDJSON record contains:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | epoch ms | When the call ran |
| `date` | YYYY-MM-DD | Cron-friendly date |
| `prompt` | string | The prompt as sent |
| `surface` | string | `chatgpt` / `perplexity` |
| `brand_mentioned` | boolean | Was any `brand_variants` entry in the answer? |
| `brand_position` | int or null | If the answer is a list, what position (1-indexed) is the brand at? |
| `competitors_mentioned` | string[] | Subset of `competitors` that appeared in the answer |
| `competitor_count` | int | `competitors_mentioned.length` |
| `cited_sources` | string[] | Domains the surface explicitly cited (Perplexity exposes this) |
| `answer_excerpt` | string | First 500 chars of the answer (for spot-checking; sanitized) |
| `model` | string | The model the surface returned (`gpt-4o-mini-2024-07-18`, etc.) |

## Manual workflow for surfaces without APIs

Google AI Mode, AI Overviews, Bing Copilot, Claude.ai don't expose stable APIs (as of 2026-05). Run these manually once a week and append to the same NDJSON:

1. Open the surface in a browser (e.g. [google.com/search?udm=50](https://www.google.com/search?udm=50) for Google AI Mode)
2. Run each prompt from your config
3. Note: brand mentioned? Position in citations? Competitors mentioned?
4. Append a record to `./ai-citations-history/history.ndjson` in the same schema, with `"surface": "google-ai-mode"` etc.

The skill includes a one-liner to make manual logging quick:

```bash
node -e "console.log(JSON.stringify({timestamp:Date.now(),date:new Date().toISOString().slice(0,10),prompt:'YOUR_PROMPT',surface:'google-ai-mode',brand_mentioned:true,brand_position:2,competitors_mentioned:['x.com','y.com'],competitor_count:2,cited_sources:[],answer_excerpt:'',model:'manual-log'}))" >> ai-citations-history/history.ndjson
```

## Analysis recipes

Once you have 4+ weeks of history, useful queries:

```bash
# Citation rate over time (per week)
cat ai-citations-history/history.ndjson | \
  node -e "const ls = require('fs').readFileSync(0, 'utf8').trim().split('\n').map(JSON.parse); \
  const byWeek = {}; \
  for (const r of ls) { \
    const w = r.date.slice(0,7); \
    byWeek[w] = byWeek[w] || { total: 0, mentioned: 0 }; \
    byWeek[w].total++; if (r.brand_mentioned) byWeek[w].mentioned++; \
  } \
  for (const [w, v] of Object.entries(byWeek).sort()) console.log(w, '|', v.mentioned, '/', v.total, '=', Math.round(100*v.mentioned/v.total)+'%');"

# Top competitors by mentions (last 4 weeks)
cat ai-citations-history/history.ndjson | \
  node -e "const ls = require('fs').readFileSync(0, 'utf8').trim().split('\n').map(JSON.parse); \
  const cutoff = Date.now() - 28*24*3600*1000; \
  const recent = ls.filter(r => r.timestamp >= cutoff); \
  const counts = {}; \
  for (const r of recent) for (const c of (r.competitors_mentioned || [])) counts[c] = (counts[c] || 0) + 1; \
  Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([d,n]) => console.log(n, d));"
```

The numbers are most useful **week-over-week**, not absolute — citation models drift, so always compare relative trends.

## Security model

- API keys via env vars only (`OPENAI_API_KEY`, `PERPLEXITY_API_KEY`). The script hard-fails if it finds an `api_key` field in the config (same defense as [[psi-weekly-cron-baseline]] — see the H2 finding in CHANGELOG v0.3.2).
- Prompts are validated as strings; arrays are length-checked (max 100 prompts per run).
- API responses pass through `sanitize()` from [[seo-outreach-report]] — same indirect-prompt-injection defense as `seo-onpage.js`. Untrusted AI output cannot escape into Claude context with embedded instructions.
- NDJSON history file is `chmod 0o600` on first write (same as `psi-fetch.example.js` post-v0.3.3).
- No network calls outside `api.openai.com` and `api.perplexity.ai`. Both are hardcoded host names — no SSRF possible.

## Related skills

- [[ai-search-rescue]] — the *framework* this skill measures. Read it first to know which prompts to track.
- [[post-core-update-recovery]] — AI citations are the leading indicator of Phase A (Authority foundation) actually working.
- [[psi-weekly-cron-baseline]] — same architecture pattern (config → fetch → NDJSON → cron). Pair both for full Recovery telemetry.
- [[seo-outreach-report]] — once you have 4+ weeks of citation history, the trend chart can be added as an extra chapter in the outreach PDF.

## Realistic expectations

- **First useful trend:** after 4-6 weekly runs (4-6 weeks)
- **Cost:** OpenAI ~$0.10/year + Perplexity ~$0 (free tier) for 20 prompts × 2 surfaces × 52 weeks
- **Surfaces covered:** ChatGPT + Perplexity automatically; rest manual but documented
- **False positives:** ~5-10% — brand variants can match unrelated text (e.g. "Matze" matching "matze-matratze.de" *and* a competitor's product name "Matze"). Tune `brand_variants` carefully; review `answer_excerpt` field weekly for the first month.
