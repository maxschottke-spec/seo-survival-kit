'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeDomain,
  ensureDomainDir,
  acquireLock,
  releaseLock,
  appendNDJSON,
  safeReadFile,
} = require('../lib/safe.js');

const SCORE_WEIGHTS = {
  vi_trend: 0.30,
  keyword_stability: 0.25,
  quick_win_progress: 0.20,
  issue_reduction: 0.15,
  backlink_quality: 0.10,
};

function computeRecoveryScore(current, baseline, lastEntry) {
  let score = 50;
  const components = {};

  if (current.vi != null && baseline && baseline.vi_current != null) {
    const viRatio = current.vi / baseline.vi_current;
    const viScore = Math.min(100, Math.max(0, viRatio * 100));
    components.vi_trend = viScore;
    score += (viScore - 50) * SCORE_WEIGHTS.vi_trend;
  }

  if (current.keywords_t10 != null && lastEntry && lastEntry.keywords_t10 != null) {
    const delta = current.keywords_t10 - lastEntry.keywords_t10;
    const stabilityScore = Math.min(100, Math.max(0, 50 + delta * 5));
    components.keyword_stability = stabilityScore;
    score += (stabilityScore - 50) * SCORE_WEIGHTS.keyword_stability;
  }

  score = Math.round(Math.min(100, Math.max(0, score)));
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

function determinePhase(score, baseline) {
  if (!baseline) return 'R2';
  if (score < 20) return 'R1';
  if (score < 40) return 'R2';
  if (score < 60) return 'R3';
  if (score < 80) return 'R4';
  return 'R5';
}

function writeMonitorEntry(inputDomain, domain, slug, vi, keywordsT10, warnings, errors) {
  const dir = ensureDomainDir(slug);
  const historyPath = path.join(dir, 'history.ndjson');
  const lock = acquireLock(dir, 'recovery-monitor');
  try {
    const lastEntry = getLastEntry(historyPath);
    const baseline = getBaseline(dir);
    const current = { vi, keywords_t10: keywordsT10 };
    const { score } = computeRecoveryScore(current, baseline, lastEntry);
    const phase = determinePhase(score, baseline);
    const status = errors.length > 0 ? 'failed' : warnings.length > 0 ? 'partial' : 'complete';

    const entry = {
      status,
      input_domain: inputDomain,
      domain,
      canonical_domain: null,
      slug,
      timestamp: new Date().toISOString(),
      warnings,
      errors,
      vi,
      vi_delta_pct: lastEntry && lastEntry.vi ? Math.round(((vi - lastEntry.vi) / lastEntry.vi) * 1000) / 10 : null,
      score,
      phase,
      keywords_t10: keywordsT10,
      keywords_t10_delta: lastEntry && lastEntry.keywords_t10 != null ? keywordsT10 - lastEntry.keywords_t10 : null,
      top_losers_recovered: null,
      issues_open: null,
      issues_fixed: null,
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
  lines.push('--------------------------------------------');
  return lines.join('\n');
}

module.exports = {
  computeRecoveryScore,
  getLastEntry,
  getBaseline,
  determinePhase,
  writeMonitorEntry,
  formatDeltaReport,
  SCORE_WEIGHTS,
};
