#!/usr/bin/env node
'use strict';

// Tests for --cache-dir, --dry-run, strict argument checking, number checking
// and the file-system hardening behind scripts/recovery-monitor.js and
// scripts/recovery-crawl.js (v0.5.6).
//
// Background, part 1 (first-time-user walk-through): up to v0.5.5 both scripts
// accepted --cache-dir and ignored it — a run "into a throwaway directory"
// wrote into ~/.cache/seo-rescue instead, and the data-less CLI mode appended
// an all-null line to history.ndjson.
//
// Background, part 2 (independent review of that fix): `--dry-run=true` wrote
// anyway, a `--cache-dir` without value fell back to the real cache, a typo
// like `--dryrun` was ignored, huge numbers were stored with lost precision,
// and a symlink in the parent path or a hard-linked history file was written
// through.
//
// Run:
//   node plugins/seo-rescue/test-fixtures/ecommerce-recovery/recovery-scripts-cache-dir.test.js
//
// Everything happens in mkdtemp directories. For this process SEO_CACHE_DIR
// points at a decoy directory; child processes get a decoy HOME and NO
// SEO_CACHE_DIR, so their default target is <decoy HOME>/.cache/seo-rescue —
// the stand-in for the user's real cache. EVERY test ends with the assertion
// that both decoys are still untouched, and that the children's working
// directory is still empty.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'seo-rescue-cachedir-test-')));
const decoyHome = path.join(sandbox, 'decoy-home');
const decoyCache = path.join(sandbox, 'decoy-cache');
const childCwd = path.join(sandbox, 'child-cwd');
fs.mkdirSync(decoyHome);
fs.mkdirSync(childCwd);
process.env.HOME = decoyHome;
process.env.USERPROFILE = decoyHome;
process.env.SEO_CACHE_DIR = decoyCache;

const safe = require('../../lib/safe.js');
const monitor = require('../../scripts/recovery-monitor.js');
const crawl = require('../../scripts/recovery-crawl.js');

const MONITOR = path.join(__dirname, '..', '..', 'scripts', 'recovery-monitor.js');
const CRAWL = path.join(__dirname, '..', '..', 'scripts', 'recovery-crawl.js');
const POSIX = process.platform !== 'win32';

let passed = 0;
let failed = 0;

function decoyUntouched() {
  assert.strictEqual(fs.existsSync(decoyCache), false, 'SEO_CACHE_DIR decoy was created');
  assert.deepStrictEqual(fs.readdirSync(decoyHome), [], 'decoy HOME (default cache target of the child processes) was written to');
  assert.deepStrictEqual(fs.readdirSync(childCwd), [], 'working directory of the child processes was written to');
}

function test(name, fn) {
  try {
    fn();
    decoyUntouched();
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
  const env = { ...process.env, HOME: decoyHome, USERPROFILE: decoyHome };
  delete env.SEO_CACHE_DIR; // default target of the child = <decoy HOME>/.cache/seo-rescue
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', shell: false, env, cwd: childCwd });
}

function lines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
}

function mode(p) {
  return fs.statSync(p).mode & 0o777;
}

// A run that must be refused before anything is written: exit 2, message on
// stderr, and the given directory does not exist afterwards.
function refused(r, root, pattern) {
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  if (pattern) assert.match(r.stderr, pattern);
  assert.match(r.stderr, /Nothing was written/);
  if (root) assert.strictEqual(fs.existsSync(root), false, `${root} was created`);
}

const WITH_DATA = ['--domain', 'example.com', '--vi', '0.42', '--keywords-t10', '12'];

// ---------------------------------------------------------------------------
console.log('\nlib/safe.js — explicit cache dir');

test('ensureDomainDir(slug, dir) creates the domain dir under dir, mode 0700', () => {
  const root = freshDir();
  const dir = safe.ensureDomainDir('example-com', root);
  assert.strictEqual(dir, path.join(root, 'example-com'));
  assert.ok(fs.statSync(dir).isDirectory());
  if (POSIX) {
    assert.strictEqual(mode(dir), 0o700);
    assert.strictEqual(mode(root), 0o700);
  }
});

