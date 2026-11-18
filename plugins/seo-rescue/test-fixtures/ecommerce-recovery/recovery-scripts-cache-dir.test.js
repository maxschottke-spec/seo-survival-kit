#!/usr/bin/env node
'use strict';

// Tests for --cache-dir, --dry-run and the data-less CLI mode of
// scripts/recovery-monitor.js and scripts/recovery-crawl.js (v0.5.6).
//
// Background: up to v0.5.5 both scripts accepted --cache-dir and ignored it —
// a run "into a throwaway directory" wrote into ~/.cache/seo-rescue instead,
// and the data-less CLI mode appended an all-null line to history.ndjson.
//
// Run:
//   node plugins/seo-rescue/test-fixtures/ecommerce-recovery/recovery-scripts-cache-dir.test.js
//
// Everything happens in mkdtemp directories. HOME and SEO_CACHE_DIR are pointed
// at a decoy directory for this process and for every child process, so even a
// regression cannot touch the real ~/.cache/seo-rescue; the tests assert that
// the decoy stays empty.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'seo-rescue-cachedir-test-')));
const decoyHome = path.join(sandbox, 'decoy-home');
const decoyCache = path.join(sandbox, 'decoy-cache');
fs.mkdirSync(decoyHome);
process.env.HOME = decoyHome;
process.env.USERPROFILE = decoyHome;
process.env.SEO_CACHE_DIR = decoyCache;

const safe = require('../../lib/safe.js');
const monitor = require('../../scripts/recovery-monitor.js');
const crawl = require('../../scripts/recovery-crawl.js');

const MONITOR = path.join(__dirname, '..', '..', 'scripts', 'recovery-monitor.js');
const CRAWL = path.join(__dirname, '..', '..', 'scripts', 'recovery-crawl.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message}`);
    failed++;
  }
}

let n = 0;
function freshDir() {
  return path.join(sandbox, `cache-${++n}`);
}

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, HOME: decoyHome, USERPROFILE: decoyHome, SEO_CACHE_DIR: decoyCache },
  });
}

function decoyUntouched() {
  assert.strictEqual(fs.existsSync(decoyCache), false, 'SEO_CACHE_DIR decoy was created');
  assert.deepStrictEqual(fs.readdirSync(decoyHome), [], 'decoy HOME was written to');
}

function lines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
}

console.log('\nlib/safe.js — explicit cache dir');

test('ensureDomainDir(slug, dir) creates the domain dir under dir, mode 0700', () => {
  const root = freshDir();
  const dir = safe.ensureDomainDir('example-com', root);
  assert.strictEqual(dir, path.join(root, 'example-com'));
  assert.ok(fs.statSync(dir).isDirectory());
  if (process.platform !== 'win32') {
    assert.strictEqual(fs.statSync(dir).mode & 0o777, 0o700);
    assert.strictEqual(fs.statSync(root).mode & 0o777, 0o700);
  }
  decoyUntouched();
});

test('ensureDomainDir(slug, dir) still validates the slug', () => {
  assert.throws(() => safe.ensureDomainDir('../escape', freshDir()));
});

test('ensureDomainDir refuses a symlinked explicit cache dir', () => {
  if (process.platform === 'win32') return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.ensureDomainDir('example-com', link), /symlink/);
  assert.deepStrictEqual(fs.readdirSync(real), []);
});

test('ensureDomainDir refuses a symlinked domain dir', () => {
  if (process.platform === 'win32') return;
  const root = freshDir();
  const elsewhere = freshDir();
  fs.mkdirSync(root);
  fs.mkdirSync(elsewhere);
  fs.symlinkSync(elsewhere, path.join(root, 'example-com'));
  assert.throws(() => safe.ensureDomainDir('example-com', root), /symlink/);
});

test('getCacheDir rejects an empty explicit dir', () => {
  assert.throws(() => safe.getCacheDir(''), /Unsafe cache dir/);
});

