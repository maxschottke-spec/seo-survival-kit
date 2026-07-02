'use strict';
const path = require('node:path');
const { parseArgs } = require('node:util');

const {
  normalizeDomain,
  ensureDomainDir,
  acquireLock,
  releaseLock,
  atomicWriteJSON,
  generateRunId,
} = require('../lib/safe.js');

const SEVERITY_MAP = {
  broken_internal_link: { default: 'high', upgrade: (d) => d.inlink_count > 100 ? 'critical' : null },
  redirect_chain: { default: 'medium', upgrade: (d) => d.original_topic_lost ? 'high' : null },
  non_indexable_canonical: { default: 'high', upgrade: () => null },
  missing_h1: { default: 'medium', upgrade: () => null },
  duplicate_h1: { default: 'low', upgrade: (d, count) => count > 10 ? 'medium' : null },
  missing_meta_description: { default: 'low', upgrade: () => null },
  orphan_page: { default: 'medium', upgrade: () => null },
  // Shopware-specific patterns (see commands/recovery-crawl.md, "Shopware-spezifische Crawl-Patterns")
  shopware_url_resolver_conflict: { default: 'high', upgrade: () => null },
  dreisc_301_404_chain: { default: 'high', upgrade: () => null },
  duplicate_canonical_blog: { default: 'high', upgrade: (d) => (d && d.top10_ranking === true) ? 'critical' : null },
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

function classifyIssues(rawIssues) {
  return rawIssues.map(issue => {
    const mapping = SEVERITY_MAP[issue.type];
    if (!mapping) return { ...issue, severity: 'medium' };
    let severity = mapping.default;
    if (issue.details && issue.details.length > 0) {
      for (const d of issue.details) {
        const upgraded = mapping.upgrade(d, issue.count);
        if (upgraded) { severity = upgraded; break; }
      }
    } else {
      const upgraded = mapping.upgrade({}, issue.count);
      if (upgraded) severity = upgraded;
    }
    return { ...issue, severity };
  });
}

function buildSummary(issues) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, total_issues: 0 };
  for (const i of issues) {
    summary[i.severity] = (summary[i.severity] || 0) + 1;
    summary.total_issues++;
  }
  return summary;
}

function writeIssuesJSON(domain, slug, inputDomain, crawledUrls, rawIssues, warnings, errors, options = {}) {
  const dir = ensureDomainDir(slug);
  const lock = acquireLock(dir, 'recovery-crawl');
  try {
    const issues = classifyIssues(rawIssues);
    const summary = buildSummary(issues);
    // crawler_provider must be declared by the caller (e.g. 'screaming_frog_mcp', 'csv_import').
    // No silent 'unknown' default: a missing provider is warned and data_quality stays conservative.
    const crawlerProvider = options.crawlerProvider || null;
    if (!crawlerProvider) {
      warnings.push('crawler_provider missing — caller must pass options.crawlerProvider; data_quality capped at "partial"');
    }
    const status = errors.length > 0 ? 'failed' : warnings.length > 0 ? 'partial' : 'complete';
    const dataQuality = options.localCrawlerUsed ? 'poor' : ((crawlerProvider === 'csv_import' || !crawlerProvider) ? 'partial' : 'good');
    const output = {
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
      crawl_limit: options.crawlLimit || 500,
      crawled_internal_html_urls: crawledUrls,
      exported_rows_total: options.exportedRowsTotal || crawledUrls,
      raw_exports_used: options.rawExportsUsed || [],
      crawler_provider: crawlerProvider,
      local_crawler_used: options.localCrawlerUsed || false,
      issues,
      summary,
    };
    atomicWriteJSON(path.join(dir, 'issues.json'), output);
    return output;
  } finally {
    releaseLock(lock);
  }
}

if (require.main === module) {
  const args = parseCLI();
  if (!args.domain) {
    console.error('Usage: node recovery-crawl.js --domain <domain> [--cache-dir <path>]');
    process.exit(2);
  }
  try {
    const { domain, slug } = normalizeDomain(args.domain);
    // Read raw exports from cache dir
    const cacheDir = args['cache-dir'] || ensureDomainDir(slug);
    // This CLI entry point expects raw data to already be in crawl/raw/ or imports/crawl/
    console.log(JSON.stringify({ domain, slug, cacheDir, message: 'Ready for crawl data processing' }));
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(e.message.includes('Lock') ? 3 : 1);
  }
}

module.exports = { classifyIssues, buildSummary, writeIssuesJSON, SEVERITY_MAP, parseCLI };