test('ensureDomainDir(slug, dir) still validates the slug', () => {
  assert.throws(() => safe.ensureDomainDir('../escape', freshDir()));
});

test('ensureDomainDir refuses a symlinked explicit cache dir', () => {
  if (!POSIX) return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.ensureDomainDir('example-com', link), /symlink/);
  assert.deepStrictEqual(fs.readdirSync(real), []);
});

test('ensureDomainDir refuses a symlink in the PARENT path of the explicit cache dir', () => {
  if (!POSIX) return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.ensureDomainDir('example-com', path.join(link, 'cache')), /symlink is part of the path/);
  assert.throws(() => safe.ensureDomainDir('example-com', path.join(link, 'a', 'b', 'cache')), /symlink is part of the path/);
  assert.deepStrictEqual(fs.readdirSync(real), [], 'something was created behind the symlink');
});

test('the refusal names the resolved path to use instead', () => {
  if (!POSIX) return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.getCacheDir(path.join(link, 'cache')), (e) => e.message.includes(path.join(real, 'cache')));
});

test('resolveDomainDir (dry run) refuses a symlink in the parent path too', () => {
  if (!POSIX) return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.resolveDomainDir('example-com', path.join(link, 'cache')), /symlink is part of the path/);
});

test('ensureDomainDir refuses a symlinked domain dir', () => {
  if (!POSIX) return;
  const root = freshDir();
  const elsewhere = freshDir();
  fs.mkdirSync(root);
  fs.mkdirSync(elsewhere);
  fs.symlinkSync(elsewhere, path.join(root, 'example-com'));
  assert.throws(() => safe.ensureDomainDir('example-com', root), /symlink/);
  assert.deepStrictEqual(fs.readdirSync(elsewhere), []);
});

test('a cache dir that is a file is refused', () => {
  const root = freshDir();
  fs.writeFileSync(root, 'x');
  assert.throws(() => safe.getCacheDir(root));
  assert.strictEqual(fs.readFileSync(root, 'utf8'), 'x');
});

test('getCacheDir rejects an empty explicit dir', () => {
  assert.throws(() => safe.getCacheDir(''), /Unsafe cache dir/);
  assert.throws(() => safe.getCacheDir('   '), /Unsafe cache dir/);
  assert.throws(() => safe.getCacheDir(true), /Unsafe cache dir/);
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

// ---------------------------------------------------------------------------
console.log('\nlib/safe.js — permissions are tightened, never loosened');

test('a cache root with mode 0500 stays 0500', () => {
  if (!POSIX) return;
  const root = freshDir();
  fs.mkdirSync(root, { mode: 0o500 });
  fs.chmodSync(root, 0o500);
  try {
    assert.strictEqual(safe.getCacheDir(root), root);
    assert.strictEqual(mode(root), 0o500);
  } finally {
    fs.chmodSync(root, 0o700);
  }
});

test('a domain dir with mode 0500 stays 0500', () => {
  if (!POSIX) return;
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  fs.mkdirSync(dir, { recursive: true });
  fs.chmodSync(dir, 0o500);
  try {
    assert.strictEqual(safe.ensureDomainDir('example-com', root), dir);
    assert.strictEqual(mode(dir), 0o500);
  } finally {
    fs.chmodSync(dir, 0o700);
  }
});

test('group/other bits are removed (0755 -> 0700, 0750 -> 0700, 0555 -> 0500)', () => {
  if (!POSIX) return;
  for (const [before, after] of [[0o755, 0o700], [0o750, 0o700], [0o555, 0o500]]) {
    const root = freshDir();
    fs.mkdirSync(root);
    fs.chmodSync(root, before);
    try {
      safe.getCacheDir(root);
      assert.strictEqual(mode(root), after, `${before.toString(8)} became ${mode(root).toString(8)}`);
    } finally {
      fs.chmodSync(root, 0o700);
    }
  }
});

// ---------------------------------------------------------------------------
console.log('\nlib/safe.js — files: symlink, hard link, non-file');

test('appendNDJSON refuses a symlink and leaves its target alone', () => {
  if (!POSIX) return;
  const dir = freshDir();
  fs.mkdirSync(dir);
  const foreign = path.join(dir, 'foreign.txt');
  fs.writeFileSync(foreign, 'keep\n');
  const link = path.join(dir, 'history.ndjson');
  fs.symlinkSync(foreign, link);
  assert.throws(() => safe.appendNDJSON(link, { a: 1 }), /symlink/);
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), 'keep\n');
});

