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
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function safeSlug(s) {
  if (typeof s !== 'string' || !SLUG_RE.test(s)) {
    throw new Error(`Unsafe slug rejected: ${JSON.stringify(s)} (must match ${SLUG_RE})`);
  }
  return s;
}

function validateConfigTargets(targets) {
  if (!Array.isArray(targets)) throw new Error('config.targets must be an array');
  for (const t of targets) {
    if (!t || typeof t !== 'object') throw new Error('config.targets[*] must be an object');
    safeSlug(t.slug);
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
  validateConfigTargets,
  safeReadFile,
  mkRunDir,
  writeFileExclusive,
  getCacheDir,
  cachePath,
};
