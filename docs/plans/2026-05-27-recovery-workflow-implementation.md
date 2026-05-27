# Recovery Workflow Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 new Claude Code Commands (recovery-diagnose, recovery-crawl, recovery-plan, recovery-monitor, recovery-full) in the seo-rescue plugin with shared lib extensions, JSON schemas, and reference documents.

**Architecture:** Hybrid approach — Markdown commands for diagnosis/planning/orchestration (Claude reasons using MCP tools), script-backed commands for crawl/monitoring (deterministic Node.js). All commands share domain normalization, atomic write safety, and NDJSON history via extended `lib/safe.js`. Commands live in `commands/` with thin `skills/` wrappers for Claude Code plugin discovery.

**Tech Stack:** Node.js (no npm dependencies), Claude Code plugin SKILL.md format, JSON Schema Draft 2020-12, Screaming Frog MCP, DataForSEO MCP, Sistrix API.

**Spec:** `docs/specs/2026-05-27-recovery-workflow-design.md`

---

## Plugin Discovery Note

Claude Code discovers skills via `skills/<name>/SKILL.md` files scanned recursively under the plugin directory. The spec's `commands/` directory contains the detailed command specifications. Each command gets a thin `skills/<name>/SKILL.md` wrapper with the YAML frontmatter for discovery + a single instruction to read and follow the corresponding `commands/*.md` file. This keeps the spec's directory structure intact while maintaining plugin compatibility.

---

### Task 1: Extend `lib/safe.js` — Domain Normalization

**Files:**
- Modify: `plugins/seo-rescue/lib/safe.js`

- [ ] **Step 1: Write the `normalizeDomain` function**

Add to `plugins/seo-rescue/lib/safe.js` before `module.exports`:

```js
function normalizeDomain(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('normalizeDomain: input must be a non-empty string');
  }
  const raw = input.trim();
  let hostname;
  if (/^https?:\/\//i.test(raw)) {
    let u;
    try { u = new URL(raw); } catch {
      throw new Error(`normalizeDomain: failed to parse URL: ${JSON.stringify(raw)}`);
    }
    hostname = u.hostname;
  } else {
    hostname = raw.split('/')[0].split('?')[0].split('#')[0];
  }
  hostname = hostname.toLowerCase().replace(/\.$/, '');
  if (!HOSTNAME_RE.test(hostname)) {
    throw new Error(`normalizeDomain: invalid hostname: ${JSON.stringify(hostname)}`);
  }
  const slug = hostname.replace(/\./g, '-');
  safeSlug(slug);
  return {
    input_domain: raw,
    domain: hostname,
    canonical_domain: null,
    slug,
  };
}
```

- [ ] **Step 2: Add `normalizeDomain` to module.exports**

Add `normalizeDomain` to the existing `module.exports` object in `lib/safe.js`:

```js
module.exports = {
  safeSlug,
  safeHostname,
  safeUrl,
  safeLabel,
  validateConfigTargets,
  safeReadFile,
  mkRunDir,
  writeFileExclusive,
  getCacheDir,
  cachePath,
  normalizeDomain,
};
```

- [ ] **Step 3: Verify `normalizeDomain` manually**

Run:
```bash
cd /Users/max/Projekte/seo-survival-kit
node -e "
const { normalizeDomain } = require('./plugins/seo-rescue/lib/safe.js');
const cases = [
  'example.com',
  'https://example.com',
  'https://example.com/pfad?q=1#f',
  'www.example.com',
  'https://www.example.com/pfad?q=1#f',
  'http://www.example.com/',
];
for (const c of cases) {
  const r = normalizeDomain(c);
  console.log(JSON.stringify(r));
}
"
```

Expected output:
```
{"input_domain":"example.com","domain":"example.com","canonical_domain":null,"slug":"example-com"}
{"input_domain":"https://example.com","domain":"example.com","canonical_domain":null,"slug":"example-com"}
{"input_domain":"https://example.com/pfad?q=1#f","domain":"example.com","canonical_domain":null,"slug":"example-com"}
{"input_domain":"www.example.com","domain":"www.example.com","canonical_domain":null,"slug":"www-example-com"}
{"input_domain":"https://www.example.com/pfad?q=1#f","domain":"www.example.com","canonical_domain":null,"slug":"www-example-com"}
{"input_domain":"http://www.example.com/","domain":"www.example.com","canonical_domain":null,"slug":"www-example-com"}
```

- [ ] **Step 4: Verify error cases**

Run:
```bash
cd /Users/max/Projekte/seo-survival-kit
node -e "
const { normalizeDomain } = require('./plugins/seo-rescue/lib/safe.js');
const bad = ['', '   ', 'ftp://example.com', '127.0.0.1'];
for (const c of bad) {
  try { normalizeDomain(c); console.log('FAIL: should have thrown for', c); }
  catch (e) { console.log('OK:', e.message); }
}
"
```

Expected: All four should print `OK:` with error messages.

- [ ] **Step 5: Commit**

```bash
git add plugins/seo-rescue/lib/safe.js
git commit -m "feat(lib): add normalizeDomain for recovery commands"
```

---

### Task 2: Extend `lib/safe.js` — Write Safety Primitives

**Files:**
- Modify: `plugins/seo-rescue/lib/safe.js`

- [ ] **Step 1: Add `ensureDomainDir` function**

Add to `lib/safe.js` after `getCacheDir`:

```js
function ensureDomainDir(slug) {
  safeSlug(slug);
  const dir = path.join(getCacheDir(), slug);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch {}
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink()) {
    throw new Error(`Domain cache dir must not be a symlink: ${dir}`);
  }
  return dir;
}
```

- [ ] **Step 2: Add `acquireLock` and `releaseLock` functions**