test('appendNDJSON refuses a hard-linked file and leaves it alone', () => {
  if (!POSIX) return;
  const dir = freshDir();
  fs.mkdirSync(dir);
  const foreign = path.join(dir, 'foreign.txt');
  fs.writeFileSync(foreign, 'keep\n');
  const hard = path.join(dir, 'history.ndjson');
  fs.linkSync(foreign, hard);
  assert.throws(() => safe.appendNDJSON(hard, { a: 1 }), /hard links/);
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), 'keep\n');
});

test('appendNDJSON still creates and appends to an ordinary file', () => {
  const dir = freshDir();
  fs.mkdirSync(dir);
  const file = path.join(dir, 'history.ndjson');
  safe.appendNDJSON(file, { a: 1 });
  safe.appendNDJSON(file, { a: 2 });
  assert.deepStrictEqual(lines(file).map((l) => JSON.parse(l).a), [1, 2]);
  if (POSIX) assert.strictEqual(mode(file), 0o600);
});

test('atomicWriteJSON refuses a symlink target and a directory target', () => {
  if (!POSIX) return;
  const dir = freshDir();
  fs.mkdirSync(dir);
  const foreign = path.join(dir, 'foreign.json');
  fs.writeFileSync(foreign, '{"keep":true}');
  const link = path.join(dir, 'issues.json');
  fs.symlinkSync(foreign, link);
  assert.throws(() => safe.atomicWriteJSON(link, { a: 1 }), /symlink/);
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), '{"keep":true}');
  const sub = path.join(dir, 'sub');
  fs.mkdirSync(sub);
  assert.throws(() => safe.atomicWriteJSON(sub, { a: 1 }), /not a regular file/);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['foreign.json', 'issues.json', 'sub']);
});

// ---------------------------------------------------------------------------
console.log('\nlib/safe.js — parseStrictCli');

const SPEC = { domain: 'string', 'cache-dir': 'string', 'dry-run': 'boolean' };
const usageError = (argv, pattern) => assert.throws(
  () => safe.parseStrictCli(SPEC, argv),
  (e) => e.code === 'USAGE' && (!pattern || pattern.test(e.message)),
  `no usage error for ${JSON.stringify(argv)}`,
);

test('accepts the unambiguous forms', () => {
  assert.deepStrictEqual(safe.parseStrictCli(SPEC, ['--domain', 'a.com', '--dry-run']), { domain: 'a.com', 'dry-run': true });
  assert.deepStrictEqual(safe.parseStrictCli(SPEC, ['--domain=a.com', '--cache-dir=/x']), { domain: 'a.com', 'cache-dir': '/x' });
  assert.deepStrictEqual(safe.parseStrictCli(SPEC, []), {});
});

test('rejects a value on a switch: --dry-run=true, =false, =1, =', () => {
  for (const v of ['--dry-run=true', '--dry-run=false', '--dry-run=1', '--dry-run=']) usageError(['--domain', 'a.com', v]);
});

test('rejects unknown options and positionals', () => {
  usageError(['--dryrun']);
  usageError(['--dry_run']);
  usageError(['-n']);
  usageError(['--domain', 'a.com', 'stray']);
});

test('rejects an option without value, with an option as value, with an empty value', () => {
  usageError(['--cache-dir']);
  usageError(['--cache-dir', '--dry-run']);
  usageError(['--cache-dir=']);
  usageError(['--cache-dir', '   ']);
  usageError(['--domain']);
});

