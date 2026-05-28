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

// Normalizes domain input for recovery commands. Accepts bare hostnames, URLs
// with http/https, and paths/queries (stripped). www. is NOT stripped —
// www.example.com and example.com are treated as distinct domains.
// Returns { input_domain, domain, canonical_domain, slug }.
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
        require('node:child_process').execSync('sleep 0.1', { stdio: 'ignore' });
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

function atomicWriteJSON(filePath, data) {
  const st = safeLstat(filePath);
  if (st && st.isSymbolicLink()) {
    throw new Error(`atomicWriteJSON: target is a symlink: ${filePath}`);
  }
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(tmpPath, json, { mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

function appendNDJSON(filePath, entry) {
  const st = safeLstat(filePath);
  if (st && st.isSymbolicLink()) {
    throw new Error(`appendNDJSON: target is a symlink: ${filePath}`);
  }
  const line = JSON.stringify(entry) + '\n';
  const fd = fs.openSync(filePath, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(fd, line); } finally { fs.closeSync(fd); }
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
  if (st && st.isSymbolicLink()) return;
  const line = `[${new Date().toISOString()}] [${runId}] ${maskSecrets(message)}\n`;
  const fd = fs.openSync(logPath, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(fd, line); } finally { fs.closeSync(fd); }
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
  ensureSafeDomainDir,
  acquireLock,
  releaseLock,
  atomicWriteJSON,
  appendNDJSON,
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
  readChangeHistory,
  CHANGE_HISTORY_SCHEMA_VERSION,
  APPROVAL_ELEMENTS,
  BROAD_APPROVAL_TRIGGERS,
};
