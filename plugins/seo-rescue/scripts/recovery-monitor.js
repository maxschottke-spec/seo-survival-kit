'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const {
  normalizeDomain,
  ensureDomainDir,
  acquireLock,
  releaseLock,
  appendNDJSON,
  safeReadFile,
  generateRunId,
  safeReadJSON,
} = require('../lib/safe.js');

const SCORE_WEIGHTS = {
  vi_trend: 0.30,
  keyword_stability: 0.25,
  quick_win_progress: 0.20,
  issue_reduction: 0.15,
  backlink_quality: 0.10,
};

function parseCLI() {
  const { values } = parseArgs({
    options: {
      domain: { type: 'string' },
      'cache-dir': { type: 'string' },
    },
    strict: false,
  });
  return values;
}

function computeRecoveryScore(current, baseline, lastEntry) {
  const values = {
    vi_trend: null,
    keyword_stability: null,
    quick_win_progress: null,
    issue_reduction: null,
    backlink_quality: null,
  };

  // VI trend — primary: documented 4-week trend formula (+50% trend = 100, -50% = 0)
  if (current.vi_trend_4w_pct != null) {
    values.vi_trend = Math.round(Math.min(100, Math.max(0, current.vi_trend_4w_pct + 50)));
  } else if (current.vi != null && baseline && baseline.vi_current != null && baseline.vi_current > 0) {
    // Documented fallback: delta vs befund.json baseline (+10% = 100, 0% = 50, -10% = 0, linear)
    const changePct = ((current.vi - baseline.vi_current) / baseline.vi_current) * 100;
    values.vi_trend = Math.round(Math.min(100, Math.max(0, 50 + changePct * 5)));
  }

  // Keyword stability: % of baseline top-10 keywords still in top 10
  if (current.keywords_t10 != null && baseline && baseline.position_distribution && baseline.position_distribution.t10 > 0) {
    const baseT10 = baseline.position_distribution.t10;
    const ratio = Math.min(1, current.keywords_t10 / baseT10);
    values.keyword_stability = Math.round(ratio * 100);
  }

  // Quick win: top-10 delta vs last entry as proxy (first run: null)
  if (lastEntry && lastEntry.keywords_t10 != null && current.keywords_t10 != null) {
    const delta = current.keywords_t10 - lastEntry.keywords_t10;
    values.quick_win_progress = Math.round(Math.min(100, Math.max(0, 50 + delta * 10)));
  }

  // Issue reduction: only with fresh issue data (no claim without a fresh crawl)
  if (current.issue_data_fresh === true && current.issues_open != null && baseline) {
    const baseIssues = (baseline.issues_critical || 0) + (baseline.issues_high || 0);
    if (baseIssues > 0) {
      const reduction = 1 - (current.issues_open / baseIssues);
      values.issue_reduction = Math.round(Math.min(100, Math.max(0, reduction * 100)));
    }
  }

  // Backlink quality: only when a real spam score was provided — no hardcoded neutral value
  if (current.backlink_spam_score != null) {
    values.backlink_quality = Math.round(Math.min(100, Math.max(0, (1 - current.backlink_spam_score / 100) * 100)));
  }

  const availableKeys = Object.keys(values).filter((k) => values[k] != null);

  // Need at least 2 real components for a score
  if (availableKeys.length < 2) {
    const components = {};
    for (const k of Object.keys(values)) components[k] = null;
    return { score: null, components };
  }

  // Emit { value, weight } per available component; weights normalized to sum 1.0
  const totalWeight = availableKeys.reduce((sum, k) => sum + SCORE_WEIGHTS[k], 0);
  const components = {};
  let score = 0;
  for (const k of Object.keys(values)) {
    if (values[k] == null) {
      components[k] = null;
      continue;
    }
    const weight = SCORE_WEIGHTS[k] / totalWeight;
    components[k] = { value: values[k], weight };
    score += values[k] * weight;
  }

  return { score: Math.round(score), components };
}

