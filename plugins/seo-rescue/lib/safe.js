'use strict';
// Shared safety helpers for all seo-rescue scripts.
//
// - safeSlug(s): hard-validates a config slug to a strict alnum/dash/underscore set.
//   Throws if invalid. Use at config-load time on every target.slug.
// - safeReadFile(p, maxBytes): size-capped readFileSync. Refuses to read files
//   larger than maxBytes (default 10 MB). Defense against /tmp poisoning + DoS.
// - mkRunDir(): per-run isolated tmp dir via mkdtempSync. Replaces the predictable
//   /tmp/seo-*.json convention so other local processes cannot pre-create symlinks
//   that the script would clobber on writeFileSync.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const LABEL_MAX = 200;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const STALE_LOCK_TTL_MS = 10 * 60 * 1000;

function safeSlug(s) {
  if (typeof s !== 'string' || !SLUG_RE.test(s)) {
    throw new Error(`Unsafe slug rejected: ${JSON.stringify(s)} (must match ${SLUG_RE})`);
  }
  return s;
}

// Validates a bare hostname (no protocol, no path). For full URLs use safeUrl.
function safeHostname(s) {
  if (typeof s !== 'string' || !HOSTNAME_RE.test(s)) {
    throw new Error(`Unsafe hostname rejected: ${JSON.stringify(s)} (must match ${HOSTNAME_RE})`);
  }
  return s;
}

// Validates a full URL. Requires http/https. Blocks SSRF targets:
// loopback (127.0.0.0/8, localhost, 0.0.0.0), private RFC1918 ranges
// (10/8, 172.16/12, 192.168/16), link-local (169.254/16 — includes
// cloud-metadata 169.254.169.254), .local mDNS, and bare IPv6 loopback.
function safeUrl(s) {
  if (typeof s !== 'string') throw new Error(`Unsafe URL rejected (not a string): ${JSON.stringify(s)}`);
  let u;
  try { u = new URL(s); } catch { throw new Error(`Unsafe URL rejected (parse failed): ${JSON.stringify(s)}`); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`Unsafe URL rejected (protocol must be http/https): ${JSON.stringify(s)}`);
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host.endsWith('.local')
  ) {
    throw new Error(`Unsafe URL rejected (private/loopback host blocked): ${JSON.stringify(s)}`);
  }
  return s;
}

// Validates a short free-text label. String + length cap. Used for fields that
// appear in PDF cover text and HTML; the report-side escaping (esc()) already
// handles HTML injection, so this is a length-DoS / sanity check only.
function safeLabel(s) {
  if (typeof s !== 'string') throw new Error(`Unsafe label rejected (not a string): ${JSON.stringify(s)}`);
  if (s.length > LABEL_MAX) throw new Error(`Unsafe label rejected (too long, max ${LABEL_MAX} chars): ${s.length}`);
  return s;
}

function validateConfigTargets(targets) {
  if (!Array.isArray(targets)) throw new Error('config.targets must be an array');
  for (const t of targets) {
    if (!t || typeof t !== 'object') throw new Error('config.targets[*] must be an object');
    safeSlug(t.slug);
    if (t.domain !== undefined) safeHostname(t.domain);
    if (t.host !== undefined) safeUrl(t.host);
    if (t.label !== undefined) safeLabel(t.label);
  }
  return targets;
}

function safeReadFile(p, maxBytes = DEFAULT_MAX_BYTES) {
  const st = fs.statSync(p);
  if (!st.isFile()) throw new Error(`safeReadFile: not a regular file: ${p}`);
  if (st.size > maxBytes) {
    throw new Error(`safeReadFile: ${p} exceeds size cap (${st.size} > ${maxBytes} bytes)`);
  }
  return fs.readFileSync(p, 'utf8');
}

