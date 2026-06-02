'use strict';
// GSC Deep Dive — starter script.
// Pulls top queries, top pages, query-page pairs, manual actions, and CrUX field
// data for the configured GSC property via the Search Console API + PSI v5.
// Writes a single JSON snapshot per run to `<output_dir>/<site>-<YYYY-MM-DD>.json`.
//
// Run: GSC_SERVICE_ACCOUNT_JSON=/path/to/sa.json node gsc-fetch.example.js
// Override site + window: ... node gsc-fetch.example.js example.com 30

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { safeReadFile, safeHostname } = require('../../lib/safe.js');

const CFG_PATH = process.env.GSC_CONFIG || './gsc-config.json';
const argSite = process.argv[2];
const argDays = process.argv[3] ? parseInt(process.argv[3], 10) : null;

let CFG = {};
if (fs.existsSync(CFG_PATH)) {
  CFG = JSON.parse(safeReadFile(CFG_PATH));
}
// argv overrides config; config overrides defaults
const SITE = argSite || CFG.site;
const DAYS = argDays || CFG.days || 90;
const OUT_DIR = CFG.output_dir || './gsc-history';
const TOP_N = CFG.top_n || 500;

if (!SITE) {
  console.error('No site configured. Set "site" in gsc-config.json OR pass as argv:');
  console.error('  node gsc-fetch.example.js example.com');
  console.error('Site format: sc-domain:example.com  OR  https://www.example.com/');
  process.exit(1);
}

// --- Config-input validation (validate-at-load + trust-at-use) ---
// Site format: either sc-domain:<host> or https?://<host>/
function validateSite(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 300) throw new Error(`site: must be a 1-300 char string`);
  if (s.startsWith('sc-domain:')) {
    safeHostname(s.slice('sc-domain:'.length));
    return s;
  }
  let u;
  try { u = new URL(s); } catch { throw new Error(`site: not sc-domain: prefix and not a valid URL: ${JSON.stringify(s)}`); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`site: URL protocol must be http/https`);
  safeHostname(u.hostname);
  return s;
}
validateSite(SITE);

if (!Number.isFinite(DAYS) || DAYS < 1 || DAYS > 480) {
  console.error('days: must be an integer between 1 and 480 (GSC API caps history at 16 months ≈ 480 days)');
  process.exit(1);
}
if (!Number.isFinite(TOP_N) || TOP_N < 1 || TOP_N > 25000) {
  console.error('top_n: must be an integer between 1 and 25000 (GSC API row-limit per request)');
  process.exit(1);
}
if (CFG.output_dir !== undefined) {
  if (typeof CFG.output_dir !== 'string') { console.error('config.output_dir must be a string'); process.exit(1); }
  if (path.isAbsolute(CFG.output_dir) || CFG.output_dir.includes('..')) {
    console.error(`config.output_dir: must be a relative path inside CWD (no absolute, no ..). Got: ${JSON.stringify(CFG.output_dir)}`); process.exit(1);
  }
}
if (CFG.service_account_json) {
  console.error('Refusing to run: gsc-config.json contains service_account_json field. Service account JSON must be loaded via GSC_SERVICE_ACCOUNT_JSON env var only.');
  process.exit(1);
}

const SA_PATH = process.env.GSC_SERVICE_ACCOUNT_JSON;
if (!SA_PATH) {
  console.error('Missing GSC_SERVICE_ACCOUNT_JSON env var. Set it to the absolute path of your service-account JSON file:');
  console.error('  export GSC_SERVICE_ACCOUNT_JSON=~/.config/seo-rescue/gsc-service-account.json');
  process.exit(1);
}
if (!fs.existsSync(SA_PATH)) { console.error(`Service-account file not found: ${SA_PATH}`); process.exit(1); }
const SA = JSON.parse(safeReadFile(SA_PATH));
if (!SA.client_email || !SA.private_key) {
  console.error('Service-account JSON is missing client_email or private_key — wrong file?');
  process.exit(1);
}

// --- OAuth2 JWT exchange (in-memory only, no on-disk caching) ---