Add to `lib/safe.js`:

```js
function acquireLock(domainDir, timeoutMs = 30000) {
  const lockPath = path.join(domainDir, '.lock');
  const fd = fs.openSync(lockPath, fs.constants.O_WRONLY | fs.constants.O_CREAT, 0o600);
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      fs.flock(fd, 'ex');
      return fd;
    } catch (e) {
      if (e.code === 'EAGAIN' || e.code === 'EWOULDBLOCK') {
        if (Date.now() >= deadline) {
          fs.closeSync(fd);
          throw new Error(`acquireLock: timeout after ${timeoutMs}ms — another command may be running for this domain`);
        }
        const { execSync } = require('node:child_process');
        execSync('sleep 0.1');
        continue;
      }
      fs.closeSync(fd);
      throw e;
    }
  }
}

function releaseLock(fd) {
  try { fs.closeSync(fd); } catch {}
}
```

**Note:** Node.js does not have a built-in `fs.flock`. The lock implementation uses `fs.flockSync` from `node:fs` if available (Node 22+), otherwise falls back to a `.lock` file existence check with `O_EXCL` semantics:

```js
function acquireLock(domainDir, timeoutMs = 30000) {
  const lockPath = path.join(domainDir, '.lock');
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      fs.writeFileSync(fd, String(process.pid));
      fs.closeSync(fd);
      return lockPath;
    } catch (e) {
      if (e.code === 'EEXIST') {
        if (Date.now() >= deadline) {
          throw new Error(`acquireLock: timeout after ${timeoutMs}ms — another command may be running for this domain. Lock: ${lockPath}`);
        }
        const wait = require('node:timers/promises');
        // Synchronous wait — these scripts are single-threaded batch operations
        require('node:child_process').execSync('sleep 0.1', { stdio: 'ignore' });
        continue;
      }
      throw e;
    }
  }
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch {}
}
```

- [ ] **Step 3: Add `atomicWriteJSON` function**

Add to `lib/safe.js`:

```js
function atomicWriteJSON(filePath, data) {
  const st = safeLstat(filePath);
  if (st && st.isSymbolicLink()) {
    throw new Error(`atomicWriteJSON: target is a symlink: ${filePath}`);
  }
  const tmpPath = filePath + '.tmp';
  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(tmpPath, json, { mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

function safeLstat(p) {
  try { return fs.lstatSync(p); } catch { return null; }
}
```

- [ ] **Step 4: Add `appendNDJSON` function**

Add to `lib/safe.js`:

```js
function appendNDJSON(filePath, entry) {
  const st = safeLstat(filePath);
  if (st && st.isSymbolicLink()) {
    throw new Error(`appendNDJSON: target is a symlink: ${filePath}`);
  }
  const line = JSON.stringify(entry) + '\n';
  const fd = fs.openSync(filePath, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(fd, line); } finally { fs.closeSync(fd); }
}
```

- [ ] **Step 5: Update module.exports**

```js
module.exports = {
  safeSlug,
  safeHostname,
  safeUrl,
  safeLabel,
  validateConfigTargets,
  safeReadFile,
  mkRunDir,
  writeFileExclusive,
  getCacheDir,
  cachePath,
  normalizeDomain,
  ensureDomainDir,
  acquireLock,
  releaseLock,
  atomicWriteJSON,
  appendNDJSON,
};
```

- [ ] **Step 6: Verify atomicWriteJSON manually**

Run:
```bash
cd /Users/max/Projekte/seo-survival-kit
node -e "
const { atomicWriteJSON, ensureDomainDir } = require('./plugins/seo-rescue/lib/safe.js');
const dir = ensureDomainDir('test-domain');
const fp = require('path').join(dir, 'test.json');
atomicWriteJSON(fp, { hello: 'world' });
console.log(require('fs').readFileSync(fp, 'utf8'));
require('fs').rmSync(dir, { recursive: true });
console.log('OK');
"
```

Expected: prints `{ "hello": "world" }` then `OK`.

- [ ] **Step 7: Verify appendNDJSON manually**

Run:
```bash
cd /Users/max/Projekte/seo-survival-kit
node -e "
const { appendNDJSON, ensureDomainDir } = require('./plugins/seo-rescue/lib/safe.js');
const dir = ensureDomainDir('test-domain');
const fp = require('path').join(dir, 'test.ndjson');
appendNDJSON(fp, { a: 1 });
appendNDJSON(fp, { b: 2 });
const lines = require('fs').readFileSync(fp, 'utf8').trim().split('\n');
console.log(lines.length === 2 ? 'OK: 2 lines' : 'FAIL');
console.log(lines.map(l => JSON.parse(l)));
require('fs').rmSync(dir, { recursive: true });
"
```

Expected: `OK: 2 lines` then array with both entries.

- [ ] **Step 8: Commit**

```bash
git add plugins/seo-rescue/lib/safe.js
git commit -m "feat(lib): add write safety primitives (atomicWriteJSON, appendNDJSON, locks)"
```

---

### Task 3: Create JSON Schemas

**Files:**
- Create: `plugins/seo-rescue/schemas/befund.schema.json`
- Create: `plugins/seo-rescue/schemas/issues.schema.json`
- Create: `plugins/seo-rescue/schemas/action-plan.schema.json`
- Create: `plugins/seo-rescue/schemas/history.schema.json`