// Creates an isolated tmp dir owned by this process. Returns absolute path.
// Caller is responsible for cleanup (rmSync recursive) on exit.
function mkRunDir(prefix = 'seo-rescue-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Per-user cache dir for inter-script state (raw.json, summary.json, onpage.json,
// home.html). Replaces world-writable /tmp/. Created with 0700 perms; refused if
// the path is a symlink (defeats symlink-mounted-dir attacks).
// Override via SEO_CACHE_DIR env var; default ~/.cache/seo-rescue/.
//
// CROSS-PLATFORM NOTE — Windows: fs.chmodSync is a no-op on NTFS (Node ignores
// the mode argument because POSIX mode bits don't map to ACLs). The mode 0o700
// passed to mkdirSync + the try/chmodSync are kept for macOS/Linux. On Windows,
// the cache dir inherits its parent's ACL; if you run on a shared box, set
// ACLs manually on $env:LOCALAPPDATA\seo-rescue\cache to your user only — see
// ONBOARDING.md "Cross-platform env vars for the pipeline scripts" for the
// PowerShell snippet that does this for .env files (same pattern applies here).
//
// `overrideDir` (optional) is an explicit cache root, e.g. from a script's
// --cache-dir option. It takes precedence over SEO_CACHE_DIR. Because the
// caller can point it anywhere, it is checked more strictly than the default:
// no component of the path may be a symlink (see assertNoSymlinkInPath).
//
// For every cache dir (default, SEO_CACHE_DIR, explicit): the final component
// must be a real directory owned by the current user, and a failing chmod
// aborts instead of being swallowed. Existing stricter permissions (e.g. 0500)
// are left alone. What happens to a directory that is open to group or others
// depends on whose directory it is:
//   - default path / SEO_CACHE_DIR, and directories this library just created:
//     the group/other bits are removed (setuid/setgid/sticky bits are kept);
//   - an EXISTING directory named by an explicit --cache-dir (or the domain
//     dir inside it): refused, never changed. `--cache-dir .` or
//     `--cache-dir "$HOME"` must not silently take away other users' access
//     to a directory that was never meant to be a cache.
//
// KNOWN LIMIT: check and use are separate system calls (Node has no openat).
// This stops accidental and pre-planted symlinks. It does not stop a process
// running as the same user that swaps directories while a script runs.
function validateExplicitCacheDir(overrideDir) {
  if (typeof overrideDir !== 'string' || overrideDir.trim() === '' || overrideDir.includes('\0')) {
    throw new Error(`Unsafe cache dir rejected: ${JSON.stringify(overrideDir)}`);
  }
  return path.resolve(overrideDir);
}

// Deepest existing ancestor of `dir` (may be `dir` itself).
function deepestExisting(dir) {
  let existing = dir;
  while (!safeLstat(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  return existing;
}

// Rejects `dir` if any component of it is a symlink. Works for paths that do
// not exist yet: the deepest existing ancestor is resolved with realpath and
// must be identical to itself. `dir` must be absolute and normalized.
function assertNoSymlinkInPath(dir) {
  const existing = deepestExisting(dir);
  const real = fs.realpathSync(existing);
  if (real !== existing) {
    const hint = path.join(real, path.relative(existing, dir));
    throw new Error(`Unsafe cache dir rejected: a symlink is part of the path ${dir} (${existing} resolves to ${real}). Pass the resolved path instead: ${hint}`);
  }
}

// Rejects `dir` if it, or the deepest ancestor of it that exists, is something
// other than a directory (a file, a FIFO, …). Without this, a dry run would
// accept `<file>/sub` while the real run fails in mkdir with a raw ENOTDIR.
function assertPathUsableAsDir(dir, label) {
  const existing = deepestExisting(dir);
  const st = fs.statSync(existing);
  if (!st.isDirectory()) {
    throw new Error(existing === dir
      ? `Unsafe cache dir rejected: ${label} is not a directory: ${dir}`
      : `Unsafe cache dir rejected: ${existing} is not a directory, so ${dir} cannot be created`);
  }
}

// Final-component checks shared by the cache root and the per-domain dir.
// `refuseIfOpen`: the directory existed before this call AND was named through
// an explicit cache dir — then group/other access is a reason to refuse, not
// something to change (see the comment block above).
function hardenOwnDir(dir, label, refuseIfOpen = false) {
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink()) {
    throw new Error(`${label} must not be a symlink: ${dir}`);
  }
  if (!st.isDirectory()) {
    throw new Error(`${label} is not a directory: ${dir}`);
  }
  if (process.platform === 'win32') return; // no POSIX owner/mode on NTFS (see note above)
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
    throw new Error(`${label} is not owned by the current user: ${dir}`);
  }
  if ((st.mode & 0o077) === 0) return; // already private (possibly stricter than 0700): leave it
  if (refuseIfOpen) {
    throw new Error(`Unsafe cache dir rejected: ${dir} already exists and is accessible to group or others (mode ${(st.mode & 0o777).toString(8).padStart(3, '0')}). It was not changed. Use a new directory of its own for the cache, or, if this directory really is meant to be the cache, run: chmod 700 ${JSON.stringify(dir)}`);
  }
  // Only ever remove bits: drop group/other access, keep the owner bits and
  // any setuid/setgid/sticky bit as they are.
  fs.chmodSync(dir, (st.mode & 0o7777) & ~0o077);
}

function getCacheDir(overrideDir) {
  let dir;
  const explicit = overrideDir != null;
  if (explicit) {
    dir = validateExplicitCacheDir(overrideDir);
    assertNoSymlinkInPath(dir);
  } else {
    dir = process.env.SEO_CACHE_DIR || path.join(os.homedir(), '.cache', 'seo-rescue');
  }
  // Check before mkdir as well: mkdirSync({recursive}) on an existing symlink
  // succeeds silently, and chmodSync would then follow it.
  const pre = safeLstat(dir);
  if (pre && pre.isSymbolicLink()) {
    throw new Error(`Cache dir must not be a symlink: ${dir}`);
  }
  assertPathUsableAsDir(path.resolve(dir), 'cache dir');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  hardenOwnDir(dir, 'Cache dir', explicit && !!pre);
  if (explicit) assertNoSymlinkInPath(dir);
  return dir;
}

// Build a cache-dir-relative file path for a given slug + suffix.
// Validates the slug, throws on path-traversal attempts.
function cachePath(slug, suffix) {
  safeSlug(slug);
  if (typeof suffix !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(suffix)) {
    throw new Error(`Unsafe suffix rejected: ${JSON.stringify(suffix)}`);
  }
  return path.join(getCacheDir(), `${slug}${suffix}`);
}

// Open file for exclusive write — fails if path exists (defeats symlink-clobber).
// Use this whenever you write to a path that could pre-exist as an attacker symlink.
function writeFileExclusive(p, data) {
  const fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { fs.writeFileSync(fd, data); } finally { fs.closeSync(fd); }
}

// Normalizes domain input for recovery commands. Accepts bare hostnames, URLs
// with http/https, and paths/queries (stripped). www. is NOT stripped —
// www.example.com and example.com are treated as distinct domains.
// Returns { input_domain, domain, canonical_domain, slug }.
//
// KNOWN LIMIT: the slug replaces dots by hyphens, so two different hostnames
// can share one slug and therefore one cache directory: `a-b.com` and `a.b.com`
// both give `a-b-com`. Not changed on purpose — a different slug scheme would
// orphan every existing cache. If you track two such domains, give each its
// own cache root (SEO_CACHE_DIR or --cache-dir).
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

// `cacheDir` (optional) is an explicit cache root (see getCacheDir). Without it
// the root is SEO_CACHE_DIR or ~/.cache/seo-rescue/.
function ensureDomainDir(slug, cacheDir) {
  safeSlug(slug);
  const dir = path.join(getCacheDir(cacheDir), slug);
  const pre = safeLstat(dir);
  if (pre && pre.isSymbolicLink()) {
    throw new Error(`Domain cache dir must not be a symlink: ${dir}`);
  }
  if (pre && !pre.isDirectory()) {
    throw new Error(`Unsafe cache dir rejected: domain cache dir is not a directory: ${dir}`);
  }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  hardenOwnDir(dir, 'Domain cache dir', cacheDir != null && !!pre);
  return dir;
}

// Read-only counterpart of ensureDomainDir for dry runs: returns the path the
// domain dir WOULD have, creates and changes nothing, and applies the same
// symlink refusals (for an explicit cache dir: anywhere in the path).
function resolveDomainDir(slug, cacheDir) {
  safeSlug(slug);
  let root;
  if (cacheDir != null) {
    root = validateExplicitCacheDir(cacheDir);
    assertNoSymlinkInPath(root);
  } else {
    root = process.env.SEO_CACHE_DIR || path.join(os.homedir(), '.cache', 'seo-rescue');
  }
  const dir = path.join(root, slug);
  for (const p of [root, dir]) {
    const st = safeLstat(p);
    if (st && st.isSymbolicLink()) throw new Error(`Cache dir must not be a symlink: ${p}`);
  }
  // Same refusals as the real run, without creating or changing anything:
  // nothing in the path may be a non-directory, and an existing directory named
  // through an explicit cache dir must be the user's own and private.
  assertPathUsableAsDir(path.resolve(root), 'cache dir');
  assertPathUsableAsDir(path.resolve(dir), 'domain cache dir');
  if (process.platform !== 'win32') {
    for (const p of [root, dir]) {
      const st = safeLstat(p);
      if (!st) continue;
      if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
        throw new Error(`Cache dir is not owned by the current user: ${p}`);
      }
      if (cacheDir != null && (st.mode & 0o077) !== 0) {
        throw new Error(`Unsafe cache dir rejected: ${p} already exists and is accessible to group or others (mode ${(st.mode & 0o777).toString(8).padStart(3, '0')}). It was not changed. Use a new directory of its own for the cache, or, if this directory really is meant to be the cache, run: chmod 700 ${JSON.stringify(p)}`);
      }
    }
  }
  return dir;
}

