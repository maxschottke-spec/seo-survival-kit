'use strict';
// PSI Weekly Cron Baseline — starter script.
// Reads psi-config.json, calls PSI v5 per URL × strategy, appends NDJSON, alerts on regressions.
//
// Run: node psi-fetch.example.js (or via launchd / GHA / systemd)

const fs = require('node:fs');
const path = require('node:path');

const CFG_PATH = process.env.PSI_CONFIG || './psi-config.json';
if (!fs.existsSync(CFG_PATH)) { console.error(`Config not found: ${CFG_PATH}`); process.exit(1); }
const CFG = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));

// env-only by design: previously this fell back to CFG.api_key, which combined
// with an un-ignored psi-config.json made it easy to commit the API key to git.
// Force env-var usage so the secret cannot live in a tracked file.
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('Missing GOOGLE_API_KEY env var. Set it before running:');
  console.error('  export GOOGLE_API_KEY=AIza...   # or use a .env loader');
  process.exit(1);
}
if (CFG.api_key) {
  console.error('Refusing to run: psi-config.json contains api_key. Remove it and use the GOOGLE_API_KEY env var instead.');
  process.exit(1);
}

const OUT_DIR = CFG.output_dir || './psi-history';
fs.mkdirSync(OUT_DIR, { recursive: true });
const NDJSON = path.join(OUT_DIR, 'history.ndjson');

const STRATEGIES = CFG.strategies || ['mobile', 'desktop'];
const CATS = CFG.categories || ['performance', 'seo', 'accessibility', 'best-practices'];
const THRESHOLD = CFG.alert_threshold_drop || 10;
const BASELINE_WEEKS = CFG.alert_baseline_weeks || 4;

async function psi(url, strategy) {
  const params = new URLSearchParams({ url, strategy, key: API_KEY });
  CATS.forEach(c => params.append('category', c));
  const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`);
  return r.json();
}

function extractMetrics(j) {
  const lh = j?.lighthouseResult;
  if (!lh) return null;
  const audits = lh.audits || {};
  const cats = lh.categories || {};
  return {
    perf: cats.performance ? Math.round(cats.performance.score * 100) : null,
    seo: cats.seo ? Math.round(cats.seo.score * 100) : null,
    a11y: cats.accessibility ? Math.round(cats.accessibility.score * 100) : null,
    bp: cats['best-practices'] ? Math.round(cats['best-practices'].score * 100) : null,
    lcp: audits['largest-contentful-paint']?.numericValue,
    fcp: audits['first-contentful-paint']?.numericValue,
    tbt: audits['total-blocking-time']?.numericValue,
    cls: audits['cumulative-layout-shift']?.numericValue,
    ttfb: audits['server-response-time']?.numericValue,
    crux_lcp: j?.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.category,
    crux_cls: j?.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category,
    crux_inp: j?.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT_MS?.category,
    crux_overall: j?.loadingExperience?.overall_category,
  };
}

function loadHistory() {
  if (!fs.existsSync(NDJSON)) return [];
  return fs.readFileSync(NDJSON, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

function baselineFor(history, url, strategy, metricKey, weeksBack) {
  const cutoff = Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000;
  const relevant = history.filter(h => h.url === url && h.strategy === strategy && h.timestamp >= cutoff && h.metrics && h.metrics[metricKey] != null);
  if (relevant.length < 2) return null;
  return relevant.reduce((s, h) => s + h.metrics[metricKey], 0) / relevant.length;
}

(async () => {
  const history = loadHistory();
  const now = new Date();
  const records = [];
  const regressions = [];

  for (const u of CFG.urls) {
    for (const strategy of STRATEGIES) {
      console.error(`PSI ${u.label} (${strategy})...`);
      const j = await psi(u.url, strategy);
      const metrics = extractMetrics(j);
      if (!metrics) {
        console.error(`  ERROR: no Lighthouse result for ${u.url}`);
        continue;
      }
      const rec = { timestamp: now.getTime(), date: now.toISOString().slice(0,10), label: u.label, url: u.url, strategy, metrics };

      // Regression check on perf score
      const baselinePerf = baselineFor(history, u.url, strategy, 'perf', BASELINE_WEEKS);
      if (baselinePerf != null && metrics.perf != null && (baselinePerf - metrics.perf) >= THRESHOLD) {
        rec.regression = true;
        rec.baseline = Math.round(baselinePerf);
        regressions.push(`⚠️  ${u.label} (${strategy}): performance ${metrics.perf} (baseline ${Math.round(baselinePerf)}, drop ${Math.round(baselinePerf - metrics.perf)})`);
      }

      records.push(rec);
      console.error(`  perf=${metrics.perf} seo=${metrics.seo} a11y=${metrics.a11y} bp=${metrics.bp} lcp=${Math.round(metrics.lcp||0)}ms cls=${(metrics.cls||0).toFixed(3)}`);
    }
  }

  // Append to NDJSON
  fs.appendFileSync(NDJSON, records.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.error(`\n✅ Appended ${records.length} rows to ${NDJSON}`);

  if (regressions.length) {
    console.error(`\n🚨 ${regressions.length} regression(s) detected:`);
    regressions.forEach(r => console.error('  ' + r));
    process.exit(2);  // non-zero so cron / GHA can alert
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
