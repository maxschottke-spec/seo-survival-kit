# SEO Survival Kit for Claude Code

> Recovery Operating System for Ecommerce/D2C. Ten Claude Code skills (one orchestrator + nine sub-skills) for SEO diagnosis, Core Update recovery, AI search visibility, decision-maker reporting, and channel economics. Built and validated during real ecommerce Core-Update recovery in spring 2026. Open-source, MIT, zero runtime dependencies.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet)](https://code.claude.com/)
[![Status: Public Beta](https://img.shields.io/badge/Status-Public%20Beta-orange.svg)](./CHANGELOG.md)

**v0.5.0 shipped · v0.5.1 in flight.** Public beta. Breaking changes possible before v1.0. Pin to a tag for reproducible installs. See [CHANGELOG.md](./CHANGELOG.md).

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
- Which AI surfaces (AI Overview, ChatGPT, Perplexity) are citing the site, and which are still going to competitors?

## What this is NOT

- Not an autonomous SEO system. Every recommendation is reviewed by the operator.
- Not a full-service marketing agency. Execution belongs to the operator's team, agency, or contractors.
- Not a generic AI growth platform. The focus is recovery-first decision support for ecommerce/D2C, not breadth across all marketing surfaces.
- Not automatic ad optimization. No write actions to any ad account. No automatic budget changes.
- Not a guarantee. Every output carries calibrated confidence; the framework refuses to promise rankings, revenue, or timelines.

## Naming at a glance

| Refers to | Name |
|---|---|
| Repository / marketplace | `seo-survival-kit` |
| Plugin (technical) | `seo-rescue` |
| Slash commands | `/seo-rescue:rescue`, `/seo-rescue:seo-audit-free`, … |

The split is intentional (marketplace is the brand, plugin is the technical handle).

## The ten skills (1 orchestrator + 9 specialized sub-skills)

Every skill is reachable as a namespaced slash command. The orchestrator (`rescue`) routes to the right sub-skill; each sub-skill can also be called directly.

| Type | Slash command | What it does | Cost |
|---|---|---|---|
| Orchestrator | `/seo-rescue:rescue` | Routing table — points at the right sub-skill | free |
| Sub-skill | `/seo-rescue:seo-audit-free <domain>` | Free-tier health check (GSC + PSI + Lighthouse + curl) | free |
| Sub-skill | `/seo-rescue:post-core-update-recovery <domain>` | Core-Update diagnose tree + 4-phase Authority-First recovery plan | free |
| Sub-skill | `/seo-rescue:seo-outreach-report <domain>` | 10-chapter A4 PDF for non-technical decision-makers (Sistrix + DataForSEO + PSI) | ~$0.05-$0.50 |
| Sub-skill | `/seo-rescue:channel-economics-analyzer` | Per-channel P&L across 30+ marketplaces | free (your CSVs) |
| Sub-skill | `/seo-rescue:competitor-deep-audit <domain>` | DataForSEO SERP-overlap + keyword-gap analysis | ~$0.10-$0.50 |
| Sub-skill | `/seo-rescue:psi-weekly-cron-baseline` | Automated weekly PSI tracking with regression alerts | free |
| Sub-skill | `/seo-rescue:ai-search-rescue <domain>` | AI Overviews + AI Mode + ChatGPT + Perplexity visibility recovery (framework) | free |
| Sub-skill | `/seo-rescue:ai-citations-tracker` | Weekly cron tracking brand citations in ChatGPT + Perplexity (NDJSON history) | ~$0.10/year |
| Sub-skill | `/seo-rescue:gsc-deep-dive <domain> [days?]` | One-call Google Search Console snapshot (queries + pages + coverage + CrUX) | free |

Skill-level detail: see [ARCHITECTURE.md section 4](./ARCHITECTURE.md#4-modules-and-skill-registry).

## Architecture and documentation

| Doc | Purpose |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Canonical source of truth: vision, positioning, system shape, modules, governance, privacy, adaptive onboarding, knowledge layer, what is NOT implemented |
| [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) | Six-stage recovery framework, Recovery Risk Engine, Money Keyword Protection, Winner/Loser Neutralization, URL Recovery Analysis, Recovery Signal Score, five-phase sequencing |
| [DECISION_ENGINE.md](./DECISION_ENGINE.md) | Decision rules catalog, evidence weighting, data quality, profitability signals, prioritization, sequencing, cross-channel signals |
| [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) | Weekly CSV-first workflow specification (skill ships in v0.5.1) |
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
- AI search visibility (AI Overview, ChatGPT, Perplexity) citation recovery, not just classical rankings.

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

v0.5.0 shipped, v0.5.1 in flight. Single-maintainer open-source project. No SLA, no commercial support. Issue response best-effort within a few days. For production-critical workflows, pin to a specific tag and review releases before upgrading.

## License, security, contributing

MIT. See [LICENSE](./LICENSE), [SECURITY.md](./SECURITY.md), [CONTRIBUTING (open an issue first for larger changes)](https://github.com/maxschottke-spec/seo-survival-kit/issues).