const ensureSafeDomainDir = ensureDomainDir;

function safeLstat(p) {
  try { return fs.lstatSync(p); } catch { return null; }
}

function acquireLock(domainDir, command = 'unknown', timeoutMs = 30000) {
  const lockPath = path.join(domainDir, '.lock');
  const token = Math.random().toString(36).slice(2, 10);
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      const lockData = JSON.stringify({ pid: process.pid, timestamp: new Date().toISOString(), command, token });
      fs.writeFileSync(fd, lockData);
      fs.closeSync(fd);
      return { path: lockPath, token };
    } catch (e) {
      if (e.code === 'EEXIST') {
        // Something that is not a plain file sits where the lock belongs (FIFO,
        // directory, symlink): it can never be released by a running command,
        // so waiting 30 s for it helps nobody. Refuse at once, change nothing.
        const lst = safeLstat(lockPath);
        if (lst && !lst.isFile()) {
          throw new Error(`acquireLock: lock path is not a regular file: ${lockPath}`);
        }
        // Check for stale lock
        try {
          const st = fs.statSync(lockPath);
          if (Date.now() - st.mtimeMs > STALE_LOCK_TTL_MS) {
            fs.unlinkSync(lockPath);
            continue;
          }
        } catch {}
        if (Date.now() >= deadline) {
          throw new Error(`acquireLock: timeout after ${timeoutMs}ms — another command may be running for this domain. Lock: ${lockPath}`);
        }
        // Synchronous ~100ms back-off without spawning a shell/process.
        // (CLAUDE.md security model: never execSync a string; also portable + Windows-safe.)
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        continue;
      }
      throw e;
    }
  }
}

