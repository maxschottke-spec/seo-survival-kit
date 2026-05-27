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
  const components = {
    vi_trend_score: null,
    keyword_stability_score: null,
    quick_win_score: null,
    issue_reduction_score: null,
    backlink_quality_score: null,
  };
  let availableComponents = 0;

  // VI trend: +10% = 100, 0% = 50, -10% = 0, linear
  if (current.vi != null && baseline && baseline.vi_current != null && baseline.vi_current > 0) {
    const changePct = ((current.vi - baseline.vi_current) / baseline.vi_current) * 100;
    components.vi_trend_score = Math.round(Math.min(100, Math.max(0, 50 + changePct * 5)));
    availableComponents++;
  }

  // Keyword stability: % of baseline top-10 keywords still in top 10
  if (current.keywords_t10 != null && baseline && baseline.position_distribution && baseline.position_distribution.t10 > 0) {
    const baseT10 = baseline.position_distribution.t10;
    const ratio = Math.min(1, current.keywords_t10 / baseT10);
    components.keyword_stability_score = Math.round(ratio * 100);
    availableComponents++;
  }

  // Quick win: use delta from last entry as proxy
  if (lastEntry && lastEntry.keywords_t10 != null && current.keywords_t10 != null) {
    const delta = current.keywords_t10 - lastEntry.keywords_t10;
    components.quick_win_score = Math.round(Math.min(100, Math.max(0, 50 + delta * 10)));
    availableComponents++;
  }

  // Issue reduction: needs current issues data
  if (current.issues_open != null && baseline) {
    const baseIssues = (baseline.issues_critical || 0) + (baseline.issues_high || 0);
    if (baseIssues > 0) {
      const reduction = 1 - (current.issues_open / baseIssues);
      components.issue_reduction_score = Math.round(Math.min(100, Math.max(0, reduction * 100)));
      availableComponents++;
    }
  }

  // Backlink quality: neutral if no data
  components.backlink_quality_score = 50;
  availableComponents++;

  // Need at least 2 components for a score
  if (availableComponents < 2) {
    return { score: null, components };
  }

  let score = 0;
  const weights = SCORE_WEIGHTS;
  let totalWeight = 0;
  if (components.vi_trend_score != null) { score += components.vi_trend_score * weights.vi_trend; totalWeight += weights.vi_trend; }
  if (components.keyword_stability_score != null) { score += components.keyword_stability_score * weights.keyword_stability; totalWeight += weights.keyword_stability; }
  if (components.quick_win_score != null) { score += components.quick_win_score * weights.quick_win_progress; totalWeight += weights.quick_win_progress; }
  if (components.issue_reduction_score != null) { score += components.issue_reduction_score * weights.issue_reduction; totalWeight += weights.issue_reduction; }
  if (components.backlink_quality_score != null) { score += components.backlink_quality_score * weights.backlink_quality; totalWeight += weights.backlink_quality; }

  score = totalWeight > 0 ? Math.round(score / totalWeight) : null;

  return { score, components };
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
  if (!baseline) return 'R2';
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
    const current = { vi, keywords_t10: keywordsT10, issues_open: issuesData ? issuesData.open : null };
    const { score, components } = computeRecoveryScore(current, baseline, lastEntry);
    const phase = determinePhase(score, baseline);
    const status = errors.length > 0 ? 'failed' : warnings.length > 0 ? 'partial' : 'complete';
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
      vi,
      vi_delta_pct: lastEntry && lastEntry.vi ? Math.round(((vi - lastEntry.vi) / lastEntry.vi) * 1000) / 10 : null,
      score,
      phase,
      keywords_t10: keywordsT10,
      keywords_t10_delta: lastEntry && lastEntry.keywords_t10 != null ? keywordsT10 - lastEntry.keywords_t10 : null,
      top_losers_recovered: null,
      issues_open: issuesData ? issuesData.open : null,
      issues_fixed: issuesData ? issuesData.fixed : null,
      issue_data_fresh: options.issueDataFresh !== undefined ? options.issueDataFresh : false,
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
  const scoreFrom = lastEntry ? ` (von ${lastEntry.score})` : '';
  lines.push(`Score:       ${entry.score}/100${scoreFrom}`);
  lines.push(`Phase:       ${entry.phase}`);
  const kwStr = entry.keywords_t10 != null ? String(entry.keywords_t10) : 'n/a';
  const kwDelta = entry.keywords_t10_delta != null ? ` (${entry.keywords_t10_delta > 0 ? '+' : ''}${entry.keywords_t10_delta})` : '';
  lines.push(`Top-10:      ${kwStr} Keywords${kwDelta}`);
  if (entry.component_scores) {
    const cs = entry.component_scores;
    const fmt = (v) => v != null ? String(v) : 'n/a';
    lines.push(`Components:  VI=${fmt(cs.vi_trend_score)} KW=${fmt(cs.keyword_stability_score)} QW=${fmt(cs.quick_win_score)} ISS=${fmt(cs.issue_reduction_score)} BL=${fmt(cs.backlink_quality_score)}`);
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
