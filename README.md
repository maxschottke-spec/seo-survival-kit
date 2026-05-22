# SEO Survival Kit for Claude Code

> Seven focused SEO skills built from real 2026 recovery cases — for any website owner who needs to understand what's wrong, what to fix, and how to talk about it to non-technical stakeholders. **E-commerce, publishers, SaaS, services, agencies — same workflow.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet)](https://code.claude.com/)

## What's new

- **Renamed** from `seo-rescue-skills` to `seo-survival-kit` (2026-05-22) — better captures the scope: rescue + survival + growth across the post-AI-Overview 2026 SERP landscape. See [ROADMAP-2026.md](./ROADMAP-2026.md) for how the skills are positioned for Google's announced direction.
- **6 skills** covering free-tier audit → recovery framework → outreach reports → channel economics → competitor gaps → automated PSI tracking.
- **Smoke-tested** on 10 diverse domains across 7 categories (e-commerce, news, SaaS, comparison, content/UGC, services, travel) — pipeline works domain-agnostically.

## See it in action

### Sample outreach report

Same layout you get for a real domain — decision-maker-friendly, 10 chapters, ~1 MB PDF:

![Sample SEO Report — Cover & Executive Summary](./examples/screenshots/01-cover-executive-summary.png)

Full sample PDF: [examples/sample-audit.pdf](./examples/sample-audit.pdf)

### The use case: extreme Core-Update crash

This is the pattern these skills are built for — years of stable visibility, then a sharp −60% drop in 2-3 weeks after a published Google Core Update. Owner did nothing wrong. Recovery is now a 6–12 month authority-rebuild, not a tech fix:

![Core Update Crash Use Case](./examples/screenshots/02-core-update-crash-case.png)

See [ROADMAP-2026.md](./ROADMAP-2026.md) for documented public cases (HouseFresh, Glenn Gabe 2023-24, Dec 2025 retailer, Retro Dodo) and how Google's 2026 search direction shapes the recovery playbook.

## What this is

Most SEO Claude Code skills focus on **audits and implementation**. This plugin focuses on the scenarios audits don't fully address:

1. **You have no budget** for SEO tools and want a quick health check using only Google's free tools
2. **A website got hit by a Google Core Update** — what's actually happening, and how to recover over 6–12 months
3. **You want to send a non-technical site owner a polished SEO report** — outreach pitch, client handoff, founder briefing, board-level snapshot
4. **You need to know which channel actually makes money** (Amazon vs OTTO vs direct shop) and which to drop
5. **You need a real competitor analysis** that catches the actual organic competitors, not who you think competes
6. **You need automated weekly performance tracking** to catch regressions before customers do

If you're already running [claude-seo](https://github.com/AgriciDaniel/claude-seo) for technical audits, this complements it with the **free-tier entry path**, the **rescue framing**, the **decision-maker communication layer**, and **multi-channel financial perspective**.

**Who uses this:**
- 🏪 E-commerce shop owners and operators
- 📰 News publishers and content sites
- 💼 SaaS founders and growth teams
- 🛎️ Service businesses (agencies, consultants, freelancers)
- 🏥 YMYL sites (healthcare, finance, legal) — Authority-First recovery framework is especially relevant
- 🤝 SEO agencies and freelancers doing cold outreach

The skills are domain-type-agnostic. The example data in `examples/` happens to be an e-commerce sample, but the workflow works identically for a B2B SaaS or a news site.

## Quick Reference

Every skill is reachable as a namespaced slash command. Type `/seo-rescue:rescue` in Claude Code to see the routing table, or call any sub-skill directly.

| Slash command | What it does | Cost |
|---|---|---|
| `/seo-rescue:rescue` | Orchestrator + routing table | free |
| `/seo-rescue:seo-audit-free <domain>` | Free-tier health check (GSC + PSI + Lighthouse + curl) | free |
| `/seo-rescue:post-core-update-recovery <domain>` | Core-Update diagnose tree + 4-phase Authority-First recovery plan | free |
| `/seo-rescue:seo-outreach-report <domain>` | 10-chapter A4 PDF for non-technical decision-makers (Sistrix + DataForSEO + PSI) | ~$0.05-$0.50 |
| `/seo-rescue:channel-economics-analyzer` | Per-channel P&L across 30+ marketplaces | free (your CSVs) |
| `/seo-rescue:competitor-deep-audit <domain>` | DataForSEO SERP-overlap + keyword-gap analysis | ~$0.10-$0.50 |
| `/seo-rescue:psi-weekly-cron-baseline` | Automated weekly PSI tracking with regression alerts | free |
| `/seo-rescue:ai-search-rescue <domain>` | AI Overviews + AI Mode + ChatGPT + Perplexity visibility recovery | free |