function releaseLock(lock) {
  if (!lock || !lock.path) return;
  try {
    const content = fs.readFileSync(lock.path, 'utf8');
    const data = JSON.parse(content);
    if (data.token === lock.token) {
      fs.unlinkSync(lock.path);
    }
  } catch {
    // Lock file may already be removed
  }
}

// A file this library is about to replace or append to must be a regular file,
// owned by the current user. `requireSingleLink` additionally refuses a file
// with more than one hard link (writing through it would change a file that
// also lives under another name).
function assertOwnRegularFile(st, filePath, fn, requireSingleLink) {
  if (st.isSymbolicLink()) throw new Error(`${fn}: target is a symlink: ${filePath}`);
  if (!st.isFile()) throw new Error(`${fn}: target is not a regular file: ${filePath}`);
  if (process.platform === 'win32') return;
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
    throw new Error(`${fn}: target is not owned by the current user: ${filePath}`);
  }
  if (requireSingleLink && st.nlink !== 1) {
    throw new Error(`${fn}: target has ${st.nlink} hard links, refusing to write through it: ${filePath}`);
  }
}

function atomicWriteJSON(filePath, data) {
  const st = safeLstat(filePath);
  // An existing target is replaced by rename, not written through, so a second
  // hard link is harmless here. A symlink, a non-file or a foreign file is not.
  if (st) assertOwnRegularFile(st, filePath, 'atomicWriteJSON', false);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = JSON.stringify(data, null, 2) + '\n';
  // Write the temp file with O_EXCL so a pre-existing symlink at tmpPath aborts
  // the write instead of being followed (parity with writeFileExclusive/appendNDJSON).
  writeFileExclusive(tmpPath, json);
  fs.renameSync(tmpPath, filePath);
}

// Appends one line to a file this library owns. Order matters:
//   1. lstat BEFORE opening: an existing target must be a regular file, ours,
//      with one link. This is what keeps a FIFO from being opened at all —
//      open(O_WRONLY) on a FIFO without a reader blocks forever, with the
//      domain lock held.
//   2. open with O_NOFOLLOW: if the path was swapped for a symlink after
//      step 1, open fails (ELOOP) instead of following it. O_NONBLOCK: if it
//      was swapped for a FIFO, open fails (ENXIO) instead of blocking.
//   3. fstat the descriptor: the file actually opened must pass the same
//      checks as in step 1. Nothing is written before that.
function appendLineSafely(filePath, line, fn) {
  const st = safeLstat(filePath);
  if (st) assertOwnRegularFile(st, filePath, fn, true);
  const flags = fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY
    | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0);
  let fd;
  try {
    fd = fs.openSync(filePath, flags, 0o600);
  } catch (e) {
    if (e.code === 'ELOOP') throw new Error(`${fn}: target is a symlink: ${filePath}`);
    if (e.code === 'ENXIO') throw new Error(`${fn}: target is not a regular file: ${filePath}`);
    throw e;
  }
  try {
    assertOwnRegularFile(fs.fstatSync(fd), filePath, fn, true);
    fs.writeFileSync(fd, line);
  } finally {
    fs.closeSync(fd);
  }
}

function appendNDJSON(filePath, entry) {
  appendLineSafely(filePath, JSON.stringify(entry) + '\n', 'appendNDJSON');
}

// Strict command-line parsing for scripts that write files. Anything that is
// not unambiguous is an error, never a silent default — a mistyped or malformed
// safety switch must not turn into a real write:
//   --dryrun                 unknown option            -> error
//   --dry-run=true / =false  value on a switch          -> error
//   --cache-dir              option without its value   -> error
//   --cache-dir --dry-run    value looks like an option -> error
//   --cache-dir=             empty value                -> error
//   --cache-dir=--dry-run    value looks like an option -> error
//   --vi 1 --vi 2            option given twice         -> error
//   stray positional argument                           -> error
// `spec` maps option name -> 'string' | 'boolean'. Returns { name: value } with
// only the options that were given. Errors carry code 'USAGE'; callers print
// the message and exit 2 before touching the file system.
function parseStrictCli(spec, argv = process.argv.slice(2)) {
  const options = {};
  for (const [name, type] of Object.entries(spec)) {
    if (type !== 'string' && type !== 'boolean') throw new Error(`parseStrictCli: bad type for --${name}`);
    options[name] = { type, multiple: true };
  }
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options, strict: true, allowPositionals: false }));
  } catch (e) {
    const err = new Error(`Invalid arguments: ${e.message}`);
    err.code = 'USAGE';
    throw err;
  }
  const usage = (msg) => { const err = new Error(`Invalid arguments: ${msg}`); err.code = 'USAGE'; return err; };
  const out = {};
  for (const [name, list] of Object.entries(values)) {
    if (!Object.prototype.hasOwnProperty.call(spec, name)) continue;
    if (list.length > 1) throw usage(`--${name} was given ${list.length} times`);
    const v = list[0];
    if (spec[name] === 'string' && (typeof v !== 'string' || v.trim() === '')) {
      throw usage(`--${name} needs a non-empty value`);
    }
    // `--cache-dir=--dry-run` is the same slip as `--cache-dir --dry-run`, just
    // in a form the parser accepts. A value that looks like an option is
    // refused for every option; a path that really starts with "-" can be
    // written as "./-name".
    if (spec[name] === 'string' && v.trim().startsWith('-')) {
      throw usage(`--${name} got ${JSON.stringify(v)}, which looks like an option, not a value`);
    }
    if (spec[name] === 'boolean' && v !== true) throw usage(`--${name} takes no value`);
    out[name] = v;
  }
  return out;
}

