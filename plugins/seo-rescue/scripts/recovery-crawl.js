'use strict';
const path = require('node:path');
const {
  normalizeDomain,
  ensureDomainDir,
  acquireLock,
  releaseLock,
  atomicWriteJSON,
} = require('../lib/safe.js');

const SEVERITY_MAP = {
  broken_internal_link: { default: 'high', upgrade: (d) => d.inlink_count > 100 ? 'critical' : null },
  redirect_chain: { default: 'medium', upgrade: (d) => d.original_topic_lost ? 'high' : null },
  non_indexable_canonical: { default: 'high', upgrade: () => null },
  missing_h1: { default: 'medium', upgrade: () => null },
  duplicate_h1: { default: 'low', upgrade: (d, count) => count > 10 ? 'medium' : null },
  missing_meta_description: { default: 'low', upgrade: () => null },
  orphan_page: { default: 'medium', upgrade: () => null },
};

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

function writeIssuesJSON(domain, slug, inputDomain, crawledUrls, rawIssues, warnings, errors) {
  const dir = ensureDomainDir(slug);
  const lockPath = acquireLock(dir);
  try {
    const issues = classifyIssues(rawIssues);
    const summary = buildSummary(issues);
    const status = errors.length > 0 ? 'failed' : warnings.length > 0 ? 'partial' : 'complete';
    const output = {
      status,
      input_domain: inputDomain,
      domain,
      canonical_domain: null,
      slug,
      timestamp: new Date().toISOString(),
      warnings,
      errors,
      crawled_urls: crawledUrls,
      issues,
      summary,
    };
    atomicWriteJSON(path.join(dir, 'issues.json'), output);
    return output;
  } finally {
    releaseLock(lockPath);
  }
}

module.exports = { classifyIssues, buildSummary, writeIssuesJSON, SEVERITY_MAP };