- [ ] **Step 1: Create `schemas/befund.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "befund.schema.json",
  "title": "Recovery Diagnose Befund",
  "type": "object",
  "required": ["status", "input_domain", "domain", "canonical_domain", "slug", "timestamp", "warnings", "errors"],
  "properties": {
    "status": { "type": "string", "enum": ["complete", "partial", "failed"] },
    "input_domain": { "type": "string" },
    "domain": { "type": "string" },
    "canonical_domain": { "type": ["string", "null"] },
    "slug": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_-]{0,63}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "warnings": { "type": "array", "items": { "type": "string" } },
    "errors": { "type": "array", "items": { "type": "string" } },
    "vi_current": { "type": ["number", "null"] },
    "vi_peak": { "type": ["number", "null"] },
    "vi_drop_pct": { "type": ["number", "null"] },
    "vi_trend_4w_pct": { "type": ["number", "null"] },
    "vi_trend_12w_pct": { "type": ["number", "null"] },
    "core_update_correlation": { "type": "string", "enum": ["high", "medium", "low", "none"] },
    "core_update_name": { "type": ["string", "null"] },
    "keywords_total": { "type": ["integer", "null"] },
    "position_distribution": {
      "type": ["object", "null"],
      "properties": {
        "t3": { "type": "integer" },
        "t10": { "type": "integer" },
        "t20": { "type": "integer" },
        "t50": { "type": "integer" },
        "t100": { "type": "integer" }
      }
    },
    "quick_wins": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["keyword", "position", "volume"],
        "properties": {
          "keyword": { "type": "string" },
          "position": { "type": "integer" },
          "volume": { "type": "integer" },
          "intent": { "type": "string" }
        }
      }
    },
    "top_losers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["keyword", "position_before", "position_after", "volume"],
        "properties": {
          "keyword": { "type": "string" },
          "position_before": { "type": "integer" },
          "position_after": { "type": "integer" },
          "volume": { "type": "integer" }
        }
      }
    },
    "backlink_profile": {
      "type": ["object", "null"],
      "properties": {
        "referring_domains": { "type": "integer" },
        "total_backlinks": { "type": "integer" },
        "dofollow_pct": { "type": "number" },
        "nofollow_pct": { "type": "number" },
        "spam_score": { "type": "number" },
        "broken_backlinks": { "type": "integer" }
      }
    },
    "diagnosis": { "type": "string", "enum": ["core-update", "technical", "content", "mixed", "healthy"] },
    "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
    "recovery_stage_estimate": { "type": ["string", "null"], "enum": ["R1", "R2", "R3", "R4", "R5", null] },
    "summary_de": { "type": "string" }
  }
}
```

- [ ] **Step 2: Create `schemas/issues.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "issues.schema.json",
  "title": "Recovery Crawl Issues",
  "type": "object",
  "required": ["status", "input_domain", "domain", "canonical_domain", "slug", "timestamp", "warnings", "errors", "crawled_urls", "issues", "summary"],
  "properties": {
    "status": { "type": "string", "enum": ["complete", "partial", "failed"] },
    "input_domain": { "type": "string" },
    "domain": { "type": "string" },
    "canonical_domain": { "type": ["string", "null"] },
    "slug": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_-]{0,63}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "warnings": { "type": "array", "items": { "type": "string" } },
    "errors": { "type": "array", "items": { "type": "string" } },
    "crawled_urls": { "type": "integer", "minimum": 0 },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "severity", "count"],
        "properties": {
          "type": {
            "type": "string",
            "enum": ["broken_internal_link", "redirect_chain", "non_indexable_canonical", "missing_h1", "duplicate_h1", "missing_meta_description", "orphan_page"]
          },
          "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "count": { "type": "integer", "minimum": 0 },
          "affected_urls": { "type": ["integer", "array"] },
          "details": { "type": "array" }
        }
      }
    },
    "summary": {
      "type": "object",
      "required": ["critical", "high", "medium", "low", "total_issues"],
      "properties": {
        "critical": { "type": "integer" },
        "high": { "type": "integer" },
        "medium": { "type": "integer" },
        "low": { "type": "integer" },
        "total_issues": { "type": "integer" }
      }
    }
  }
}
```

- [ ] **Step 3: Create `schemas/action-plan.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "action-plan.schema.json",
  "title": "Recovery Action Plan",
  "type": "object",
  "required": ["status", "input_domain", "domain", "canonical_domain", "slug", "timestamp", "warnings", "errors", "current_phase", "actions"],
  "properties": {
    "status": { "type": "string", "enum": ["complete", "partial", "failed"] },
    "input_domain": { "type": "string" },
    "domain": { "type": "string" },
    "canonical_domain": { "type": ["string", "null"] },
    "slug": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_-]{0,63}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "warnings": { "type": "array", "items": { "type": "string" } },
    "errors": { "type": "array", "items": { "type": "string" } },
    "current_phase": { "type": "string", "enum": ["R1", "R2", "R3", "R4", "R5"] },
    "next_phase_criteria": { "type": "string" },
    "do_not_touch": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["keyword", "position", "reason"],
        "properties": {
          "keyword": { "type": "string" },
          "position": { "type": "integer" },
          "reason": { "type": "string" }
        }
      }
    },
    "actions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["priority", "timeline", "action", "type", "risk", "impact", "effort"],
        "properties": {
          "priority": { "type": "integer", "minimum": 1 },
          "timeline": { "type": "string" },
          "action": { "type": "string" },
          "type": { "type": "string" },
          "risk": { "type": "string", "enum": ["green", "yellow", "red", "black"] },
          "impact": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "effort": { "type": "string", "enum": ["low", "medium", "high"] },
          "affected_urls": { "type": "integer" },
          "inlinks_recovered": { "type": "integer" },
          "source_issue": { "type": "string" },
          "batch_limit": { "type": "string" }
        }
      }
    },
    "expected_impact": {
      "type": "object",
      "properties": {
        "vi_recovery_pct": { "type": "string" },
        "timeline_weeks": { "type": "string" },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    }
  }
}
```

