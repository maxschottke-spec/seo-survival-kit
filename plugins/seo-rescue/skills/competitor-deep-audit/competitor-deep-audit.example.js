'use strict';
// Competitor Deep Audit — starter script.
// Identifies top organic competitors + computes keyword gaps via DataForSEO.
//
// Run: node --env-file=.env competitor-deep-audit.example.js <your-domain>

const fs = require('node:fs');
const { safeHostname } = require('../../lib/safe.js');

// Validate-at-load: TARGET flows into the DataForSEO request body AND into
// the output filename stem below (`./${stem}.json`). Without this check,
// `node competitor-deep-audit.example.js /tmp/poc` would write outside CWD,
// and a tab-character or NUL in the domain would break downstream parsers.
// safeHostname enforces a strict RFC1123 hostname charset — slashes,
// protocols, paths, and whitespace are all rejected.
const TARGET = process.argv[2];
if (!TARGET) { console.error('Usage: node competitor-deep-audit.example.js <your-domain>'); process.exit(1); }
safeHostname(TARGET);

const D4S_LOGIN = process.env.DATAFORSEO_LOGIN;
const D4S_PASS = process.env.DATAFORSEO_PASSWORD;
if (!D4S_LOGIN || !D4S_PASS) { console.error('Missing DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD env vars'); process.exit(1); }

// Filter out marketplaces / aggregators that show up in SERPs but aren't actionable
const COMPETITOR_BLACKLIST = ['amazon.de', 'amazon.com', 'ebay.de', 'ebay.com', 'wikipedia.org', 'youtube.com', 'pinterest.de', 'pinterest.com', 'idealo.de', 'google.com', 'facebook.com', 'instagram.com', 'reddit.com'];

function d4sAuth() { return 'Basic ' + Buffer.from(`${D4S_LOGIN}:${D4S_PASS}`).toString('base64'); }
async function d4sPost(path, body) {
  const r = await fetch(`https://api.dataforseo.com${path}`, {
    method: 'POST',
    headers: { Authorization: d4sAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify([body]),
  });
  return r.json().catch(() => ({}));
}

async function rankedKeywords(domain, limit=500) {
  const j = await d4sPost('/v3/dataforseo_labs/google/ranked_keywords/live', {
    target: domain, language_code: 'de', location_code: 2276, limit,
    order_by: ['ranked_serp_element.serp_item.estimated_traffic_volume,desc'],
  });
  const items = j.tasks?.[0]?.result?.[0]?.items || [];
  const map = new Map();
  for (const it of items) {
    const kw = it.keyword_data?.keyword;
    if (!kw) continue;
    map.set(kw, {
      keyword: kw,
      sv: it.keyword_data?.keyword_info?.search_volume || 0,
      position: it.ranked_serp_element?.serp_item?.rank_group,
      url: it.ranked_serp_element?.serp_item?.url,
      etv: it.ranked_serp_element?.serp_item?.estimated_traffic_volume || 0,
    });
  }
  return map;
}

(async () => {
  console.error(`Fetching competitors for ${TARGET}...`);
  const compRes = await d4sPost('/v3/dataforseo_labs/google/competitors_domain/live', {
    target: TARGET, language_code: 'de', location_code: 2276, limit: 25,
  });
  const compItems = compRes.tasks?.[0]?.result?.[0]?.items || [];
  const realComps = compItems
    .filter(c => !COMPETITOR_BLACKLIST.includes(c.domain))
    .slice(0, 8);

  console.error(`Real competitors (filtered):`);
  realComps.forEach((c, i) => console.error(`  ${i+1}. ${c.domain} (intersections=${c.intersections}, etv=${Math.round(c.metrics?.organic?.etv || 0)})`));

  console.error(`\nFetching your ranked keywords...`);
  const yourKws = await rankedKeywords(TARGET, 1000);
  console.error(`  Found ${yourKws.size} keywords for ${TARGET}`);

  const gaps = new Map(); // keyword -> { sv, your_pos, best_comp, comp_pos, comp_url, comp_count }

  for (const comp of realComps) {
    console.error(`Fetching ${comp.domain} keywords...`);
    const compKws = await rankedKeywords(comp.domain, 500);
    for (const [kw, data] of compKws) {
      if (data.position > 10) continue; // only competitor top-10
      const yours = yourKws.get(kw);
      const yourPos = yours ? yours.position : null;
      if (yourPos !== null && yourPos <= 10) continue; // we already rank top-10, no gap
      const existing = gaps.get(kw);
      if (existing) {
        existing.comp_count += 1;
        if (data.position < existing.comp_pos) {
          existing.best_comp = comp.domain;
          existing.comp_pos = data.position;
          existing.comp_url = data.url;
        }
      } else {
        gaps.set(kw, {
          keyword: kw,
          sv: data.sv,
          your_pos: yourPos,
          best_comp: comp.domain,
          comp_pos: data.position,
          comp_url: data.url,
          comp_count: 1,
          etv: data.etv,
        });
      }
    }
  }

  // Score and sort
  const scored = [...gaps.values()].map(g => ({
    ...g,
    score: g.sv * (g.your_pos == null ? 1 : (1 - g.your_pos / 100)) * Math.log2(g.comp_count + 1),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 50);

  // Write outputs
  const date = new Date().toISOString().slice(0,10);
  const stem = `competitor-audit-${TARGET.replace(/\./g, '-')}-${date}`;
  fs.writeFileSync(`./${stem}.json`, JSON.stringify({ target: TARGET, competitors: realComps.map(c => c.domain), gaps: top }, null, 2));

  let md = `# Competitor Deep Audit — ${TARGET}\n\nDate: ${date}\n\n## Real competitors (top 8 by SERP overlap)\n\n`;
  realComps.forEach((c, i) => { md += `${i+1}. **${c.domain}** — ${c.intersections} keyword overlaps, ~${Math.round(c.metrics?.organic?.etv || 0)} ETV\n`; });
  md += `\n## Top 50 keyword gaps (sorted by opportunity score)\n\n| # | Keyword | SV | Your Pos | Best Competitor | Their Pos | Comps in Top 10 |\n|---|---------|---:|---------:|------------------|----------:|----------------:|\n`;
  top.forEach((g, i) => {
    md += `| ${i+1} | ${g.keyword} | ${g.sv} | ${g.your_pos == null ? '—' : g.your_pos} | ${g.best_comp} | ${g.comp_pos} | ${g.comp_count} |\n`;
  });
  md += `\n## Total estimated opportunity\n\n- Sum of gap-keyword search volume: **${top.reduce((s, g) => s + g.sv, 0).toLocaleString('de-DE')}** searches/month\n- Realistic capture (if you rank top-10 on top 15 of these): ~${Math.round(top.slice(0,15).reduce((s, g) => s + g.sv * 0.15, 0)).toLocaleString('de-DE')} additional visits/month\n`;

  fs.writeFileSync(`./${stem}.md`, md);
  console.error(`\n✅ Done. ${gaps.size} gaps found, top 50 saved to:`);
  console.error(`   ./${stem}.json`);
  console.error(`   ./${stem}.md`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