function generateRunId() {
  const now = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${date}-${time}-${rand}`;
}

function safeReadJSON(filePath) {
  const content = safeReadFile(filePath);
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`safeReadJSON: invalid JSON in ${filePath}: ${e.message}`);
  }
}

function safeReadLatestImport(dir, patterns) {
  if (!fs.existsSync(dir)) return null;
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink()) throw new Error(`safeReadLatestImport: dir is a symlink: ${dir}`);
  let newest = null;
  let newestMtime = 0;
  for (const pattern of patterns) {
    const files = fs.readdirSync(dir).filter(f => {
      if (pattern instanceof RegExp) return pattern.test(f);
      return f === pattern || f.endsWith(pattern);
    });
    for (const f of files) {
      const fp = path.join(dir, f);
      const fst = fs.statSync(fp);
      if (fst.isFile() && fst.mtimeMs > newestMtime) {
        newest = fp;
        newestMtime = fst.mtimeMs;
      }
    }
  }
  return newest;
}

const SECRET_ENV_KEYS = ['SISTRIX_API_KEY', 'DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD', 'GOOGLE_API_KEY'];

function maskSecrets(value) {
  if (typeof value !== 'string') return String(value);
  let masked = value;
  for (const key of SECRET_ENV_KEYS) {
    const val = process.env[key];
    if (val && val.length > 4) {
      masked = masked.split(val).join(`${key}=***${val.slice(-4)}`);
    }
  }
  return masked;
}

function safeLog(domainDir, runId, message) {
  const logPath = path.join(domainDir, 'run.log');
  const st = safeLstat(logPath);
  // Logging is best effort: a log path that is a symlink, a FIFO, a directory,
  // hard-linked or foreign is skipped silently, never opened.
  if (st && (st.isSymbolicLink() || !st.isFile())) return;
  const line = `[${new Date().toISOString()}] [${runId}] ${maskSecrets(message)}\n`;
  try {
    appendLineSafely(logPath, line, 'safeLog');
  } catch (e) {
    if (/safeLog:/.test(String(e && e.message))) return;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// SEO Change Governor primitives (v1.1.0)
// See references/SEO_CHANGE_GOVERNOR.md, SEO_CHANGE_HISTORY.md, SAFE_LIVE_CHANGE_RULES.md
// ---------------------------------------------------------------------------

const CHANGE_HISTORY_SCHEMA_VERSION = '1.1.0';

// Validation elements for approval text
const APPROVAL_ELEMENTS = ['number', 'type', 'risk_points', 'urls', 'plan_reference', 'permission'];

// Broad batch trigger phrases (full Hard Stop)
const BROAD_APPROVAL_TRIGGERS = [
  'alles', 'mach', 'weiter', 'ja', 'alless',
  'passt', 'ok', 'go', 'mach den rest',
  'alles fixen', 'alles patchen', 'mach du alles',
  'ja alles', 'los gehts',
];

// appendChangeHistory(slug, entry) — appends a change-log entry to NDJSON.
// Validates required fields per change-log-entry.schema.json v1.1.0.
// Returns the timestamp written.
function appendChangeHistory(slug, entry) {
  safeSlug(slug);
  if (!entry || typeof entry !== 'object') {
    throw new Error('appendChangeHistory: entry must be an object');
  }
  const required = ['run_id', 'change_id', 'domain', 'actor', 'mode',
    'change_type', 'change_category', 'entity_system', 'url',
    'risk_points_final', 'confidence', 'decision'];
  for (const f of required) {
    if (entry[f] === undefined || entry[f] === null) {
      throw new Error(`appendChangeHistory: missing required field "${f}"`);
    }
  }
  const enriched = {
    schema_version: CHANGE_HISTORY_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const dir = ensureSafeDomainDir(slug);
  const filePath = path.join(dir, 'change-history.ndjson');
  appendNDJSON(filePath, enriched);
  return enriched.timestamp;
}

// validateApproval(approvalText, planContext) — validates if user approval is specific
// enough to authorize the planned changes. Returns { is_valid, matched_elements,
// missing_elements, reason }. Pattern-based: looks for plan-referencing elements.
function validateApproval(approvalText, planContext) {
  if (typeof approvalText !== 'string') {
    return { is_valid: false, matched_elements: [], missing_elements: APPROVAL_ELEMENTS,
      reason: 'approval_text must be a string' };
  }
  const normalized = approvalText.trim().toLowerCase();

  // Hard Stop: broad batch triggers
  for (const trigger of BROAD_APPROVAL_TRIGGERS) {
    if (normalized === trigger || normalized === `"${trigger}"`) {
      return { is_valid: false, matched_elements: [], missing_elements: APPROVAL_ELEMENTS,
        reason: 'Broad batch trigger phrase; explicit plan reference required' };
    }
  }

  const matched = [];
  // number: digit or German number word with quantifier
  if (/\b(\d+|ein(e[nr]?)?|eine?|zwei|drei|vier|fuenf|fünf|sechs|sieben|acht|neun|zehn)\b/.test(normalized)) {
    matched.push('number');
  }
  // type: change types mentioned
  if (/\b(redirect|anchor|fix|deaktiv|katego|canonical|link|patch|backlink|micro|cms|h1)/i.test(normalized)) {
    matched.push('type');
  }
  // risk_points / risk reference
  if (/\b(punkt|risk|risiko|budget|risikopunkt)/i.test(normalized)) {
    matched.push('risk_points');
  }
  // urls / cluster reference
  if (/\b(url|seite|page|cluster|kategorie|category|blog\/)/i.test(normalized) || /\/[a-z0-9-]+/i.test(normalized)) {
    matched.push('urls');
  }
  // plan reference
  if (/\b(plan|change plan|diesen|dieser|diese|genau|jetzt|hier)/i.test(normalized)) {
    matched.push('plan_reference');
  }
  // permission
  if (/\b(fuehre|führe|mach|execute|ja(?!\s*$)|okay|freigegeben|deaktivier|bestätig|bestaetig|geht klar)/i.test(normalized)) {
    matched.push('permission');
  }

  const missing = APPROVAL_ELEMENTS.filter(e => !matched.includes(e));
  const isValid = matched.length >= 3;
  return {
    is_valid: isValid,
    matched_elements: matched,
    missing_elements: missing,
    reason: isValid
      ? 'Three or more validation elements present; approval accepted'
      : `Only ${matched.length} of 6 elements present; need at least 3`,
  };
}

// writeSnapshot(slug, kind, entityId, data, when) — writes a before/after snapshot
// for cms-slot or any entity. Used by CMS-Slot PATCHes to satisfy audit-safe rules
// because Shopware does not reliably return updatedAt for cms-slot writes.
// when: 'before' | 'after'. Returns the absolute path written.
function writeSnapshot(slug, kind, entityId, data, when) {
  safeSlug(slug);
  if (when !== 'before' && when !== 'after') {
    throw new Error(`writeSnapshot: when must be 'before' or 'after', got ${when}`);
  }
  if (!entityId || typeof entityId !== 'string') {
    throw new Error('writeSnapshot: entityId required');
  }
  const safeKind = String(kind).replace(/[^a-z0-9_-]/gi, '');
  const safeEntity = String(entityId).replace(/[^a-z0-9_-]/gi, '');
  if (!safeKind || !safeEntity) {
    throw new Error('writeSnapshot: kind and entityId must yield safe identifiers');
  }
  const dir = ensureSafeDomainDir(slug);
  const snapDir = path.join(dir, 'snapshots', safeKind);
  fs.mkdirSync(snapDir, { recursive: true, mode: 0o700 });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${safeEntity}-${ts}-${when}.json`;
  const filePath = path.join(snapDir, filename);
  writeFileExclusive(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

// checkSeoUrlCollision(entries, foreignKey, salesChannelId, languageId, routeName)
// Checks Shopware seo-url entries for the undocumented constraint:
// max 1 non-deleted entry per foreignKey/channel/language/route context.
// Input: array of seo-url entry objects (from Shopware API search).
// Returns { active_non_deleted_entries, collision_detected, colliding_ids }.
function checkSeoUrlCollision(entries, foreignKey, salesChannelId, languageId, routeName) {
  if (!Array.isArray(entries)) {
    throw new Error('checkSeoUrlCollision: entries must be an array');
  }
  const matching = entries.filter(e =>
    e && e.foreignKey === foreignKey &&
    e.salesChannelId === salesChannelId &&
    e.languageId === languageId &&
    e.routeName === routeName &&
    e.isDeleted === false
  );
  return {
    active_non_deleted_entries: matching.length,
    collision_detected: matching.length > 1,
    colliding_ids: matching.length > 1 ? matching.map(e => e.id) : [],
  };
}

// checkDreiscSeoPrecheck(redirects, urlSlug)
// Checks DreiscSeo redirects for chain-risk patterns before category/product
// deactivation. Returns { redirects_from_url, redirects_to_url,
// would_create_301_to_404, affected_redirect_ids }.
// Note: DreiscSeo matches case-insensitively; comparisons normalize case.
function checkDreiscSeoPrecheck(redirects, urlSlug) {
  if (!Array.isArray(redirects)) {
    throw new Error('checkDreiscSeoPrecheck: redirects must be an array');
  }
  if (typeof urlSlug !== 'string' || !urlSlug) {
    throw new Error('checkDreiscSeoPrecheck: urlSlug required');
  }
  const normalize = (s) => String(s || '').toLowerCase().replace(/^\/+|\/+$/g, '');
  const targetNorm = normalize(urlSlug);
  const fromUrl = redirects.filter(r =>
    r && r.active === true && normalize(r.sourcePath) === targetNorm
  );
  const toUrl = redirects.filter(r =>
    r && r.active === true && normalize(r.redirectPath) === targetNorm
  );
  const wouldChain = toUrl.length > 0; // any active redirect pointing here = chain risk
  return {
    redirects_from_url: fromUrl.map(r => ({ id: r.id, target: r.redirectPath })),
    redirects_to_url: toUrl.map(r => ({ id: r.id, source: r.sourcePath })),
    would_create_301_to_404: wouldChain,
    affected_redirect_ids: toUrl.map(r => r.id),
  };
}

// checkHypothesisScopeMatch(plannedChanges, hypothesisRegistry)
// Enforces the Hypothesis Verification Gate (recovery-plan Step 8a) in code.
// plannedChanges: array of change-budget planned_changes entries
//   (each needs at least { id, target, hypothesis_id }).
// hypothesisRegistry: array of hypothesis entries from recovery-audit output
//   (each needs { hypothesis_id, hypothesis_status, fix_scope }), or null/undefined
//   when no recovery-audit output exists (first run).
// Returns { audit_output_available, all_planned_changes_verified,
//   below_verified_count, scope_expansions_blocked, missing_hypothesis_ids,
//   hard_stops, per_change: [{ id, disposition, stop_reason }] }.
// disposition: 'allowed_now' | 'prepare_now_execute_later' | 'hard_stop'.
// Graceful first-run degradation: empty/missing registry never hard-stops —
// every change is segregated to prepare_now_execute_later (roadmap-only).
function checkHypothesisScopeMatch(plannedChanges, hypothesisRegistry) {
  if (!Array.isArray(plannedChanges)) {
    throw new Error('checkHypothesisScopeMatch: plannedChanges must be an array');
  }
  const normalizeUrl = (s) => String(s || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^\/+|\/+$/g, '');
  const registry = Array.isArray(hypothesisRegistry) ? hypothesisRegistry : [];
  const auditAvailable = registry.length > 0;
  const byId = new Map(registry.map(h => [h && h.hypothesis_id, h]));

  const perChange = [];
  const scopeExpansionsBlocked = [];
  const missingHypothesisIds = [];
  const hardStops = [];
  let belowVerifiedCount = 0;

  for (const change of plannedChanges) {
    const id = change && change.id;
    if (!auditAvailable) {
      perChange.push({ id, disposition: 'prepare_now_execute_later', stop_reason: 'hypothesis_gate_no_audit_output' });
      belowVerifiedCount += 1;
      continue;
    }
    if (!change || !change.hypothesis_id) {
      perChange.push({ id, disposition: 'hard_stop', stop_reason: 'hypothesis_id_missing' });
      missingHypothesisIds.push(id);
      hardStops.push(id);
      continue;
    }
    const hypothesis = byId.get(change.hypothesis_id);
    if (!hypothesis) {
      perChange.push({ id, disposition: 'hard_stop', stop_reason: 'hypothesis_not_in_registry' });
      missingHypothesisIds.push(id);
      hardStops.push(id);
      continue;
    }
    const status = hypothesis.hypothesis_status;
    if (status !== 'verified' && status !== 'fixed') {
      perChange.push({ id, disposition: 'prepare_now_execute_later', stop_reason: 'hypothesis_below_verified' });
      belowVerifiedCount += 1;
      continue;
    }
    const scopeUrls = hypothesis.fix_scope && Array.isArray(hypothesis.fix_scope.affected_urls)
      ? hypothesis.fix_scope.affected_urls.map(normalizeUrl)
      : null;
    if (scopeUrls && change.target && !scopeUrls.includes(normalizeUrl(change.target))) {
      perChange.push({ id, disposition: 'prepare_now_execute_later', stop_reason: 'fix_scope_expansion' });
      scopeExpansionsBlocked.push(id);
      continue;
    }
    perChange.push({ id, disposition: 'allowed_now', stop_reason: null });
  }

  return {
    audit_output_available: auditAvailable,
    all_planned_changes_verified: perChange.length > 0 && perChange.every(c => c.disposition === 'allowed_now'),
    below_verified_count: belowVerifiedCount,
    scope_expansions_blocked: scopeExpansionsBlocked,
    missing_hypothesis_ids: missingHypothesisIds,
    hard_stops: hardStops,
    per_change: perChange,
  };
}

// validateSettlementOverride(plan)
// Validates a Settlement-Gate override request against SEO_SETTLEMENT_GATE.md
// section 7. plan: a change plan per change-budget.schema.json.
// Returns { override_allowed, override_type, missing_requirements, reason }.
// Never throws on malformed plans — missing structure is reported as a
// missing requirement so callers always get a deny-by-default verdict.
function validateSettlementOverride(plan) {
  const missing = [];
  if (!plan || typeof plan !== 'object') {
    return { override_allowed: false, override_type: null, missing_requirements: ['plan_object'], reason: 'plan must be an object' };
  }
  if (plan.settlement_gate_override_requested !== true) {
    return { override_allowed: false, override_type: plan.override_type || null, missing_requirements: ['settlement_gate_override_requested'], reason: 'no override requested' };
  }
  const overrideType = plan.override_type;
  const validTypes = ['technical_emergency', 'rollback_stabilization', 'explicit_emergency_approval'];
  if (!validTypes.includes(overrideType)) {
    return { override_allowed: false, override_type: overrideType || null, missing_requirements: ['override_type'], reason: `override_type must be one of: ${validTypes.join(', ')}` };
  }
  if (typeof plan.override_reason !== 'string' || !plan.override_reason.trim()) {
    missing.push('override_reason');
  }
  const changes = Array.isArray(plan.planned_changes) ? plan.planned_changes : [];
  if (changes.length === 0) missing.push('planned_changes_non_empty');

  if (overrideType === 'technical_emergency') {
    // 7.A: each emergency must be supported by a live HTTP verification
    for (const c of changes) {
      const method = c && c.pre_change_state_check && c.pre_change_state_check.method;
      if (method !== 'live_http' && method !== 'live_http_and_api') {
        missing.push(`live_http_verification:${(c && c.id) || 'unknown'}`);
      }
    }
  }

  if (overrideType === 'explicit_emergency_approval') {
    // 7.C: ALL requirements must be present
    if (typeof plan.total_risk_points !== 'number') missing.push('total_risk_points');
    if (!Array.isArray(plan.post_change_checks) || plan.post_change_checks.length === 0) missing.push('post_change_checks');
    const av = plan.approval_validation;
    if (!av || av.is_valid !== true) missing.push('approval_validation_is_valid');
    if (av && typeof av.approval_text === 'string') {
      const normalized = av.approval_text.trim().toLowerCase();
      if (BROAD_APPROVAL_TRIGGERS.includes(normalized)) missing.push('approval_text_is_broad_trigger');
    }
    for (const c of changes) {
      const cid = (c && c.id) || 'unknown';
      if (!c || typeof c.risk_points_final !== 'number') missing.push(`risk_points_final:${cid}`);
      if (!c || !Array.isArray(c.data_sources) || c.data_sources.length === 0) missing.push(`data_sources:${cid}`);
      if (!c || !['high', 'medium'].includes(c.confidence)) missing.push(`confidence_medium_or_higher:${cid}`);
      if (!c || typeof c.rollback_method !== 'string' || !c.rollback_method.trim()) missing.push(`rollback_method:${cid}`);
      if (!c || !c.pre_change_state_check || !c.pre_change_state_check.method) missing.push(`pre_change_state_check:${cid}`);
    }
  }

  const allowed = missing.length === 0;
  return {
    override_allowed: allowed,
    override_type: overrideType,
    missing_requirements: missing,
    reason: allowed
      ? `override requirements for ${overrideType} satisfied`
      : `override denied — ${missing.length} requirement(s) missing`,
  };
}

// readChangeHistory(slug) — reads change-history.ndjson and returns parsed entries.
// Returns [] if file does not exist. Skips invalid lines silently.
// Uses ensureSafeDomainDir to match the path used by appendChangeHistory.
function readChangeHistory(slug) {
  safeSlug(slug);
  const baseDir = getCacheDir();
  const filePath = path.join(baseDir, slug, 'change-history.ndjson');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const entries = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { entries.push(JSON.parse(trimmed)); } catch { /* skip invalid */ }
  }
  return entries;
}

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
  resolveDomainDir,
  ensureSafeDomainDir,
  acquireLock,
  releaseLock,
  atomicWriteJSON,
  appendNDJSON,
  parseStrictCli,
  generateRunId,
  safeReadJSON,
  safeReadLatestImport,
  maskSecrets,
  safeLog,
  STALE_LOCK_TTL_MS,
  // SEO Change Governor primitives (v1.1.0)
  appendChangeHistory,
  validateApproval,
  writeSnapshot,
  checkSeoUrlCollision,
  checkDreiscSeoPrecheck,
  checkHypothesisScopeMatch,
  validateSettlementOverride,
  readChangeHistory,
  CHANGE_HISTORY_SCHEMA_VERSION,
  APPROVAL_ELEMENTS,
  BROAD_APPROVAL_TRIGGERS,
};
