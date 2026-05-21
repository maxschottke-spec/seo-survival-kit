'use strict';
// Extracts on-page signals (title, meta, H1, schema, CMS, image-alt) from locally cached
// homepage HTML files. Expects `/tmp/<slug>-home.html` to exist for each target.
//
// To cache homepage HTML for a domain:
//   curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "https://example.com/" > /tmp/<slug>-home.html

const fs = require('node:fs');

const CONFIG_PATH = process.env.SEO_AUDIT_CONFIG || './audit-config.json';
if (!fs.existsSync(CONFIG_PATH)) { console.error(`Config not found: ${CONFIG_PATH}`); process.exit(1); }
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const TARGETS = CONFIG.targets;

function extract(html) {
  const out = {};
  const m = (re) => { const x = html.match(re); return x ? x[1] : null; };
  const all = (re) => { const xs = []; let x; while ((x = re.exec(html)) !== null) xs.push(x[1]); return xs; };

  out.title = m(/<title[^>]*>([^<]*)<\/title>/i);
  out.title_len = out.title ? out.title.length : 0;
  out.meta_desc = m(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  out.meta_desc_len = out.meta_desc ? out.meta_desc.length : 0;
  out.canonical = m(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  out.lang = m(/<html[^>]*lang=["']([^"']*)["']/i);
  out.viewport = !!m(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["']/i);
  out.robots_meta = m(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  out.og_title = m(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  out.og_desc = m(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  out.og_image = m(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
  out.h1s = all(/<h1[^>]*>([^<]{1,200})/gi).map(s => s.trim());
  out.h2s = all(/<h2[^>]*>([^<]{1,200})/gi).slice(0, 25).map(s => s.trim());
  out.h1_count = out.h1s.length;
  out.h2_count = out.h2s.length;
  out.jsonld_count = (html.match(/application\/ld\+json/gi) || []).length;
  const ldBlocks = [];
  const ldRe = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let lm;
  while ((lm = ldRe.exec(html)) !== null) ldBlocks.push(lm[1]);
  out.schema_types = [];
  for (const blk of ldBlocks) {
    const types = blk.match(/"@type"\s*:\s*"([^"]+)"/g) || [];
    for (const t of types) out.schema_types.push(t.match(/"([^"]+)"$/)[1]);
  }
  out.schema_types = [...new Set(out.schema_types)];

  if (/gambio/i.test(html)) out.cms = 'Gambio';
  else if (/shopware/i.test(html)) out.cms = 'Shopware';
  else if (/shopify/i.test(html)) out.cms = 'Shopify';
  else if (/woocommerce|wp-content/i.test(html)) out.cms = 'WordPress/WooCommerce';
  else if (/_next\/static/i.test(html)) out.cms = 'Next.js';
  else if (/codeigniter|ci_session/i.test(html)) out.cms = 'CodeIgniter (Custom)';
  else if (/oxid/i.test(html)) out.cms = 'OXID';
  else if (/jtl/i.test(html)) out.cms = 'JTL';
  else out.cms = 'Unbekannt/Custom';

  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  out.word_count = text.split(' ').filter(w => w.length > 1).length;

  out.hreflang_count = (html.match(/hreflang=/gi) || []).length;
  const imgs = html.match(/<img[^>]+>/gi) || [];
  out.img_total = imgs.length;
  out.img_no_alt = imgs.filter(i => !/alt=/i.test(i) || /alt=["']\s*["']/i.test(i)).length;
  const links = html.match(/<a[^>]+href=["']([^"']+)["']/gi) || [];
  out.link_total = links.length;
  return out;
}

const result = {};
for (const t of TARGETS) {
  const file = `/tmp/${t.slug}-home.html`;
  if (!fs.existsSync(file)) { console.error(`Skip ${t.slug}: ${file} missing — cache the homepage first with curl`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  result[t.slug] = extract(html);
  const r = result[t.slug];
  console.error(`[${t.slug}] title="${r.title}" h1=${r.h1_count} schema=${r.schema_types.join(',')} cms=${r.cms} img=${r.img_total} (no-alt=${r.img_no_alt}) words=${r.word_count}`);
}
fs.writeFileSync('/tmp/seo-onpage.json', JSON.stringify(result, null, 2));
