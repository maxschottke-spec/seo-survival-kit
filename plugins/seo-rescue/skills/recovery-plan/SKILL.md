---
name: recovery-plan
description: 'Generates a prioritized recovery action plan from diagnosis + crawl data. Determines recovery phase (R1-R5), builds Do-Not-Touch list for stable keywords, prioritizes actions by Impact x Effort x Risk, enforces batch-change limits. Requires recovery-diagnose to have run first.'
user-invocable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.3'
  category: marketing
---

# Recovery Plan

Read and follow the full command specification:

1. Read `${CLAUDE_PLUGIN_ROOT}/commands/recovery-plan.md` for the complete workflow.
2. Read `${CLAUDE_PLUGIN_ROOT}/references/RECOVERY_SYSTEM.md` for phase determination and risk matrix.
3. Read `${CLAUDE_PLUGIN_ROOT}/references/DECISION_ENGINE.md` for prioritization rules.
4. Validate output against `${CLAUDE_PLUGIN_ROOT}/schemas/action-plan.schema.json`.