test('rejects a repeated option', () => {
  usageError(['--cache-dir', '/a', '--cache-dir', '/b'], /given 2 times/);
  usageError(['--dry-run', '--dry-run'], /given 2 times/);
});

// ---------------------------------------------------------------------------
console.log('\nrecovery-monitor.js — CLI');

test('--cache-dir is honoured: history lands there, not in the default cache', () => {
  const root = freshDir();
  const r = run(MONITOR, [...WITH_DATA, '--cache-dir', root]);
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
});

test('no data given: nothing is appended and no directory is created', () => {
  const root = freshDir();
  const r = run(MONITOR, ['--domain', 'example.com', '--cache-dir', root]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /nothing written/);
  assert.strictEqual(fs.existsSync(root), false);
});

test('no data given: an existing history keeps its line count', () => {
  const root = freshDir();
  run(MONITOR, [...WITH_DATA, '--cache-dir', root]);
  const history = path.join(root, 'example-com', 'history.ndjson');
  const before = fs.readFileSync(history, 'utf8');
  const r = run(MONITOR, ['--domain', 'example.com', '--cache-dir', root]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(fs.readFileSync(history, 'utf8'), before);
});

test('--dry-run with data prints the entry and writes nothing', () => {
  const root = freshDir();
  const r = run(MONITOR, [...WITH_DATA, '--cache-dir', root, '--dry-run']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Dry run: nothing written/);
  const json = r.stdout.split('\n').find((l) => l.startsWith('{'));
  assert.strictEqual(JSON.parse(json).vi, 0.42);
  assert.strictEqual(fs.existsSync(root), false);
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

test('missing --domain exits 2 with usage', () => {
  const r = run(MONITOR, []);
  refused(r, null, /--domain is required/);
  assert.match(r.stderr, /--dry-run/);
});

test('invalid domain exits 2', () => {
  const root = freshDir();
  refused(run(MONITOR, ['--domain', '../etc', '--vi', '1', '--cache-dir', root]), root);
});

// --- review finding 1: a malformed safety switch must never lead to a write
for (const form of ['--dry-run=true', '--dry-run=false', '--dry-run=1', '--dry-run=']) {
  test(`${form} is refused (exit 2), nothing written`, () => {
    const root = freshDir();
    refused(run(MONITOR, [...WITH_DATA, '--cache-dir', root, form]), root, /Invalid arguments/);
  });
}

for (const typo of ['--dryrun', '--dry_run', '--Dry-Run', '--dry-runn', '-n']) {
  test(`mistyped option ${typo} is refused (exit 2), nothing written`, () => {
    const root = freshDir();
    refused(run(MONITOR, [...WITH_DATA, '--cache-dir', root, typo]), root, /Invalid arguments/);
  });
}

test('a stray positional argument is refused', () => {
  const root = freshDir();
  refused(run(MONITOR, [...WITH_DATA, '--cache-dir', root, 'dry-run']), root, /Invalid arguments/);
});

// --- review finding 2: a given but unusable option is an error, never "not given"
test('--cache-dir without a value is refused and does NOT fall back to the default cache', () => {
  refused(run(MONITOR, ['--domain', 'example.com', '--vi', '1', '--cache-dir']), null, /Invalid arguments/);
});

test('--cache-dir followed by another option is refused (no directory named "--dry-run")', () => {
  refused(run(MONITOR, [...WITH_DATA, '--cache-dir', '--dry-run']), null, /Invalid arguments/);
});

test('--cache-dir= (empty) is refused', () => {
  refused(run(MONITOR, [...WITH_DATA, '--cache-dir=']), null, /non-empty value/);
});

test('--vi / --keywords-t10 / --domain without a value are refused', () => {
  const root = freshDir();
  refused(run(MONITOR, ['--domain', 'example.com', '--cache-dir', root, '--vi']), root);
  refused(run(MONITOR, ['--domain', 'example.com', '--cache-dir', root, '--keywords-t10']), root);
  refused(run(MONITOR, ['--cache-dir', root, '--vi', '1', '--domain']), root);
});

test('a repeated option is refused', () => {
  const a = freshDir();
  const b = freshDir();
  refused(run(MONITOR, [...WITH_DATA, '--cache-dir', a, '--cache-dir', b]), a, /given 2 times/);
  assert.strictEqual(fs.existsSync(b), false);
});

// --- review finding 3: numbers
const BAD_VI = ['-1', 'NaN', 'Infinity', '-Infinity', '1e308', '1e3', '0x10', 'abc', '1,5', '1000001', ' 1', '+1', '.5'];
for (const v of BAD_VI) {
  test(`--vi=${JSON.stringify(v)} is refused (exit 2), nothing written`, () => {
    const root = freshDir();
    refused(run(MONITOR, ['--domain', 'example.com', '--cache-dir', root, `--vi=${v}`]), root, /Invalid arguments/);
  });
}

const BAD_T10 = ['9007199254740993', '9007199254740992', '1000000001', '1.5', '-3', 'NaN', 'Infinity', '1e3', 'abc'];
for (const v of BAD_T10) {
  test(`--keywords-t10=${JSON.stringify(v)} is refused (exit 2), nothing written`, () => {
    const root = freshDir();
    refused(run(MONITOR, ['--domain', 'example.com', '--cache-dir', root, `--keywords-t10=${v}`]), root, /Invalid arguments/);
  });
}

test('the limits themselves are accepted (--vi 1000000, --keywords-t10 1000000000, both 0)', () => {
  const root = freshDir();
  const r = run(MONITOR, ['--domain', 'example.com', '--vi', '1000000', '--keywords-t10', '1000000000', '--cache-dir', root, '--dry-run']);
  assert.strictEqual(r.status, 0, r.stderr);
  const entry = JSON.parse(r.stdout.split('\n').find((l) => l.startsWith('{')));
  assert.strictEqual(entry.vi, 1000000);
  assert.strictEqual(entry.keywords_t10, 1000000000);
  const z = run(MONITOR, ['--domain', 'example.com', '--vi', '0', '--keywords-t10', '0', '--cache-dir', root, '--dry-run']);
  assert.strictEqual(z.status, 0, z.stderr);
});

// --- review finding 4: file system
test('symlinked --cache-dir exits 2', () => {
  if (!POSIX) return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  const r = run(MONITOR, [...WITH_DATA, '--cache-dir', link]);
  refused(r, null, /symlink/);
  assert.deepStrictEqual(fs.readdirSync(real), []);
});

test('--cache-dir below a symlinked parent exits 2, nothing behind the symlink', () => {
  if (!POSIX) return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  refused(run(MONITOR, [...WITH_DATA, '--cache-dir', path.join(link, 'cache')]), null, /symlink is part of the path/);
  refused(run(MONITOR, [...WITH_DATA, '--cache-dir', path.join(link, 'cache'), '--dry-run']), null, /symlink is part of the path/);
  assert.deepStrictEqual(fs.readdirSync(real), []);
});

test('history.ndjson is a symlink: exit 2, target unchanged, no lock left', () => {
  if (!POSIX) return;
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  fs.mkdirSync(dir, { recursive: true });
  const foreign = path.join(sandbox, `foreign-${n}.txt`);
  fs.writeFileSync(foreign, 'keep\n');
  fs.symlinkSync(foreign, path.join(dir, 'history.ndjson'));
  const r = run(MONITOR, [...WITH_DATA, '--cache-dir', root]);
  refused(r, null, /symlink/);
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), 'keep\n');
  assert.strictEqual(fs.existsSync(path.join(dir, '.lock')), false);
});

test('history.ndjson is a hard link to another file: exit 2, that file unchanged', () => {
  if (!POSIX) return;
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  fs.mkdirSync(dir, { recursive: true });
  const foreign = path.join(sandbox, `foreign-${n}.ndjson`);
  fs.writeFileSync(foreign, '{"keep":true}\n');
  fs.linkSync(foreign, path.join(dir, 'history.ndjson'));
  const r = run(MONITOR, [...WITH_DATA, '--cache-dir', root]);
  refused(r, null, /hard links/);
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), '{"keep":true}\n');
  assert.strictEqual(fs.existsSync(path.join(dir, '.lock')), false);
});

