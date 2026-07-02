---
name: recovery-monitor
description: 'Weekly recovery tracking. Fetches current VI + keyword positions, computes 0-100 recovery score, appends to NDJSON history, outputs delta report. Run weekly or on-demand to track recovery progress over time. API-driven (Sistrix/DataForSEO MCP) — for the CSV-only weekly review without any API access use sistrix-monday-recovery-check instead.'
user-invocable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.4'
  category: marketing
---

# Recovery Monitor

Read and follow the full command specification:

1. Read `${CLAUDE_PLUGIN_ROOT}/commands/recovery-monitor.md` for the complete workflow.
2. After collecting Sistrix + DataForSEO data, call `node "${CLAUDE_PLUGIN_ROOT}/scripts/recovery-monitor.js"` helper functions.
3. Validate each history entry against `${CLAUDE_PLUGIN_ROOT}/schemas/history.schema.json`.