- [ ] **Step 4: Create `schemas/history.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "history.schema.json",
  "title": "Recovery Monitor History Entry",
  "description": "One line in history.ndjson. Each line is an independent JSON object.",
  "type": "object",
  "required": ["status", "input_domain", "domain", "canonical_domain", "slug", "timestamp", "warnings", "errors", "score", "phase"],
  "properties": {
    "status": { "type": "string", "enum": ["complete", "partial", "failed"] },
    "input_domain": { "type": "string" },
    "domain": { "type": "string" },
    "canonical_domain": { "type": ["string", "null"] },
    "slug": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_-]{0,63}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "warnings": { "type": "array", "items": { "type": "string" } },
    "errors": { "type": "array", "items": { "type": "string" } },
    "vi": { "type": ["number", "null"] },
    "vi_delta_pct": { "type": ["number", "null"] },
    "score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "phase": { "type": "string", "enum": ["R1", "R2", "R3", "R4", "R5"] },
    "keywords_t10": { "type": ["integer", "null"] },
    "keywords_t10_delta": { "type": ["integer", "null"] },
    "top_losers_recovered": { "type": ["integer", "null"] },
    "issues_open": { "type": ["integer", "null"] },
    "issues_fixed": { "type": ["integer", "null"] }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add plugins/seo-rescue/schemas/
git commit -m "feat(schemas): add JSON schemas for recovery command outputs"
```

---

### Task 4: Create Reference Documents

**Files:**
- Create: `plugins/seo-rescue/references/CORE_UPDATES.md`
- Create: `plugins/seo-rescue/references/RECOVERY_SYSTEM.md` (copy from repo root)
- Create: `plugins/seo-rescue/references/DECISION_ENGINE.md` (copy from repo root)

- [ ] **Step 1: Create `references/CORE_UPDATES.md`**

```markdown
# Known Google Core Updates

Reference data for Core Update correlation checks in `recovery-diagnose`.

| Update | Rollout-Start | Rollout-Ende |
|--------|--------------|-------------|
| March 2026 Core Update | 2026-03-27 | 2026-04-08 |
| November 2025 Core Update | 2025-11-11 | 2025-11-28 |
| August 2025 Core Update | 2025-08-15 | 2025-08-30 |
| March 2025 Core Update | 2025-03-13 | 2025-03-27 |

## Correlation Logic

- VI-Drop within 4 weeks after rollout start → `high`
- VI-Drop 4–8 weeks after rollout start → `medium`
- VI-Drop >8 weeks after or before rollout → `low`
- No temporal relationship → `none`

## Maintenance

Add new Core Updates as Google announces them. Check the Google Search Status Dashboard:
https://status.search.google.com/products/rGHU1u7kqx6rbY6IYDM6/
```

- [ ] **Step 2: Copy reference docs**

```bash
cd /Users/max/Projekte/seo-survival-kit
mkdir -p plugins/seo-rescue/references
cp RECOVERY_SYSTEM.md plugins/seo-rescue/references/RECOVERY_SYSTEM.md
cp DECISION_ENGINE.md plugins/seo-rescue/references/DECISION_ENGINE.md
```

- [ ] **Step 3: Commit**

```bash
git add plugins/seo-rescue/references/
git commit -m "feat(references): add CORE_UPDATES.md and copy RECOVERY_SYSTEM + DECISION_ENGINE"
```

---

### Task 5: Command `recovery-diagnose`

**Files:**
- Create: `plugins/seo-rescue/commands/recovery-diagnose.md`
- Create: `plugins/seo-rescue/skills/recovery-diagnose/SKILL.md`

- [ ] **Step 1: Create `commands/recovery-diagnose.md`**

Write the full command specification. This file contains the detailed instructions Claude follows when the command is invoked. Content must include:
- Domain normalization steps using `normalizeDomain()` from `lib/safe.js`
- Sistrix API calls (VI current, overview, 6-month history via 18-call loop)
- DataForSEO MCP calls (ranked_keywords/live with location 2276, backlinks/summary/live, domain_rank_overview/live)
- Core Update correlation check against `references/CORE_UPDATES.md`
- Output assembly per `schemas/befund.schema.json`
- Atomic write via `atomicWriteJSON()` to `~/.cache/seo-rescue/{slug}/befund.json`
- Lock acquire/release around writes
- Error handling table from spec (Sistrix unavailable → partial, DataForSEO unavailable → failed, etc.)
- Validation rules (vi_drop_pct negative when vi_current < vi_peak, position_distribution monotonic, etc.)

The command file must be a standalone Markdown document that Claude can read and follow step-by-step. It should reference `references/RECOVERY_SYSTEM.md` for diagnosis thresholds and `references/CORE_UPDATES.md` for update dates.

Full content — write the complete `commands/recovery-diagnose.md` from the spec's Command 1 section. Include all fields from the befund.json output schema example. Include the severity classification logic: VI-Drop >20% = high, >40% = critical. Include the diagnosis classification: look at VI timing (core-update), crawl errors (technical), thin content signals (content), combination (mixed), none (healthy).

- [ ] **Step 2: Create `skills/recovery-diagnose/SKILL.md` wrapper**

```yaml
---
name: recovery-diagnose
description: 'Automatic domain diagnosis for Core Update recovery. Calls Sistrix + DataForSEO MCP, quantifies VI drop, identifies keyword losses, scans backlink profile, correlates with known Core Update dates. Outputs structured befund.json to cache. Use when starting recovery analysis for a domain.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.0'
  category: marketing
---

# Recovery Diagnose

Read and follow the full command specification:

1. Read `../../commands/recovery-diagnose.md` for the complete workflow.
2. Read `../../references/CORE_UPDATES.md` for Core Update dates.
3. Read `../../references/RECOVERY_SYSTEM.md` for diagnosis thresholds and recovery stage estimation.
4. Validate output against `../../schemas/befund.schema.json`.
```

