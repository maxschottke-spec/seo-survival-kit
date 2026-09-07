#!/usr/bin/env node
'use strict';
// check-no-private-names.js — pre-push guard against client identifiers
// leaking into this PUBLIC repository.
//
// Why this exists: on 2026-09-07 two commits on a feature branch carried a
// prospect's domain and first name in code comments and commit messages —
// caught locally before the push, but only by chance. The repository's
// existing practice is to anonymize ("Pilot-domain recovery case
// (anonymized)"); nothing enforced it. Second occurrence of the class
// "data class decided after the fact" → rule plus test.
//
// How it works: the denylist lives OUTSIDE version control, in
// `private/denylist.txt` (one term per line, `#` comments allowed;
// `private/` is gitignored). The knowledge of who the clients are stays on
// the author's machine, where it belongs — publishing the denylist would
// defeat its purpose. If the file is absent (CI, fresh clone), the check
// prints a notice and passes: it guards the author, not the world.
//
// What it scans:
//   1. every tracked file (git ls-files) — not the working tree, so that
//      gitignored material like private/ is never read by mistake;
//   2. the messages of every commit that is not yet on the upstream
//      (`@{upstream}..HEAD`, falling back to `origin/main..HEAD`) — this is
//      where the 2026-09-07 leak actually was.
//
// Matching is case-insensitive and on word boundaries, so a denylisted
// "jan" does not fire on "January" or "Janus".
//
// Usage:  node scripts/check-no-private-names.js
// Exit:   0 clean or no denylist · 1 hit(s) found · 2 misuse
//
// Wire as a hook:  git config core.hooksPath .githooks

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DENYLIST = path.join(ROOT, 'private', 'denylist.txt');

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', shell: false });
  if (r.status !== 0) return null;
  return r.stdout;
}

// --require (vom Pre-Push-Hook gesetzt): Fehlende Sperrliste oder nicht
// bestimmbare Push-Range sind dann ein FEHLER, kein No-op. Ohne --require
// (CI, fremder Clone) bleibt der Check ein No-op — dort gibt es die Liste
// nicht, und das ist gewollt. (Codex-Befund 07.09.2026: ein frischer Clone
// des Betreuers hätte sonst still ohne Guard gepusht.)
const REQUIRE = process.argv.includes('--require');
if (!fs.existsSync(DENYLIST)) {
  if (REQUIRE) { console.error(`check-no-private-names: ${path.relative(ROOT, DENYLIST)} fehlt — im Hook-Modus ist das ein Fehler (Liste anlegen oder Push mit --no-verify ausdruecklich erzwingen).`); process.exit(1); }
  console.log(`check-no-private-names: no ${path.relative(ROOT, DENYLIST)} — nothing to check (author-side guard).`);
  process.exit(0);
}

const terms = fs.readFileSync(DENYLIST, 'utf8')
  .split('\n')
  .map((l) => l.replace(/#.*$/, '').trim())
  .filter(Boolean);

if (!terms.length) {
  if (REQUIRE) { console.error('check-no-private-names: denylist is empty — im Hook-Modus ist das ein Fehler.'); process.exit(1); }
  console.log('check-no-private-names: denylist is empty — nothing to check.');
  process.exit(0);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Wortgrenzen NUR dort, wo der Begriff selbst mit einem Wortzeichen endet
// bzw. beginnt. "x.y@" endet mit "@": eine erzwungene Grenze danach hätte
// "x.y@example.com" NICHT getroffen — genau die Adresse, wegen der es diesen
// Guard gibt (Codex-Befund 07.09.2026).
const isWord = (c) => /[\p{L}\p{N}_]/u.test(c);
const patterns = terms.map((t) => {
  const left = isWord(t[0]) ? '(^|[^\\p{L}\\p{N}_])' : '';
  const right = isWord(t[t.length - 1]) ? '(?=$|[^\\p{L}\\p{N}_])' : '';
  return { term: t, re: new RegExp(`${left}${escape(t)}${right}`, 'iu') };
});

const hits = [];

// 1) tracked files — the PATH is checked for every file (a binary named
//    after a client leaks the name just as well), the CONTENT for text files.
//    A read error other than "deleted but still tracked" is a hit, not a
//    skip: silently skipping is fail-open (Codex-Befund 07.09.2026).
const tracked = (git(['ls-files', '-z']) || '').split('\0').filter(Boolean);
let binaries = 0;
for (const rel of tracked) {
  for (const { term, re } of patterns) {
    if (re.test(rel)) hits.push({ where: rel, term, line: `(Dateipfad) ${rel}` });
  }
  const abs = path.join(ROOT, rel);
  let buf;
  try { buf = fs.readFileSync(abs); } catch (e) {
    if (e && e.code === 'ENOENT') continue; // deleted in the working tree, still tracked: no content to leak
    hits.push({ where: rel, term: '(Lesefehler)', line: `nicht lesbar: ${e && e.code ? e.code : e}` });
    continue;
  }
  // binaries: a NUL byte in the first 8 KiB is a good enough tell — content is
  // not scanned (no text extraction here); the path was checked above
  if (buf.subarray(0, 8192).includes(0)) { binaries++; continue; }
  const text = buf.toString('utf8');
  const lines = text.split('\n');
  for (const { term, re } of patterns) {
    lines.forEach((line, i) => {
      if (re.test(line)) hits.push({ where: `${rel}:${i + 1}`, term, line: line.trim().slice(0, 120) });
    });
  }
}

// 2) unpushed commit messages
let range = null;
if (git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])) range = '@{upstream}..HEAD';
else if (git(['rev-parse', '--verify', 'origin/main'])) range = 'origin/main..HEAD';
if (!range && REQUIRE) {
  console.error('check-no-private-names: Push-Range nicht bestimmbar (kein Upstream, kein origin/main) — im Hook-Modus ist das ein Fehler; erst `git fetch origin`.');
  process.exit(1);
}
if (range) {
  const log = git(['log', range, '--format=%H%x00%B%x00']) || '';
  const entries = log.split('\0').filter((s) => s.trim());
  for (let i = 0; i + 1 < entries.length; i += 2) {
    const sha = entries[i].trim().slice(0, 7);
    const body = entries[i + 1];
    for (const { term, re } of patterns) {
      const line = body.split('\n').find((l) => re.test(l));
      if (line) hits.push({ where: `commit ${sha}`, term, line: line.trim().slice(0, 120) });
    }
  }
}

if (hits.length) {
  console.error(`check-no-private-names: ${hits.length} hit(s) — this repository is public.\n`);
  for (const h of hits) console.error(`  ${h.where}\n    term "${h.term}": ${h.line}`);
  console.error('\nRemove the identifier (anonymize) or rewrite the commit before pushing.');
  process.exit(1);
}
console.log(`check-no-private-names: clean (${terms.length} term(s), ${tracked.length} tracked files${binaries ? `, ${binaries} binary paths checked, content not scanned` : ''}${range ? `, commits ${range}` : ''}).`);
