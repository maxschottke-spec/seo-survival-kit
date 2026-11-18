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
fs.mkdirSync(decoyHome, { mode: 0o700 });
fs.mkdirSync(childCwd, { mode: 0o700 });
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

// Fixture directories are created private (0700): an existing directory that
// group or others can access is refused as an explicit cache dir.
function mkdirPrivate(p) {
  fs.mkdirSync(p, { recursive: true, mode: 0o700 });
  fs.chmodSync(p, 0o700);
}

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

// timeout: a regression that blocks (FIFO) must fail the test, not hang it.
function run(script, args, opts = {}) {
  const home = opts.home || decoyHome;
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.SEO_CACHE_DIR; // default target of the child = <HOME>/.cache/seo-rescue
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8', shell: false, env, cwd: opts.cwd || childCwd, timeout: 15000, killSignal: 'SIGKILL',
  });
}

function mkfifo(p) {
  const r = spawnSync('mkfifo', [p]);
  return r.status === 0;
}

// Runs fn with a property of an object temporarily replaced.
function withPatched(obj, key, value, fn) {
  const original = obj[key];
  obj[key] = value;
  try { return fn(); } finally { obj[key] = original; }
}

function sameOutcome(a, b, pattern) {
  assert.strictEqual(a.status, 2, `real run: exit ${a.status}\n${a.stderr}`);
  assert.strictEqual(b.status, 2, `dry run: exit ${b.status}\n${b.stdout}${b.stderr}`);
  assert.match(a.stderr, pattern);
  assert.match(b.stderr, pattern);
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
  mkdirPrivate(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.ensureDomainDir('example-com', link), /symlink/);
  assert.deepStrictEqual(fs.readdirSync(real), []);
});

test('ensureDomainDir refuses a symlink in the PARENT path of the explicit cache dir', () => {
  if (!POSIX) return;
  const real = freshDir();
  mkdirPrivate(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.ensureDomainDir('example-com', path.join(link, 'cache')), /symlink is part of the path/);
  assert.throws(() => safe.ensureDomainDir('example-com', path.join(link, 'a', 'b', 'cache')), /symlink is part of the path/);
  assert.deepStrictEqual(fs.readdirSync(real), [], 'something was created behind the symlink');
});

test('the refusal names the resolved path to use instead', () => {
  if (!POSIX) return;
  const real = freshDir();
  mkdirPrivate(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.getCacheDir(path.join(link, 'cache')), (e) => e.message.includes(path.join(real, 'cache')));
});