- [ ] **Step 3: Commit**

```bash
git add plugins/seo-rescue/commands/recovery-diagnose.md plugins/seo-rescue/skills/recovery-diagnose/
git commit -m "feat(commands): add recovery-diagnose command + skill wrapper"
```

---

### Task 6: Script `recovery-crawl.js`

**Files:**
- Create: `plugins/seo-rescue/scripts/recovery-crawl.js`

- [ ] **Step 1: Write `scripts/recovery-crawl.js`**

This script is invoked by the `recovery-crawl` command's SKILL.md. It orchestrates the Screaming Frog MCP crawl, extracts bulk exports, classifies issues, and writes `issues.json`.

The script does NOT call MCP tools directly (those are Claude-side). Instead, it provides helper functions that the SKILL.md instructs Claude to use between MCP calls:

```js
'use strict';
const path = require('node:path');
const {
  normalizeDomain,
  ensureDomainDir,
  acquireLock,
  releaseLock,
  atomicWriteJSON,
} = require('../lib/safe.js');

const SEVERITY_MAP = {
  broken_internal_link: { default: 'high', upgrade: (d) => d.inlink_count > 100 ? 'critical' : null },
  redirect_chain: { default: 'medium', upgrade: (d) => d.original_topic_lost ? 'high' : null },
  non_indexable_canonical: { default: 'high', upgrade: () => null },
  missing_h1: { default: 'medium', upgrade: () => null },
  duplicate_h1: { default: 'low', upgrade: (d, count) => count > 10 ? 'medium' : null },
  missing_meta_description: { default: 'low', upgrade: () => null },
  orphan_page: { default: 'medium', upgrade: () => null },
};

function classifyIssues(rawIssues) {
  return rawIssues.map(issue => {
    const mapping = SEVERITY_MAP[issue.type];
    if (!mapping) return { ...issue, severity: 'medium' };
    let severity = mapping.default;
    if (issue.details && issue.details.length > 0) {
      for (const d of issue.details) {
        const upgraded = mapping.upgrade(d, issue.count);
        if (upgraded) { severity = upgraded; break; }
      }
    }
    return { ...issue, severity };
  });
}

function buildSummary(issues) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, total_issues: 0 };
  for (const i of issues) {
    summary[i.severity] = (summary[i.severity] || 0) + 1;
    summary.total_issues++;
  }
  return summary;
}

function writeIssuesJSON(domain, slug, inputDomain, crawledUrls, rawIssues, warnings, errors) {
  const dir = ensureDomainDir(slug);
  const lockPath = acquireLock(dir);
  try {
    const issues = classifyIssues(rawIssues);
    const summary = buildSummary(issues);
    const status = errors.length > 0 ? 'failed' : warnings.length > 0 ? 'partial' : 'complete';
    const output = {
      status,
      input_domain: inputDomain,
      domain,
      canonical_domain: null,
      slug,
      timestamp: new Date().toISOString(),
      warnings,
      errors,
      crawled_urls: crawledUrls,
      issues,
      summary,
    };
    atomicWriteJSON(path.join(dir, 'issues.json'), output);
    return output;
  } finally {
    releaseLock(lockPath);
  }
}

module.exports = { classifyIssues, buildSummary, writeIssuesJSON, SEVERITY_MAP };
```

- [ ] **Step 2: Verify classifyIssues**

Run:
```bash
cd /Users/max/Projekte/seo-survival-kit
node -e "
const { classifyIssues } = require('./plugins/seo-rescue/scripts/recovery-crawl.js');
const issues = [
  { type: 'broken_internal_link', count: 438, details: [{ inlink_count: 106 }] },
  { type: 'redirect_chain', count: 8, details: [{ original_topic_lost: true }] },
  { type: 'missing_h1', count: 18, details: [] },
  { type: 'duplicate_h1', count: 15, details: [] },
];
const classified = classifyIssues(issues);
console.log(classified.map(i => i.type + ': ' + i.severity));
"
```

Expected:
```
[ 'broken_internal_link: critical', 'redirect_chain: high', 'missing_h1: medium', 'duplicate_h1: medium' ]
```

- [ ] **Step 3: Commit**

```bash
git add plugins/seo-rescue/scripts/recovery-crawl.js
git commit -m "feat(scripts): add recovery-crawl.js with issue classification"
```

---

### Task 7: Command `recovery-crawl`

**Files:**
- Create: `plugins/seo-rescue/commands/recovery-crawl.md`
- Create: `plugins/seo-rescue/skills/recovery-crawl/SKILL.md`

- [ ] **Step 1: Create `commands/recovery-crawl.md`**

Write the full command specification from the spec's Command 2 section. Must include:
- Domain normalization
- Screaming Frog MCP tool calls: `sf_crawl` (max 500 URLs), `sf_crawl_progress` polling, 7 bulk exports
- Issue classification (reference `scripts/recovery-crawl.js` for `classifyIssues` and `writeIssuesJSON`)
- Instruction for Claude to call `node scripts/recovery-crawl.js` to write the final output after collecting MCP data
- Error handling table
- Validation rules

- [ ] **Step 2: Create `skills/recovery-crawl/SKILL.md` wrapper**

```yaml
---
name: recovery-crawl
description: 'Screaming Frog MCP crawl + issue classification. Crawls up to 500 URLs, extracts broken links, redirect chains, missing H1s, canonical errors, and missing meta descriptions. Classifies issues by severity with upgrade rules. Outputs structured issues.json to cache.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.0'
  category: marketing
---

# Recovery Crawl

Read and follow the full command specification:

1. Read `../../commands/recovery-crawl.md` for the complete workflow.
2. Use Screaming Frog MCP tools (`sf_crawl`, `sf_crawl_progress`, `sf_generate_bulk_export`, `sf_export_crawl`) as specified.
3. After collecting data, call `node ../../scripts/recovery-crawl.js` helper functions to classify issues and write output.
4. Validate output against `../../schemas/issues.schema.json`.
```

