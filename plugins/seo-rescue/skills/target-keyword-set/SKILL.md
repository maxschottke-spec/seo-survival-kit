---
name: target-keyword-set
description: 'Use when a client engagement, a contract annex, or a recurring report needs an AGREED target keyword set instead of a traffic number — e.g. "which keywords should we commit to", "Zielbegriffe für den Vertrag", "Anlage 2", "striking distance keywords", "what can we measure weekly", "why does the weekly report say +12 % one week and −15 % the next". Derives 20–30 terms from where the domain ALREADY ranks (positions 3–20, minimum volume, purchase intent or strong seasonality, no brand), clustered by core keyword and grouped by the KIND OF WORK each needs: hold, advance, wrong page type (a blog post holds a buying query), seasonal window (with peak month and how wide the window is). Also quantifies how much of the commercial value sits on editorial pages. Requires DataForSEO credentials; offline mode via --fixture.'
user-invocable: true
argument-hint: '<domain> [--limit 30] [--min-volume 100] [--pos-min 3] [--pos-max 20] [--brand a,b]'
allowed-tools: [Read, Write, Bash(node:*)]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.5'
  category: marketing
---

# Target Keyword Set

## Why this exists

A weekly report that headlines a traffic delta says something untrue most weeks. Measured on a shop with ~200 organic clicks a week over 33 calendar weeks: week-over-week scatter 13 %, real trend −1.4 % per week. Nine times more noise than signal. Signal-to-noise by cadence: 1 week 0.11 · 2 weeks 0.28 · 4 weeks 0.49 · 8 weeks 0.67 — **no cadence under a quarter separates development from chance** at that scale.

What *does* move non-randomly is a ranking position for a named term. That is why a contract annex and a weekly report need a fixed target set, not a click count. This skill derives that set from data — as a **proposal for negotiation**, never as a measured fact.

## What it does

One DataForSEO Labs call (`ranked_keywords`, up to 1000 rows, filtered server-side), then four rules, every one of which must hold:

1. **The domain already ranks between `--pos-min` and `--pos-max`** (default 3–20). Only there does work turn into measurable movement within weeks. Terms without a ranking are a build-up project, not a target with a deadline.
2. **Minimum monthly volume** (default 100, twelve-month average).
3. **Purchase intent** per the provider's intent label — **or strong seasonality** (peak ≥ 1.8 × annual average). Seasonal terms often carry the label "informational" while the SERP is all shops; the SERP decides, not the label. The script cannot see the SERP, so it keeps seasonal terms *with a flag* rather than dropping them.
4. **No brand terms.** Brand is not moved by work; putting it in a target set is a gifted target. Default brand term = the domain stem (`example` for `example.de`), extend with `--brand`.

Spelling variants are clustered by the provider's `core_keyword`; the highest-volume member represents the cluster, the best position of any member counts. Intent is decided **per cluster** (any member commercial or seasonal keeps the cluster) — filtering per keyword would drop a variant labelled "navigational" before it reached its cluster.

### Four groups, by kind of work

| Group | Rule | What it means |
|---|---|---|
| **A — hold** | position ≤ 10, non-editorial page ranks | Nothing is broken. Observe, do not damage. |
| **B — advance** | position 11–max, non-editorial page ranks | The work backlog: the right page exists, it just sits too far back. |
| **C — wrong page type** | purchase intent, but an *editorial* URL holds it | The customer wants to buy, Google serves a guide. It sells nothing and depresses CTR. |
| **D — seasonal window** | peak ≥ 1.8 × average | With peak month and window width in months. A page built today rarely makes a one-month window. |

Plus one number that usually surprises: **share of commercial value sitting on editorial pages** (volume × CPC as a ranking proxy, not euros).

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT}/skills/target-keyword-set
node --env-file=.env target-keyword-set.js example.de
node --env-file=.env target-keyword-set.js example.de --limit 25 --min-volume 200 --brand example,exampleshop
node target-keyword-set.js example.de --fixture ranked-keywords.json     # offline, no API
node target-keyword-set.js --selftest                                     # against the synthetic fixture
```

Output: a Markdown table set on stdout (ready to paste into a contract draft) and a JSON file in the cache dir (`<domain>-target-set.json`) with groups, rules applied, drop counts, editorial share, season calendar, and caveats.

`.env` needs `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`. Cost: one Labs call, roughly $0.01–0.10 depending on row count.

## What it does NOT do

- **Does not verify the SERP.** Intent labels are a model output. Where a label and the actual results page disagree, the results page wins — check the top handful of group-D and group-C terms by hand before committing to them.
- **Page-type detection is a URL pattern** (default `/blog/`, `/magazin/`, `/ratgeber/`, `/news/`, `/journal/`, `/wissen/`; override with `--editorial`). This is a heuristic from two domains (`experimental_n1`). With a crawl available, classify by `Product`/`CollectionPage` vs `Article` instead — no hookup for that yet.
- **Volumes and CPCs are provider estimates.** Good for ordering, not for forecasting. "Value points" are a ranking aid, not revenue.
- **Positions are monthly index states**, not a daily measurement. For a running report, re-measure on a fixed weekday.
- **A target set is a negotiation object, not a measurement.** Nothing here is agreed until the client has agreed to it.

## Pairs with

- [[seo-outreach-report]] weekly mode — once the set is agreed, the weekly report can carry positions per target term instead of a traffic delta (see its noise-band rule).
- [[recovery-diagnose]] — group C ("wrong page type") is a diagnosable structural finding: the site ranks, but with the wrong page. Worth a diagnose step of its own.
- [[competitor-deep-audit]] — the gap list tells you what you *don't* rank for; this skill tells you what you already rank for and can move.
