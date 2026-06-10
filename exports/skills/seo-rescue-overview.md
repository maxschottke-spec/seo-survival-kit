# SEO Rescue — Framework Overview

> **Source:** `plugins/seo-rescue/skills/rescue/SKILL.md` (canonical Claude Code orchestrator). This export is a **platform-agnostic overview** for non-Claude-Code LLMs — the slash-command-based routing in the original (`/seo-rescue:rescue audit <domain>` etc.) does not apply outside Claude Code.

This document describes the overall SEO-Rescue framework so any LLM (Cursor, OpenAI Custom GPT, Gemini, Aider) can route the user to the right sub-framework. Two of the sub-frameworks (`post-core-update-recovery`, `ai-search-rescue`) are also available as exported markdown in this directory. The remaining sub-frameworks (`seo-outreach-report`, `competitor-deep-audit`, `psi-weekly-cron-baseline`, `channel-economics-analyzer`, `ai-citations-tracker`, `gsc-deep-dive`, `seo-audit-free`, `sistrix-monday-recovery-check`, `subscription-monetization-audit`, plus the six `recovery-*` workflow commands) remain Claude-Code-specific — see "Script-backed skills" below.

## Routing — pick the right sub-framework by symptom

| User says | Apply |
|---|---|
| "Sistrix VI dropped 30 %+ after a Google update" | [post-core-update-recovery](./post-core-update-recovery.md) |
| "We rank organically but ChatGPT / AI Overviews don't cite us" | [ai-search-rescue](./ai-search-rescue.md) |
| "We need a free SEO check, no paid tools" | seo-audit-free (Claude Code only — see canonical SKILL.md) |
| "Generate a decision-maker PDF for shop owner X.de" | seo-outreach-report (Claude Code only — Node-pipeline script) |
| "Which sales channel actually makes money?" | channel-economics-analyzer (Claude Code only — Node-pipeline script) |
| "Who outranks me, what keywords am I missing?" | competitor-deep-audit (Claude Code only — Node-pipeline script) |
| "Set up weekly PSI tracking with regression alerts" | psi-weekly-cron-baseline (Claude Code only — Node-pipeline script) |
| "Track ChatGPT / Perplexity brand-citation frequency weekly" | ai-citations-tracker (Claude Code only — Node-pipeline script) |
| "Pull Google Search Console data in one call" | gsc-deep-dive (Claude Code only — Node-pipeline script) |
| "Run my weekly Monday recovery review from SISTRIX CSVs" | sistrix-monday-recovery-check (Claude Code only — CSV-first weekly review) |
| "Audit my subscription / recurring-revenue levers" | subscription-monetization-audit (Claude Code only — optional Stripe/Chargebee/Recurly CSV import) |
| "Run the full recovery workflow on my domain" | recovery-full and the recovery-diagnose/crawl/audit/plan/monitor commands (Claude Code only) |

## When to use which framework

```
User reports a problem
  │
  ├── No SEO tools budget?
  │     └── YES → seo-audit-free (Claude Code only)
  │
  ├── Visibility dropped after Core Update?
  │     └── YES → post-core-update-recovery (this directory)
  │
  ├── Needs report for client / owner?
  │     └── YES → seo-outreach-report (Claude Code only)
  │
  ├── Multi-channel e-commerce P&L question?
  │     └── YES → channel-economics-analyzer (Claude Code only)
  │
  ├── Wants competitor analysis?
  │     └── YES → competitor-deep-audit (Claude Code only)
  │
  ├── Wants ongoing performance monitoring?
  │     └── YES → psi-weekly-cron-baseline (Claude Code only)
  │
  └── AI-search / AI-Overview citation issue?
        └── YES → ai-search-rescue (this directory)
                  + ai-citations-tracker (Claude Code only — for ongoing measurement)
```

## Framework-only skills (available cross-platform)

These are pure-Markdown decision frameworks. They work on any LLM that reads the file. Drop them into Cursor `.cursor/rules/`, OpenAI Custom GPT Instructions, Gemini `GEMINI.md`, Aider `CONVENTIONS.md`, or paste into any chat context.

- **[post-core-update-recovery.md](./post-core-update-recovery.md)** — Diagnose + 4-phase recovery plan for sites hit by a Google Core Update. Authority-first, 6–12 month timeline.
- **[ai-search-rescue.md](./ai-search-rescue.md)** — Recover visibility in Google AI Overviews / AI Mode / ChatGPT / Perplexity / Bing Copilot / Claude.ai search. Seven optimization tactics plus a three-layer measurement setup.

## Script-backed skills (Claude Code only)

These wrap Node.js pipelines (API calls to Sistrix / DataForSEO / Google PSI / GSC / OpenAI / Perplexity, plus Chrome-headless PDF rendering). The scripts themselves are platform-agnostic Node, but the **invocation instructions** in their SKILL.md files use Claude Code conventions (slash commands, `allowed-tools` frontmatter, etc.).

For non-Claude-Code use:

1. **Read the Node script directly** in `plugins/seo-rescue/skills/<skill-name>/*.example.js`. Each script is single-file, documented inline, MIT-licensed.
2. **Configure via JSON + env vars** as documented in each script's header comment. API keys via env, never config files.
3. **Run with `node` directly** in the script directory.
4. **Cross-reference the SKILL.md** for the editorial context — that part is platform-independent even if the slash-command invocation isn't.

If you want native skill-like behavior on Cursor / Custom GPT / Gemini / Aider, an MCP server wrapper would be the right solution (planned for v1.0+).

## Plugin info

- **Canonical version:** `seo-survival-kit` plugin for Claude Code
- **Repository:** [github.com/maxschottke-spec/seo-survival-kit](https://github.com/maxschottke-spec/seo-survival-kit)
- **License:** MIT
- **Dependencies:** zero npm runtime deps (everything that talks to a network is via `fetch`; PDF rendering uses Chrome-headless via `spawnSync` with `shell: false`)
- **Security:** two independent review rounds, see [SECURITY.md](https://github.com/maxschottke-spec/seo-survival-kit/blob/main/SECURITY.md#external-security-reviews)
- **Status:** Public Beta (v0.5.2 — 18 skills/commands: 1 orchestrator + 17 sub-skills and recovery commands)

---

**Where to apply this on each platform:** see [exports/README.md](../README.md).