- [ ] **Step 3: Commit**

```bash
git add plugins/seo-rescue/commands/recovery-crawl.md plugins/seo-rescue/skills/recovery-crawl/
git commit -m "feat(commands): add recovery-crawl command + skill wrapper"
```

---

### Task 8: Command `recovery-plan`

**Files:**
- Create: `plugins/seo-rescue/commands/recovery-plan.md`
- Create: `plugins/seo-rescue/skills/recovery-plan/SKILL.md`

- [ ] **Step 1: Create `commands/recovery-plan.md`**

Write the full command specification from the spec's Command 3 section. Must include:
- Domain normalization
- Load `befund.json` and `issues.json` from cache
- Input validation (both files must exist, befund must not be `status: failed`)
- Recovery phase determination (R1–R5) referencing `references/RECOVERY_SYSTEM.md`
- Do-Not-Touch list construction from stable Top-10 keywords
- Prioritization logic: Protect Winners → Stop Bleeding → Quick Wins → Authority Building → Expansion
- Impact x Effort x Risk matrix referencing `references/DECISION_ENGINE.md`
- 30/60/90 day plan generation
- Risk assessment per action (green/yellow/red/black)
- Batch-change limit enforcement (3-5 URLs/day when risk != green)
- Atomic write of `action-plan.json`
- Error handling and validation rules

- [ ] **Step 2: Create `skills/recovery-plan/SKILL.md` wrapper**

```yaml
---
name: recovery-plan
description: 'Generates a prioritized recovery action plan from diagnosis + crawl data. Determines recovery phase (R1-R5), builds Do-Not-Touch list for stable keywords, prioritizes actions by Impact x Effort x Risk, enforces batch-change limits. Requires recovery-diagnose to have run first.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.0'
  category: marketing
---

# Recovery Plan

Read and follow the full command specification:

1. Read `../../commands/recovery-plan.md` for the complete workflow.
2. Read `../../references/RECOVERY_SYSTEM.md` for phase determination and risk matrix.
3. Read `../../references/DECISION_ENGINE.md` for prioritization rules.
4. Validate output against `../../schemas/action-plan.schema.json`.
```

- [ ] **Step 3: Commit**

```bash
git add plugins/seo-rescue/commands/recovery-plan.md plugins/seo-rescue/skills/recovery-plan/
git commit -m "feat(commands): add recovery-plan command + skill wrapper"
```

---

### Task 9: Script `recovery-monitor.js`

**Files:**
- Create: `plugins/seo-rescue/scripts/recovery-monitor.js`

- [ ] **Step 1: Write `scripts/recovery-monitor.js`**

```js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeDomain,
  ensureDomainDir,
  acquireLock,
  releaseLock,
  appendNDJSON,
  safeReadFile,
} = require('../lib/safe.js');

const SCORE_WEIGHTS = {
  vi_trend: 0.30,
  keyword_stability: 0.25,
  quick_win_progress: 0.20,
  issue_reduction: 0.15,
  backlink_quality: 0.10,
};

function computeRecoveryScore(current, baseline, lastEntry) {
  let score = 50;
  const components = {};

  if (current.vi != null && baseline && baseline.vi_current != null) {
    const viRatio = current.vi / baseline.vi_current;
    const viScore = Math.min(100, Math.max(0, viRatio * 100));
    components.vi_trend = viScore;
    score += (viScore - 50) * SCORE_WEIGHTS.vi_trend;
  }

  if (current.keywords_t10 != null && lastEntry && lastEntry.keywords_t10 != null) {
    const delta = current.keywords_t10 - lastEntry.keywords_t10;
    const stabilityScore = Math.min(100, Math.max(0, 50 + delta * 5));
    components.keyword_stability = stabilityScore;
    score += (stabilityScore - 50) * SCORE_WEIGHTS.keyword_stability;
  }

  score = Math.round(Math.min(100, Math.max(0, score)));
  return { score, components };
}

function getLastEntry(historyPath) {
  try {
    const content = safeReadFile(historyPath);
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

function getBaseline(domainDir) {
  const befundPath = path.join(domainDir, 'befund.json');
  try {
    return JSON.parse(safeReadFile(befundPath));
  } catch {
    return null;
  }
}

function determinePhase(score, baseline) {
  if (!baseline) return 'R2';
  if (score < 20) return 'R1';
  if (score < 40) return 'R2';
  if (score < 60) return 'R3';
  if (score < 80) return 'R4';
  return 'R5';
}

function writeMonitorEntry(inputDomain, domain, slug, vi, keywordsT10, warnings, errors) {
  const dir = ensureDomainDir(slug);
  const historyPath = path.join(dir, 'history.ndjson');
  const lockPath = acquireLock(dir);
  try {
    const lastEntry = getLastEntry(historyPath);
    const baseline = getBaseline(dir);
    const current = { vi, keywords_t10: keywordsT10 };
    const { score } = computeRecoveryScore(current, baseline, lastEntry);
    const phase = determinePhase(score, baseline);
    const status = errors.length > 0 ? 'failed' : warnings.length > 0 ? 'partial' : 'complete';

    const entry = {
      status,
      input_domain: inputDomain,
      domain,
      canonical_domain: null,
      slug,
      timestamp: new Date().toISOString(),
      warnings,
      errors,
      vi,
      vi_delta_pct: lastEntry && lastEntry.vi ? Math.round(((vi - lastEntry.vi) / lastEntry.vi) * 1000) / 10 : null,
      score,
      phase,
      keywords_t10: keywordsT10,
      keywords_t10_delta: lastEntry && lastEntry.keywords_t10 != null ? keywordsT10 - lastEntry.keywords_t10 : null,
      top_losers_recovered: null,
      issues_open: null,
      issues_fixed: null,
    };

    appendNDJSON(historyPath, entry);
    return { entry, lastEntry };
  } finally {
    releaseLock(lockPath);
  }
}

function formatDeltaReport(entry, lastEntry) {
  const lines = [];
  lines.push(`Recovery Monitor — ${entry.domain} — ${entry.timestamp.split('T')[0]}`);
  lines.push('--------------------------------------------');
  const viStr = entry.vi != null ? entry.vi.toFixed(4) : 'n/a';
  const viDelta = entry.vi_delta_pct != null ? ` (${entry.vi_delta_pct > 0 ? '+' : ''}${entry.vi_delta_pct}%)` : '';
  lines.push(`VI:          ${viStr}${viDelta}`);
  const scoreFrom = lastEntry ? ` (von ${lastEntry.score})` : '';
  lines.push(`Score:       ${entry.score}/100${scoreFrom}`);
  lines.push(`Phase:       ${entry.phase}`);
  const kwStr = entry.keywords_t10 != null ? String(entry.keywords_t10) : 'n/a';
  const kwDelta = entry.keywords_t10_delta != null ? ` (${entry.keywords_t10_delta > 0 ? '+' : ''}${entry.keywords_t10_delta})` : '';
  lines.push(`Top-10:      ${kwStr} Keywords${kwDelta}`);
  lines.push('--------------------------------------------');
  return lines.join('\n');
}

module.exports = {
  computeRecoveryScore,
  getLastEntry,
  getBaseline,
  determinePhase,
  writeMonitorEntry,
  formatDeltaReport,
  SCORE_WEIGHTS,
};
```

