#!/usr/bin/env node
'use strict';
// seo-weekly-gen.js — kompakter Weekly-SEO-Report (1 Seite) für einen Kunden/Prospect.
// Bewusst KEIN Umsetzungs-Playbook: zeigt Datenkompetenz, hält das "How" zurück —
// Empfehlungen als WAS+WARUM, nie als Schritt-für-Schritt-Anleitung.
//
// Usage:  SEO_AUDIT_CONFIG=/path/audit-config.json node seo-weekly-gen.js <slug>
//
// Liest:   <cache-dir>/<slug>-summary.json   (aus seo-extract-v2.js)
//          <cache-dir>/seo-onpage.json       (aus seo-onpage.js, optional)
//          config.weekly[slug]               (Branding + kuratiertes Editorial)
//          <cache-dir>/<slug>-weekly/snap-*.json (Vorwoche → Deltas)
// Schreibt: $SEO_PDF_OUTPUT_DIR|~/Downloads/SEO-Weekly-<domain>-<YYYY-MM-DD>.pdf
//          <cache-dir>/<slug>-weekly/report-<date>.html  (für das Review-Gate)
//          + neuen Snapshot für den nächsten Delta-Vergleich.
//
// config.weekly[slug] (alles optional):
//   logo_file:            absoluter Pfad zu einem Absender-Logo (SVG/PNG), wird eingebettet
//   footer_brand:         Absenderzeile im Footer, z. B. "Agentur XY · Jane Doe"
//   accent / ink / muted: CI-Farben (Hex), Default: neutrales Blau/Anthrazit
//   intro:                Einleitungstext, erscheint NUR in Report #1
//   observations_current: Array kuratierter Beobachtungen für EINEN Lauf
//   observations_date:    YYYY-MM-DD — nur bei exakt diesem Datum werden die kuratierten
//                         Beobachtungen benutzt, sonst Auto-Fallback aus der Datenlage
//                         (verhindert, dass Cron-Läufe veraltete Wochen-Aussagen wiederholen)
//   recommendations:      Array {title, text} — stehende Empfehlungen ohne How-to
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { safeSlug, validateConfigTargets, safeReadFile, cachePath, getCacheDir, mkRunDir, writeFileExclusive } = require('../../lib/safe.js');

const CONFIG_PATH = process.env.SEO_AUDIT_CONFIG || './audit-config.json';
const CONFIG = JSON.parse(safeReadFile(CONFIG_PATH));
const slug = safeSlug(process.argv[2] || '');
const target = validateConfigTargets(CONFIG.targets || []).find(t => t.slug === slug);
if (!target) { console.error(`Slug ${slug} not in config`); process.exit(1); }

const S = JSON.parse(safeReadFile(cachePath(slug, '-summary.json')));
let ONP = {};
try { ONP = JSON.parse(safeReadFile(path.join(getCacheDir(), 'seo-onpage.json')))[slug] || {}; } catch { /* optional */ }
const W = (CONFIG.weekly || {})[slug] || {};

const today = new Date().toISOString().slice(0, 10);
const SNAP_DIR = path.join(getCacheDir(), `${slug}-weekly`);
fs.mkdirSync(SNAP_DIR, { recursive: true, mode: 0o700 });

// ---- Vorwochen-Snapshot laden (jüngster snap-*.json, der nicht von heute ist)
const prevFile = fs.readdirSync(SNAP_DIR).filter(f => /^snap-\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .filter(f => f !== `snap-${today}.json`).sort().pop();
const PREV = prevFile ? JSON.parse(safeReadFile(path.join(SNAP_DIR, prevFile))) : null;
const prevDate = prevFile ? prevFile.slice(5, 15) : null;
const reportNo = fs.readdirSync(SNAP_DIR).filter(f => /^snap-/.test(f)).filter(f => f !== `snap-${today}.json`).length + 1;

// ---- Snapshot dieser Woche schreiben (Basis für nächste Deltas)
const snap = {
  date: today,
  vi: S.vi_current, kw_total: S.d4s_kw_total,
  backlinks: S.backlinks?.total, ref_domains: S.backlinks?.referring_domains,
  psi_mobile_perf: S.psi_mobile?.perf, psi_desktop_perf: S.psi_desktop?.perf,
  keywords: (S.d4s_top_keywords || []).map(k => ({ keyword: k.keyword, position: k.position, sv: k.sv })),
};
const snapFile = path.join(SNAP_DIR, `snap-${today}.json`);
fs.rmSync(snapFile, { force: true });
writeFileExclusive(snapFile, JSON.stringify(snap, null, 2));

// ---- Helpers
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/—/g, '–');
const de = (n, d = 0) => n == null ? '–' : Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const deDate = iso => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '–';
const hex = (v, dflt) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : dflt;
const ACCENT = hex(W.accent, '#1f4bd8');
const INK = hex(W.ink, '#1a1b1f');
const MUTED = hex(W.muted, '#758696');

