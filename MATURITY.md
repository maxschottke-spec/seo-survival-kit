# Maturity Disclosure & Comparison

Honest assessment of where this plugin sits in the Claude Code SEO ecosystem.

## Where this plugin is today

**Version 0.1.0** — first public release in May 2026.

- ✅ Tested against 4 real domains (mixed e-commerce + news, results anonymized)
- ✅ Real Core-Update-Recovery case validates the framework
- ✅ Pipeline scripts run end-to-end in <5 min per domain
- ✅ MIT license, clean structure
- ✅ Sample PDF + screenshots in `examples/` (synthetic data, real layout)
- ✅ Subagent trigger-test green for `seo-outreach-report` (correctly picked over `claude-seo:seo-audit` and `make-pdf`)
- ✅ agentskills.io compliant — SKILL.md format works in Claude Code / Cursor / Codex / Gemini CLI (cross-agent portability — though only tested in Claude Code so far)
- ✅ Security hardening v0.1 — safeSlug regex validator, JSON.stringify path quoting, --no-sandbox removed, env-based Chrome path
- ⚠️ No external contributors yet
- ⚠️ No automated tests (skills tested via subagent pressure scenarios manually)
- ⚠️ German-language documentation in some places (Lessons + parts of SKILL.md) — English README and a fully translated SKILL.md planned for 0.2
- ⚠️ Hardcoded for German/`location_code: 2276` DataForSEO Labs queries — international expansion planned

**Verdict:** Useful for the specific niche it covers. Not a replacement for comprehensive audit suites.

## How this compares to alternatives

| Plugin / Skill Pack | Stars | Mature? | Covers what we cover? | Recommendation |
|---------------------|-------|---------|------------------------|----------------|
| [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | 6.9k | **Very mature** (v1.9.9, 30+ commits, active maintenance) | Comprehensive audit, schema, content, GEO, e-commerce, international, PDF reports | **Use for technical audits.** This is the reference. |
| [aaron-he-zhu/seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills) | 1.7k | Mature | 20 skills around keyword research + content writing + technical audits + rank tracking | **Use for ongoing content/keyword work.** |
| [zubair-trabzada/dataforseo-claude](https://github.com/zubair-trabzada/dataforseo-claude) | 79 | Newer | DataForSEO-focused with 13 skills + 5 subagents | Good if DataForSEO is your main data source. |
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | 12.9k | Very mature | Marketing stack (CRO, copy, paid ads, SEO) — broader scope | Use for marketing breadth, not deep SEO. |
| **[maxschottke-spec/seo-survival-kit](https://github.com/maxschottke-spec/seo-survival-kit) (this)** | 0 | **0.1, brand new** | Core-Update recovery framework + outreach-PDF pipeline | **Use when** the situation is recovery / cold-outreach. Complements above. |

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
- [ ] External security review (paid, scope similar to safe-write-mode v0.2 review — currently self-reviewed only)

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