## The seven skills

### `seo-audit-free`

Beginner-friendly SEO health check using **only free tools**:
- Google Search Console (free with site verification)
- Google PageSpeed Insights v5 (25k calls/day free with API key)
- Lighthouse CLI (open source, runs locally)
- Schema.org Validator (browser-based, free)
- `curl` for robots.txt, sitemap, HTTP headers

Produces a 1-page Markdown report with traffic-light findings and three concrete next steps. **Zero API costs.**

**Use when** you don't have budget for paid SEO tools, want to evaluate whether a paid audit is worth it, or are auditing a friend's/family's website. Anti-use: deeper competitive analysis (needs the paid `seo-outreach-report`).

### `post-core-update-recovery`

Specific recovery framework for domains that lost visibility after a Google Core Update.

- Decision tree for distinguishing Core-Update damage from technical/CWV drops
- 4-phase plan: Authority foundation → Topical hubs → Off-page authority → Tech hygiene
- Realistic timelines (6–12 months, not 6–8 weeks)
- Counter-rationalizations for common owner panic-moves (buying backlinks, doing a relaunch, blaming CWV)

**Triggers automatically** when you describe a Sistrix VI drop correlating with a published Core Update, broad keyword loss with stable brand keywords, no technical changes, no manual action.

### `seo-outreach-report`

End-to-end pipeline that produces a polished A4 PDF SEO snapshot per domain — ready to send to a non-technical site owner.

**Pipeline** (4 small Node.js scripts in the skill folder):
1. `seo-audit-fetch-v2.js` — parallel Sistrix-VI + DataForSEO Labs + Google PSI v5 fetch
2. `seo-extract-v2.js` — extract KPIs, top keywords, quick wins (Pos 4–20 with SV≥100)
3. `seo-onpage.js` — title/meta/H1/schema check from local HTML
4. `seo-report-gen.js` — Chrome-headless HTML→PDF render with embedded SVG charts

**Report structure** (10 chapters, decision-maker language):
1. Cover with data-driven headline
2. Executive Summary (4 KPI gauges + Top-5 priorities)
3. Status Quo (what we found — neutral, no judgment)
4. Visibility chart with 18-month history
5. Top-15 rankings + Quick Wins table
6. Competitors
7. PageSpeed with traffic-light gauges
8. Schema/Title/Meta/Image-alt findings
9. Backlinks
10. Conclusion + 30/60/90-day action plan (per item: what, why, how, who, cost, expected impact)

PDF is ~1 MB per domain. Full pipeline runs in under 5 minutes per domain.

### `channel-economics-analyzer`

Channel-level P&L calculator for multi-channel e-commerce businesses (Amazon, OTTO, eBay, direct shop). Per channel: revenue, COGS, fees, ad-spend, operating margin, break-even order count. Tells you which channel is profitable and which is bleeding money.

**Use when** you sell across multiple marketplaces and want to know which to scale, hold, or wind down. Output: channel scorecard with traffic-light status and concrete action thresholds.

### `competitor-deep-audit`

DataForSEO-powered competitor analysis. Identifies the **real** organic competitors (not who the owner thinks), then computes keyword-gap-analysis: keywords where competitors rank top-10 but you don't, sorted by opportunity score (search volume × competitor density).

**Use when** planning content roadmaps or doing a new SEO mandate intake. Output: 30–50-item prioritized opportunity list per competitor audit. Cost: ~$0.10–$0.50 per audit.

### `psi-weekly-cron-baseline`

Automated weekly PageSpeed Insights tracking with regression detection. Runs as launchd/systemd/GitHub-Actions cron, stores history as NDJSON, alerts when scores drop > threshold vs N-week baseline. **Free** (uses PSI v5 free quota).

**Use when** you've done performance optimization and want to make sure it sticks — or when third-party plugins/themes have a history of silently breaking performance.

### `ai-search-rescue`

Framework for recovering visibility in AI search surfaces — Google AI Overviews, Google AI Mode, ChatGPT, Perplexity, Bing Copilot, Claude.ai search. Different mechanics from classical SERP ranking: you're competing to be the source the LLM cites, not the link the user clicks. Seven optimization tactics (extractable passages, question-shaped headings, source-cited statements, author trust, schema for AI, llms.txt, Wikipedia), a three-layer measurement setup (brand-mention prompt set, GSC AI-traffic filter, AI-crawler logs), and a realistic 6-12 week recovery workflow.

