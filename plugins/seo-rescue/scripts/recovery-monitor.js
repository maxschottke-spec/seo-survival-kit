'use strict';
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeDomain,
  ensureDomainDir,
  resolveDomainDir,
  acquireLock,
  releaseLock,
  appendNDJSON,
  safeReadFile,
  generateRunId,
  safeReadJSON,
  parseStrictCli,
} = require('../lib/safe.js');

const SCORE_WEIGHTS = {
  vi_trend: 0.30,
  keyword_stability: 0.25,
  quick_win_progress: 0.20,
  issue_reduction: 0.15,
  backlink_quality: 0.10,
};

const CLI_SPEC = {
  domain: 'string',
  'cache-dir': 'string',
  'dry-run': 'boolean',
  vi: 'string',
  'keywords-t10': 'string',
  help: 'boolean',
};

// Strict: unknown options, a value on a switch (--dry-run=true), an option
// without its value, an empty value and a repeated option all throw (code
// 'USAGE'). See parseStrictCli in lib/safe.js.
function parseCLI(argv) {
  return parseStrictCli(CLI_SPEC, argv);
}

// Value ranges. The upper bounds are sanity limits, not SEO facts: they sit far
// above anything a real domain shows and far below the point where JavaScript
// numbers lose integer precision (2^53) or percentage arithmetic overflows.
const LIMITS = {
  vi: { min: 0, max: 1e6 },                       // visibility index, fractional
  keywordsT10: { min: 0, max: 1e9, integer: true },   // count of keywords
  keywordsTotal: { min: 0, max: 1e9, integer: true }, // count of keywords
  viTrend4wPct: { min: -100, max: 1e6 },          // a value cannot fall by more than 100 %
  backlinkSpamScore: { min: 0, max: 100 },        // percentage score
};

// Returns the number, or null when the value is absent. Throws on anything that
// is not a finite number inside the range (and a safe integer where required).
function checkNumber(name, value, { min, max, integer = false }) {
  if (value == null) return null;
  const ok = typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    && (!integer || Number.isSafeInteger(value));
  if (!ok) {
    throw new Error(`Invalid value for ${name}: ${JSON.stringify(value)} (${integer ? 'whole number' : 'number'} from ${min} to ${max} expected)`);
  }
  return value;
}

// Parses an optional number from a CLI string. Only plain decimal notation is
// accepted ("0.42", "12"): no exponent, no sign, no hex, no "Infinity".
function parseNumberOption(name, raw, limits) {
  if (raw == null) return null;
  if (typeof raw !== 'string' || !/^\d+(\.\d+)?$/.test(raw)) {
    const err = new Error(`Invalid arguments: --${name} must be a plain non-negative number, got ${JSON.stringify(raw)}`);
    err.code = 'USAGE';
    throw err;
  }
  // Compare the digits, not the parsed float: 9007199254740993 parses to …992.
  if (limits.integer && !/^\d{1,15}$/.test(raw)) {
    const err = new Error(`Invalid arguments: --${name} must be a whole number up to ${limits.max}, got ${JSON.stringify(raw)}`);
    err.code = 'USAGE';
    throw err;
  }
  try {
    return checkNumber(`--${name}`, Number(raw), limits);
  } catch (e) {
    const err = new Error(`Invalid arguments: ${e.message}`);
    err.code = 'USAGE';
    throw err;
  }
}