- [ ] **Step 2: Verify computeRecoveryScore**

Run:
```bash
cd /Users/max/Projekte/seo-survival-kit
node -e "
const { computeRecoveryScore } = require('./plugins/seo-rescue/scripts/recovery-monitor.js');
const current = { vi: 0.108, keywords_t10: 120 };
const baseline = { vi_current: 0.155 };
const lastEntry = { keywords_t10: 115 };
const { score } = computeRecoveryScore(current, baseline, lastEntry);
console.log('Score:', score, '(expected: 40-70 range)');
console.log(score >= 0 && score <= 100 ? 'OK: in range' : 'FAIL: out of range');
"
```

Expected: a score in the 40-70 range, `OK: in range`.

- [ ] **Step 3: Verify formatDeltaReport**

Run:
```bash
cd /Users/max/Projekte/seo-survival-kit
node -e "
const { formatDeltaReport } = require('./plugins/seo-rescue/scripts/recovery-monitor.js');
const entry = { domain: 'example.com', timestamp: '2026-05-27T21:00:00Z', vi: 0.108, vi_delta_pct: 2.3, score: 62, phase: 'R2', keywords_t10: 120, keywords_t10_delta: 5 };
const last = { score: 55 };
console.log(formatDeltaReport(entry, last));
"
```

Expected: formatted delta report with all fields.

- [ ] **Step 4: Commit**

```bash
git add plugins/seo-rescue/scripts/recovery-monitor.js
git commit -m "feat(scripts): add recovery-monitor.js with score computation and delta report"
```

---

### Task 10: Command `recovery-monitor`

**Files:**
- Create: `plugins/seo-rescue/commands/recovery-monitor.md`
- Create: `plugins/seo-rescue/skills/recovery-monitor/SKILL.md`

- [ ] **Step 1: Create `commands/recovery-monitor.md`**

Write the full command specification from the spec's Command 4 section. Must include:
- Domain normalization
- Sistrix VI call
- DataForSEO ranked_keywords call (MCP preferred, fetch fallback)
- Call `node scripts/recovery-monitor.js` helper to compute score, append NDJSON, format delta report
- Score weights table (VI 30%, Keyword Stability 25%, Quick Win 20%, Issue Reduction 15%, Backlink Quality 10%)
- Error handling table
- Validation rules

- [ ] **Step 2: Create `skills/recovery-monitor/SKILL.md` wrapper**

```yaml
---
name: recovery-monitor
description: 'Weekly recovery tracking. Fetches current VI + keyword positions, computes 0-100 recovery score, appends to NDJSON history, outputs delta report. Run weekly or on-demand to track recovery progress over time.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.0'
  category: marketing
---

# Recovery Monitor

Read and follow the full command specification:

1. Read `../../commands/recovery-monitor.md` for the complete workflow.
2. After collecting Sistrix + DataForSEO data, call `node ../../scripts/recovery-monitor.js` helper functions.
3. Validate each history entry against `../../schemas/history.schema.json`.
```

- [ ] **Step 3: Commit**

```bash
git add plugins/seo-rescue/commands/recovery-monitor.md plugins/seo-rescue/skills/recovery-monitor/
git commit -m "feat(commands): add recovery-monitor command + skill wrapper"
```

---

### Task 11: Command `recovery-full` (Orchestrator)

**Files:**
- Create: `plugins/seo-rescue/commands/recovery-full.md`
- Create: `plugins/seo-rescue/skills/recovery-full/SKILL.md`

- [ ] **Step 1: Create `commands/recovery-full.md`**

