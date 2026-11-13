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
const { safeSlug, validateConfigTargets, safeReadFile, cachePath, writeFileExclusive } = require('../../lib/safe.js');

const SISTRIX_KEY = process.env.SISTRIX_API_KEY;
const D4S_LOGIN = process.env.DATAFORSEO_LOGIN;
const D4S_PASS = process.env.DATAFORSEO_PASSWORD;
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

const CONFIG_PATH = process.env.SEO_AUDIT_CONFIG || './audit-config.json';
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`Config not found: ${CONFIG_PATH}\nCopy audit-config.example.json to audit-config.json and customize.`);
  process.exit(1);
}
const CONFIG = JSON.parse(safeReadFile(CONFIG_PATH));
const ALL_TARGETS = validateConfigTargets(CONFIG.targets || []);

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

// PageSpeed ist eine EINZELMESSUNG auf geteilter Infrastruktur und streut
// erheblich. Beleg (eine Kundendomain, 07.09.2026): 07:17 Uhr Desktop 80, 14:25 Uhr
// Desktop 60 — dieselbe Seite, sieben Stunden Abstand, 20 Punkte Unterschied,
// gegen eine Reihe, die vom 03.08. bis 24.08. zwischen 79 und 83 lag. Der
// Wochenbericht hätte daraus "PageSpeed Desktop 60/100, −23" gemacht und dem
// Kunden einen Einbruch gemeldet, den es nicht gab. Das Editorial-Gate hat den
// Versand gestoppt; verlassen darf man sich darauf nicht, denn es prüft
// Kohärenz, nicht Messgüte.
//
// Deshalb drei Läufe, und es gewinnt der MITTLERE nach Performance-Score.
// Zurückgegeben wird der vollständige mittlere Lauf, nicht ein aus drei Läufen
// zusammengerechneter Wert: sonst beschreibt der Bericht eine Messung, die so
// nie stattgefunden hat (Score aus Lauf 2, LCP aus Lauf 1, TBT aus Lauf 3).
// `_psi_spread` hält fest, wie weit die Läufe auseinanderlagen — ist die
// Streuung selbst groß, ist sie das Thema und nicht der Punktwert.
const PSI_SPREAD_MAX = 15; // Punkte zwischen bestem und schlechtestem Lauf, ab denen die Messung nicht trägt
async function psiMedian(url, strategy, runs = 3) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    // Nicht im Sekundentakt gegen dieselbe URL feuern.
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const r = await psi(url, strategy);
      const score = r?.lighthouseResult?.categories?.performance?.score;
      // Ein einzelner Fehllauf (Quota, Timeout, leere Antwort) kippt die
      // Messung nicht — er zählt nur nicht mit.
      if (typeof score === 'number') results.push({ score: Math.round(score * 100), raw: r });
    } catch { /* siehe oben */ }
  }
  if (!results.length) return { error: `psi ${strategy}: kein Lauf lieferte einen Performance-Score` };
  results.sort((a, b) => a.score - b.score);
  const scores = results.map((r) => r.score);
  const spread = scores[scores.length - 1] - scores[0];
  // Weniger als `runs` gültige Läufe: Es gibt keinen Median. Bei zwei Läufen
  // wählte Math.floor(2/2) bisher den HÖHEREN — ein Einbruch wurde damit
  // optimistisch kaschiert (Codex-Befund 07.09.2026). Jetzt: bei unvollständiger
  // Messung den NIEDRIGEREN nehmen (konservativ) und die Messung als
  // "degraded" markieren; Generator und Gate blenden die Kachel dann aus.
  // Dasselbe bei großer Streuung: ab PSI_SPREAD_MAX Punkten sagt der Median
  // mehr über die Messung als über die Seite.
  const complete = results.length >= runs;
  const pick = complete ? results[Math.floor(results.length / 2)] : results[0];
  const degraded = !complete || spread >= PSI_SPREAD_MAX;
  return {
    ...pick.raw,
    _psi_runs: results.length,
    _psi_runs_requested: runs,
    _psi_scores: scores,
    _psi_spread: spread,
    _psi_degraded: degraded,
    _psi_degraded_reason: !complete ? `nur ${results.length} von ${runs} Läufen gültig` : spread >= PSI_SPREAD_MAX ? `Streuung ${spread} Punkte` : null,
  };
}