test('a cache root with mode 0500 is not loosened by a run', () => {
  if (!POSIX) return;
  const root = freshDir();
  fs.mkdirSync(root);
  fs.chmodSync(root, 0o500);
  try {
    const r = run(MONITOR, [...WITH_DATA, '--cache-dir', root, '--dry-run']);
    assert.strictEqual(r.status, 0, r.stderr);
    run(MONITOR, [...WITH_DATA, '--cache-dir', root]);
    run(CRAWL, ['--domain', 'example.com', '--cache-dir', root]);
    assert.strictEqual(mode(root), 0o500);
  } finally {
    fs.chmodSync(root, 0o700);
  }
});

// ---------------------------------------------------------------------------
console.log('\nrecovery-monitor.js — writeMonitorEntry()');

const W = (vi, t10, options) => monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', vi, t10, [], [], options);

test('options.cacheDir is honoured', () => {
  const root = freshDir();
  const res = W(0.5, 7, { cacheDir: root });
  assert.strictEqual(res.written, true);
  assert.strictEqual(res.historyPath, path.join(root, 'example-com', 'history.ndjson'));
  assert.strictEqual(lines(res.historyPath).length, 1);
});

test('options.dryRun writes nothing', () => {
  const root = freshDir();
  const res = W(0.5, 7, { cacheDir: root, dryRun: true });
  assert.strictEqual(res.written, false);
  assert.strictEqual(res.entry.vi, 0.5);
  assert.strictEqual(fs.existsSync(root), false);
});