// A value read back from history.ndjson is external input: use it for a delta
// only if it is a finite number.
function finiteOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
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
  } else if (current.vi != null && baseline && Number.isFinite(baseline.vi_current) && baseline.vi_current > 0) {
    // Documented fallback: delta vs befund.json baseline (+10% = 100, 0% = 50, -10% = 0, linear)
    const changePct = ((current.vi - baseline.vi_current) / baseline.vi_current) * 100;
    values.vi_trend = Math.round(Math.min(100, Math.max(0, 50 + changePct * 5)));
  }

  // Keyword stability: % of baseline top-10 keywords still in top 10
  if (current.keywords_t10 != null && baseline && baseline.position_distribution && Number.isFinite(baseline.position_distribution.t10) && baseline.position_distribution.t10 > 0) {
    const baseT10 = baseline.position_distribution.t10;
    const ratio = Math.min(1, current.keywords_t10 / baseT10);
    values.keyword_stability = Math.round(ratio * 100);
  }

  // Quick win: top-10 delta vs last entry as proxy (first run: null)
  if (lastEntry && Number.isFinite(lastEntry.keywords_t10) && current.keywords_t10 != null) {
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

// options.cacheDir — explicit cache root (the --cache-dir option). Goes through
//   ensureDomainDir()/getCacheDir() in lib/safe.js: created 0700, symlink refused.
//   Without it: SEO_CACHE_DIR or ~/.cache/seo-rescue/.
// options.manualInput — values were typed in by hand (direct CLI call);
//   data_quality is capped at 'partial', confidence at 'medium'.
// options.dryRun — compute the entry against whatever is already in the cache,
//   but create no directory, take no lock and append nothing.
function writeMonitorEntry(inputDomain, domain, slug, vi, keywordsT10, warnings, errors, options = {}) {
  // Validate every number BEFORE the first file-system access. The CLI checks
  // its strings too, but this function is also called directly (command spec).
  vi = checkNumber('vi', vi, LIMITS.vi);
  keywordsT10 = checkNumber('keywordsT10', keywordsT10, LIMITS.keywordsT10);
  checkNumber('options.keywordsTotal', options.keywordsTotal, LIMITS.keywordsTotal);
  checkNumber('options.viTrend4wPct', options.viTrend4wPct, LIMITS.viTrend4wPct);
  checkNumber('options.backlinkSpamScore', options.backlinkSpamScore, LIMITS.backlinkSpamScore);
  if (options.dryRun != null && typeof options.dryRun !== 'boolean') {
    throw new Error(`Invalid value for options.dryRun: ${JSON.stringify(options.dryRun)} (true or false expected)`);
  }
  if (!Array.isArray(warnings) || !Array.isArray(errors)) {
    throw new Error('warnings and errors must be arrays');
  }
  const dryRun = options.dryRun === true;
  const dir = dryRun ? resolveDomainDir(slug, options.cacheDir) : ensureDomainDir(slug, options.cacheDir);
  const historyPath = path.join(dir, 'history.ndjson');
  const lock = dryRun ? null : acquireLock(dir, 'recovery-monitor');
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
    const computed = computeRecoveryScore(current, baseline, lastEntry);
    // Computed values are checked for finiteness: JSON.stringify would store
    // Infinity/NaN silently as null, i.e. as "no data" instead of "broken".
    const score = Number.isFinite(computed.score) ? computed.score : null;
    const components = computed.components;
    const lastVi = lastEntry ? finiteOrNull(lastEntry.vi) : null;
    const lastT10 = lastEntry ? finiteOrNull(lastEntry.keywords_t10) : null;
    let viDeltaPct = null;
    if (vi != null && lastVi != null && lastVi > 0) {
      const d = Math.round(((vi - lastVi) / lastVi) * 1000) / 10;
      if (Number.isFinite(d)) viDeltaPct = d;
      else warnings.push('vi_delta_pct not computable (previous VI too close to zero) — stored as null');
    }
    let t10Delta = null;
    if (keywordsT10 != null && lastT10 != null) {
      const d = keywordsT10 - lastT10;
      if (Number.isSafeInteger(d)) t10Delta = d;
      else warnings.push('keywords_t10_delta not computable (previous value is not a whole number) — stored as null');
    }
    const phase = determinePhase(score, baseline);
    // 'failed' is reserved for no-write aborts (lock timeout, symlink — exit codes 2/3).
    // Any entry that gets written is 'complete' or 'partial'.
    const status = (errors.length > 0 || warnings.length > 0) ? 'partial' : 'complete';
    let dataQuality = (vi != null && keywordsT10 != null) ? 'good' : (vi != null || keywordsT10 != null) ? 'partial' : 'poor';
    // Hand-entered values are not a live provider reading: never rate them 'good'
    // (and therefore never 'high' confidence).
    if (options.manualInput === true && dataQuality === 'good') dataQuality = 'partial';

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
      vi_delta_pct: viDeltaPct,
      score,
      phase,
      keywords_t10: keywordsT10,
      keywords_t10_delta: t10Delta,
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

    if (!dryRun) appendNDJSON(historyPath, entry);
    return { entry, lastEntry, historyPath, written: !dryRun };
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

const USAGE = `Usage: node recovery-monitor.js --domain <domain> [--vi <number>] [--keywords-t10 <integer>]
                                [--cache-dir <path>] [--dry-run]

  --domain        Domain to track (required).
  --vi            Current visibility index, entered by hand (e.g. from a Sistrix export).
                  Plain decimal number from 0 to 1000000, e.g. 0.42.
  --keywords-t10  Current number of keywords in the top 10, entered by hand.
                  Whole number from 0 to 1000000000.
  --cache-dir     Cache root to use instead of SEO_CACHE_DIR / ~/.cache/seo-rescue.
                  No part of the path may be a symlink.
  --dry-run       Print the entry that would be appended. Creates and writes nothing.
                  A switch: write it without a value.

Arguments are checked strictly, before anything is read or written: an unknown
option, --dry-run=true, an option without its value or a repeated option ends
the run with exit code 2.

Without --vi and --keywords-t10 the script has no data: it prints the current
state and appends nothing. Safe first run:
  node recovery-monitor.js --domain example.com --vi 0.42 --keywords-t10 12 --dry-run`;

// Exit codes: 0 ok (written, or deliberately nothing written) · 1 run failed ·
// 2 usage error or security abort (nothing was written) · 3 lock timeout.
function exitCodeFor(e) {
  if (e && e.code === 'USAGE') return 2;
  const msg = String((e && e.message) || '');
  if (/^normalizeDomain:/.test(msg)) return 2;
  if (/symlink|Unsafe|not owned|hard links|not a regular file|not a directory/i.test(msg)) return 2;
  if (msg.includes('Lock')) return 3;
  return 1;
}

if (require.main === module) {
  try {
    // 1. Arguments. Everything here happens before any file-system access.
    const args = parseCLI();
    if (args.help) {
      console.log(USAGE);
      process.exit(0);
    }
    if (!args.domain) {
      const err = new Error('Invalid arguments: --domain is required');
      err.code = 'USAGE';
      throw err;
    }
    const { domain, slug, input_domain } = normalizeDomain(args.domain);
    const vi = parseNumberOption('vi', args.vi, LIMITS.vi);
    const keywordsT10 = parseNumberOption('keywords-t10', args['keywords-t10'], LIMITS.keywordsT10);
    const hasData = vi != null || keywordsT10 != null;
    // No data: never append. A history line with nothing but nulls adds no
    // information and skews "delta vs. last entry" on the next real run.
    const dryRun = args['dry-run'] === true || !hasData;
    const warnings = [];
    if (vi == null) warnings.push('CLI mode: no VI given (--vi)');
    if (keywordsT10 == null) warnings.push('CLI mode: no top-10 keyword count given (--keywords-t10)');
    // 2. Work.
    const result = writeMonitorEntry(input_domain, domain, slug, vi, keywordsT10, warnings, [], {
      cacheDir: args['cache-dir'],
      dryRun,
      manualInput: true,
      providersUsed: hasData ? ['manual_cli'] : [],
      sourceNotes: hasData ? ['Values entered by hand on the command line'] : [],
    });
    console.log(formatDeltaReport(result.entry, result.lastEntry));
    if (!hasData) {
      console.log(`No data given (--vi / --keywords-t10): nothing written. History file would be: ${result.historyPath}`);
    } else if (!result.written) {
      console.log(`Dry run: nothing written. Entry that would be appended to ${result.historyPath}:`);
      console.log(JSON.stringify(result.entry));
    } else {
      console.log(`Appended to ${result.historyPath}`);
    }
    process.exit(0);
  } catch (e) {
    const code = exitCodeFor(e);
    console.error(e.message);
    if (e && e.code === 'USAGE') console.error('\n' + USAGE);
    if (code === 2) console.error('Nothing was written.');
    process.exit(code);
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
  parseNumberOption,
  checkNumber,
  exitCodeFor,
  LIMITS,
};
