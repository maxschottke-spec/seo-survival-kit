'use strict';
// L2 Quiet-Death detector for seo-survival-kit (gsc-deep-dive).
// EXPERIMENTAL N=1 (Lesson 2, case-001). Flags slow, non-update-driven click
// declines in a per-query weekly series. Zero runtime dependencies.
//
// CLI:  node quiet-death-detect.example.js <gsc-snapshot.json> [--core <CORE_UPDATES.md>] [--brand a,b]
// API:  require(...) → { detectQuietDeath, parseUpdateWindows, classifyPattern, isoWeekToMonday }
const fs = require('fs');
const path = require('path');

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

function rollingMean(values, window) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(mean(slice));
  }
  return out;
}

function longestNonIncreasingRun(means, tolerance = 0.02) {
  if (!means.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < means.length; i++) {
    if (means[i] <= means[i - 1] * (1 + tolerance)) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

function parseUpdateWindows(md) {
  const windows = [];
  for (const line of String(md).split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cols = line.split('|').map(c => c.trim());
    const start = cols[3], end = cols[4];
    if (/^\d{4}-\d{2}-\d{2}$/.test(start || '') && /^\d{4}-\d{2}-\d{2}$/.test(end || '')) {
      windows.push({ start, end });
    }
  }
  return windows;
}

function isoWeekToMonday(isoWeek) {
  const [y, w] = String(isoWeek).split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7; // Mon=0
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function dropCorrelatesWithUpdate(dropWeekMonday, windows) {
  const d = new Date(dropWeekMonday + 'T00:00:00Z').getTime();
  const wk = 7 * 24 * 3600 * 1000;
  return windows.some(w => {
    const s = new Date(w.start + 'T00:00:00Z').getTime() - wk;
    const e = new Date(w.end + 'T00:00:00Z').getTime() + wk;
    return d >= s && d <= e;
  });
}

function classifyPattern(query, brandTerms, hasAIO) {
  const q = String(query).toLowerCase();
  if ((brandTerms || []).some(t => t && q.includes(String(t).toLowerCase()))) return 'brand_erosion';
  if (hasAIO) return 'serp_feature_absorption';
  return 'generic_erosion';
}

function detectQuietDeath(snapshot, updateWindows, opts = {}) {
  const C = { min_start_clicks: 5, min_loss_pct: 50, min_decline_weeks: 6, rolling_window: 4 };
  const brandTerms = opts.brandTerms || [];
  const series = (snapshot && snapshot.query_weekly_series) || [];
  const aioPresent = ((snapshot && snapshot.search_appearance) || [])
    .some(r => /overview|ai/i.test((r && (r.searchAppearance || r.query)) || ''));
  const flagged = [];
  for (const item of series) {
    const weeks = item.weeks || [];
    if (weeks.length < C.min_decline_weeks) continue;
    const clicks = weeks.map(w => Number(w.clicks) || 0);
    const startMean = mean(clicks.slice(0, C.rolling_window));
    const endMean = mean(clicks.slice(-C.rolling_window));
    if (startMean < C.min_start_clicks) continue;
    const lossPct = Math.round((endMean - startMean) / startMean * 100);
    if (lossPct > -C.min_loss_pct) continue;
    const declineWeeks = longestNonIncreasingRun(rollingMean(clicks, C.rolling_window));
    if (declineWeeks < C.min_decline_weeks) continue;
    let maxDrop = 0, dropIdx = 1;
    for (let i = 1; i < clicks.length; i++) {
      const drop = clicks[i] - clicks[i - 1];
      if (drop < maxDrop) { maxDrop = drop; dropIdx = i; }
    }
    const correlated = dropCorrelatesWithUpdate(isoWeekToMonday(weeks[dropIdx].iso_week), updateWindows || []);
    flagged.push({
      query: item.query,
      start_clicks: Math.round(startMean),
      end_clicks: Math.round(endMean),
      loss_pct: lossPct,
      decline_weeks: declineWeeks,
      update_correlation: correlated ? 'partial' : 'none',
      pattern_hint: classifyPattern(item.query, brandTerms, aioPresent),
    });
  }
  return {
    maturity: 'experimental_n1',
    criteria: C,
    window_weeks: series.length ? Math.max(...series.map(s => (s.weeks || []).length)) : 0,
    queries_analyzed: series.length,
    flagged_count: flagged.length,
    quiet_death_queries: flagged,
  };
}

module.exports = { detectQuietDeath, parseUpdateWindows, classifyPattern, isoWeekToMonday, rollingMean, longestNonIncreasingRun };

if (require.main === module) {
  const args = process.argv.slice(2);
  const snapPath = args.find(a => !a.startsWith('--'));
  const coreIdx = args.indexOf('--core');
  const corePath = coreIdx >= 0 ? args[coreIdx + 1] : path.join(__dirname, '..', '..', 'references', 'CORE_UPDATES.md');
  const brandIdx = args.indexOf('--brand');
  const brandTerms = brandIdx >= 0 ? (args[brandIdx + 1] || '').split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!snapPath) { console.error('usage: node quiet-death-detect.example.js <gsc-snapshot.json> [--core <CORE_UPDATES.md>] [--brand a,b]'); process.exit(1); }
  const snapshot = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  let windows = [];
  try { windows = parseUpdateWindows(fs.readFileSync(corePath, 'utf8')); }
  catch (e) { console.error('[quiet-death] CORE_UPDATES not readable, all correlations = none:', e.message); }
  const res = detectQuietDeath(snapshot, windows, { brandTerms });
  const site = (snapshot.site || 'site').replace(/[^a-z0-9.-]/gi, '-').slice(0, 80);
  const outDir = path.join(path.dirname(snapPath));
  const date = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `${site}-quiet-death-${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(res, null, 2));
  const none = res.quiet_death_queries.filter(q => q.update_correlation === 'none').length;
  const partial = res.flagged_count - none;
  console.error(`[quiet-death] ${snapshot.site}: ${res.flagged_count}/${res.queries_analyzed} queries flagged (${none}× none, ${partial}× partial update-correlation)`);
  console.error(`✅ ${outPath}`);
}