test('options.dryRun must be a real boolean: "true", "false", 1 are refused, nothing written', () => {
  for (const v of ['true', 'false', 1, 0, 'yes']) {
    const root = freshDir();
    assert.throws(() => W(0.5, 7, { cacheDir: root, dryRun: v }), /options\.dryRun/);
    assert.strictEqual(fs.existsSync(root), false);
  }
});

test('an invalid options.cacheDir is refused instead of falling back to the default', () => {
  for (const v of ['', '   ', true, 42, {}]) {
    assert.throws(() => W(0.5, 7, { cacheDir: v }), /Unsafe cache dir/);
  }
});

test('null values after a real entry give null deltas, not negative numbers', () => {
  const root = freshDir();
  W(0.5, 7, { cacheDir: root });
  const res = monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', null, null, ['no data'], [], { cacheDir: root, dryRun: true });
  assert.strictEqual(res.entry.vi_delta_pct, null);
  assert.strictEqual(res.entry.keywords_t10_delta, null);
});

test('vi: negative, NaN, infinite, oversized and non-number values throw, nothing written', () => {
  for (const v of [-1, -0.0001, NaN, Infinity, -Infinity, 1e308, 1000001, '0.4', true, {}]) {
    const root = freshDir();
    assert.throws(() => W(v, 7, { cacheDir: root }), /Invalid value for vi/, `vi=${String(v)} accepted`);
    assert.strictEqual(fs.existsSync(root), false, `vi=${String(v)} created ${root}`);
  }
});

test('keywordsT10: negative, fractional, NaN, infinite, unsafe and oversized values throw, nothing written', () => {
  // eslint-disable-next-line no-loss-of-precision
  for (const v of [-1, 1.5, NaN, Infinity, 9007199254740993, Number.MAX_SAFE_INTEGER + 1, 1000000001, '12', true]) {
    const root = freshDir();
    assert.throws(() => W(0.5, v, { cacheDir: root }), /Invalid value for keywordsT10/, `keywordsT10=${String(v)} accepted`);
    assert.strictEqual(fs.existsSync(root), false);
  }
});

