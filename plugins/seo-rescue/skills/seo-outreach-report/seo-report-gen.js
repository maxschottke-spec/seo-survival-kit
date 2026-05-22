'use strict';
// Generates one HTML report per target → PDF via Chrome headless.
// Reads all editorial content from audit-config.json's `narrative[slug]` block.
//
// Config requirements per target slug in `narrative`:
//   - headline:           string (PDF cover headline)
//   - business_one_liner: string (one-sentence business description)
//   - diagnose:           [string,string,string]  (executive summary paragraphs)
//   - fazit:              [string,string,string]  (conclusion paragraphs)
//   - action_plan:        Array<{when,what,why,how,who,cost,impact}>
//
// Run: node seo-report-gen.js [slug,slug,...]   (defaults to all targets)

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { safeSlug, validateConfigTargets, safeReadFile, cachePath, mkRunDir, writeFileExclusive } = require('../../lib/safe.js');

const CONFIG_PATH = process.env.SEO_AUDIT_CONFIG || './audit-config.json';
if (!fs.existsSync(CONFIG_PATH)) { console.error(`Config not found: ${CONFIG_PATH}`); process.exit(1); }
const CONFIG = JSON.parse(safeReadFile(CONFIG_PATH));
validateConfigTargets(CONFIG.targets || []);
const filterSlugs = (process.argv[2] || '').split(',').filter(Boolean).map(safeSlug);
const TARGETS = filterSlugs.length
  ? CONFIG.targets.filter(t => filterSlugs.includes(t.slug))
  : CONFIG.targets;

const ONPAGE_PATH = cachePath('seo-onpage', '.json');
const ONPAGE_ALL = fs.existsSync(ONPAGE_PATH)
  ? JSON.parse(safeReadFile(ONPAGE_PATH))
  : {};

const OUTPUT_DIR = process.env.SEO_PDF_OUTPUT_DIR || `${process.env.HOME}/Downloads`;

const CHROME_PATH = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// HTML-escape: covers & < > " ' ` to make output safe inside both double- and
// single-quoted attributes plus template-literal-style backticks. The PDF is
// rendered by Chrome with a strict <meta CSP> below, but defense-in-depth here
// matters because tool API responses (DataForSEO backlink rows, schema_types
// extracted from third-party HTML) can carry attacker-controlled strings.
function esc(s) {
  return s == null ? '' : String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}
// Numeric coercion — for fields that the pipeline expects as numbers but which
// could be replaced by hostile strings if the cache file was tampered with.
function num(v) { return Number.isFinite(+v) ? +v : 0; }
function trunc(s, n) { if (!s) return '—'; return s.length > n ? s.slice(0,n-1)+'…' : s; }
function formatVI(v) { return v != null ? v.toFixed(4) : '—'; }
function formatPct(v) { return v != null ? (v >= 0 ? '+' : '') + v + '%' : '—'; }
function formatMs(v) { return v != null ? Math.round(v) + ' ms' : '—'; }
function formatSec(v) { return v != null ? (v / 1000).toFixed(1) + ' s' : '—'; }
function formatNumber(n) { return n == null ? '—' : new Intl.NumberFormat('de-DE').format(Math.round(n)); }

function light(score) {
  if (score == null) return ['#9ca3af', '—'];
  if (score >= 90) return ['#10b981', 'sehr gut'];
  if (score >= 70) return ['#84cc16', 'gut'];
  if (score >= 50) return ['#f59e0b', 'ausbaufähig'];
  return ['#ef4444', 'kritisch'];
}
function lightLCP(ms) {
  if (ms == null) return ['#9ca3af', '—'];
  if (ms <= 2500) return ['#10b981', 'sehr gut'];
  if (ms <= 4000) return ['#f59e0b', 'verbesserungsbedürftig'];
  return ['#ef4444', 'schlecht'];
}
function lightCLS(v) {
  if (v == null) return ['#9ca3af', '—'];
  if (v <= 0.1) return ['#10b981', 'sehr gut'];
  if (v <= 0.25) return ['#f59e0b', 'verbesserungsbedürftig'];
  return ['#ef4444', 'schlecht'];
}