function delta(cur, prev, d = 0, invert = false) {
  if (!PREV) return '';
  if (prev == null || cur == null) return '<span class="d n">neu erfasst</span>';
  const diff = cur - prev;
  if (Math.abs(diff) < Math.pow(10, -d) / 2) return '<span class="d n">±0</span>';
  const good = invert ? diff < 0 : diff > 0;
  return `<span class="d ${good ? 'up' : 'down'}">${diff > 0 ? '+' : '−'}${de(Math.abs(diff), d)}</span>`;
}

// ---- VI-Sparkline (inline SVG)
function sparkline(series, width = 480, height = 72) {
  const pts = (series || []).concat([{ date: S.vi_date, value: S.vi_current }]).filter(p => p.value != null);
  if (pts.length < 2) return '';
  const vals = pts.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
  const x = i => 4 + i * (width - 8) / (pts.length - 1);
  const y = v => height - 12 - (v - min) / range * (height - 24);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px">
    <path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="2.2"/>
    <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="3.4" fill="${ACCENT}"/>
    <text x="4" y="${height - 1}" class="axis">${deDate(pts[0].date)}</text>
    <text x="${width - 4}" y="${height - 1}" class="axis" text-anchor="end">${deDate(last.date)} · VI ${de(last.value, 3)}</text>
  </svg>`;
}

// ---- Bewegungen vs. Vorwoche (nur wenn Vorwoche existiert)
let moversHtml = '';
if (PREV && PREV.keywords) {
  const prevPos = Object.fromEntries(PREV.keywords.map(k => [k.keyword, k.position]));
  const movers = (S.d4s_top_keywords || [])
    .map(k => ({ ...k, diff: prevPos[k.keyword] != null ? prevPos[k.keyword] - k.position : null }))
    .filter(k => k.diff !== null && k.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 8);
  const gone = PREV.keywords.filter(pk => !(S.d4s_top_keywords || []).some(k => k.keyword === pk.keyword)).slice(0, 4);
  if (movers.length || gone.length) {
    moversHtml = `<h2>Bewegungen seit ${deDate(prevDate)}</h2><table>
      <tr><th>Keyword</th><th class="r">Suchvol./Mo</th><th class="r">Position</th><th class="r">Veränderung</th></tr>
      ${movers.map(k => `<tr><td>${esc(k.keyword)}</td><td class="r">${de(k.sv)}</td><td class="r">${k.position}</td>
        <td class="r">${k.diff > 0 ? `<span class="d up">▲ +${k.diff}</span>` : `<span class="d down">▼ −${Math.abs(k.diff)}</span>`}</td></tr>`).join('')}
      ${gone.map(k => `<tr><td>${esc(k.keyword)}</td><td class="r">${de(k.sv)}</td><td class="r">–</td><td class="r"><span class="d down">aus Top-Erfassung gefallen</span></td></tr>`).join('')}
    </table>`;
  } else {
    moversHtml = `<h2>Bewegungen seit ${deDate(prevDate)}</h2><p class="muted">Keine nennenswerten Positionsveränderungen in den Top-Rankings – in einer ruhigen Woche ist das ein gutes Zeichen.</p>`;
  }
}

// ---- Top-Rankings (Showcase, max 10, nach Suchvolumen)
const topKw = (S.d4s_top_keywords || []).slice().sort((a, b) => (b.sv || 0) - (a.sv || 0)).slice(0, 10);

// ---- Beobachtungen: kuratiert nur, wenn für den heutigen Lauf geschrieben —
// sonst automatisch aus der Datenlage (Cron-sicher, keine veralteten Aussagen).
let observations = (W.observations_date === today && W.observations_current) || null;
if (!observations) {
  observations = [];
  if (S.psi_mobile?.perf != null && S.psi_mobile.perf < 60)
    observations.push(`Die mobile Ladeleistung liegt im Labor-Test bei ${S.psi_mobile.perf}/100 (größtes Element nach ${de(S.psi_mobile.lcp / 1000, 1)} s sichtbar; Google-Richtwert: unter 2,5 s). Die echten Nutzerdaten sind aktuell noch im grünen Bereich – das Labor zeigt aber, wie wenig Puffer bleibt.`);
  if (ONP.schema_types && ONP.schema_types.length === 0)
    observations.push('Die Startseite liefert kein strukturiertes Markup aus. Rich-Results in der Google-Suche (Preise, Bewertungssterne, Produktdaten) bleiben damit ungenutzt – ein Feld, auf dem Wettbewerber sichtbar präsenter sind.');
  if (S.vi_all_time_max && S.vi_current < S.vi_all_time_max.value * 0.9)
    observations.push(`Die Sichtbarkeit liegt ${de((1 - S.vi_current / S.vi_all_time_max.value) * 100)} % unter dem eigenen Höchststand vom ${deDate(S.vi_all_time_max.date)} – der Abstand ist aufholbar, schließt sich aber nicht von selbst.`);
  if (!observations.length)
    observations.push(`Solide Woche ohne auffällige Befunde: ${de(S.d4s_kw_total)} Rankings in den Top-100, Sichtbarkeitstrend ${S.vi_trend_4w > 0 ? 'positiv' : 'seitwärts'} (${de(S.vi_trend_4w, 1)} % über 4 Wochen).`);
}

const recommendations = W.recommendations || [];
const intro = reportNo === 1 ? (W.intro || null) : null;

// ---- Absender-Logo (optional), eingebettet als data-URI
let logoImg = '';
if (W.logo_file && fs.existsSync(W.logo_file) && !fs.lstatSync(W.logo_file).isSymbolicLink()
    && fs.statSync(W.logo_file).size <= 2_000_000) {
  const ext = path.extname(W.logo_file).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : null;
  if (mime) {
    const b64 = fs.readFileSync(W.logo_file).toString('base64');
    logoImg = `<img src="data:${mime};base64,${b64}" style="height:20px;display:block" alt="">`;
  }
}

// ---- HTML
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 16mm 15mm 14mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 10.2pt/1.5 "Helvetica Neue", Arial, sans-serif; color: ${INK}; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid ${INK}; padding-bottom: 9px; margin-bottom: 4px; }
  .accentbar { height: 3px; background: ${ACCENT}; width: 64px; margin-bottom: 14px; }
  .brand { font-size: 14pt; font-weight: 700; letter-spacing: -.01em; }
  .brand small { color: ${ACCENT}; font-weight: 600; }
  .meta { text-align: right; font-size: 8.5pt; color: ${MUTED}; }
  h2 { font: 700 8.6pt/1 "Helvetica Neue", Arial, sans-serif; text-transform: uppercase; letter-spacing: .12em; margin: 15px 0 7px; color: ${ACCENT}; }
  p { margin-bottom: 6px; }
  .muted { color: ${MUTED}; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; margin: 10px 0 4px; }
  .kpi { background: #fafafa; border: 1px solid #e4e7eb; border-radius: 8px; padding: 8px 9px; }
  .kpi .v { font-size: 13.5pt; font-weight: 700; letter-spacing: -.02em; }
  .kpi .l { font-size: 7.2pt; color: ${MUTED}; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }
  .d { font-size: 8pt; font-weight: 600; }
  .d.up { color: #18b46d; } .d.down { color: #d23f31; } .d.n { color: ${MUTED}; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 4px 0 8px; }
  th { text-align: left; font-size: 7.4pt; text-transform: uppercase; letter-spacing: .08em; color: ${MUTED}; border-bottom: 2px solid ${INK}; padding: 3px 6px; }
  td { padding: 3.5px 6px; border-bottom: 1px solid #eceef1; }
  tr:nth-child(even) td { background: #fafafa; }
  .r { text-align: right; }
  ul { margin: 2px 0 8px 16px; }
  li { margin-bottom: 5px; }
  li::marker { color: ${ACCENT}; }
  .rec { border-left: 3px solid ${ACCENT}; background: #f5f7fd; padding: 8px 11px; margin-bottom: 7px; border-radius: 0 6px 6px 0; }
  .rec b { display: block; color: ${INK}; }
  .rec span { font-size: 9pt; color: #43464d; }
  .axis { font-size: 7pt; fill: ${MUTED}; font-family: Arial; }
  footer { margin-top: 14px; border-top: 1px solid #e4e7eb; padding-top: 6px; font-size: 7.8pt; color: ${MUTED}; }
</style></head><body>
<header>
  <div>
    ${logoImg}
    <div class="brand" style="margin-top:6px">SEO-Weekly <small>· ${esc(target.domain)}</small></div>
  </div>
  <div class="meta">Report #${reportNo}${reportNo === 1 ? ' – Basisaufnahme' : ''} · Stand ${deDate(today)}<br>
  ${prevDate ? `Vergleichswoche: ${deDate(prevDate)}` : 'Ab jetzt wöchentlich – künftige Ausgaben zeigen jede Veränderung zur Vorwoche'}</div>
</header>
<div class="accentbar"></div>

${intro ? `<p>${esc(intro)}</p>` : ''}

<div class="kpis">
  <div class="kpi"><div class="v">${de(S.vi_current, 3)}</div><div class="l">Sichtbarkeit (Sistrix)</div>${delta(S.vi_current, PREV?.vi, 3)}</div>
  <div class="kpi"><div class="v">${de(S.d4s_kw_total)}</div><div class="l">Keywords Top-100</div>${delta(S.d4s_kw_total, PREV?.kw_total)}</div>
  <div class="kpi"><div class="v">${S.vi_trend_4w > 0 ? '+' : ''}${de(S.vi_trend_4w, 1)}%</div><div class="l">Sichtbarkeit 4 Wochen</div></div>
  <div class="kpi"><div class="v">${de(S.backlinks?.referring_domains)}</div><div class="l">Verlinkende Domains</div>${delta(S.backlinks?.referring_domains, PREV?.ref_domains)}</div>
  <div class="kpi"><div class="v">${de(S.psi_mobile?.perf)}/100</div><div class="l">PageSpeed mobil</div>${delta(S.psi_mobile?.perf, PREV?.psi_mobile_perf)}</div>
  <div class="kpi"><div class="v">${de(S.psi_desktop?.perf)}/100</div><div class="l">PageSpeed Desktop</div>${delta(S.psi_desktop?.perf, PREV?.psi_desktop_perf)}</div>
</div>

<h2>Sichtbarkeitsverlauf (18 Monate)</h2>
${sparkline(S.vi_series)}

${moversHtml}

<h2>Stärkste Rankings${reportNo === 1 ? ' (Ausgangslage)' : ''}</h2>
<table>
  <tr><th>Keyword</th><th class="r">Suchvolumen/Mo</th><th class="r">Position</th></tr>
  ${topKw.map(k => `<tr><td>${esc(k.keyword)}</td><td class="r">${de(k.sv)}</td><td class="r">${k.position}</td></tr>`).join('')}
</table>

<h2>Beobachtungen dieser Woche</h2>
<ul>${observations.map(o => `<li>${esc(o)}</li>`).join('')}</ul>

${recommendations.length ? `<h2>Empfehlungen</h2>
${recommendations.map(r => `<div class="rec"><b>${esc(r.title)}</b><span>${esc(r.text)}</span></div>`).join('')}` : ''}

<footer>Alle Kennzahlen stammen aus externen Messquellen (Sistrix-Sichtbarkeitsindex, DataForSEO-Rankingdaten, Google PageSpeed/CrUX-Felddaten). Für diesen Report ist kein Zugriff auf Shop, Analytics oder Search Console erforderlich.${W.footer_brand ? ` · ${esc(W.footer_brand)}` : ''} · ${deDate(today)}</footer>
</body></html>`;

// ---- Review-Kopie + Render
const reviewHtml = path.join(SNAP_DIR, `report-${today}.html`);
fs.rmSync(reviewHtml, { force: true });
writeFileExclusive(reviewHtml, html);

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CHROME)) { console.error(`Chrome not found: ${CHROME} (set CHROME_PATH)`); process.exit(1); }
const OUTPUT_DIR = process.env.SEO_PDF_OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
const runDir = mkRunDir('seo-rescue-weekly-');
try {
  const tmpHtml = path.join(runDir, 'report.html');
  writeFileExclusive(tmpHtml, html);
  const pdfFile = path.join(OUTPUT_DIR, `SEO-Weekly-${target.domain}-${today}.pdf`);
  fs.rmSync(pdfFile, { force: true });
  const result = spawnSync(CHROME, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfFile}`, `file://${tmpHtml}`],
    { stdio: 'pipe', shell: false, timeout: 120_000 });
  if (result.status !== 0) throw new Error(`Chrome render failed (exit ${result.status}): ${result.stderr?.toString().slice(0, 300)}`);
  console.log(`[${slug}] Report #${reportNo} -> ${pdfFile}`);
} finally {
  try { fs.rmSync(runDir, { recursive: true, force: true }); } catch { /* best effort */ }
}