**Use when** organic rankings have recovered but AI Overview citations are still going to competitors, or when a site says "ChatGPT keeps recommending the competitor, never us". One operational finding from real recovery work: AI citations move 2-6 weeks before classical Sistrix VI does, so they're a leading indicator that Authority-First work in `post-core-update-recovery` is actually being recognized.

## Installation

**Recommended — pinned to a tag (reproducible, survives upstream changes):**
```shell
/plugin marketplace add maxschottke-spec/seo-survival-kit#v0.3.1
/plugin install seo-rescue@seo-survival-kit
/reload-plugins
```

Always-latest (less safe — a maintainer-account compromise would propagate on next reload):
```shell
/plugin marketplace add maxschottke-spec/seo-survival-kit
/plugin install seo-rescue@seo-survival-kit
/reload-plugins
```

See [SECURITY.md](./SECURITY.md#how-to-verify-before-trusting) for how to verify a pinned version before installing.

## ⚠️ Before you run anything — read these

| File | Why it matters |
|------|----------------|
| **[COSTS.md](./COSTS.md)** | The `seo-outreach-report` pipeline uses three paid APIs. ~€0.05–€0.50 per domain audit. Read first. |
| **[SECURITY.md](./SECURITY.md)** | What the scripts access, what they don't, and how to verify before trusting them. |
| **[MATURITY.md](./MATURITY.md)** | Honest comparison with mature alternatives. This is v0.1 — useful but not a complete suite. |
| **[ONBOARDING.md](./ONBOARDING.md)** | Step-by-step from install to first PDF in 15 minutes. |

`post-core-update-recovery` is free — no API costs, no setup needed beyond install.

`seo-outreach-report` requires API credentials for Sistrix + DataForSEO + Google PSI. Full walkthrough in [ONBOARDING.md](./ONBOARDING.md).

## Who should use this

| You are | This is for you |
|---------|----------------|
| **Freelance SEO consultant** | Outreach-report = lead-gen tool. Recovery skill = framework for diagnosing new desperate-client mandates. |
| **In-house SEO at an e-commerce shop** | Recovery skill after every Core Update hit. Outreach-report to communicate state to non-technical leadership. |
| **Boutique SEO agency** | Both skills as deliverable templates. Saves hours per onboarding and post-update analysis. |
| **Founder of a shop that lost traffic** | The recovery framework gives you a realistic plan and counter-arguments against panic-moves. |

## What this is NOT

- Not a replacement for `claude-seo` or other technical-audit skills. **Use this alongside them.**
- Not for sites that simply haven't built up SEO yet (<6 months old) — that's an aufbau phase, not a rescue
- Not a magic Core-Update recovery in 4 weeks — the skill is explicit that real recovery is 6–12 months

## Real-world data

Skills were built from four real-world domain audits in May 2026 (mid-size DE mattress shop, foam-cushion manufacturer, German news publisher, camper-mattress brand) and from one extended Core-Update recovery case (March/April 2026 update window).

## Self-improving via LESSONS.md

Each skill has a `LESSONS.md` file. As you use the skills and encounter new patterns or workarounds, append dated entries. After 3+ entries confirm a pattern, consolidate into the main SKILL.md. This way the skills get better the more you use them.

## License

MIT — see [LICENSE](./LICENSE).

## Security & external reviewers

Full threat model and verification steps: [SECURITY.md](./SECURITY.md).

If you're reviewing the plugin — independently, as a collaborator, or with LLM assistance — see [SECURITY.md → For external reviewers](./SECURITY.md#for-external-reviewers). It defines a short reporting protocol (`[VERIFIED]` / `[PROBABLE]` / `[UNVERIFIED]` labels, mandatory `file:line` citations, false-positive guidance for the bundled `skill-security-auditor`, and a copy-paste system prompt for free-tier/sandboxed LLM assistants).

To report a vulnerability: open a [GitHub issue](https://github.com/maxschottke-spec/seo-survival-kit/issues) for non-sensitive items, or email the maintainer directly for items that could affect installed users.

## Contributing

This is a personal skill collection. PRs welcome if you've found real-world improvements, especially:
- New Core-Update lessons in `LESSONS.md`
- Better trigger phrases that improve skill discovery
- Bug fixes in the pipeline scripts

Open an issue if you want to discuss a larger change before opening a PR.

## Status & Maturity

Version 0.1 — first public release. Built and tested against real 2026 recovery cases (4 domain audits, 1 extended Core-Update recovery). Expect breaking changes until 1.0.

**Honest comparison** with mature alternatives (claude-seo with 6.9k stars is the reference): see [MATURITY.md](./MATURITY.md). This plugin is **niche complement**, not a replacement.