test('resolveDomainDir (dry run) refuses a symlink in the parent path too', () => {
  if (!POSIX) return;
  const real = freshDir();
  mkdirPrivate(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  assert.throws(() => safe.resolveDomainDir('example-com', path.join(link, 'cache')), /symlink is part of the path/);
});

test('ensureDomainDir refuses a symlinked domain dir', () => {
  if (!POSIX) return;
  const root = freshDir();
  const elsewhere = freshDir();
  mkdirPrivate(root);
  mkdirPrivate(elsewhere);
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
  mkdirPrivate(dir);
  fs.chmodSync(dir, 0o500);
  try {
    assert.strictEqual(safe.ensureDomainDir('example-com', root), dir);
    assert.strictEqual(mode(dir), 0o500);
  } finally {
    fs.chmodSync(dir, 0o700);
  }
});

// Default path and SEO_CACHE_DIR are the user's cache by definition: an old
// cache that is open to group/others keeps working and is tightened.
test('SEO_CACHE_DIR: group/other bits are removed, special bits kept (0755->0700, 0750->0700, 0555->0500, 01777->01700, 02755->02700)', () => {
  if (!POSIX) return;
  const saved = process.env.SEO_CACHE_DIR;
  try {
    for (const [before, after] of [[0o755, 0o700], [0o750, 0o700], [0o555, 0o500], [0o1777, 0o1700], [0o2755, 0o2700]]) {
      const root = freshDir();
      fs.mkdirSync(root);
      fs.chmodSync(root, before);
      // Some systems drop setgid/sticky on chmod by an unprivileged user: compare
      // against what the directory really had, not against what was asked for.
      const had = fs.statSync(root).mode & 0o7777;
      const expected = had === before ? after : (had & ~0o077);
      process.env.SEO_CACHE_DIR = root;
      try {
        safe.getCacheDir();
        const now = fs.statSync(root).mode & 0o7777;
        assert.strictEqual(now, expected, `${had.toString(8)} became ${now.toString(8)}, expected ${expected.toString(8)}`);
        assert.strictEqual(now & 0o7000, had & 0o7000, 'special bits changed');
      } finally {
        fs.chmodSync(root, 0o700);
      }
    }
  } finally {
    process.env.SEO_CACHE_DIR = saved;
  }
});

test('explicit cache dir: an EXISTING directory open to group/others is refused and NOT changed', () => {
  if (!POSIX) return;
  for (let m of [0o755, 0o750, 0o705, 0o1777, 0o2755]) {
    const root = freshDir();
    fs.mkdirSync(root);
    fs.chmodSync(root, m);
    m = fs.statSync(root).mode & 0o7777; // what the system really set
    assert.throws(() => safe.getCacheDir(root), /already exists and is accessible to group or others.*chmod 700/s);
    assert.throws(() => safe.ensureDomainDir('example-com', root), /already exists and is accessible/);
    assert.throws(() => safe.resolveDomainDir('example-com', root), /already exists and is accessible/);
    assert.strictEqual(fs.statSync(root).mode & 0o7777, m, `mode ${m.toString(8)} was changed`);
    assert.deepStrictEqual(fs.readdirSync(root), []);
  }
});

test('explicit cache dir: an existing open DOMAIN dir inside a private root is refused and not changed', () => {
  if (!POSIX) return;
  const root = freshDir();
  mkdirPrivate(root);
  const dir = path.join(root, 'example-com');
  fs.mkdirSync(dir);
  fs.chmodSync(dir, 0o755);
  assert.throws(() => safe.ensureDomainDir('example-com', root), /already exists and is accessible/);
  assert.throws(() => safe.resolveDomainDir('example-com', root), /already exists and is accessible/);
  assert.strictEqual(mode(dir), 0o755);
});

test('explicit cache dir: a NEW directory (and new parents) is created 0700', () => {
  if (!POSIX) return;
  const base = freshDir();
  const root = path.join(base, 'a', 'b');
  const dir = safe.ensureDomainDir('example-com', root);
  for (const p of [base, path.join(base, 'a'), root, dir]) assert.strictEqual(mode(p), 0o700, p);
});

test('CLI: --cache-dir . in a 0755 directory -> exit 2 (real and dry run), mode still 755, nothing created', () => {
  if (!POSIX) return;
  const cwd = freshDir();
  fs.mkdirSync(cwd);
  fs.chmodSync(cwd, 0o755);
  for (const extra of [[], ['--dry-run']]) {
    for (const script of [MONITOR, CRAWL]) {
      const args = script === MONITOR ? [...WITH_DATA, '--cache-dir', '.', ...extra] : ['--domain', 'example.com', '--cache-dir', '.', ...extra];
      const r = run(script, args, { cwd });
      assert.strictEqual(r.status, 2, `${path.basename(script)} ${extra.join(' ')}: exit ${r.status}\n${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /already exists and is accessible to group or others/);
      assert.match(r.stderr, /chmod 700/);
    }
  }
  assert.strictEqual(mode(cwd), 0o755);
  assert.deepStrictEqual(fs.readdirSync(cwd), []);
});

test('CLI: an old default cache with mode 0755 keeps working and is tightened to 0700', () => {
  if (!POSIX) return;
  const home = freshDir();
  const cache = path.join(home, '.cache', 'seo-rescue');
  fs.mkdirSync(cache, { recursive: true });
  fs.chmodSync(cache, 0o755);
  const r = run(MONITOR, WITH_DATA, { home });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(mode(cache), 0o700);
  assert.strictEqual(lines(path.join(cache, 'example-com', 'history.ndjson')).length, 1);
});

// ---------------------------------------------------------------------------
console.log('\nlib/safe.js — files: symlink, hard link, non-file');

test('appendNDJSON refuses a symlink and leaves its target alone', () => {
  if (!POSIX) return;
  const dir = freshDir();
  mkdirPrivate(dir);
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
  mkdirPrivate(dir);
  const foreign = path.join(dir, 'foreign.txt');
  fs.writeFileSync(foreign, 'keep\n');
  const hard = path.join(dir, 'history.ndjson');
  fs.linkSync(foreign, hard);
  assert.throws(() => safe.appendNDJSON(hard, { a: 1 }), /hard links/);
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), 'keep\n');
});

test('appendNDJSON still creates and appends to an ordinary file', () => {
  const dir = freshDir();
  mkdirPrivate(dir);
  const file = path.join(dir, 'history.ndjson');
  safe.appendNDJSON(file, { a: 1 });
  safe.appendNDJSON(file, { a: 2 });
  assert.deepStrictEqual(lines(file).map((l) => JSON.parse(l).a), [1, 2]);
  if (POSIX) assert.strictEqual(mode(file), 0o600);
});

test('atomicWriteJSON refuses a symlink target and a directory target', () => {
  if (!POSIX) return;
  const dir = freshDir();
  mkdirPrivate(dir);
  const foreign = path.join(dir, 'foreign.json');
  fs.writeFileSync(foreign, '{"keep":true}');
  const link = path.join(dir, 'issues.json');
  fs.symlinkSync(foreign, link);
  assert.throws(() => safe.atomicWriteJSON(link, { a: 1 }), /symlink/);
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), '{"keep":true}');
  const sub = path.join(dir, 'sub');
  mkdirPrivate(sub);
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
  mkdirPrivate(real);
  const link = freshDir();
  fs.symlinkSync(real, link);
  const r = run(MONITOR, [...WITH_DATA, '--cache-dir', link]);
  refused(r, null, /symlink/);
  assert.deepStrictEqual(fs.readdirSync(real), []);
});

test('--cache-dir below a symlinked parent exits 2, nothing behind the symlink', () => {
  if (!POSIX) return;
  const real = freshDir();
  mkdirPrivate(real);
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
  mkdirPrivate(dir);
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
  mkdirPrivate(dir);
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
  mkdirPrivate(root);
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
  mkdirPrivate(dir);
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
  mkdirPrivate(dir);
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
  mkdirPrivate(real);
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
  mkdirPrivate(dir);
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
  mkdirPrivate(dir);
  const other = path.join(sandbox, `other-issues-${n}.json`);
  fs.writeFileSync(other, '{"keep":true}');
  fs.linkSync(other, path.join(dir, 'issues.json'));
  I({ cacheDir: root, crawlerProvider: 'csv_import' });
  assert.strictEqual(fs.readFileSync(other, 'utf8'), '{"keep":true}');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'issues.json'), 'utf8')).summary.total_issues, 1);
});

// ---------------------------------------------------------------------------
console.log('\nfinal review round — FIFO and other non-files');

test('history.ndjson is a FIFO: exit 2 at once (no hang), no lock left, real and dry run', () => {
  if (!POSIX) return;
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  mkdirPrivate(dir);
  if (!mkfifo(path.join(dir, 'history.ndjson'))) return;
  const r = run(MONITOR, [...WITH_DATA, '--cache-dir', root]);
  assert.strictEqual(r.error, undefined, `run did not finish: ${r.error && r.error.message}`);
  refused(r, null, /not a regular file/);
  assert.deepStrictEqual(fs.readdirSync(dir), ['history.ndjson'], 'lock or other file left behind');
  const d = run(MONITOR, [...WITH_DATA, '--cache-dir', root, '--dry-run']);
  assert.strictEqual(d.error, undefined, 'dry run did not finish');
  assert.strictEqual(d.status, 0, d.stderr); // dry run only reads; an unreadable history counts as "no previous entry"
  assert.deepStrictEqual(fs.readdirSync(dir), ['history.ndjson']);
});

test('befund.json / issues.json as FIFO do not block a run', () => {
  if (!POSIX) return;
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  mkdirPrivate(dir);
  if (!mkfifo(path.join(dir, 'befund.json')) || !mkfifo(path.join(dir, 'issues.json'))) return;
  const r = run(MONITOR, [...WITH_DATA, '--cache-dir', root]);
  assert.strictEqual(r.error, undefined, 'run did not finish');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(lines(path.join(dir, 'history.ndjson')).length, 1);
});

test('.lock is a FIFO or a directory: exit 2 at once instead of a 30 s wait', () => {
  if (!POSIX) return;
  for (const kind of ['fifo', 'dir']) {
    const root = freshDir();
    const dir = path.join(root, 'example-com');
    mkdirPrivate(dir);
    const lock = path.join(dir, '.lock');
    if (kind === 'fifo') { if (!mkfifo(lock)) return; } else mkdirPrivate(lock);
    const started = Date.now();
    const r = run(MONITOR, [...WITH_DATA, '--cache-dir', root]);
    assert.strictEqual(r.error, undefined, `${kind}: run did not finish`);
    refused(r, null, /lock path is not a regular file/);
    assert.ok(Date.now() - started < 10000, `${kind}: took ${Date.now() - started} ms`);
    assert.deepStrictEqual(fs.readdirSync(dir), ['.lock']);
  }
});

test('writeIssuesJSON with issues.json as FIFO is refused without blocking (child process)', () => {
  if (!POSIX) return;
  const root = freshDir();
  const dir = path.join(root, 'example-com');
  mkdirPrivate(dir);
  if (!mkfifo(path.join(dir, 'issues.json'))) return;
  const code = `const c=require(${JSON.stringify(CRAWL)});try{c.writeIssuesJSON('example.com','example-com','example.com',1,[],[],[],{cacheDir:${JSON.stringify(root)},crawlerProvider:'csv_import'});process.exit(0)}catch(e){console.error(e.message);process.exit(/not a regular file/.test(e.message)?7:1)}`;
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', cwd: childCwd, env: { ...process.env, HOME: decoyHome } });
  assert.strictEqual(r.error, undefined, 'did not finish');
  assert.strictEqual(r.status, 7, r.stderr);
  assert.deepStrictEqual(fs.readdirSync(dir), ['issues.json']);
});

test('appendNDJSON refuses a FIFO and a directory before opening', () => {
  if (!POSIX) return;
  const dir = freshDir();
  mkdirPrivate(dir);
  const fifo = path.join(dir, 'f.ndjson');
  if (!mkfifo(fifo)) return;
  let opened = false;
  withPatched(fs, 'openSync', (...a) => { opened = true; throw new Error('openSync must not be reached'); }, () => {
    assert.throws(() => safe.appendNDJSON(fifo, { a: 1 }), /not a regular file/);
    assert.throws(() => safe.appendNDJSON(dir, { a: 1 }), /not a regular file/);
  });
  assert.strictEqual(opened, false);
});

test('safeLog skips a run.log that is a FIFO instead of blocking', () => {
  if (!POSIX) return;
  const dir = freshDir();
  mkdirPrivate(dir);
  if (!mkfifo(path.join(dir, 'run.log'))) return;
  safe.safeLog(dir, 'run-1', 'hello');
  const ok = freshDir();
  mkdirPrivate(ok);
  safe.safeLog(ok, 'run-1', 'hello');
  assert.match(fs.readFileSync(path.join(ok, 'run.log'), 'utf8'), /\[run-1\] hello/);
});

// ---------------------------------------------------------------------------
console.log('\nfinal review round — checks that a mutation must not survive');

test('appendNDJSON opens with O_NOFOLLOW and O_NONBLOCK', () => {
  if (!POSIX) return;
  const dir = freshDir();
  mkdirPrivate(dir);
  const file = path.join(dir, 'h.ndjson');
  const realOpen = fs.openSync;
  let flags = null;
  withPatched(fs, 'openSync', (p, f, m) => { if (p === file) flags = f; return realOpen(p, f, m); }, () => safe.appendNDJSON(file, { a: 1 }));
  assert.ok(Number.isInteger(flags), 'openSync was not called for the file');
  assert.ok((flags & fs.constants.O_NOFOLLOW) === fs.constants.O_NOFOLLOW && fs.constants.O_NOFOLLOW !== 0, 'O_NOFOLLOW missing');
  assert.ok((flags & fs.constants.O_NONBLOCK) === fs.constants.O_NONBLOCK, 'O_NONBLOCK missing');
  assert.ok((flags & fs.constants.O_APPEND) === fs.constants.O_APPEND, 'O_APPEND missing');
});

// Simulates the race: the name passes the lstat pre-check (here: lstat does not
// see it) and is a symlink / FIFO by the time it is opened.
const hideFromLstat = (hidden, fn) => {
  const realLstat = fs.lstatSync;
  return withPatched(fs, 'lstatSync', (p, ...rest) => {
    if (p === hidden) { const e = new Error('ENOENT (simulated)'); e.code = 'ENOENT'; throw e; }
    return realLstat(p, ...rest);
  }, fn);
};

test('symlink that appears after the pre-check is still not followed (O_NOFOLLOW)', () => {
  if (!POSIX) return;
  const dir = freshDir();
  mkdirPrivate(dir);
  const foreign = path.join(dir, 'foreign.txt');
  fs.writeFileSync(foreign, 'keep\n');
  const link = path.join(dir, 'history.ndjson');
  fs.symlinkSync(foreign, link);
  hideFromLstat(link, () => assert.throws(() => safe.appendNDJSON(link, { a: 1 }), /symlink/));
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), 'keep\n');
});

test('FIFO that appears after the pre-check does not block (O_NONBLOCK)', () => {
  if (!POSIX) return;
  const dir = freshDir();
  mkdirPrivate(dir);
  const fifo = path.join(dir, 'history.ndjson');
  if (!mkfifo(fifo)) return;
  const code = `const fs=require('fs');const safe=require(${JSON.stringify(path.join(__dirname, '..', '..', 'lib', 'safe.js'))});const real=fs.lstatSync;fs.lstatSync=(p,...r)=>{if(p===${JSON.stringify(fifo)}){const e=new Error('x');e.code='ENOENT';throw e}return real(p,...r)};try{safe.appendNDJSON(${JSON.stringify(fifo)},{a:1});process.exit(0)}catch(e){console.error(e.message);process.exit(/not a regular file/.test(e.message)?7:1)}`;
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', cwd: childCwd, env: { ...process.env, HOME: decoyHome } });
  assert.strictEqual(r.error, undefined, 'blocked on the FIFO');
  assert.strictEqual(r.status, 7, r.stderr);
});

test('hard link that appears after the pre-check is caught by fstat on the open file', () => {
  if (!POSIX) return;
  const dir = freshDir();
  mkdirPrivate(dir);
  const foreign = path.join(dir, 'foreign.txt');
  fs.writeFileSync(foreign, 'keep\n');
  const hard = path.join(dir, 'history.ndjson');
  fs.linkSync(foreign, hard);
  hideFromLstat(hard, () => assert.throws(() => safe.appendNDJSON(hard, { a: 1 }), /hard links/));
  assert.strictEqual(fs.readFileSync(foreign, 'utf8'), 'keep\n');
});

test('ownership: a cache dir, a domain dir, a history file and an issues file of another user are refused', () => {
  if (!POSIX || typeof process.getuid !== 'function') return;
  const realUid = process.getuid();
  const root = freshDir();
  const dir = safe.ensureDomainDir('example-com', root);
  const history = path.join(dir, 'history.ndjson');
  const issues = path.join(dir, 'issues.json');
  fs.writeFileSync(history, '{"keep":true}\n', { mode: 0o600 });
  fs.writeFileSync(issues, '{"keep":true}', { mode: 0o600 });
  const saved = process.env.SEO_CACHE_DIR;
  withPatched(process, 'getuid', () => realUid + 1, () => {
    assert.throws(() => safe.getCacheDir(root), /not owned by the current user/);
    assert.throws(() => safe.ensureDomainDir('example-com', root), /not owned by the current user/);
    assert.throws(() => safe.resolveDomainDir('example-com', root), /not owned by the current user/);
    process.env.SEO_CACHE_DIR = root;
    try {
      assert.throws(() => safe.getCacheDir(), /not owned by the current user/);
    } finally {
      process.env.SEO_CACHE_DIR = saved;
    }
    assert.throws(() => safe.appendNDJSON(history, { a: 1 }), /not owned by the current user/);
    assert.throws(() => safe.atomicWriteJSON(issues, { a: 1 }), /not owned by the current user/);
  });
  assert.strictEqual(fs.readFileSync(history, 'utf8'), '{"keep":true}\n');
  assert.strictEqual(fs.readFileSync(issues, 'utf8'), '{"keep":true}');
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['history.ndjson', 'issues.json']);
});

test('a failing chmod aborts instead of being swallowed', () => {
  if (!POSIX) return;
  const root = freshDir();
  fs.mkdirSync(root);
  fs.chmodSync(root, 0o755);
  const saved = process.env.SEO_CACHE_DIR;
  process.env.SEO_CACHE_DIR = root;
  try {
    withPatched(fs, 'chmodSync', () => { const e = new Error('EPERM (simulated chmod failure)'); e.code = 'EPERM'; throw e; }, () => {
      assert.throws(() => safe.getCacheDir(), /simulated chmod failure/);
      assert.throws(() => safe.ensureDomainDir('example-com'), /simulated chmod failure/);
    });
    assert.strictEqual(mode(root), 0o755);
    assert.deepStrictEqual(fs.readdirSync(root), []);
  } finally {
    process.env.SEO_CACHE_DIR = saved;
    fs.chmodSync(root, 0o700);
  }
});

test('dry run: a symlink as domain dir is refused (resolveDomainDir and both CLIs)', () => {
  if (!POSIX) return;
  const root = freshDir();
  const elsewhere = freshDir();
  mkdirPrivate(root);
  mkdirPrivate(elsewhere);
  fs.symlinkSync(elsewhere, path.join(root, 'example-com'));
  assert.throws(() => safe.resolveDomainDir('example-com', root), /must not be a symlink/);
  refused(run(MONITOR, [...WITH_DATA, '--cache-dir', root, '--dry-run']), null, /must not be a symlink/);
  refused(run(CRAWL, ['--domain', 'example.com', '--cache-dir', root, '--dry-run']), null, /must not be a symlink/);
  assert.deepStrictEqual(fs.readdirSync(elsewhere), []);
});

// ---------------------------------------------------------------------------
console.log('\nfinal review round — arguments, dry run = real run, no empty entries');

for (const form of ['--cache-dir=--dry-run', '--cache-dir=-x', '--cache-dir=--', '--domain=--dry-run', '--domain=-example.com']) {
  test(`${form} is refused (exit 2), no directory created`, () => {
    refused(run(MONITOR, ['--vi', '1', ...(form.startsWith('--domain') ? [] : ['--domain', 'example.com']), form]), null, /looks like an option/);
    refused(run(CRAWL, [...(form.startsWith('--domain') ? [] : ['--domain', 'example.com']), form]), null, /looks like an option/);
  });
}

test('parseStrictCli refuses a value that starts with "-" and accepts "./-name"', () => {
  usageError(['--cache-dir=--dry-run'], /looks like an option/);
  usageError(['--cache-dir=-rf'], /looks like an option/);
  usageError(['--domain=--help'], /looks like an option/);
  assert.deepStrictEqual(safe.parseStrictCli(SPEC, ['--cache-dir=./-name']), { 'cache-dir': './-name' });
});

test('--cache-dir <file>/sub: real run and dry run both exit 2 with the same clear message', () => {
  const file = freshDir();
  fs.writeFileSync(file, 'x');
  for (const [script, base] of [[MONITOR, WITH_DATA], [CRAWL, ['--domain', 'example.com']]]) {
    const target = path.join(file, 'sub');
    sameOutcome(run(script, [...base, '--cache-dir', target]), run(script, [...base, '--cache-dir', target, '--dry-run']), /is not a directory, so .* cannot be created/);
  }
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'x');
});

test('--cache-dir <file>: real run and dry run both exit 2 with the same clear message (no raw EEXIST)', () => {
  const file = freshDir();
  fs.writeFileSync(file, 'x');
  for (const [script, base] of [[MONITOR, WITH_DATA], [CRAWL, ['--domain', 'example.com']]]) {
    const a = run(script, [...base, '--cache-dir', file]);
    sameOutcome(a, run(script, [...base, '--cache-dir', file, '--dry-run']), /cache dir is not a directory/);
    assert.doesNotMatch(a.stderr, /EEXIST|ENOTDIR/);
  }
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'x');
});

test('a file where the domain dir belongs: real run and dry run both exit 2', () => {
  const root = freshDir();
  mkdirPrivate(root);
  fs.writeFileSync(path.join(root, 'example-com'), 'x');
  for (const [script, base] of [[MONITOR, WITH_DATA], [CRAWL, ['--domain', 'example.com']]]) {
    sameOutcome(run(script, [...base, '--cache-dir', root]), run(script, [...base, '--cache-dir', root, '--dry-run']), /not a directory/);
  }
  assert.strictEqual(fs.readFileSync(path.join(root, 'example-com'), 'utf8'), 'x');
});

test('writeMonitorEntry without any measurement appends nothing and creates nothing', () => {
  const root = freshDir();
  const res = monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', null, null, [], [], { cacheDir: root });
  assert.strictEqual(res.written, false);
  assert.strictEqual(res.skippedReason, 'no_measurement');
  assert.strictEqual(fs.existsSync(root), false);
  const u = monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', undefined, undefined, ['Sistrix nicht erreichbar'], [], { cacheDir: root, runId: 'r1', providersUsed: [] });
  assert.strictEqual(u.written, false);
  assert.strictEqual(fs.existsSync(root), false);
});

test('writeMonitorEntry without measurement leaves an existing history untouched', () => {
  const root = freshDir();
  const first = W(0.5, 7, { cacheDir: root });
  const before = fs.readFileSync(first.historyPath, 'utf8');
  const res = monitor.writeMonitorEntry('example.com', 'example.com', 'example-com', null, null, [], [], { cacheDir: root });
  assert.strictEqual(res.written, false);
  assert.strictEqual(fs.readFileSync(first.historyPath, 'utf8'), before);
  assert.strictEqual(fs.existsSync(path.join(root, 'example-com', '.lock')), false);
});

test('one measurement is enough to write (vi only, keywords only, an option only)', () => {
  for (const [vi, t10, o] of [[0.5, null, {}], [null, 7, {}], [null, null, { keywordsTotal: 900 }], [null, null, { viTrend4wPct: -3 }], [null, null, { backlinkSpamScore: 2 }]]) {
    const root = freshDir();
    const res = W(vi, t10, { cacheDir: root, ...o });
    assert.strictEqual(res.written, true, JSON.stringify([vi, t10, o]));
    assert.strictEqual(res.skippedReason, null);
    assert.strictEqual(lines(res.historyPath).length, 1);
  }
});

test('writeIssuesJSON: crawlLimit / exportedRowsTotal must be whole numbers, nothing written otherwise', () => {
  const bad = [
    { crawlLimit: Infinity }, { crawlLimit: NaN }, { crawlLimit: -1 }, { crawlLimit: 0 }, { crawlLimit: 1.5 }, { crawlLimit: '500' },
    { exportedRowsTotal: Infinity }, { exportedRowsTotal: NaN }, { exportedRowsTotal: -1 }, { exportedRowsTotal: 2.5 }, { exportedRowsTotal: '9' },
  ];
  for (const o of bad) {
    const root = freshDir();
    assert.throws(() => I({ cacheDir: root, crawlerProvider: 'csv_import', ...o }), /Invalid value for options\./, `${JSON.stringify(o)} accepted`);
    assert.strictEqual(fs.existsSync(root), false);
  }
  // the message names the real value, not JSON's "null" for Infinity/NaN
  assert.throws(() => I({ cacheDir: freshDir(), crawlerProvider: 'csv_import', crawlLimit: Infinity }), /crawlLimit: Infinity /);
  assert.throws(() => W(NaN, 7, { cacheDir: freshDir() }), /Invalid value for vi: NaN /);
  const root = freshDir();
  const out = I({ cacheDir: root, crawlerProvider: 'csv_import', crawlLimit: 250, exportedRowsTotal: 0 });
  assert.strictEqual(out.crawl_limit, 250);
  assert.strictEqual(out.exported_rows_total, 0);
  const written = JSON.parse(fs.readFileSync(path.join(root, 'example-com', 'issues.json'), 'utf8'));
  assert.strictEqual(written.crawl_limit, 250);
});

test('classifyIssues: an issue type named like an Object.prototype key gets the default severity', () => {
  for (const type of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    const [res] = crawl.classifyIssues([{ type, count: 1, details: [] }]);
    assert.strictEqual(res.severity, 'medium', type);
  }
  assert.strictEqual(crawl.classifyIssues([{ type: 'missing_h1', count: 1 }])[0].severity, 'medium');
  assert.strictEqual(crawl.classifyIssues([{ type: 'broken_internal_link', count: 1, details: [{ inlink_count: 500 }] }])[0].severity, 'critical');
});

fs.rmSync(sandbox, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
