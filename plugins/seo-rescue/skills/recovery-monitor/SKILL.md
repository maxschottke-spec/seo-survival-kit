---
name: recovery-monitor
description: 'Weekly recovery tracking. Fetches current VI + keyword positions, computes 0-100 recovery score, appends to NDJSON history, outputs delta report. Run weekly or on-demand to track recovery progress over time.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.2'
  category: marketing
---

# Recovery Monitor

Read and follow the full command specification:

1. Read `../../commands/recovery-monitor.md` for the complete workflow.
2. After collecting Sistrix + DataForSEO data, call `node ../../scripts/recovery-monitor.js` helper functions.
3. Validate each history entry against `../../schemas/history.schema.json`.