Write the full orchestrator command specification from the spec's Command 5 section. Must include:
- Domain normalization (done once, passed to all sub-commands)
- Sequential invocation of recovery-diagnose → recovery-crawl → recovery-plan → recovery-monitor
- Status checks after each step (diagnose failed = abort, others failed = warn + continue)
- Zwischenstatus output after each step
- Final summary with befund + top issues + top actions + recovery score
- Hint about weekly recovery-monitor

- [ ] **Step 2: Create `skills/recovery-full/SKILL.md` wrapper**

```yaml
---
name: recovery-full
description: 'Full recovery workflow orchestrator. Chains recovery-diagnose, recovery-crawl, recovery-plan, and recovery-monitor in sequence. One command for complete domain recovery analysis from diagnosis to monitoring setup. Gracefully degrades if individual steps fail.'
user-invokable: true
argument-hint: '<domain>'
allowed-tools: [Read, Write, Bash(node:*), Grep, Glob]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.0'
  category: marketing
---

# Recovery Full Workflow

Read and follow the full command specification:

1. Read `../../commands/recovery-full.md` for the orchestration workflow.
2. Invoke each sub-command in sequence by reading and following its command specification.
3. Check artifact status after each step before proceeding.
```

- [ ] **Step 3: Commit**

```bash
git add plugins/seo-rescue/commands/recovery-full.md plugins/seo-rescue/skills/recovery-full/
git commit -m "feat(commands): add recovery-full orchestrator command + skill wrapper"
```

---

### Task 12: Update Orchestrator, Plugin Manifest, and CLAUDE.md

**Files:**
- Modify: `plugins/seo-rescue/skills/rescue/SKILL.md`
- Modify: `plugins/seo-rescue/.claude-plugin/plugin.json`
- Modify: `CLAUDE.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: Add recovery commands to rescue orchestrator routing table**

In `plugins/seo-rescue/skills/rescue/SKILL.md`, add rows to the Quick Reference table:

```markdown
| `/seo-rescue:rescue recovery <domain>` | Full recovery workflow (alias for `/seo-rescue:recovery-full`) |
| `/seo-rescue:recovery-diagnose <domain>` | Core Update diagnosis via Sistrix + DataForSEO |
| `/seo-rescue:recovery-crawl <domain>` | Screaming Frog crawl + issue classification |
| `/seo-rescue:recovery-plan <domain>` | Prioritized recovery action plan |
| `/seo-rescue:recovery-monitor <domain>` | Weekly recovery tracking + score |
| `/seo-rescue:recovery-full <domain>` | Full workflow: diagnose → crawl → plan → monitor |
```

- [ ] **Step 2: Update plugin.json version and description**

Change version to `0.5.0` and add recovery commands to the description:

```json
{
  "$schema": "https://anthropic.com/claude-code/plugin.schema.json",
  "name": "seo-rescue",
  "version": "0.5.0",
  "description": "Fourteen SEO skills + orchestrator. Type /seo-rescue:rescue for the routing table. NEW in v0.5: Recovery Workflow Automation — /seo-rescue:recovery-full (full workflow), /seo-rescue:recovery-diagnose (Core Update diagnosis), /seo-rescue:recovery-crawl (Screaming Frog issue scan), /seo-rescue:recovery-plan (prioritized action plan), /seo-rescue:recovery-monitor (weekly tracking + score). Plus existing skills: seo-audit-free, post-core-update-recovery, seo-outreach-report, channel-economics-analyzer, competitor-deep-audit, psi-weekly-cron-baseline, ai-search-rescue, ai-citations-tracker, gsc-deep-dive.",
  "author": {
    "name": "Max Schottke",
    "url": "https://github.com/maxschottke-spec"
  },
  "license": "MIT",
  "homepage": "https://github.com/maxschottke-spec/seo-survival-kit"
}
```

- [ ] **Step 3: Update CLAUDE.md architecture section**

Add the new directories (`commands/`, `scripts/`, `references/`, `schemas/`) to the Architecture tree in `CLAUDE.md`. Add a section explaining the command/skill wrapper pattern.

- [ ] **Step 4: Add CHANGELOG entry**

Add a `## v0.5.0` section to `CHANGELOG.md` with the 5 new commands, lib extensions, schemas, and references.

- [ ] **Step 5: Update README Quick Reference table**

Add the 5 new commands to the README's Quick Reference.

- [ ] **Step 6: Validate plugin**

Run:
```bash
cd /Users/max/Projekte/seo-survival-kit
claude plugin validate plugins/seo-rescue
claude plugin validate .
```

Both must show `Validation passed`.

- [ ] **Step 7: Commit**

```bash
git add plugins/seo-rescue/skills/rescue/SKILL.md plugins/seo-rescue/.claude-plugin/plugin.json CLAUDE.md CHANGELOG.md README.md
git commit -m "feat(v0.5.0): update orchestrator, manifest, docs for recovery workflow commands"
```

---

## Implementation Order Summary

```
Task 1  → lib/safe.js: normalizeDomain
Task 2  → lib/safe.js: write safety (atomic, NDJSON, locks)
Task 3  → JSON schemas (4 files)
Task 4  → Reference docs (CORE_UPDATES.md + copies)
Task 5  → recovery-diagnose command + wrapper
Task 6  → recovery-crawl.js script
Task 7  → recovery-crawl command + wrapper
Task 8  → recovery-plan command + wrapper
Task 9  → recovery-monitor.js script
Task 10 → recovery-monitor command + wrapper
Task 11 → recovery-full orchestrator + wrapper
Task 12 → Orchestrator, plugin.json, CLAUDE.md, CHANGELOG, README, validate
```

Dependencies: Task 1 and 2 must complete before Tasks 5–11. Tasks 3 and 4 are independent and can run in parallel with 1–2. Tasks 5–11 can run sequentially in any order (each is self-contained), but the logical flow is diagnose → crawl → plan → monitor → full.