test('resolveDomainDir returns the path and creates nothing', () => {
  const root = freshDir();
  assert.strictEqual(safe.resolveDomainDir('example-com', root), path.join(root, 'example-com'));
  assert.strictEqual(fs.existsSync(root), false);
});

test('without an explicit dir, SEO_CACHE_DIR still applies (unchanged behaviour)', () => {
  const root = freshDir();
  const saved = process.env.SEO_CACHE_DIR;
  process.env.SEO_CACHE_DIR = root;
  try {
    assert.strictEqual(safe.ensureDomainDir('example-com'), path.join(root, 'example-com'));
  } finally {
    process.env.SEO_CACHE_DIR = saved;
  }
});

console.log('\nrecovery-monitor.js — CLI');

test('--cache-dir is honoured: history lands there, not in SEO_CACHE_DIR or HOME', () => {
  const root = freshDir();
  const r = run(MONITOR, ['--domain', 'example.com', '--vi', '0.42', '--keywords-t10', '12', '--cache-dir', root]);
  assert.strictEqual(r.status, 0, r.stderr);
  const history = path.join(root, 'example-com', 'history.ndjson');
  const entries = lines(history).map((l) => JSON.parse(l));
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].vi, 0.42);
  assert.strictEqual(entries[0].keywords_t10, 12);
  assert.strictEqual(entries[0].status, 'complete');
  // hand-entered values are never rated as a live reading
  assert.strictEqual(entries[0].data_quality, 'partial');
  assert.strictEqual(entries[0].confidence, 'medium');
  assert.deepStrictEqual(entries[0].providers_used, ['manual_cli']);
  assert.strictEqual(fs.existsSync(path.join(root, 'example-com', '.lock')), false, 'lock left behind');
  decoyUntouched();
});

test('no data given: nothing is appended and no directory is created', () => {
  const root = freshDir();
  const r = run(MONITOR, ['--domain', 'example.com', '--cache-dir', root]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /nothing written/);
  assert.strictEqual(fs.existsSync(root), false);
  decoyUntouched();
});

test('no data given: an existing history keeps its line count', () => {
  const root = freshDir();
  run(MONITOR, ['--domain', 'example.com', '--vi', '0.42', '--keywords-t10', '12', '--cache-dir', root]);
  const history = path.join(root, 'example-com', 'history.ndjson');
  const before = fs.readFileSync(history, 'utf8');
  const r = run(MONITOR, ['--domain', 'example.com', '--cache-dir', root]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(fs.readFileSync(history, 'utf8'), before);
});

test('--dry-run with data prints the entry and writes nothing', () => {
  const root = freshDir();
  const r = run(MONITOR, ['--domain', 'example.com', '--vi', '0.42', '--keywords-t10', '12', '--cache-dir', root, '--dry-run']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Dry run: nothing written/);
  const json = r.stdout.split('\n').find((l) => l.startsWith('{'));
  assert.strictEqual(JSON.parse(json).vi, 0.42);
  assert.strictEqual(fs.existsSync(root), false);
  decoyUntouched();
});

test('--dry-run reads an existing history for the delta but does not append', () => {
  const root = freshDir();
  run(MONITOR, ['--domain', 'example.com', '--vi', '0.40', '--keywords-t10', '10', '--cache-dir', root]);
  const history = path.join(root, 'example-com', 'history.ndjson');
  const r = run(MONITOR, ['--domain', 'example.com', '--vi', '0.44', '--keywords-t10', '12', '--cache-dir', root, '--dry-run']);
  assert.strictEqual(r.status, 0, r.stderr);
  const entry = JSON.parse(r.stdout.split('\n').find((l) => l.startsWith('{')));
  assert.strictEqual(entry.vi_delta_pct, 10);
  assert.strictEqual(entry.keywords_t10_delta, 2);
  assert.strictEqual(lines(history).length, 1);
});

test('second real run appends a second line', () => {
  const root = freshDir();
  run(MONITOR, ['--domain', 'example.com', '--vi', '0.40', '--keywords-t10', '10', '--cache-dir', root]);
  run(MONITOR, ['--domain', 'example.com', '--vi', '0.44', '--keywords-t10', '12', '--cache-dir', root]);
  assert.strictEqual(lines(path.join(root, 'example-com', 'history.ndjson')).length, 2);
});

test('invalid --vi is rejected, nothing written', () => {
  const root = freshDir();
  const r = run(MONITOR, ['--domain', 'example.com', '--vi', 'abc', '--cache-dir', root]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Invalid value for --vi/);
  assert.strictEqual(fs.existsSync(root), false);
});

test('missing --domain exits 2 with usage', () => {
  const r = run(MONITOR, []);
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /--dry-run/);
});

