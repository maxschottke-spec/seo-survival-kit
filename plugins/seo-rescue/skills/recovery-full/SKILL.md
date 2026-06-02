---
name: recovery-full
description: 'Full recovery workflow orchestrator. Chains recovery-diagnose, recovery-crawl, recovery-plan, and recovery-monitor in sequence. One command for complete domain recovery analysis from diagnosis to monitoring setup. Gracefully degrades if individual steps fail.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.2'
  category: marketing
---

# Recovery Full Workflow

Read and follow the full command specification:

1. Read `../../commands/recovery-full.md` for the orchestration workflow.
2. Invoke each sub-command in sequence by reading and following its command specification.
3. Check artifact status after each step before proceeding.