function viChart(series, width=720, height=180) {
  if (!series || series.length === 0) return '';
  const max = Math.max(...series.map(p => p.value));
  const span = max || 1;
  const padL = 40, padR = 10, padT = 10, padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const pts = series.map((p, i) => {
    const x = padL + (i / (series.length - 1)) * innerW;
    const y = padT + innerH - (p.value / span) * innerH;
    return [x, y, p];
  });
  const linePath = pts.map((p, i) => (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${pts[pts.length-1][0].toFixed(1)},${padT+innerH} L${pts[0][0].toFixed(1)},${padT+innerH} Z`;
  const yTicks = [0, max * 0.5, max].map(v => {
    const y = padT + innerH - (v / span) * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${width-padR}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>
            <text x="${padL-5}" y="${y+3}" text-anchor="end" font-size="9" fill="#6b7280">${v.toFixed(2)}</text>`;
  }).join('');
  const xLabels = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 6)) === 0).map(p => {
    const d = p[2].date;
    return `<text x="${p[0]}" y="${height-padB+15}" text-anchor="middle" font-size="9" fill="#6b7280">${d.slice(2,7)}</text>`;
  }).join('');
  const dots = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#2563eb"/>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#2563eb" stop-opacity="0.25"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>${yTicks}<path d="${areaPath}" fill="url(#g)"/><path d="${linePath}" stroke="#2563eb" stroke-width="2" fill="none"/>${dots}${xLabels}</svg>`;
}

function gauge(score, label) {
  const [color, txt] = light(score);
  const pct = score == null ? 0 : score;
  const dash = (pct / 100) * 188;
  return `<div class="gauge"><svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="30" stroke="#e5e7eb" stroke-width="8" fill="none"/><circle cx="40" cy="40" r="30" stroke="${color}" stroke-width="8" fill="none" stroke-dasharray="${dash} 188" stroke-linecap="round" transform="rotate(-90 40 40)"/><text x="40" y="46" text-anchor="middle" font-size="20" font-weight="700" fill="#111827">${score==null?'—':score}</text></svg><div class="gauge-label">${label}</div><div class="gauge-status" style="color:${color}">${txt}</div></div>`;
}

function posBars(dist) {
  const tot = dist.t3+dist.t10+dist.t20+dist.t50+dist.t100;
  const buckets = [
    { label: 'Top 1–3 (Bestplatzierung)', n: dist.t3, color: '#10b981' },
    { label: 'Top 4–10 (Seite 1)', n: dist.t10, color: '#84cc16' },
    { label: 'Top 11–20 (Seite 2)', n: dist.t20, color: '#f59e0b' },
    { label: 'Top 21–50', n: dist.t50, color: '#fb923c' },
    { label: 'Top 51–100', n: dist.t100, color: '#ef4444' },
  ];
  return buckets.map(b => {
    const pct = tot ? (b.n / tot * 100).toFixed(1) : 0;
    return `<div class="pos-bar"><span class="pos-bar-lbl">${b.label}</span><div class="pos-bar-track"><div class="pos-bar-fill" style="width:${pct}%;background:${b.color}"></div></div><span class="pos-bar-n">${b.n} <small>(${pct} %)</small></span></div>`;
  }).join('');
}

