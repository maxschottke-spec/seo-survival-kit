---
name: recovery-diagnose
description: 'Automatic domain diagnosis for Core Update recovery. Calls Sistrix + DataForSEO MCP, quantifies VI drop, identifies keyword losses, scans backlink profile, correlates with known Core Update dates. Outputs structured befund.json to cache. Use when starting recovery analysis for a domain. Data-driven: requires Sistrix/DataForSEO MCP access (CSV fallbacks exist) and writes befund.json — for the tool-free pure-Markdown framework use post-core-update-recovery instead.'
user-invocable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.3'
  category: marketing
---

# Recovery Diagnose

Read and follow the full command specification:

1. Read `${CLAUDE_PLUGIN_ROOT}/commands/recovery-diagnose.md` for the complete workflow.
2. Read `${CLAUDE_PLUGIN_ROOT}/references/CORE_UPDATES.md` for Core Update dates.
3. Read `${CLAUDE_PLUGIN_ROOT}/references/RECOVERY_SYSTEM.md` for diagnosis thresholds and recovery stage estimation.
4. Validate output against `${CLAUDE_PLUGIN_ROOT}/schemas/befund.schema.json`.
