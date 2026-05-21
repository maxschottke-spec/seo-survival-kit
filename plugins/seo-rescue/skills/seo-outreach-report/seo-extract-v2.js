'use strict';
// Extracts per-domain summary metrics from the raw JSON dumps produced by seo-audit-fetch-v2.js.
//
// Run: node seo-extract-v2.js [slug,slug,...]

const fs = require('node:fs');

const CONFIG_PATH = process.env.SEO_AUDIT_CONFIG || './audit-config.json';
if (!fs.existsSync(CONFIG_PATH)) { console.error(`Config not found: ${CONFIG_PATH}`); process.exit(1); }
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const filterSlugs = (process.argv[2] || '').split(',').filter(Boolean);
const TARGETS = filterSlugs.length
  ? CONFIG.targets.filter(t => filterSlugs.includes(t.slug))
  : CONFIG.targets;

function summarize(t) {
  const rawPath = `/tmp/seo-${t.slug}-raw.json`;
  if (!fs.existsSync(rawPath)) { console.error(`Skip ${t.slug}: ${rawPath} missing — run seo-audit-fetch-v2.js first`); return; }
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const o = { ...t };

  // Sistrix VI current
  const viNow = raw.sistrix.vi?.answer?.[0]?.sichtbarkeitsindex?.[0];
  o.vi_current = viNow ? parseFloat(viNow.value) : null;
  o.vi_date = viNow?.date || null;

  // Sistrix VI overview (min/max/weeks)
  const ov = raw.sistrix.vi_overview?.answer?.[0];
  o.vi_all_time_max = ov?.sichtbarkeitsindex_overview_max?.[0] ? { value: parseFloat(ov.sichtbarkeitsindex_overview_max[0].value), date: ov.sichtbarkeitsindex_overview_max[0].date } : null;
  o.vi_all_time_min = ov?.sichtbarkeitsindex_overview_min?.[0] ? { value: parseFloat(ov.sichtbarkeitsindex_overview_min[0].value), date: ov.sichtbarkeitsindex_overview_min[0].date } : null;
  o.vi_weeks_tracked = ov?.sichtbarkeitsindex_overview?.[0]?.weeks || null;

  // Sistrix VI history series
  o.vi_series = raw.sistrix.vi_history || [];
  if (o.vi_series.length > 4) {
    const last = o.vi_series[o.vi_series.length - 1].value;
    const ago4 = o.vi_series[o.vi_series.length - 5]?.value;
    const ago12 = o.vi_series[o.vi_series.length - 13]?.value;
    o.vi_trend_4w  = ago4  > 0 ? +(((last - ago4)  / ago4)  * 100).toFixed(1) : null;
    o.vi_trend_12w = ago12 > 0 ? +(((last - ago12) / ago12) * 100).toFixed(1) : null;
  }

  // DataForSEO ranked
  const d4sItems = raw.dataforseo.ranked?.tasks?.[0]?.result?.[0]?.items || [];
  o.d4s_kw_total = raw.dataforseo.ranked?.tasks?.[0]?.result?.[0]?.total_count || d4sItems.length;
  o.d4s_top_keywords = d4sItems.slice(0, 30).map(it => ({
    keyword: it.keyword_data?.keyword,
    position: it.ranked_serp_element?.serp_item?.rank_group,
    url: it.ranked_serp_element?.serp_item?.url,
    sv: it.keyword_data?.keyword_info?.search_volume,
    kd: it.keyword_data?.keyword_properties?.keyword_difficulty,
    etv: it.ranked_serp_element?.serp_item?.estimated_traffic_volume,
  }));
  o.pos_dist = { t3: 0, t10: 0, t20: 0, t50: 0, t100: 0 };
  for (const it of d4sItems) {
    const p = it.ranked_serp_element?.serp_item?.rank_group;
    if (p == null) continue;
    if (p <= 3) o.pos_dist.t3++;
    else if (p <= 10) o.pos_dist.t10++;
    else if (p <= 20) o.pos_dist.t20++;
    else if (p <= 50) o.pos_dist.t50++;
    else o.pos_dist.t100++;
  }
  o.quick_wins = d4sItems
    .filter(it => {
      const p = it.ranked_serp_element?.serp_item?.rank_group;
      const sv = it.keyword_data?.keyword_info?.search_volume || 0;
      return p > 3 && p <= 20 && sv >= 100;
    })
    .slice(0, 15)
    .map(it => ({
      keyword: it.keyword_data?.keyword,
      position: it.ranked_serp_element?.serp_item?.rank_group,
      sv: it.keyword_data?.keyword_info?.search_volume,
      url: it.ranked_serp_element?.serp_item?.url,
    }));

  // Backlinks
  const bl = raw.dataforseo.backlinks?.tasks?.[0]?.result?.[0] || {};
  o.backlinks = {
    total: bl.backlinks,
    referring_domains: bl.referring_domains,
    referring_ips: bl.referring_ips,
    rank: bl.rank,
    backlinks_spam_score: bl.backlinks_spam_score,
    crawled_pages: bl.crawled_pages,
    referring_links_dofollow: bl.referring_links_dofollow,
    first_seen: bl.first_seen,
  };

  // Referring domains
  const rd = raw.dataforseo.ref_domains?.tasks?.[0]?.result?.[0]?.items || [];
  o.top_referring_domains = rd.slice(0, 15).map(d => ({
    domain: d.domain,
    rank: d.rank,
    backlinks: d.backlinks,
    first_seen: d.first_seen,
  }));

  // Competitors
  const d4sComp = raw.dataforseo.competitors?.tasks?.[0]?.result?.[0]?.items || [];
  o.d4s_competitors = d4sComp.slice(0, 8).map(c => ({
    domain: c.domain,
    etv: c.metrics?.organic?.etv,
    kw_count: c.metrics?.organic?.count,
    intersections: c.intersections,
    avg_position: c.avg_position,
  }));

  // PSI
  for (const strat of ['mobile', 'desktop']) {
    const p = raw.psi[strat]?.lighthouseResult;
    if (!p) { o[`psi_${strat}`] = null; continue; }
    const audits = p.audits || {};
    const cats = p.categories || {};
    o[`psi_${strat}`] = {
      perf: cats.performance ? Math.round(cats.performance.score * 100) : null,
      seo: cats.seo ? Math.round(cats.seo.score * 100) : null,
      a11y: cats.accessibility ? Math.round(cats.accessibility.score * 100) : null,
      bp: cats['best-practices'] ? Math.round(cats['best-practices'].score * 100) : null,
      lcp: audits['largest-contentful-paint']?.numericValue,
      fcp: audits['first-contentful-paint']?.numericValue,
      tbt: audits['total-blocking-time']?.numericValue,
      cls: audits['cumulative-layout-shift']?.numericValue,
      ttfb: audits['server-response-time']?.numericValue,
      crux_lcp: raw.psi[strat]?.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.category,
      crux_inp: raw.psi[strat]?.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT_MS?.category,
      crux_cls: raw.psi[strat]?.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category,
      crux_overall: raw.psi[strat]?.loadingExperience?.overall_category,
    };
  }

  fs.writeFileSync(`/tmp/seo-${t.slug}-summary.json`, JSON.stringify(o, null, 2));
  console.error(`[${t.slug}] VI=${o.vi_current} kw=${o.d4s_kw_total} rd=${o.backlinks.referring_domains} psi-m=${o.psi_mobile?.perf}/${o.psi_mobile?.seo}`);
}

for (const t of TARGETS) summarize(t);