function renderReport(target, runDir) {
  const slug = safeSlug(target.slug);
  const summaryPath = cachePath(slug, '-summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.error(`Skip ${slug}: ${summaryPath} missing — run seo-extract-v2.js first`);
    return null;
  }
  const summary = JSON.parse(safeReadFile(summaryPath));
  const onpage = ONPAGE_ALL[slug] || {};
  const narrative = (CONFIG.narrative || {})[slug];
  if (!narrative) {
    console.error(`Skip ${slug}: no narrative entry in audit-config.json. Add narrative.${slug} with headline/business_one_liner/diagnose/fazit/action_plan.`);
    return null;
  }

  const series = summary.vi_series || [];
  const fromPeak = summary.vi_all_time_max && summary.vi_current
    ? Math.round((summary.vi_current - summary.vi_all_time_max.value) / summary.vi_all_time_max.value * 100)
    : null;

  const psiM = summary.psi_mobile || {};
  const psiD = summary.psi_desktop || {};
  const actions = narrative.action_plan || [];

  // ---- HTML ----
  // Strict CSP: no scripts, no iframes, no remote loads, no plugins. Even if a
  // string slips past esc() and emits e.g. <iframe src="file://...">, the CSP
  // header below blocks it — Chrome will refuse to load the frame and the
  // attacker can't exfiltrate local files into the rendered PDF.
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'"><title>SEO-Auswertung ${esc(target.domain)}</title><style>
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111827; line-height: 1.55; font-size: 10.5pt; margin: 0; }
h1,h2,h3 { color:#111827; line-height:1.2; margin:0; }
h1 { font-size:26pt; font-weight:800; letter-spacing:-0.01em; }
h2 { font-size:16pt; font-weight:700; margin-top:22pt; padding-bottom:6pt; border-bottom:2px solid #111827; }
h3 { font-size:12pt; font-weight:700; margin-top:14pt; margin-bottom:6pt; color:#1f2937; }
p { margin: 0 0 8pt 0; }
.muted { color:#6b7280; }
.cover { padding:50pt 0 30pt; border-bottom:3px solid #2563eb; margin-bottom:18pt; }
.cover .eyebrow { color:#2563eb; font-weight:700; font-size:9pt; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:12pt; }
.cover h1 { margin-bottom:8pt; }
.cover .sub { font-size:14pt; color:#374151; max-width:480pt; }
.cover .meta { margin-top:22pt; font-size:9.5pt; color:#6b7280; }
.cover .domain-line { font-family:ui-monospace,"SF Mono",Menlo,monospace; color:#2563eb; font-weight:600; }
.kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10pt; margin:14pt 0 8pt; }
.kpi { border:1px solid #e5e7eb; border-radius:6pt; padding:10pt; background:#fafafa; }
.kpi .lbl { font-size:8.5pt; color:#6b7280; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin-bottom:2pt; }
.kpi .val { font-size:18pt; font-weight:800; color:#111827; line-height:1.05; }
.kpi .sub { font-size:8.5pt; color:#6b7280; margin-top:2pt; }
.kpi.green .val { color:#10b981; } .kpi.red .val { color:#ef4444; } .kpi.amber .val { color:#f59e0b; }
.callout { border-left:4px solid #2563eb; background:#eff6ff; padding:10pt 14pt; margin:12pt 0; border-radius:0 4pt 4pt 0; }
.signal-grid { display:grid; grid-template-columns:1fr 1fr; gap:10pt; margin:8pt 0; }
.signal { padding:8pt 10pt; border:1px solid #e5e7eb; border-radius:4pt; font-size:9.5pt; }
.signal .l { color:#6b7280; font-size:8.5pt; text-transform:uppercase; letter-spacing:0.05em; }
.signal .v { font-weight:600; }
.signal.bad { border-color:#fecaca; background:#fef2f2; }
.signal.good { border-color:#bbf7d0; background:#f0fdf4; }
.signal.warn { border-color:#fde68a; background:#fffbeb; }
table { border-collapse:collapse; width:100%; font-size:9.5pt; margin:6pt 0 12pt; }
th,td { padding:5pt 6pt; text-align:left; border-bottom:1px solid #e5e7eb; vertical-align:top; }
th { background:#f3f4f6; font-weight:700; font-size:9pt; text-transform:uppercase; letter-spacing:0.04em; color:#374151; }
tr:nth-child(even) td { background:#fafafa; }
.kw-pos { font-weight:700; }
.kw-pos.green { color:#10b981; } .kw-pos.lime { color:#65a30d; } .kw-pos.amber { color:#f59e0b; } .kw-pos.red { color:#ef4444; }
.gauges { display:flex; gap:24pt; margin:10pt 0; flex-wrap:wrap; }
.gauge { text-align:center; }
.gauge-label { font-size:9pt; font-weight:600; color:#374151; margin-top:2pt; }
.gauge-status { font-size:8.5pt; font-weight:700; margin-top:1pt; }
.pos-bar { display:grid; grid-template-columns:200pt 1fr 100pt; align-items:center; gap:8pt; margin:3pt 0; font-size:9.5pt; }
.pos-bar-lbl { color:#374151; font-weight:600; }
.pos-bar-track { background:#f3f4f6; border-radius:6pt; height:10pt; overflow:hidden; }
.pos-bar-fill { height:100%; border-radius:6pt; }
.pos-bar-n { font-variant-numeric:tabular-nums; color:#374151; font-weight:600; }
.action { border:1px solid #e5e7eb; border-radius:5pt; padding:10pt 12pt; margin:7pt 0; page-break-inside:avoid; }
.action .head { display:flex; align-items:baseline; gap:8pt; margin-bottom:5pt; }
.action .when { font-size:8pt; font-weight:700; padding:2pt 8pt; border-radius:999pt; text-transform:uppercase; letter-spacing:0.05em; }
.action .when.sofort { background:#fee2e2; color:#991b1b; }
.action .when.tag30 { background:#fef3c7; color:#92400e; }
.action .when.tag60 { background:#dbeafe; color:#1e40af; }
.action .when.tag90 { background:#e0e7ff; color:#3730a3; }
.action .what { font-weight:700; font-size:11.5pt; flex:1; color:#111827; }
.action .why { color:#4b5563; font-size:10pt; margin:3pt 0; }
.action .how { background:#f9fafb; padding:6pt 9pt; border-radius:3pt; font-size:9.5pt; margin:5pt 0; border-left:3pt solid #2563eb; }
.action .meta { display:flex; gap:16pt; font-size:8.5pt; color:#6b7280; margin-top:5pt; }
.fazit { background:linear-gradient(180deg,#1e3a8a 0%,#1e40af 100%); color:white; padding:24pt 28pt; border-radius:8pt; margin:18pt 0 12pt; }
.fazit h2 { color:white; border:0; padding:0; margin-top:0; }
.fazit p { color:#e0e7ff; font-size:11.5pt; line-height:1.6; }
.fazit strong { color:white; }
.disclaimer { font-size:8pt; color:#6b7280; border:1px dashed #d1d5db; padding:8pt 10pt; border-radius:4pt; margin:14pt 0; }
.footer-cite { font-size:8pt; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:8pt; margin-top:24pt; }
.section-intro { background:#f9fafb; border-radius:4pt; padding:8pt 12pt; font-size:10pt; color:#4b5563; margin:4pt 0 10pt; }
.bestand-grid { display:grid; grid-template-columns:1fr 1fr; gap:10pt; margin:6pt 0; }
.bestand-row { padding:5pt 0; border-bottom:1px solid #e5e7eb; font-size:10pt; }
.bestand-row .label { color:#6b7280; font-size:9pt; }
.bestand-row .value { font-weight:600; color:#111827; }
.mono { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:9pt; }
.text-r { text-align:right; } .text-c { text-align:center; }
@media print { .page-break { page-break-before: always; } }
</style></head><body>

<section class="cover">
  <div class="eyebrow">SEO-Auswertung & Handlungsempfehlung</div>
  <h1>${esc(narrative.headline)}</h1>
  <p class="sub">${esc(target.label || target.domain)} — datenbasierte Auswertung mit Handlungsempfehlungen.</p>
  <div class="meta">
    <div class="domain-line">${esc(target.host)}</div>
    <div>Stand: ${new Date().toLocaleDateString('de-DE', {day:'2-digit',month:'long',year:'numeric'})} · Quellen: Sistrix, DataForSEO, Google PageSpeed Insights</div>
  </div>
</section>

<h2>1 — Zusammenfassung für Entscheider</h2>
<div class="section-intro">Wenn Sie nur diese Seite lesen, haben Sie das Wichtigste.</div>
${(narrative.diagnose || []).map(p => `<p>${esc(p)}</p>`).join('')}

<div class="kpi-grid">
  <div class="kpi ${summary.vi_current >= 0.2 ? 'green' : summary.vi_current >= 0.1 ? 'amber' : 'red'}">
    <div class="lbl">Sichtbarkeit Google</div>
    <div class="val">${formatVI(summary.vi_current)}</div>
    <div class="sub">${summary.vi_trend_12w != null ? formatPct(summary.vi_trend_12w) + ' (12 Wo)' : ''}</div>
  </div>
  <div class="kpi ${summary.d4s_kw_total > 1000 ? 'green' : summary.d4s_kw_total > 200 ? 'amber' : 'red'}">
    <div class="lbl">Top-100-Keywords</div>
    <div class="val">${formatNumber(summary.d4s_kw_total)}</div>
    <div class="sub">${formatNumber(summary.pos_dist.t3 + summary.pos_dist.t10)} auf Seite 1</div>
  </div>
  <div class="kpi ${psiM.perf >= 75 ? 'green' : psiM.perf >= 50 ? 'amber' : 'red'}">
    <div class="lbl">PageSpeed Mobil</div>
    <div class="val">${psiM.perf ?? '—'}</div>
    <div class="sub">Desktop: ${psiD.perf ?? '—'}</div>
  </div>
  <div class="kpi ${summary.backlinks.referring_domains > 200 ? 'green' : summary.backlinks.referring_domains > 50 ? 'amber' : 'red'}">
    <div class="lbl">Verlinkende Domains</div>
    <div class="val">${formatNumber(summary.backlinks.referring_domains)}</div>
    <div class="sub">${formatNumber(summary.backlinks.total)} Backlinks gesamt</div>
  </div>
</div>

<h3>Die fünf wichtigsten Maßnahmen für die nächsten Wochen</h3>
<ol style="margin-left:18pt;padding:0">
${(() => {
  const prio = { 'sofort': 0, '30 Tage': 1, '60 Tage': 2, '90 Tage': 3 };
  const sorted = [...actions].sort((a,b) => (prio[a.when] ?? 9) - (prio[b.when] ?? 9));
  return sorted.slice(0, 5).map(a => `<li style="margin:4pt 0"><b>${esc(a.what)}</b> <small class="muted">(${esc(a.when)})</small> — ${esc(a.why)}</li>`).join('');
})()}
</ol>

<div class="page-break"></div>
<h2>2 — Bestandsaufnahme</h2>
<div class="section-intro">Was haben wir vorgefunden? Diese Seite beschreibt den Ist-Zustand neutral.</div>
<p><b>Geschäftsmodell:</b> ${esc(narrative.business_one_liner)}</p>

<h3>Technische Basis</h3>
<div class="bestand-grid">
  <div class="bestand-row"><div class="label">Shop-/CMS-System</div><div class="value">${esc(onpage.cms || '—')}</div></div>
  <div class="bestand-row"><div class="label">Sprache der Seite</div><div class="value">${esc(onpage.lang || 'nicht gesetzt')}</div></div>
  <div class="bestand-row"><div class="label">Mobile-Optimierung</div><div class="value">${onpage.viewport ? 'vorhanden' : 'FEHLT'}</div></div>
  <div class="bestand-row"><div class="label">Robots-Direktive</div><div class="value">${esc(onpage.robots_meta || 'nicht gesetzt')}</div></div>
  <div class="bestand-row"><div class="label">Kanonische URL</div><div class="value">${onpage.canonical ? 'vorhanden' : 'FEHLT'}</div></div>
  <div class="bestand-row"><div class="label">Social-Preview</div><div class="value">${onpage.og_title ? 'vorhanden' : 'unvollständig/fehlt'}</div></div>
</div>

<h3>Inhalte und Auszeichnung</h3>
<div class="bestand-grid">
  <div class="bestand-row"><div class="label">Seitentitel</div><div class="value">${(() => { const n = num(onpage.title_len); return n === 0 ? 'FEHLT' : n < 30 ? 'sehr kurz ('+n+' Z.)' : n > 65 ? 'zu lang ('+n+' Z.)' : n+' Zeichen — ok'; })()}</div></div>
  <div class="bestand-row"><div class="label">Meta-Beschreibung</div><div class="value">${(() => { const n = num(onpage.meta_desc_len); return n === 0 ? 'FEHLT' : n < 80 ? 'zu kurz' : n > 165 ? 'zu lang' : n+' Zeichen — ok'; })()}</div></div>
  <div class="bestand-row"><div class="label">H1-Hauptüberschrift</div><div class="value">${(() => { const n = num(onpage.h1_count); return n === 0 ? 'FEHLT' : n === 1 ? '1 (ideal)' : n + ' (sollte 1 sein)'; })()}</div></div>
  <div class="bestand-row"><div class="label">H2-Unterüberschriften</div><div class="value">${num(onpage.h2_count)}</div></div>
  <div class="bestand-row"><div class="label">Textumfang</div><div class="value">${formatNumber(num(onpage.word_count))} Wörter</div></div>
  <div class="bestand-row"><div class="label">Bilder (gesamt / ohne Alt)</div><div class="value">${num(onpage.img_total)} / ${num(onpage.img_no_alt)}</div></div>
  <div class="bestand-row"><div class="label">Strukturierte Daten</div><div class="value">${(onpage.schema_types || []).length === 0 ? 'KEINE' : esc((onpage.schema_types || []).join(', '))}</div></div>
</div>

<div class="page-break"></div>
<h2>3 — Sichtbarkeit bei Google im Zeitverlauf</h2>
<div class="section-intro">Der Sistrix-Sichtbarkeitsindex ("VI") misst wie hoch Ihre Domain in Google-Suchergebnissen erscheint. Skala: 0,1–0,5 = solide spezialisiert, ab 0,5 = sichtbar erfolgreich.</div>

<div class="kpi-grid">
  <div class="kpi"><div class="lbl">Aktuell</div><div class="val">${formatVI(summary.vi_current)}</div><div class="sub">${summary.vi_date || ''}</div></div>
  <div class="kpi"><div class="lbl">All-Time-Maximum</div><div class="val">${summary.vi_all_time_max ? summary.vi_all_time_max.value.toFixed(4) : '—'}</div><div class="sub">${summary.vi_all_time_max?.date || ''}</div></div>
  <div class="kpi ${fromPeak < -30 ? 'red' : fromPeak < -10 ? 'amber' : 'green'}"><div class="lbl">Abstand zum Max</div><div class="val">${fromPeak != null ? fromPeak+' %' : '—'}</div><div class="sub">vs Höchststand</div></div>
  <div class="kpi"><div class="lbl">Tracking-Historie</div><div class="val">${summary.vi_weeks_tracked || '—'}</div><div class="sub">Wochen bei Sistrix</div></div>
</div>

${series.length > 0 ? `<h3>Verlauf der letzten ${series.length} Monate</h3>${viChart(series)}` : '<p class="muted">Keine Zeitreihen-Daten verfügbar.</p>'}

<div class="page-break"></div>
<h2>4 — Wo Sie heute bei Google ranken</h2>
<div class="section-intro">Position 1–3 = oberhalb des Bildschirms · 4–10 = sichtbar auf Seite 1 · 11+ = scrollen oder weiterklicken nötig.</div>

<h3>Verteilung Ihrer Rankings</h3>
${posBars(summary.pos_dist)}

<h3>Top 15 Keywords</h3>
<table>
<thead><tr><th>#</th><th>Keyword</th><th class="text-c">Position</th><th class="text-r">Suchvolumen/Mo</th><th>URL</th></tr></thead>
<tbody>
${(summary.d4s_top_keywords || []).slice(0,15).map((k, i) => {
  const cls = k.position <= 3 ? 'green' : k.position <= 10 ? 'lime' : k.position <= 20 ? 'amber' : 'red';
  return `<tr><td>${i+1}</td><td>${esc(k.keyword)}</td><td class="text-c"><span class="kw-pos ${cls}">${k.position}</span></td><td class="text-r">${formatNumber(k.sv)}</td><td class="mono">${esc(trunc((k.url||'').replace(/^https?:\/\/[^/]+/, ''), 40))}</td></tr>`;
}).join('')}
</tbody></table>

${(summary.quick_wins || []).length > 0 ? `<h3>Quick Wins: Keywords auf Pos 4–20 (Volumen ≥100)</h3>
<div class="section-intro">Mit gezielter Optimierung dieser Seiten ist ein Sprung in die Top 10 realistisch. Geringster Aufwand, größter Hebel.</div>
<table>
<thead><tr><th>Keyword</th><th class="text-c">Aktuell</th><th class="text-r">Volumen</th><th>Ziel-URL</th></tr></thead>
<tbody>
${summary.quick_wins.slice(0,12).map(k => `<tr><td>${esc(k.keyword)}</td><td class="text-c"><span class="kw-pos amber">${k.position}</span></td><td class="text-r">${formatNumber(k.sv)}</td><td class="mono">${esc(trunc((k.url||'').replace(/^https?:\/\/[^/]+/, ''), 50))}</td></tr>`).join('')}
</tbody></table>` : ''}

<div class="page-break"></div>
<h2>5 — Wer Ihnen Marktanteile abnimmt</h2>
<div class="section-intro">Domains, die mit Ihnen um die gleichen Suchbegriffe konkurrieren — geordnet nach geschätztem Traffic-Wert.</div>
<table>
<thead><tr><th>#</th><th>Wettbewerber</th><th class="text-r">Keywords</th><th class="text-r">Geschätzte Klicks/Mo</th><th class="text-r">Schnittmenge</th></tr></thead>
<tbody>
${(summary.d4s_competitors || []).slice(0,8).map((c,i) => `<tr><td>${i+1}</td><td class="mono">${esc(c.domain)}</td><td class="text-r">${formatNumber(c.kw_count)}</td><td class="text-r">${formatNumber(c.etv)}</td><td class="text-r">${formatNumber(c.intersections)}</td></tr>`).join('')}
</tbody></table>

<div class="page-break"></div>
<h2>6 — Tempo der Website (PageSpeed)</h2>
<div class="section-intro">Google bewertet Ladezeit und Stabilität direkt — vor allem mobil. 0–49 rot · 50–89 gelb · 90–100 grün.</div>

<h3>Mobil</h3>
<div class="gauges">${gauge(psiM.perf,'Performance')}${gauge(psiM.seo,'SEO-Basics')}${gauge(psiM.a11y,'Barrierefreiheit')}${gauge(psiM.bp,'Best Practices')}</div>

<h3>Desktop</h3>
<div class="gauges">${gauge(psiD.perf,'Performance')}${gauge(psiD.seo,'SEO-Basics')}${gauge(psiD.a11y,'Barrierefreiheit')}${gauge(psiD.bp,'Best Practices')}</div>

<h3>Core Web Vitals (Mobil)</h3>
<div class="signal-grid">
  ${(() => { const [c,t] = lightLCP(psiM.lcp); return `<div class="signal" style="border-left:4px solid ${c}"><div class="l">LCP — Wann das größte Element sichtbar wird</div><div class="v">${formatSec(psiM.lcp)} <span style="color:${c};font-weight:700">— ${t}</span></div></div>`; })()}
  ${(() => { const [c,t] = lightCLS(psiM.cls); return `<div class="signal" style="border-left:4px solid ${c}"><div class="l">CLS — Stabilität des Layouts</div><div class="v">${psiM.cls != null ? psiM.cls.toFixed(3) : '—'} <span style="color:${c};font-weight:700">— ${t}</span></div></div>`; })()}
  <div class="signal"><div class="l">TBT — Blockierungszeit</div><div class="v">${formatMs(psiM.tbt)}</div></div>
  <div class="signal"><div class="l">TTFB — Server-Antwortzeit</div><div class="v">${formatMs(psiM.ttfb)}</div></div>
</div>

<div class="page-break"></div>
<h2>7 — Was Google von Ihrer Seite versteht</h2>
<div class="section-intro">Strukturierte Daten, Seitentitel und Überschriften sind die Signale, an denen Google "ablesen" kann, worum es geht.</div>
<div class="signal-grid">
  <div class="signal ${onpage.title_len < 30 || onpage.title_len > 65 ? 'bad' : 'good'}"><div class="l">Seitentitel</div><div class="v">${esc(trunc(onpage.title, 80))} <small>(${onpage.title_len} Z.)</small></div></div>
  <div class="signal ${onpage.meta_desc_len === 0 ? 'bad' : onpage.meta_desc_len < 80 ? 'warn' : 'good'}"><div class="l">Meta-Beschreibung</div><div class="v">${onpage.meta_desc ? esc(trunc(onpage.meta_desc, 120)) : '<span style="color:#ef4444">— FEHLT —</span>'}</div></div>
  <div class="signal ${num(onpage.h1_count) === 1 ? 'good' : 'bad'}"><div class="l">H1-Hauptüberschrift</div><div class="v">${num(onpage.h1_count)} H1${num(onpage.h1_count) === 0 ? ' <span style="color:#ef4444">— FEHLT</span>' : num(onpage.h1_count) > 1 ? ' <span style="color:#f59e0b">— sollte 1 sein</span>' : ''}</div></div>
  <div class="signal ${(onpage.schema_types || []).length >= 3 ? 'good' : (onpage.schema_types || []).length > 0 ? 'warn' : 'bad'}"><div class="l">Strukturierte Daten</div><div class="v">${(onpage.schema_types || []).length ? esc(onpage.schema_types.join(', ')) : '<span style="color:#ef4444">— KEINE —</span>'}</div></div>
  <div class="signal ${num(onpage.img_no_alt) / Math.max(1, num(onpage.img_total)) > 0.3 ? 'bad' : num(onpage.img_no_alt) > 0 ? 'warn' : 'good'}"><div class="l">Bilder ohne Bildbeschreibung</div><div class="v">${num(onpage.img_no_alt)} von ${num(onpage.img_total)} (${Math.round(num(onpage.img_no_alt) / Math.max(1, num(onpage.img_total)) * 100)} %)</div></div>
  <div class="signal ${onpage.canonical ? 'good' : 'bad'}"><div class="l">Kanonische URL</div><div class="v">${onpage.canonical ? esc(trunc(onpage.canonical, 60)) : '<span style="color:#ef4444">FEHLT</span>'}</div></div>
</div>

<div class="page-break"></div>
<h2>8 — Vertrauen und Verlinkungen</h2>
<div class="section-intro">Backlinks sind Vertrauenssignale für Google. Wenige Backlinks bei vielen Wettbewerber-Backlinks erklärt oft, warum man trotz guter Inhalte nicht rankt.</div>
<div class="kpi-grid">
  <div class="kpi"><div class="lbl">Verlinkende Domains</div><div class="val">${formatNumber(summary.backlinks.referring_domains)}</div></div>
  <div class="kpi"><div class="lbl">Backlinks gesamt</div><div class="val">${formatNumber(summary.backlinks.total)}</div></div>
  <div class="kpi"><div class="lbl">Domain-Rank</div><div class="val">${summary.backlinks.rank ?? '—'}</div><div class="sub">0–1000 (DataForSEO)</div></div>
  <div class="kpi ${summary.backlinks.backlinks_spam_score > 30 ? 'red' : summary.backlinks.backlinks_spam_score > 15 ? 'amber' : 'green'}"><div class="lbl">Spam-Score</div><div class="val">${summary.backlinks.backlinks_spam_score ?? '—'}</div></div>
</div>

${(summary.top_referring_domains || []).length ? `<h3>Top verlinkende Domains</h3>
<table>
<thead><tr><th>Domain</th><th class="text-r">Rank</th><th class="text-r">Backlinks</th><th>seit</th></tr></thead>
<tbody>
${summary.top_referring_domains.slice(0,12).map(d => `<tr><td class="mono">${esc(d.domain)}</td><td class="text-r">${d.rank == null ? '—' : num(d.rank)}</td><td class="text-r">${formatNumber(d.backlinks)}</td><td>${esc(String(d.first_seen || '').slice(0,10))}</td></tr>`).join('')}
</tbody></table>` : ''}

<div class="page-break"></div>
<div class="fazit">
  <h2>9 — Fazit</h2>
  ${(narrative.fazit || []).map(p => `<p>${esc(p)}</p>`).join('')}
</div>

<div class="page-break"></div>
<h2>10 — Aktionsplan: 30 · 60 · 90 Tage</h2>
<div class="section-intro">Konkrete Schritte, sortiert nach Priorität. Jeder Punkt enthält: was zu tun ist, warum, wie, wer, was es kostet, und welcher Effekt zu erwarten ist.</div>
${actions.map(a => {
  const wcls = a.when === 'sofort' ? 'sofort' : a.when?.startsWith('30') ? 'tag30' : a.when?.startsWith('60') ? 'tag60' : 'tag90';
  return `<div class="action">
    <div class="head"><span class="when ${wcls}">${esc(a.when)}</span><span class="what">${esc(a.what)}</span></div>
    <div class="why">${esc(a.why)}</div>
    <div class="how"><b>Vorgehen:</b> ${esc(a.how)}</div>
    <div class="meta"><span><b>Wer:</b> ${esc(a.who)}</span><span><b>Aufwand/Kosten:</b> ${esc(a.cost)}</span><span><b>Erwartung:</b> ${esc(a.impact)}</span></div>
  </div>`;
}).join('')}

<div class="disclaimer">
<b>Hinweis zu Empfehlungen:</b> Die vorgeschlagenen Maßnahmen, Zeitfenster, Kostenschätzungen und Erwartungswerte basieren auf den zum Stichtag verfügbaren Daten und allgemeinen SEO-Best-Practices. Sie stellen <b>keine verbindliche Geschäftsberatung</b> dar. Vor Investitionsentscheidungen wird eine eigenständige Bewertung empfohlen. Ergebnisse hängen von Umsetzungsqualität, Markt- und Wettbewerbsdynamik sowie Google-Algorithmus-Änderungen ab und können abweichen. Kostenangaben in EUR sind typische Spannen aus dem DE-Beratungs-Markt — lokale Marktbedingungen können abweichen.
<br><br>
<b>YMYL-Hinweis (Your Money or Your Life):</b> Bei Domains aus den Bereichen Medizin, Gesundheit, Recht, Finanzen oder regulierten Industrien empfehlen wir, den Aktionsplan vor Umsetzung oder Weitergabe von einer fachlich qualifizierten Person prüfen zu lassen. Schema-Empfehlungen (z. B. MedicalBusiness, Physician, Attorney), Author-Authority-Massnahmen und Off-Page-Linkbuilding können in regulierten Branchen mit Werbe- oder Berufsordnungen kollidieren. Diese Auswertung berücksichtigt branchen-spezifische Regulierung nicht.
<br><br>
<b>Erstellungswerkzeug:</b> Diese Auswertung wurde mit dem Open-Source-Werkzeug seo-survival-kit (MIT-Lizenz, Public Beta v0.3.x) erstellt. Quellcode und Methodik unter https://github.com/maxschottke-spec/seo-survival-kit.
</div>

<p class="footer-cite">Daten-Stand: ${new Date().toLocaleDateString('de-DE')}. Quellen: Sistrix API (Sichtbarkeitsindex DE), DataForSEO Labs (SERP-Rankings DE, Backlinks, Wettbewerber), Google PageSpeed Insights v5 (Lab + CrUX). Bewertungen und Empfehlungen basieren auf SEO-Best-Practices Stand ${new Date().toLocaleDateString('de-DE', {month:'long', year:'numeric'})}.</p>

</body></html>`;

  // Write HTML into the per-run isolated tmp dir created by main(). The dir was
  // freshly mkdtempSync'd, mode 0700 — no other local user could pre-create a
  // symlink there, so writeFileSync is safe without O_EXCL.
  const tmpHtmlPath = path.join(runDir, `seo-report-${slug}.html`);
  fs.writeFileSync(tmpHtmlPath, html);

  // Construct safe PDF path. `target.domain` may contain dots; we sanitize for filename.
  const fileSafeDomain = String(target.domain || slug).replace(/[^a-z0-9.-]/gi, '-');
  const pdfPath = path.join(OUTPUT_DIR, `SEO-Auswertung-${fileSafeDomain.replace(/\./g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`);

  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Chrome not found at ${CHROME_PATH}. Set CHROME_PATH env var to your Chrome binary.`);
  }
  // spawnSync with array form bypasses the shell entirely — CHROME_PATH, paths
  // with spaces, $VARs, semicolons, quotes etc. are passed as literal argv
  // entries. Plus --user-data-dir points at our isolated runDir so the headless
  // render never touches the user's real Chrome profile/cookies/extensions.
  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-default-browser-check',
    '--no-first-run',
    `--user-data-dir=${path.join(runDir, 'chrome-profile')}`,
    `--print-to-pdf=${pdfPath}`,
    '--no-pdf-header-footer',
    `file://${tmpHtmlPath}`,
  ];
  const result = spawnSync(CHROME_PATH, chromeArgs, { stdio: 'pipe', shell: false, timeout: 120_000 });
  if (result.status !== 0) {
    throw new Error(`Chrome render failed (exit ${result.status}): ${result.stderr?.toString().slice(0, 500)}`);
  }
  console.error(`[${slug}] -> ${pdfPath}`);
  return pdfPath;
}

function main() {
  const runDir = mkRunDir('seo-rescue-render-');
  let cleanup = true;
  try {
    if (process.env.SEO_KEEP_RUN_DIR === '1') cleanup = false;
    const outs = TARGETS.map(t => renderReport(t, runDir)).filter(Boolean);
    console.log('PDFs created:');
    outs.forEach(p => console.log(' -', p));
  } finally {
    if (cleanup) {
      try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) { /* best effort */ }
    } else {
      console.error(`Run dir kept: ${runDir}`);
    }
  }
}

main();
