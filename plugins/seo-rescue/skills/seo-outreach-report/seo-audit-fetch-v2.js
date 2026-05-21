'use strict';
// Fetches per-domain SEO data (Sistrix VI + history, DataForSEO Labs, Google PSI) for one
// or more target domains defined in `audit-config.json`.
//
// Config: process.env.SEO_AUDIT_CONFIG || './audit-config.json'
//
// Run examples:
//   node --env-file=.env seo-audit-fetch-v2.js                  # all targets in config
//   node --env-file=.env seo-audit-fetch-v2.js client-a         # only one slug
//   SEO_AUDIT_CONFIG=/path/cfg.json node --env-file=.env ...    # alternate config path

const fs = require('node:fs');

const SISTRIX_KEY = process.env.SISTRIX_API_KEY;
const D4S_LOGIN = process.env.DATAFORSEO_LOGIN;
const D4S_PASS = process.env.DATAFORSEO_PASSWORD;
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

const CONFIG_PATH = process.env.SEO_AUDIT_CONFIG || './audit-config.json';
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`Config not found: ${CONFIG_PATH}\nCopy audit-config.example.json to audit-config.json and customize.`);
  process.exit(1);
}
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const ALL_TARGETS = CONFIG.targets || [];

const filterSlugs = (process.argv[2] || '').split(',').filter(Boolean);
const TARGETS = filterSlugs.length
  ? ALL_TARGETS.filter(t => filterSlugs.includes(t.slug))
  : ALL_TARGETS;

if (TARGETS.length === 0) {
  console.error('No targets matched. Available slugs:', ALL_TARGETS.map(t => t.slug).join(', '));
  process.exit(1);
}

function d4sAuth() { return 'Basic ' + Buffer.from(`${D4S_LOGIN}:${D4S_PASS}`).toString('base64'); }
async function sistrix(method, params) {
  const qs = new URLSearchParams({ api_key: SISTRIX_KEY, format: 'json', ...params });
  const r = await fetch(`https://api.sistrix.com/${method}?${qs}`);
  return r.json().catch(() => ({}));
}
async function d4sPost(path, body) {
  const r = await fetch(`https://api.dataforseo.com${path}`, {
    method: 'POST',
    headers: { Authorization: d4sAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify([body]),
  });
  return r.json().catch(() => ({}));
}
async function psi(url, strategy) {
  const u = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=seo&category=accessibility&category=best-practices&key=${GOOGLE_KEY}`;
  const r = await fetch(u);
  return r.json().catch(() => ({}));
}

// Sistrix VI history: fetch one call per month for the last N months.
async function sistrixViHistory(domain, country='de', months=18) {
  const dates = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    dates.push(dt.toISOString().slice(0, 10));
  }
  const series = [];
  for (const date of dates) {
    const j = await sistrix('domain.sichtbarkeitsindex', { domain, country, date }).catch(() => ({}));
    const v = j.answer?.[0]?.sichtbarkeitsindex?.[0];
    if (v) series.push({ date: v.date, value: parseFloat(v.value) });
  }
  return series;
}

async function fetchOne(target) {
  console.error(`[${target.slug}] fetching...`);
  const out = { target, ts: new Date().toISOString() };

  const [sxVi, sxViOverview, viHist, d4sRanked, d4sBacklinks, d4sDomainInfo, d4sCompetitors, d4sBacklinkDomains, psiMobile, psiDesktop] = await Promise.all([
    sistrix('domain.sichtbarkeitsindex', { domain: target.domain, country: 'de' }).catch(e => ({ error: String(e) })),
    sistrix('domain.sichtbarkeitsindex.overview', { domain: target.domain, country: 'de' }).catch(e => ({ error: String(e) })),
    sistrixViHistory(target.domain).catch(e => []),
    d4sPost('/v3/dataforseo_labs/google/ranked_keywords/live', {
      target: target.domain, language_code: 'de', location_code: 2276, limit: 100,
      order_by: ['ranked_serp_element.serp_item.rank_group,asc'],
    }).catch(e => ({ error: String(e) })),
    d4sPost('/v3/backlinks/summary/live', { target: target.domain, internal_list_limit: 10 }).catch(e => ({ error: String(e) })),
    d4sPost('/v3/dataforseo_labs/google/domain_rank_overview/live', { target: target.domain, language_code: 'de', location_code: 2276 }).catch(e => ({ error: String(e) })),
    d4sPost('/v3/dataforseo_labs/google/competitors_domain/live', { target: target.domain, language_code: 'de', location_code: 2276, limit: 15 }).catch(e => ({ error: String(e) })),
    d4sPost('/v3/backlinks/referring_domains/live', { target: target.domain, limit: 25, order_by: ['rank,desc'] }).catch(e => ({ error: String(e) })),
    psi(target.host, 'mobile').catch(e => ({ error: String(e) })),
    psi(target.host, 'desktop').catch(e => ({ error: String(e) })),
  ]);

  out.sistrix = { vi: sxVi, vi_overview: sxViOverview, vi_history: viHist };
  out.dataforseo = { ranked: d4sRanked, backlinks: d4sBacklinks, domain_info: d4sDomainInfo, competitors: d4sCompetitors, ref_domains: d4sBacklinkDomains };
  out.psi = { mobile: psiMobile, desktop: psiDesktop };

  const outFile = `/tmp/seo-${target.slug}-raw.json`;
  fs.writeFileSync(outFile, JSON.stringify(out));
  console.error(`[${target.slug}] -> ${outFile} (${fs.statSync(outFile).size} bytes)`);
}

(async () => {
  await Promise.all(TARGETS.map(fetchOne));
  console.error(`Done. Fetched ${TARGETS.length} target(s).`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
