# Maturity Disclosure & Comparison

Honest assessment of where this plugin sits in the Claude Code SEO ecosystem.

## Where this plugin is today

**Version 0.5.0** (shipped) — sixth release in the May 2026 launch + hardening cycle. Architecture consolidation: doc structure reached canonical-source-of-truth state in [ARCHITECTURE.md](./ARCHITECTURE.md). No new runtime skills and no change to runtime behavior relative to v0.4.1. **v0.5.1 in flight:** runnable SISTRIX Monday Recovery Check skill matching the specification in [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md).

**Positioning.** Recovery Operating System for Ecommerce/D2C. Recovery-first, decision-first, profit-aware, risk-aware. Complements technical-audit suites like `claude-seo`; does not replace them. The framework supports decisions; execution belongs to the operator's team, agency, or contractors.

- ✅ Tested against 4 real domains (mixed e-commerce + news, results anonymized in published LESSONS.md)
- ✅ Real Core-Update-Recovery pilot case validates the framework — see usage section below
- ✅ Pipeline scripts run end-to-end in <5 min per domain
- ✅ MIT license, clean structure
- ✅ Sample PDF + screenshots in `examples/` (synthetic data, real layout)
- ✅ Subagent trigger-test green for `seo-outreach-report` (correctly picked over `claude-seo:seo-audit` and `make-pdf`)
- ✅ agentskills.io compliant — SKILL.md format works in Claude Code / Cursor / Codex / Gemini CLI (cross-agent portability — though only tested in Claude Code so far)
- ✅ Cross-platform docs (macOS / Linux / Windows env-var reference in ONBOARDING.md)
- ✅ Security hardening v0.3 — `lib/safe.js` (safeSlug + safeHostname + safeUrl + safeLabel + validateConfigTargets + writeFileExclusive + getCacheDir + cachePath), strict CSP on PDF HTML, `spawnSync` with `shell: false` + array argv, sanitize() against indirect prompt-injection, `allowed-tools` declared per skill, CODEOWNERS + Dependabot + branch protection
- ✅ Two independent security review rounds completed 2026-05-22 (see [SECURITY.md → External security reviews](./SECURITY.md#external-security-reviews)):
  - Round 1 (external reviewer): 1 CRITICAL chain + 4 HIGH + 6 MEDIUM — all closed in the v0.3.x security sprint
  - Round 2 (maintainer-driven senior-engineering + marketplace-reviewer audit): gitleaks + trufflehog + semgrep clean; 2 P1 marketplace items flagged + closed; verdict **SAFE TO PUBLISH**
- ⚠️ One external collaborator (security reviewer); no external feature-PRs yet
- ⚠️ No automated tests (skills tested via subagent pressure scenarios manually, plus SAST tools in CI)
- ⚠️ German-language documentation in some places (Lessons + parts of SKILL.md) — English README and a fully translated SKILL.md planned for 0.4
- ⚠️ Hardcoded for German/`location_code: 2276` DataForSEO Labs queries — international expansion planned

## Already in production use

This is a working tool driving real Core-Update recovery decisions on a live e-commerce domain (the pilot domain, anonymized in published LESSONS.md). It is not a research prototype:

- **Active recovery case** — driving recovery decisions on a mid-sized DE e-commerce shop hit by the March 2026 Google Core Update. Pipeline outputs (Sistrix VI traces, GSC click diffs, AI-citation counts) inform weekly recovery prioritization. Multiple dated lesson entries in `post-core-update-recovery/LESSONS.md` and `seo-outreach-report/LESSONS.md` document what worked and what didn't.
- **Cold-outreach use** — the decision-maker PDF format from `seo-outreach-report` has been generated for real prospects, not just synthetic examples. The 10-chapter layout, the language register, and the action-plan template all reflect feedback from actual non-technical recipients.
- **Operating since** — the pipeline scripts (then under different filenames) have been in regular use since March 2026 on the maintainer's daily SEO workflow. The plugin packaging just made them shareable.
- **Self-improving via LESSONS.md** — each new pattern observed in real use gets a dated entry. After three confirmations, it moves into the main SKILL.md. This is the mechanism that took the framework from "ad-hoc memos" to "documented playbook".

What this is **not** yet: production-grade in the sense of having external users, an SLA, or a support contract. The plugin is in **public beta** (single-maintainer, best-effort response, see the Status section of [README.md](./README.md)).

**Verdict:** Useful for the specific niche it covers. Not a replacement for comprehensive audit suites.

## How this compares to alternatives

| Plugin / Skill Pack | Stars | Mature? | Covers what we cover? | Recommendation |
|---------------------|-------|---------|------------------------|----------------|
| [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | 6.9k | **Very mature** (v1.9.9, 30+ commits, active maintenance) | Comprehensive audit, schema, content, GEO, e-commerce, international, PDF reports | **Use for technical audits.** This is the reference. |
| [aaron-he-zhu/seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills) | 1.7k | Mature | 20 skills around keyword research + content writing + technical audits + rank tracking | **Use for ongoing content/keyword work.** |
| [zubair-trabzada/dataforseo-claude](https://github.com/zubair-trabzada/dataforseo-claude) | 79 | Newer | DataForSEO-focused with 13 skills + 5 subagents | Good if DataForSEO is your main data source. |
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | 12.9k | Very mature | Marketing stack (CRO, copy, paid ads, SEO) — broader scope | Use for marketing breadth, not deep SEO. |
| **[maxschottke-spec/seo-survival-kit](https://github.com/maxschottke-spec/seo-survival-kit) (this)** | early | **0.5.0 shipped, v0.5.1 in flight, hardened** | Recovery Operating System for ecommerce/D2C: Core-Update + AI-search recovery framework, outreach-PDF pipeline, channel economics, competitor + PSI tracking, GSC deep dive, AI citation tracking, decision/sequencing layer (v0.5 docs) | **Use when** the situation is recovery / cold-outreach / AI-search visibility / cross-channel decision support for ecommerce. Complements technical-audit plugins. |

## What's actually unique here

After researching the ecosystem (May 2026):

1. **Post-Core-Update recovery as a stand-alone skill with diagnostic decision-tree** — none of the comparable skills have this as a dedicated workflow. Most treat Core-Update damage as "just do an audit."

2. **Decision-maker outreach PDF format with editorial narrative** — comparable skills produce technical audit reports (for SEO professionals). This one writes for non-technical site owners, in plain language, with cost-of-inaction framing.

3. **LESSONS.md self-improvement mechanism** — each skill file has an explicit log for new patterns. After 3+ confirmations of a pattern, it gets consolidated into the main SKILL.md. Most existing skills are static.

## What's NOT unique

- Sistrix + DataForSEO + PSI data fetching — well-covered by `claude-seo` and `dataforseo-claude`
- Schema markup checks — `claude-seo:seo-schema` is more comprehensive
- Backlink analysis — multiple skills cover this better
- Competitor gap analysis — `claude-seo:seo-competitor-pages` does this

If your use case is technical audit, **use `claude-seo`**. If your use case is "I just got hit by a Core Update" or "I need to send an owner a PDF", use this.

## Roadmap to 1.0

- [ ] English translation of all German-language sections
- [ ] International location_code support (currently DE-only in scripts)
- [x] Cross-agent compatibility — agentskills.io SKILL.md format used (test against Cursor/Codex/Gemini still pending)
- [x] Visual examples / sample PDFs in `examples/`
- [ ] 5+ entries in each `LESSONS.md` showing iteration over time
- [ ] At least one external contributor's PR merged
- [x] External security review — completed 2026-05-22 (independent reviewer, gitleaks + trivy + semgrep tool-pass + manual analysis); 1 CRITICAL chain + 4 HIGH + 6 MEDIUM findings, all closed in v0.3.x security sprint

Realistic timeline: **6–12 months to 1.0**.

## Should you use this plugin?

**Yes, if:**
- You need a Core-Update recovery framework AND you don't want to invent it from scratch
- You do cold outreach or audit handoffs and need decision-maker-friendly PDFs
- You're a freelancer / agency / inhouse SEO with German shops as primary client base

**No, if:**
- You need international SEO out of the box (English language version + location_code support is still on the roadmap)
- You need a mature, battle-tested suite — use `claude-seo` instead
- You want a one-click "fix my SEO" tool — neither this nor anything else does that

**Most likely:** install both `claude-seo` and this one. They serve different moments in your workflow.
