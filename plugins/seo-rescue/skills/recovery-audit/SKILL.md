---
name: recovery-audit
description: 'Audits all SEO changes made to a domain within a given period (read-only). Reconstructs change history from cache, Shopware updatedAt fields and crawl diffs when logs are missing. Detects Settlement-Gate-triggering Major Batches, writes recovery-gate.json, and emits the hypothesis_registry that recovery-plan needs for live-fix-eligible actions.'
user-invokable: true
argument-hint: '<domain> [--days 14]'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.2'
  category: marketing
---

# Recovery Audit

Read and follow the full command specification:

1. Read `../../commands/recovery-audit.md` for the complete workflow.
2. Read `../../references/SEO_SETTLEMENT_GATE.md` for Major Batch trigger thresholds and unlock criteria.
3. Read `../../references/HYPOTHESIS_VERIFICATION_GATE.md` for hypothesis status definitions.
4. Validate output against `../../schemas/seo-change-audit.schema.json` and `../../schemas/recovery-gate.schema.json`.

This command is the **writer** of `~/.cache/seo-rescue/{slug}/recovery-gate.json` and of the `hypothesis_registry` consumed by `recovery-plan`. Run it before `recovery-plan` whenever live-fix-eligible actions are needed.