test('symlinked --cache-dir exits 2', () => {
  if (process.platform === 'win32') return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  const r = run(MONITOR, ['--domain', 'example.com', '--vi', '0.42', '--cache-dir', link]);
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(fs.readdirSync(real), []);
});

console.log('\nrecovery-monitor.js — writeMonitorEntry()');

test('options.cacheDir is honoured', () => {
  const root = freshDir();
  const res = monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', 0.5, 7, [], [], { cacheDir: root });
  assert.strictEqual(res.written, true);
  assert.strictEqual(res.historyPath, path.join(root, 'example-com', 'history.ndjson'));
  assert.strictEqual(lines(res.historyPath).length, 1);
  decoyUntouched();
});

test('options.dryRun writes nothing', () => {
  const root = freshDir();
  const res = monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', 0.5, 7, [], [], { cacheDir: root, dryRun: true });
  assert.strictEqual(res.written, false);
  assert.strictEqual(res.entry.vi, 0.5);
  assert.strictEqual(fs.existsSync(root), false);
});

test('null values after a real entry give null deltas, not negative numbers', () => {
  const root = freshDir();
  monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', 0.5, 7, [], [], { cacheDir: root });
  const res = monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', null, null, ['no data'], [], { cacheDir: root, dryRun: true });
  assert.strictEqual(res.entry.vi_delta_pct, null);
  assert.strictEqual(res.entry.keywords_t10_delta, null);
});

console.log('\nrecovery-crawl.js');

test('CLI --cache-dir is honoured', () => {
  const root = freshDir();
  const r = run(CRAWL, ['--domain', 'example.com', '--cache-dir', root]);
  assert.strictEqual(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.cacheDir, path.join(root, 'example-com'));
  assert.ok(fs.statSync(out.cacheDir).isDirectory());
  decoyUntouched();
});

test('CLI --dry-run creates nothing', () => {
  const root = freshDir();
  const r = run(CRAWL, ['--domain', 'example.com', '--cache-dir', root, '--dry-run']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(JSON.parse(r.stdout).dry_run, true);
  assert.strictEqual(fs.existsSync(root), false);
  decoyUntouched();
});

const rawIssues = [{ type: 'missing_h1', count: 2, affected_urls: 2, details: [] }];

test('writeIssuesJSON options.cacheDir is honoured', () => {
  const root = freshDir();
  const out = crawl.writeIssuesJSON('example.com', 'example-com', 'example.com', 5, rawIssues, [], [], { cacheDir: root, crawlerProvider: 'csv_import' });
  const file = path.join(root, 'example-com', 'issues.json');
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).summary.medium, 1);
  assert.strictEqual(out.summary.total_issues, 1);
  decoyUntouched();
});

test('writeIssuesJSON options.dryRun writes nothing', () => {
  const root = freshDir();
  const out = crawl.writeIssuesJSON('example.com', 'example-com', 'example.com', 5, rawIssues, [], [], { cacheDir: root, dryRun: true, crawlerProvider: 'csv_import' });
  assert.strictEqual(out.summary.total_issues, 1);
  assert.strictEqual(fs.existsSync(root), false);
});

fs.rmSync(sandbox, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
