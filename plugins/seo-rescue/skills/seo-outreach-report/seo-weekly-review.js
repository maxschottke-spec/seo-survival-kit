#!/usr/bin/env node
'use strict';
// seo-weekly-review.js — deterministisches Review-Gate für den Weekly-Report.
// Prüft Render-Output + Datenplausibilität BEVOR irgendetwas den Rechner verlässt
// (fail-closed: der aufrufende Runner darf bei Exit != 0 NICHT versenden).
// Exit 0 = PASS · Exit 1 = FAIL (Gründe auf stdout, eine pro Zeile).
//
// Usage: SEO_AUDIT_CONFIG=/path/audit-config.json node seo-weekly-review.js <slug>
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safeSlug, validateConfigTargets, safeReadFile, getCacheDir } = require('../../lib/safe.js');

const CONFIG = JSON.parse(safeReadFile(process.env.SEO_AUDIT_CONFIG || './audit-config.json'));
const slug = safeSlug(process.argv[2] || '');
const target = validateConfigTargets(CONFIG.targets || []).find(t => t.slug === slug);
if (!target) { console.log(`FAIL: slug ${slug} nicht in Config`); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const deToday = `${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)}`;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

// --- Artefakte frisch?
const snapDir = path.join(getCacheDir(), `${slug}-weekly`);
const htmlFile = path.join(snapDir, `report-${today}.html`);
const OUTPUT_DIR = process.env.SEO_PDF_OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
const pdfFile = path.join(OUTPUT_DIR, `SEO-Weekly-${target.domain}-${today}.pdf`);
check(fs.existsSync(htmlFile) && fs.statSync(htmlFile).mtime.toISOString().slice(0, 10) === today,
  `HTML fehlt oder nicht von heute: ${htmlFile}`);
check(fs.existsSync(pdfFile), `PDF fehlt: ${pdfFile}`);
if (fs.existsSync(pdfFile)) {
  const sz = fs.statSync(pdfFile).size;
  check(sz > 30_000 && sz < 5_000_000, `PDF-Größe unplausibel: ${sz} bytes`);
}

// --- Inhalt: kaputte Werte / Platzhalter / KI-Tells
if (fs.existsSync(htmlFile)) {
  const html = safeReadFile(htmlFile);
  const text = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/g, ' ');
  for (const bad of ['undefined', 'NaN', 'Infinity', '[object', '${', '&amp;amp;']) {
    check(!text.includes(bad), `Verbotener String im Report: "${bad}"`);
  }
  check(!text.includes('—'), 'Em-Dash (KI-Tell) im Report');
  check(text.replace(/\s+/g, ' ').length > 800, 'Reporttext verdächtig kurz (<800 Zeichen)');
  check(text.includes(deToday), `Heutiges Datum ${deToday} fehlt im Report`);
  const liCount = (html.match(/<li>/g) || []).length;
  check(liCount >= 1, `Keine Beobachtungen im Report (${liCount} <li>)`);
}

// --- Datenplausibilität: heutiger Snapshot vs. Vorwoche (Glitch-Detektor).
// API-Ausreißer (halbierte Linkprofile, VI-Sprünge) sind fast immer Messfehler —
// die dürfen nie ungeprüft beim Kunden landen.
const snapFile = path.join(snapDir, `snap-${today}.json`);
check(fs.existsSync(snapFile), `Heutiger Snapshot fehlt: ${snapFile}`);
if (fs.existsSync(snapFile)) {
  const snap = JSON.parse(safeReadFile(snapFile));
  check(snap.vi > 0, `VI unplausibel: ${snap.vi}`);
  check(snap.kw_total > 0, `Keyword-Zahl unplausibel: ${snap.kw_total}`);
  const prevFile = fs.readdirSync(snapDir).filter(f => /^snap-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .filter(f => f !== `snap-${today}.json`).sort().pop();
  if (prevFile) {
    const prev = JSON.parse(safeReadFile(path.join(snapDir, prevFile)));
    const rel = (a, b) => (b ? Math.abs(a - b) / b : 0);
    check(rel(snap.vi, prev.vi) <= 0.6, `VI-Sprung >60 % ggü. Vorwoche (${prev.vi} → ${snap.vi}) — Datenglitch?`);
    check(rel(snap.kw_total, prev.kw_total) <= 0.4, `Keyword-Sprung >40 % (${prev.kw_total} → ${snap.kw_total}) — Datenglitch?`);
    check(!(prev.ref_domains && snap.ref_domains < prev.ref_domains * 0.5),
      `Ref-Domains halbiert (${prev.ref_domains} → ${snap.ref_domains}) — Datenglitch?`);
  }
}

if (fails.length) { console.log(fails.map(f => `FAIL: ${f}`).join('\n')); process.exit(1); }
console.log('PASS');
