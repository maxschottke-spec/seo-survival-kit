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

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const LABEL_MAX = 200;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

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
function getCacheDir() {
  const dir = process.env.SEO_CACHE_DIR || path.join(os.homedir(), '.cache', 'seo-rescue');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch {}
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink()) {
    throw new Error(`SEO_CACHE_DIR must not be a symlink: ${dir}`);
  }
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
};
