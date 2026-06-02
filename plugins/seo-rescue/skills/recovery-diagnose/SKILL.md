---
name: recovery-diagnose
description: 'Automatic domain diagnosis for Core Update recovery. Calls Sistrix + DataForSEO MCP, quantifies VI drop, identifies keyword losses, scans backlink profile, correlates with known Core Update dates. Outputs structured befund.json to cache. Use when starting recovery analysis for a domain.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.2'
  category: marketing
---

# Recovery Diagnose

Read and follow the full command specification:

1. Read `../../commands/recovery-diagnose.md` for the complete workflow.
2. Read `../../references/CORE_UPDATES.md` for Core Update dates.
3. Read `../../references/RECOVERY_SYSTEM.md` for diagnosis thresholds and recovery stage estimation.
4. Validate output against `../../schemas/befund.schema.json`.