function getLastEntry(historyPath) {
  try {
    const content = safeReadFile(historyPath);
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

function getBaseline(domainDir) {
  const befundPath = path.join(domainDir, 'befund.json');
  try {
    return JSON.parse(safeReadFile(befundPath));
  } catch {
    return null;
  }
}

function getIssuesData(domainDir) {
  const issuesPath = path.join(domainDir, 'issues.json');
  try {
    const data = safeReadJSON(issuesPath);
    const open = (data.summary ? data.summary.critical + data.summary.high : 0);
    return { open, fixed: 0 };
  } catch {
    return null;
  }
}

function determinePhase(score, baseline) {
  // No baseline or no computable score: phase is unknown, not a guessed 'R2'
  if (!baseline || score == null) return null;
  if (score < 20) return 'R1';
  if (score < 40) return 'R2';
  if (score < 60) return 'R3';
  if (score < 80) return 'R4';
  return 'R5';
}

function writeMonitorEntry(inputDomain, domain, slug, vi, keywordsT10, warnings, errors, options = {}) {
  const dir = ensureDomainDir(slug);
  const historyPath = path.join(dir, 'history.ndjson');
  const lock = acquireLock(dir, 'recovery-monitor');
  try {
    const lastEntry = getLastEntry(historyPath);
    const baseline = getBaseline(dir);
    const issuesData = getIssuesData(dir);
    const issueDataFresh = options.issueDataFresh === true;
    const current = {
      vi,
      keywords_t10: keywordsT10,
      issues_open: issuesData ? issuesData.open : null,
      issue_data_fresh: issueDataFresh,
      vi_trend_4w_pct: options.viTrend4wPct != null ? options.viTrend4wPct : null,
      backlink_spam_score: options.backlinkSpamScore != null ? options.backlinkSpamScore : null,
    };
    const { score, components } = computeRecoveryScore(current, baseline, lastEntry);
    const phase = determinePhase(score, baseline);
    // 'failed' is reserved for no-write aborts (lock timeout, symlink — exit codes 2/3).
    // Any entry that gets written is 'complete' or 'partial'.
    const status = (errors.length > 0 || warnings.length > 0) ? 'partial' : 'complete';
    const dataQuality = (vi != null && keywordsT10 != null) ? 'good' : (vi != null || keywordsT10 != null) ? 'partial' : 'poor';

    const entry = {
      schema_version: '1.0.0',
      run_id: options.runId || generateRunId(),
      status,
      input_domain: inputDomain,
      domain,
      canonical_domain: null,
      slug,
      timestamp: new Date().toISOString(),
      warnings,
      errors,
      data_quality: dataQuality,
      confidence: dataQuality === 'good' ? 'high' : dataQuality === 'partial' ? 'medium' : 'low',
      providers_used: options.providersUsed || [],
      missing_capabilities: options.missingCapabilities || [],
      source_notes: options.sourceNotes || [],
      vi,
      vi_delta_pct: lastEntry && lastEntry.vi ? Math.round(((vi - lastEntry.vi) / lastEntry.vi) * 1000) / 10 : null,
      score,
      phase,
      keywords_t10: keywordsT10,
      keywords_t10_delta: lastEntry && lastEntry.keywords_t10 != null ? keywordsT10 - lastEntry.keywords_t10 : null,
      keywords_total: options.keywordsTotal != null ? options.keywordsTotal : null,
      top_losers_recovered: null,
      issues_open: issuesData ? issuesData.open : null,
      issues_fixed: issuesData ? issuesData.fixed : null,
      issue_data_fresh: issueDataFresh,
      settlement_gate_status: options.settlementGateStatus || { active: false },
      change_effects: options.changeEffects || null,
      audit_health: options.auditHealth || null,
      component_scores: components,
    };

    appendNDJSON(historyPath, entry);
    return { entry, lastEntry };
  } finally {
    releaseLock(lock);
  }
}

function formatDeltaReport(entry, lastEntry) {
  const lines = [];
  lines.push(`Recovery Monitor — ${entry.domain} — ${entry.timestamp.split('T')[0]}`);
  lines.push('--------------------------------------------');
  const viStr = entry.vi != null ? entry.vi.toFixed(4) : 'n/a';
  const viDelta = entry.vi_delta_pct != null ? ` (${entry.vi_delta_pct > 0 ? '+' : ''}${entry.vi_delta_pct}%)` : '';
  lines.push(`VI:          ${viStr}${viDelta}`);
  const scoreStr = entry.score != null ? `${entry.score}/100` : 'n/a';
  const scoreFrom = lastEntry && lastEntry.score != null ? ` (von ${lastEntry.score})` : '';
  lines.push(`Score:       ${scoreStr}${scoreFrom}`);
  lines.push(`Phase:       ${entry.phase != null ? entry.phase : 'n/a'}`);
  const kwStr = entry.keywords_t10 != null ? String(entry.keywords_t10) : 'n/a';
  const kwDelta = entry.keywords_t10_delta != null ? ` (${entry.keywords_t10_delta > 0 ? '+' : ''}${entry.keywords_t10_delta})` : '';
  lines.push(`Top-10:      ${kwStr} Keywords${kwDelta}`);
  if (entry.component_scores) {
    const cs = entry.component_scores;
    const fmt = (c) => c != null && c.value != null ? String(c.value) : 'n/a';
    lines.push(`Components:  VI=${fmt(cs.vi_trend)} KW=${fmt(cs.keyword_stability)} QW=${fmt(cs.quick_win_progress)} ISS=${fmt(cs.issue_reduction)} BL=${fmt(cs.backlink_quality)}`);
  }
  lines.push('--------------------------------------------');
  return lines.join('\n');
}

if (require.main === module) {
  const args = parseCLI();
  if (!args.domain) {
    console.error('Usage: node recovery-monitor.js --domain <domain> [--cache-dir <path>]');
    process.exit(2);
  }
  try {
    const { domain, slug, input_domain } = normalizeDomain(args.domain);
    const result = writeMonitorEntry(input_domain, domain, slug, null, null, ['CLI mode: no live data fetched'], []);
    console.log(formatDeltaReport(result.entry, result.lastEntry));
    process.exit(result.entry.status === 'failed' ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(e.message.includes('Lock') ? 3 : 1);
  }
}

module.exports = {
  computeRecoveryScore,
  getLastEntry,
  getBaseline,
  getIssuesData,
  determinePhase,
  writeMonitorEntry,
  formatDeltaReport,
  SCORE_WEIGHTS,
  parseCLI,
};