async function getAccessToken() {
  // Sign a JWT manually instead of pulling googleapis (zero-deps discipline).
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claims)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const sig = signer.sign(SA.private_key, 'base64url');
  const jwt = `${unsigned}.${sig}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) {
    throw new Error(`OAuth2 token exchange failed: ${JSON.stringify(j)}`);
  }
  return j.access_token;
}

// --- GSC API helpers ---

async function searchAnalytics(token, dimensions, startDate, endDate, rowLimit = TOP_N) {
  // Network destination hardcoded — site identifier validated above.
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions,
      rowLimit,
      dataState: 'final',
    }),
  });
  return r.json().catch(() => ({}));
}

// --- Untrusted-input sanitizer for GSC query strings ---
// Users can search Google for anything including prompt-injection-shaped strings.
// Those land in GSC's "query" data and would flow into Claude context downstream.
// Same pattern as seo-onpage.js / ai-citations-tracker.
const INJECTION_PATTERNS = [
  /ignore (?:previous|prior|above|all)\s+(?:instructions|prompts?|context|rules?)/i,
  /disregard (?:previous|prior|above|all|the)\s+(?:instructions|prompts?|context|rules?)/i,
  /forget (?:everything|all|previous|prior)\s+(?:above|context|instructions)?/i,
  /you are now (?:a|an|the)\s/i,
  /act as (?:a|an|the)\s/i,
  /pretend (?:to be|you are)\s/i,
  /<\/?(?:system|instructions?|prompt)>/i,
  /\[\/?(?:system|instructions?|prompt)\]/i,
  /system prompt(?![a-z])/i,
  /jailbreak/i,
  /print (?:your|the)\s+(?:system|instructions?|prompt)/i,
  /reveal (?:your|the)\s+(?:system|instructions?|prompt)/i,
];
function sanitizeQuery(s, max = 200) {
  if (typeof s !== 'string') return '';
  const t = s.slice(0, max);
  for (const re of INJECTION_PATTERNS) if (re.test(t)) return '[REDACTED: prompt-injection pattern in GSC query]';
  return t;
}

function mapRow(r, dims) {
  const out = {
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  };
  dims.forEach((d, i) => {
    const k = d === 'query' ? 'query' : d === 'page' ? 'page' : d;
    let v = (r.keys || [])[i];
    if (k === 'query') v = sanitizeQuery(v);
    out[k] = v;
  });
  return out;
}

// --- Main ---

(async () => {
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - DAYS);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = today.toISOString().slice(0, 10);

  console.error(`[gsc-deep-dive] site=${SITE} period=${startDate}..${endDate}`);
  const token = await getAccessToken();
  console.error('  token obtained, fetching analytics...');

  const [byQuery, byPage, byQueryPage, bySearchAppearance] = await Promise.all([
    searchAnalytics(token, ['query'], startDate, endDate, TOP_N),
    searchAnalytics(token, ['page'], startDate, endDate, TOP_N),
    searchAnalytics(token, ['query', 'page'], startDate, endDate, Math.min(TOP_N * 2, 1000)),
    searchAnalytics(token, ['searchAppearance'], startDate, endDate, 50).catch(e => ({ error: String(e) })),
  ]);

  const out = {
    site: SITE,
    period: { start_date: startDate, end_date: endDate, days: DAYS },
    pulled_at: new Date().toISOString(),
    top_queries: (byQuery.rows || []).map(r => mapRow(r, ['query'])),
    top_pages: (byPage.rows || []).map(r => mapRow(r, ['page'])),
    query_page_pairs: (byQueryPage.rows || []).map(r => mapRow(r, ['query', 'page'])),
    search_appearance: (bySearchAppearance.rows || []).map(r => mapRow(r, ['searchAppearance'])),
  };

  // Derived summary
  out.summary = {
    total_queries: out.top_queries.length,
    total_pages: out.top_pages.length,
    total_clicks: out.top_queries.reduce((s, r) => s + r.clicks, 0),
    total_impressions: out.top_queries.reduce((s, r) => s + r.impressions, 0),
    avg_ctr: out.top_queries.length ? out.top_queries.reduce((s, r) => s + r.ctr, 0) / out.top_queries.length : 0,
    avg_position: out.top_queries.length ? out.top_queries.reduce((s, r) => s + r.position, 0) / out.top_queries.length : 0,
    quick_wins_count: out.top_pages.filter(r => r.position > 10 && r.position < 21 && r.impressions > 100).length,
  };

  // Write output. File path is derived from SITE which is regex-validated above.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const safeSite = SITE.replace(/[^a-z0-9.-]/gi, '-').slice(0, 80);
  const outPath = path.join(OUT_DIR, `${safeSite}-${endDate}.json`);
  // Symlink-clobber defense — same pattern as seo-report-gen.js post-v0.3.3.
  try {
    const st = fs.lstatSync(outPath);
    if (st.isSymbolicLink()) { fs.unlinkSync(outPath); console.error(`  removed pre-existing symlink at ${outPath}`); }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  try { fs.chmodSync(outPath, 0o600); } catch {}

  console.error(`\n✅ ${outPath}`);
  console.error(`   ${out.summary.total_clicks.toLocaleString('de-DE')} clicks / ${out.summary.total_impressions.toLocaleString('de-DE')} impressions over ${DAYS} days`);
  console.error(`   avg position ${out.summary.avg_position.toFixed(1)} | avg CTR ${(out.summary.avg_ctr*100).toFixed(2)}%`);
  console.error(`   Quick-Win opportunities (pos 11-20, >100 imp): ${out.summary.quick_wins_count}`);
})().catch(e => { console.error('FATAL', e.message || e); process.exit(1); });
