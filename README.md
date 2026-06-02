# SEO Survival Kit for Claude Code

> Recovery-first decision support for ecommerce/D2C SEO. Claude Code skills for Core Update recovery diagnosis, prioritized action plans, weekly monitoring, and a Change Governor / Settlement Gate that prevents over-optimizing during recovery windows. Built and validated during real ecommerce Core-Update recovery in spring 2026. Open-source, MIT, zero runtime dependencies.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet)](https://code.claude.com/)
[![Status: Public Beta](https://img.shields.io/badge/Status-Public%20Beta-orange.svg)](./CHANGELOG.md)

**v0.5.0 shipped · v0.5.1 in flight.** Public beta. Breaking changes possible before v1.0. Pin to a tag for reproducible installs. See [CHANGELOG.md](./CHANGELOG.md).

## Start here

Three common entry points. Pick the one that matches your situation:

**1. Traffic dropped after a Google Core Update**
```
/seo-rescue:post-core-update-recovery example.com
```
Diagnosis tree + phased Authority-First recovery plan (6–12 month horizon, no 4-week magic promises).

**2. Free technical health check before deciding on paid tools**
```
/seo-rescue:seo-audit-free example.com
```
Free-tier check using only Google's surfaces (GSC + PSI + Lighthouse + curl). No API keys required.

**3. Weekly recovery review using your Sistrix CSV exports**
```
/seo-rescue:sistrix-monday-recovery-check current.csv previous.csv example.com
```
17-section structured report. CSV-first, no Sistrix API key required.

**Typical sequence:** diagnose → recovery plan → weekly monitoring. Every step ends with an operator-reviewable artifact. **No autonomous live changes are made by any skill or command.**

## Positioning

Recovery-first decision intelligence for ecommerce and D2C. Most SEO tools answer *what is technically wrong*. This framework answers *given everything I know, what should I do next, what should I leave alone right now, and what should wait*. It complements technical-audit suites (`claude-seo` and similar); it does not replace them.

## What this helps you decide

- Should this URL be protected or changed right now?
- Is this recovery signal real, or is the visibility index lagging real ranking gains?
- Are winners being offset by a few large losers, masking aggregate movement?
- Which keywords are commercially important enough to protect at all costs?
- Is now the wrong time for URL consolidation, title rewrites, or template changes?
- Should we increase paid spend, or fix margin / tracking / landing pages first?
- Which channel is profitable, which is bleeding, which to wind down?
- Which AI surfaces (AI Overview, ChatGPT, Perplexity) are currently citing the site — as a supporting signal, not a primary metric.

## What this is NOT

- Not an autonomous SEO system. Every recommendation is reviewed by the operator.
- Not a full-service marketing agency. Execution belongs to the operator's team, agency, or contractors.
- Not a generic AI growth platform. The focus is recovery-first decision support for ecommerce/D2C, not breadth across all marketing surfaces.
- Not automatic ad optimization. No write actions to any ad account. No automatic budget changes.
- Not a guarantee. Every output carries calibrated confidence; the framework refuses to promise rankings, revenue, or timelines.

## Safety: Change Governor and Settlement Gate

The kit is not designed to execute SEO changes autonomously. Two safety layers sit between the operator and any live modification:

**Change Governor.** Every session starts in `audit_only` mode with zero change budget. Mode escalation requires explicit operator instruction. Each proposed change is rated on risk, evidence quality, rollback readiness, and approval state — actions without a clear data basis can never be classified as `green` risk.

**Settlement Gate.** After a Major Batch of live changes, the gate hard-blocks new optimization waves until enough data has accumulated to attribute cause and effect. The most dangerous moment in recovery is not the first mistake — it is the impulse to keep optimizing immediately afterwards. The gate enforces a waiting period during which only monitoring, QA, rollback prep, and verified emergencies are allowed.

**Goal.** Don't change too much at once. Protect winners. Keep cause-and-effect measurable. **No live SEO change without operator review.**

Canonical references:
- [`plugins/seo-rescue/references/SEO_CHANGE_GOVERNOR.md`](./plugins/seo-rescue/references/SEO_CHANGE_GOVERNOR.md) — modes, budgets, escalation rules
- [`plugins/seo-rescue/references/SEO_SETTLEMENT_GATE.md`](./plugins/seo-rescue/references/SEO_SETTLEMENT_GATE.md) — hard-block definition, exceptions, unlock criteria
- [`plugins/seo-rescue/references/SAFE_LIVE_CHANGE_RULES.md`](./plugins/seo-rescue/references/SAFE_LIVE_CHANGE_RULES.md) — pre/post-crawl rules, batch limits, user-pressure responses
- [`plugins/seo-rescue/docs/LIVE_CHANGE_QA.md`](./plugins/seo-rescue/docs/LIVE_CHANGE_QA.md) — live-change QA workflow
- [`plugins/seo-rescue/commands/recovery-audit.md`](./plugins/seo-rescue/commands/recovery-audit.md) — change-budget audit command

## Naming at a glance

| Refers to | Name |
|---|---|
| Repository / marketplace | `seo-survival-kit` |
| Plugin (technical) | `seo-rescue` |
| Slash commands | `/seo-rescue:rescue`, `/seo-rescue:seo-audit-free`, … |

The split is intentional (marketplace is the brand, plugin is the technical handle).

## What's in the kit

The orchestrator (`/seo-rescue:rescue`) routes to the right skill or command; each can also be called directly. Detailed skill registry: [ARCHITECTURE.md section 4](./ARCHITECTURE.md#4-modules-and-skill-registry).

**Core recovery workflow**

| Command | What it does | Cost |
|---|---|---|
| `/seo-rescue:post-core-update-recovery <domain>` | Core-Update diagnose tree + 4-phase Authority-First recovery plan | free |
| `/seo-rescue:recovery-diagnose <domain>` | Diagnosis with capability-based provider fallbacks (Sistrix + DataForSEO + GSC CSV) | ~$0.05–$0.50 |
| `/seo-rescue:recovery-crawl <domain>` | Crawl + severity-classified issues (Screaming Frog or local minimal-crawler fallback) | free |
| `/seo-rescue:recovery-plan <domain>` | Prioritized 30/60/90-day plan with Do-Not-Touch + human approval gate | free |
| `/seo-rescue:recovery-monitor <domain>` | Weekly tracking with deterministic 0-100 recovery score | free |
| `/seo-rescue:recovery-full <domain>` | Full sequence: diagnose → crawl → plan → monitor | ~$0.05–$0.50 |
| `/seo-rescue:sistrix-monday-recovery-check <current.csv> <previous.csv> [domain?]` | CSV-first weekly review, 17-section structured report | free |

**Diagnostic and analysis**

| Command | What it does | Cost |
|---|---|---|
| `/seo-rescue:seo-audit-free <domain>` | Free-tier health check (GSC + PSI + Lighthouse + curl) | free |
| `/seo-rescue:gsc-deep-dive <domain> [days?]` | One-call Google Search Console snapshot | free |
| `/seo-rescue:competitor-deep-audit <domain>` | DataForSEO SERP-overlap + keyword-gap analysis | ~$0.10–$0.50 |
| `/seo-rescue:psi-weekly-cron-baseline` | Automated weekly PSI tracking with regression alerts | free |

**Reporting and economics**

| Command | What it does | Cost |
|---|---|---|
| `/seo-rescue:seo-outreach-report <domain>` | 10-chapter A4 PDF for non-technical decision-makers | ~$0.05–$0.50 |
| `/seo-rescue:channel-economics-analyzer` | Per-channel P&L across 30+ marketplaces | free (your CSVs) |
| `/seo-rescue:subscription-monetization-audit [domain \| --csv]` | 5-lever recurring-revenue playbook; optional Stripe/Chargebee/Recurly CSV import for MRR / ARPU / churn / cohort analysis | free (your CSVs) |

**AI surface (experimental visibility layer)**

| Command | What it does | Cost |
|---|---|---|
| `/seo-rescue:ai-search-rescue <domain>` | Diagnosis + framework for AI Overview / ChatGPT / Perplexity citation patterns | free |
| `/seo-rescue:ai-citations-tracker` | Weekly tracker for brand citations in ChatGPT + Perplexity (NDJSON history) | ~$0.10/year |

> AI surfaces are an experimental visibility layer. Citation tracking and diagnosis only — not a guarantee of AI search traffic. Use as a supporting signal alongside classical search data, not as the sole basis for decisions.

## Architecture and documentation

| Doc | Purpose |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Canonical source of truth: vision, positioning, system shape, modules, governance, privacy, adaptive onboarding, knowledge layer, what is NOT implemented |
| [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) | Six-stage recovery framework, Recovery Risk Engine, Money Keyword Protection, Winner/Loser Neutralization, URL Recovery Analysis, Recovery Signal Score, five-phase sequencing |
| [DECISION_ENGINE.md](./DECISION_ENGINE.md) | Decision rules catalog, evidence weighting, data quality, profitability signals, prioritization, sequencing, cross-channel signals |
| [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) | Weekly CSV-first workflow specification — runnable skill at [`plugins/seo-rescue/skills/sistrix-monday-recovery-check/`](./plugins/seo-rescue/skills/sistrix-monday-recovery-check/) (v0.5.1-dev) with synthetic example at [`examples/synthetic-sistrix-monday-check/`](./examples/synthetic-sistrix-monday-check/) |
| [ROADMAP.md](./ROADMAP.md) | Version-by-version product plan |
| [ROADMAP-2026.md](./ROADMAP-2026.md) | Google search future-watch (separate from product roadmap) |

## Installation

Pinned to a tag (reproducible, survives upstream changes):

```shell
/plugin marketplace add maxschottke-spec/seo-survival-kit#v0.5.0
/plugin install seo-rescue@seo-survival-kit
/reload-plugins
```

Always-latest (less safe — a maintainer-account compromise would propagate on next reload):

```shell
/plugin marketplace add maxschottke-spec/seo-survival-kit
/plugin install seo-rescue@seo-survival-kit
/reload-plugins
```

See [SECURITY.md → How to verify before trusting](./SECURITY.md#how-to-verify-before-trusting).

### Outside Claude Code

The three pure-Markdown framework skills (`rescue`, `post-core-update-recovery`, `ai-search-rescue`) are available as platform-agnostic Markdown in [`exports/`](./exports/) with install snippets for Cursor, OpenAI Custom GPT, Gemini CLI, Aider, Continue.dev, and Codex. Script-backed skills remain Claude-Code-specific; MCP wrapper planned for v1.0+.

## Before you run anything

| File | Why |
|---|---|
| [COSTS.md](./COSTS.md) | `seo-outreach-report` uses three paid APIs. €0.05–€0.50 per domain typical. |
| [SECURITY.md](./SECURITY.md) | What the scripts access, what they don't, how to verify. |
| [MATURITY.md](./MATURITY.md) | Honest comparison with mature alternatives. |
| [ONBOARDING.md](./ONBOARDING.md) | Install to first PDF in 15 minutes. |

`post-core-update-recovery` is free. `seo-outreach-report` requires API credentials for Sistrix + DataForSEO + Google PSI — full walkthrough in [ONBOARDING.md](./ONBOARDING.md).

## Sample output

Same layout you get for a real domain — 10 chapters, ~1 MB PDF, plain language for non-technical decision-makers:

![Sample SEO Report — Cover & Executive Summary](./examples/screenshots/01-cover-executive-summary.png)

Full sample: [examples/sample-audit.pdf](./examples/sample-audit.pdf). The use-case pattern (sharp −60% drop in 2-3 weeks after a published Core Update) is documented in [examples/screenshots/02-core-update-crash-case.png](./examples/screenshots/02-core-update-crash-case.png) and [ROADMAP-2026.md](./ROADMAP-2026.md).

## When to use

- Organic traffic dropped during or shortly after a published Google Core Update. Recovery framework provides a phased Authority-First plan with realistic 6-12 month horizons.
- A non-technical decision-maker (shop owner, founder, executive) needs to understand the SEO state. Outreach-report pipeline produces a decision-maker A4 PDF.
- No budget for paid SEO tools, want a free-tier health check. `seo-audit-free` is the entry.
- Multi-marketplace ecommerce, need to know which channel is profitable. Channel-economics-analyzer computes per-channel break-even and operating margin from your CSVs.
- Weekly PSI monitoring with regression detection. Free over PSI v5 quota.
- You want to track AI surface citation patterns (AI Overview, ChatGPT, Perplexity) as a supporting signal alongside classical rankings — not as a primary growth driver.

## When not to use

- The site is brand new (< 6 months). That is an aufbau-phase, not a rescue-phase.
- You need a deep technical audit (crawlability, schema validation, CWV across hundreds of URLs). Use `claude-seo` instead. This complements it.
- You need 4-week magic recovery. The framework is explicit about 6-12 month horizons for Core Update damage.
- You need production-grade guarantees, SLAs, or enterprise contracts. Public beta, single-maintainer.

## Use-case fit

This system is currently strongest for ecommerce/D2C recovery workflows, especially when SEO data can be evaluated against revenue, margin, inventory, returns, conversion, and paid-media context.

| Website type | Fit | Notes |
|---|---|---|
| Ecommerce / D2C | Core fit | Strongest current use case. Product, category, margin, inventory, return and conversion data make recovery decisions more reliable. |
| Lead generation / B2B | Good fit with adaptation | Replace product revenue with lead quality, pipeline, CPL and sales-cycle data. |
| SaaS | Good fit with adaptation | Use signup, activation, demo, trial and pipeline metrics instead of shop revenue. |
| Local service | Partial fit | Works when calls, forms, location pages and lead quality can be measured reliably. |
| Publisher / News | Special case | Requires freshness, topical authority, Discover/News visibility and ad/affiliate revenue logic. Not the current core model. |
| Affiliate / Comparison | Partial fit | Needs EPC, merchant mix, SERP intent and monetization quality. |
| YMYL / regulated content | Caution | Requires stricter evidence standards and additional expert/legal review where applicable. |

The framework should not be treated as a universal SEO automation system. Each website type needs its own business-signal layer.

## YMYL notice

For Your-Money-Your-Life sites (medical, legal, financial, regulated), have a domain expert review the action plan before client delivery. The framework treats sites uniformly at the SEO-mechanics level; it does not validate domain-specific compliance.

## Real-world basis

Skills were built from one extended Core-Update recovery case (mid-size DE ecommerce shop, March/April 2026 update window) and validated against four additional real-world domain audits in May 2026. Patterns in skill `LESSONS.md` files are observations from this case base, not population statistics — treat as starting hypotheses to test in your own context.

The open repo is a first-pass methodology and decision-support layer. It helps identify recovery signals, risky changes, protected URLs, winner/loser patterns, missing data, and validation steps. It is not the same as a calibrated recovery engagement that brings private business context into the decision. Deeper recovery work needs data the open repo does not see: GSC/SISTRIX history, shop revenue, margin, returns, inventory, paid-media context, implementation history, competitive context, and operator review to weigh conflicting signals.

## Need help running this on your own site?

The plugin is MIT and self-serve. If you'd rather have someone with operational experience walk you through it on your specific case, the maintainer offers paid engagements:

| Engagement | What you get | Typical scope |
|---|---|---|
| **Recovery Audit (fixed)** | Full diagnose-PDF + 60-min strategy call + 4-phase 6-12 month plan | One domain, one Core-Update or AI-search problem |
| **Recovery Begleitung (retainer)** | Monthly reviews, plan adjustments, prioritization help | 3-6 months, weekly to bi-weekly cadence |
| **Outreach pipeline setup** | Configured pipeline + first 5 PDFs + handoff | One-time, for agencies that want decision-maker deliverables |

Contact: open a [Discussion](https://github.com/maxschottke-spec/seo-survival-kit/discussions) or reach the maintainer via the email on the [GitHub profile](https://github.com/maxschottke-spec). The framework comes from a specific recovery case still in active recovery; engaging means getting context on which patterns apply to your situation and which do not.

## Contributors

- [Max Schottke](https://github.com/maxschottke-spec) — maintainer, original skills, plugin packaging
- [Jeronzo](https://github.com/kamehamea-art) — independent security review (audit 2026-05-22 surfaced the data-leak surface, prompt-injection chain, and `allowed-tools` hardening that landed in the v0.3.x security sprint)

## Status

Single-maintainer open-source project. No SLA, no commercial support. Issue response best-effort within a few days. For production-critical workflows, pin to a specific tag and review releases before upgrading. The currently shipping version is visible in the badge near the top of this README and in [CHANGELOG.md](./CHANGELOG.md).

## License, security, contributing

MIT. See [LICENSE](./LICENSE), [SECURITY.md](./SECURITY.md), [CONTRIBUTING (open an issue first for larger changes)](https://github.com/maxschottke-spec/seo-survival-kit/issues).
