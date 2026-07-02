#!/usr/bin/env node
// check-export-sync.js — CI guard against silent drift between the canonical
// SKILL.md files and their platform-agnostic copies in exports/skills/.
//
// The exports are INTENTIONAL transforms of the canonical files (frontmatter
// stripped, [[skill]] links unwrapped, dot-digraph replaced by an ASCII tree,
// claude-seo cross-references removed, platform footer appended, some wording
// adapted for non-Claude platforms). A byte-diff can therefore never be the
// gate. Instead this script:
//
//   1. normalizes both sides (strip frontmatter + fenced code blocks, unwrap
//      [[..]] and [..](..) links, collapse whitespace, drop the platform
//      footer and claude-seo cross-reference lines),
//   2. computes the multiset of normalized lines that exist on only one side
//      of each canonical↔export pair,
//   3. compares that divergence report against the committed baseline
//      (scripts/export-sync-baseline.txt).
//
// Any NEW divergence — e.g. a canonical SKILL.md edit that was not mirrored
// into exports/, or vice versa — changes the report and fails the check.
// Intentional new divergence is accepted explicitly via --update.
//
// Usage:
//   node scripts/check-export-sync.js            # check (CI mode), exit 1 on drift
//   node scripts/check-export-sync.js --print    # print the current divergence report
//   node scripts/check-export-sync.js --update   # rewrite the baseline
//
// Zero npm dependencies (repo policy).
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(__dirname, 'export-sync-baseline.txt');

const PAIRS = [
  ['plugins/seo-rescue/skills/post-core-update-recovery/SKILL.md', 'exports/skills/post-core-update-recovery.md'],
  ['plugins/seo-rescue/skills/ai-search-rescue/SKILL.md', 'exports/skills/ai-search-rescue.md'],
  ['plugins/seo-rescue/skills/rescue/SKILL.md', 'exports/skills/seo-rescue-overview.md'],
];

function normalize(text) {
  // Strip YAML frontmatter (canonical files only; exports have none).
  text = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  // Drop fenced code blocks entirely: the canonical routing digraph and the
  // export-side ASCII tree are intentional format-specific representations.
  text = text.replace(/```[\s\S]*?```/g, '');
  const lines = [];
  for (let raw of text.split('\n')) {
    let line = raw;
    // Unwrap [[skill-name]] cross-skill links (Claude-only syntax).
    line = line.replace(/\[\[([^\]]+)\]\]/g, '$1');
    // Unwrap markdown links: keep the text, drop the target (exports point
    // elsewhere or drop links by design).
    line = line.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1');
    // Typographic normalization: bold markers, slash spacing ("trust / authority"
    // vs "trust/authority"), comparator spacing ("< 20 %" vs "<20 %") are
    // intentional per-platform style differences, not content drift.
    line = line.replace(/\*\*/g, '');
    line = line.replace(/\s*\/\s*/g, '/');
    line = line.replace(/([<>])\s+(\d)/g, '$1$2');
    // Collapse whitespace.
    line = line.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    // Export-only platform footer.
    if (/where to apply this on each platform/i.test(line)) continue;
    // claude-seo cross-references are removed from exports by design.
    if (/claude-seo/i.test(line)) continue;
    lines.push(line);
  }
  return lines;
}

function multisetDiff(a, b) {
  // Returns lines of `a` not covered by `b` (multiset semantics), in order.
  const counts = new Map();
  for (const l of b) counts.set(l, (counts.get(l) || 0) + 1);
  const only = [];
  for (const l of a) {
    const c = counts.get(l) || 0;
    if (c > 0) counts.set(l, c - 1);
    else only.push(l);
  }
  return only;
}

function buildReport() {
  const out = [];
  for (const [canonical, exported] of PAIRS) {
    const canonicalPath = path.join(ROOT, canonical);
    const exportedPath = path.join(ROOT, exported);
    out.push(`## ${canonical} <-> ${exported}`);
    if (!fs.existsSync(canonicalPath) || !fs.existsSync(exportedPath)) {
      out.push(`MISSING FILE: ${!fs.existsSync(canonicalPath) ? canonical : exported}`);
      continue;
    }
    const a = normalize(fs.readFileSync(canonicalPath, 'utf8'));
    const b = normalize(fs.readFileSync(exportedPath, 'utf8'));
    const onlyCanonical = multisetDiff(a, b);
    const onlyExport = multisetDiff(b, a);
    out.push(`### only in canonical (${onlyCanonical.length})`);
    for (const l of onlyCanonical) out.push(`< ${l}`);
    out.push(`### only in export (${onlyExport.length})`);
    for (const l of onlyExport) out.push(`> ${l}`);
  }
  return out.join('\n') + '\n';
}

function main() {
  const mode = process.argv[2] || '--check';
  const report = buildReport();
  if (mode === '--print') {
    process.stdout.write(report);
    return;
  }
  if (mode === '--update') {
    fs.writeFileSync(BASELINE, report);
    console.log(`baseline written: ${path.relative(ROOT, BASELINE)}`);
    return;
  }
  if (!fs.existsSync(BASELINE)) {
    console.error('::error::export-sync baseline missing. Run: node scripts/check-export-sync.js --update');
    process.exit(1);
  }
  const baseline = fs.readFileSync(BASELINE, 'utf8');
  if (report === baseline) {
    console.log('✔ exports/skills/*.md in sync with canonical SKILL.md files (no new drift vs baseline)');
    return;
  }
  console.error('::error::export drift detected: canonical SKILL.md and exports/skills/*.md diverge from the accepted baseline.');
  console.error('If the divergence is intentional, re-accept it with: node scripts/check-export-sync.js --update');
  console.error('--- current report lines not in baseline ---');
  const baselineSet = new Set(baseline.split('\n'));
  for (const l of report.split('\n')) if (!baselineSet.has(l)) console.error('  + ' + l);
  console.error('--- baseline lines no longer produced ---');
  const reportSet = new Set(report.split('\n'));
  for (const l of baseline.split('\n')) if (!reportSet.has(l)) console.error('  - ' + l);
  process.exit(1);
}

main();