test('options numbers are checked the same way (keywordsTotal, viTrend4wPct, backlinkSpamScore)', () => {
  const bad = [
    { keywordsTotal: NaN }, { keywordsTotal: -1 }, { keywordsTotal: 1.5 }, { keywordsTotal: Infinity },
    { viTrend4wPct: Infinity }, { viTrend4wPct: NaN }, { viTrend4wPct: -101 }, { viTrend4wPct: '5' },
    { backlinkSpamScore: 101 }, { backlinkSpamScore: -1 }, { backlinkSpamScore: NaN },
  ];
  for (const o of bad) {
    const root = freshDir();
    assert.throws(() => W(0.5, 7, { cacheDir: root, ...o }), /Invalid value for options\./, `${JSON.stringify(o)} accepted`);
    assert.strictEqual(fs.existsSync(root), false);
  }
  const root = freshDir();
  const ok = W(0.5, 7, { cacheDir: root, dryRun: true, keywordsTotal: 900, viTrend4wPct: -12.5, backlinkSpamScore: 3 });
  assert.strictEqual(ok.entry.keywords_total, 900);
});

test('every number in a written entry is finite (no value silently stored as null)', () => {
  const root = freshDir();
  W(1000000, 1000000000, { cacheDir: root });
  const res = W(0, 0, { cacheDir: root, viTrend4wPct: 1e6, backlinkSpamScore: 0, keywordsTotal: 1e9 });
  const walk = (v, where) => {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${where} is ${v}`);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  };
  walk(res.entry, 'entry');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(res.entry)), res.entry, 'entry changes when serialized');
});

test('a previous VI near zero gives a null delta WITH a warning, not a silent null', () => {
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'history.ndjson'), JSON.stringify({ vi: 1e-320, keywords_t10: 5 }) + '\n');
  const res = W(1000000, 7, { cacheDir: root, dryRun: true });
  assert.strictEqual(res.entry.vi_delta_pct, null);
  assert.ok(res.entry.warnings.some((w) => /vi_delta_pct not computable/.test(w)));
  assert.strictEqual(res.entry.status, 'partial');
  assert.strictEqual(res.entry.keywords_t10_delta, 2);
});

test('garbage in the previous history line is not used for arithmetic', () => {
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'history.ndjson'), JSON.stringify({ vi: 'abc', keywords_t10: '5', score: 'x' }) + '\n');
  const res = W(0.5, 7, { cacheDir: root, dryRun: true });
  assert.strictEqual(res.entry.vi_delta_pct, null);
  assert.strictEqual(res.entry.keywords_t10_delta, null);
  assert.strictEqual(res.entry.component_scores.quick_win_progress, null);
});

// ---------------------------------------------------------------------------
console.log('\nrecovery-crawl.js');

test('CLI --cache-dir is honoured', () => {
  const root = freshDir();
  const r = run(CRAWL, ['--domain', 'example.com', '--cache-dir', root]);
  assert.strictEqual(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.cacheDir, path.join(root, 'example-com'));
  assert.ok(fs.statSync(out.cacheDir).isDirectory());
});

test('CLI --dry-run creates nothing', () => {
  const root = freshDir();
  const r = run(CRAWL, ['--domain', 'example.com', '--cache-dir', root, '--dry-run']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(JSON.parse(r.stdout).dry_run, true);
  assert.strictEqual(fs.existsSync(root), false);
});

for (const form of ['--dry-run=true', '--dry-run=false', '--dry-run=1', '--dryrun', '--dry_run']) {
  test(`CLI ${form} is refused (exit 2), no directory created`, () => {
    const root = freshDir();
    refused(run(CRAWL, ['--domain', 'example.com', '--cache-dir', root, form]), root, /Invalid arguments/);
  });
}

test('CLI --cache-dir without a value is refused and does NOT create the default cache', () => {
  refused(run(CRAWL, ['--domain', 'example.com', '--cache-dir']), null, /Invalid arguments/);
});

test('CLI --cache-dir followed by --dry-run is refused (no directory named "--dry-run")', () => {
  refused(run(CRAWL, ['--domain', 'example.com', '--cache-dir', '--dry-run']), null, /Invalid arguments/);
  assert.strictEqual(fs.existsSync(path.join(childCwd, '--dry-run')), false);
});

test('CLI missing --domain and invalid domain exit 2', () => {
  refused(run(CRAWL, []), null, /--domain is required/);
  const root = freshDir();
  refused(run(CRAWL, ['--domain', 'not a domain', '--cache-dir', root]), root);
});

test('CLI --cache-dir below a symlinked parent exits 2 (with and without --dry-run)', () => {
  if (!POSIX) return;
  const real = freshDir();
  fs.mkdirSync(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  refused(run(CRAWL, ['--domain', 'example.com', '--cache-dir', path.join(link, 'cache')]), null, /symlink is part of the path/);
  refused(run(CRAWL, ['--domain', 'example.com', '--cache-dir', path.join(link, 'cache'), '--dry-run']), null, /symlink is part of the path/);
  assert.deepStrictEqual(fs.readdirSync(real), []);
});

const rawIssues = [{ type: 'missing_h1', count: 2, affected_urls: 2, details: [] }];
const I = (options, crawled = 5) => crawl.writeIssuesJSON('example.com', 'example-com', 'example.com', crawled, rawIssues, [], [], options);

test('writeIssuesJSON options.cacheDir is honoured', () => {
  const root = freshDir();
  const out = I({ cacheDir: root, crawlerProvider: 'csv_import' });
  const file = path.join(root, 'example-com', 'issues.json');
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).summary.medium, 1);
  assert.strictEqual(out.summary.total_issues, 1);
});

test('writeIssuesJSON options.dryRun writes nothing', () => {
  const root = freshDir();
  const out = I({ cacheDir: root, dryRun: true, crawlerProvider: 'csv_import' });
  assert.strictEqual(out.summary.total_issues, 1);
  assert.strictEqual(fs.existsSync(root), false);
});

test('writeIssuesJSON: options.dryRun "true" and a non-integer URL count are refused, nothing written', () => {
  const a = freshDir();
  assert.throws(() => I({ cacheDir: a, dryRun: 'true', crawlerProvider: 'csv_import' }), /options\.dryRun/);
  assert.strictEqual(fs.existsSync(a), false);
  for (const c of [NaN, Infinity, -1, 1.5, '5']) {
    const b = freshDir();
    assert.throws(() => I({ cacheDir: b, crawlerProvider: 'csv_import' }, c), /crawledUrls/);
    assert.strictEqual(fs.existsSync(b), false);
  }
});

test('writeIssuesJSON: issues.json is a symlink -> refused, target unchanged, no lock or temp file left', () => {
  if (!POSIX) return;
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  fs.mkdirSync(dir, { recursive: true });
  const foreign = path.join(sandbox, `foreign-issues-${n}.json`);
  fs.writeFileSync(foreign, '{"keep":true}');
  fs.symlinkSync(foreign, path.join(dir, 'issues.json'));
  assert.throws(() => I({ cacheDir: root, crawlerProvider: 'csv_import' }), /symlink/);
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), '{"keep":true}');
  assert.deepStrictEqual(fs.readdirSync(dir), ['issues.json']);
});

test('writeIssuesJSON: replacing a hard-linked issues.json leaves the other name unchanged', () => {
  if (!POSIX) return;
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  fs.mkdirSync(dir, { recursive: true });
  const other = path.join(sandbox, `other-issues-${n}.json`);
  fs.writeFileSync(other, '{"keep":true}');
  fs.linkSync(other, path.join(dir, 'issues.json'));
  I({ cacheDir: root, crawlerProvider: 'csv_import' });
  assert.strictEqual(fs.readFileSync(other, 'utf8'), '{"keep":true}');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'issues.json'), 'utf8')).summary.total_issues, 1);
});

fs.rmSync(sandbox, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
