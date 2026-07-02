---
name: recovery-crawl
description: 'Screaming Frog MCP crawl + issue classification. Crawls up to 500 URLs, extracts broken links, redirect chains, missing H1s, canonical errors, and missing meta descriptions. Classifies issues by severity with upgrade rules. Outputs structured issues.json to cache.'
user-invocable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.3'
  category: marketing
---

# Recovery Crawl

Read and follow the full command specification:

1. Read `${CLAUDE_PLUGIN_ROOT}/commands/recovery-crawl.md` for the complete workflow.
2. Use Screaming Frog MCP tools (`sf_crawl`, `sf_crawl_progress`, `sf_generate_bulk_export`, `sf_export_crawl`) as specified.
3. After collecting data, call `node "${CLAUDE_PLUGIN_ROOT}/scripts/recovery-crawl.js"` helper functions to classify issues and write output.
4. Validate output against `${CLAUDE_PLUGIN_ROOT}/schemas/issues.schema.json`.
