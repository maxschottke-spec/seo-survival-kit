---
name: recovery-plan
description: 'Generates a prioritized recovery action plan from diagnosis + crawl data. Determines recovery phase (R1-R5), builds Do-Not-Touch list for stable keywords, prioritizes actions by Impact x Effort x Risk, enforces batch-change limits. Requires recovery-diagnose to have run first.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.2'
  category: marketing
---

# Recovery Plan

Read and follow the full command specification:

1. Read `../../commands/recovery-plan.md` for the complete workflow.
2. Read `../../references/RECOVERY_SYSTEM.md` for phase determination and risk matrix.
3. Read `../../references/DECISION_ENGINE.md` for prioritization rules.
4. Validate output against `../../schemas/action-plan.schema.json`.