// Sistrix VI history: fetch one call per month for the last N months.
// Abgeschlossene Monate sind unveränderlich → Cache im User-Cache-Dir, damit
// wiederkehrende Läufe (Weekly-Reports, Crons) nicht 18 Credits pro Lauf verbrennen:
// nur fehlende Monate + der laufende Monat gehen gegen die API (~2 Credits/Lauf).
async function sistrixViHistory(slug, domain, country='de', months=18) {
  const cacheFile = cachePath(slug, `-vi-cache-${country}.json`);
  let cache = {};
  try { cache = JSON.parse(safeReadFile(cacheFile)); } catch { /* first run */ }

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const dates = [];
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    dates.push(dt.toISOString().slice(0, 10));
  }
  const series = [];
  let cacheDirty = false;
  for (const date of dates) {
    if (cache[date] && date !== currentMonth) { series.push(cache[date]); continue; }
    const j = await sistrix('domain.sichtbarkeitsindex', { domain, country, date }).catch(() => ({}));
    const v = j.answer?.[0]?.sichtbarkeitsindex?.[0];
    if (v) {
      const entry = { date: v.date, value: parseFloat(v.value) };
      series.push(entry);
      cache[date] = entry;
      cacheDirty = true;
    }
  }
  if (cacheDirty) {
    try { fs.rmSync(cacheFile, { force: true }); writeFileExclusive(cacheFile, JSON.stringify(cache, null, 1)); } catch { /* cache is best effort */ }
  }
  return series;
}

async function fetchOne(target) {
  console.error(`[${target.slug}] fetching...`);
  const out = { target, ts: new Date().toISOString() };

  const [sxVi, sxViOverview, viHist, d4sRanked, d4sBacklinks, d4sDomainInfo, d4sCompetitors, d4sBacklinkDomains] = await Promise.all([
    sistrix('domain.sichtbarkeitsindex', { domain: target.domain, country: 'de' }).catch(e => ({ error: String(e) })),
    sistrix('domain.sichtbarkeitsindex.overview', { domain: target.domain, country: 'de' }).catch(e => ({ error: String(e) })),
    sistrixViHistory(target.slug, target.domain).catch(e => []),
    // limit:1000 + SV-desc sampling gives a realistic position distribution.
    // The previous limit:100 + rank_group asc only returned the best-ranking 100
    // keywords, which made the position-distribution chart in the PDF show 100 %
    // of keywords in Top 3 even for domains with thousands of keywords ranking
    // across all positions. SV-desc means we still see the high-value head terms
    // first, but we now capture mid-tail rankings too.
    d4sPost('/v3/dataforseo_labs/google/ranked_keywords/live', {
      target: target.domain, language_code: 'de', location_code: 2276, limit: 1000,
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
    }).catch(e => ({ error: String(e) })),
    d4sPost('/v3/backlinks/summary/live', { target: target.domain, internal_list_limit: 10 }).catch(e => ({ error: String(e) })),
    d4sPost('/v3/dataforseo_labs/google/domain_rank_overview/live', { target: target.domain, language_code: 'de', location_code: 2276 }).catch(e => ({ error: String(e) })),
    d4sPost('/v3/dataforseo_labs/google/competitors_domain/live', { target: target.domain, language_code: 'de', location_code: 2276, limit: 15 }).catch(e => ({ error: String(e) })),
    d4sPost('/v3/backlinks/referring_domains/live', { target: target.domain, limit: 25, order_by: ['rank,desc'] }).catch(e => ({ error: String(e) })),
  ]);
  // PSI NACH den übrigen Abfragen und mobil/desktop NACHEINANDER: parallel
  // hießen 3+3 Läufe zwei Anfragen je zwei Sekunden gegen dieselbe URL —
  // ein gemeinsames Ratenlimit dünnt dann beide Reihen aus, und der
  // Ein-Lauf-Rückfall greift genau dann, wenn er nicht greifen soll
  // (Codex-Befund 07.09.2026). Kostet rund eine Minute Laufzeit.
  const psiMobile = await psiMedian(target.host, 'mobile').catch(e => ({ error: String(e) }));
  const psiDesktop = await psiMedian(target.host, 'desktop').catch(e => ({ error: String(e) }));

  out.sistrix = { vi: sxVi, vi_overview: sxViOverview, vi_history: viHist };
  out.dataforseo = { ranked: d4sRanked, backlinks: d4sBacklinks, domain_info: d4sDomainInfo, competitors: d4sCompetitors, ref_domains: d4sBacklinkDomains };
  out.psi = { mobile: psiMobile, desktop: psiDesktop };

  const slug = safeSlug(target.slug);
  const outFile = cachePath(slug, '-raw.json');
  // Unlink first so a pre-existing symlink can't redirect our write.
  try { fs.unlinkSync(outFile); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  writeFileExclusive(outFile, JSON.stringify(out));
  console.error(`[${slug}] -> ${outFile} (${fs.statSync(outFile).size} bytes)`);
}

(async () => {
  await Promise.all(TARGETS.map(fetchOne));
  console.error(`Done. Fetched ${TARGETS.length} target(s).`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
