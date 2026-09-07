#!/usr/bin/env node
'use strict';
// target-keyword-set.js — leitet aus der bestehenden Reichweite einer Domain
// einen Zielbegriffssatz ab: 20–30 Begriffe, gruppiert nach der ART DER
// ARBEIT, die sie brauchen. Grundlage für die Keyword-Anlage eines Vertrags
// und der einzige Anker, mit dem ein Wochenbericht etwas Belastbares messen
// kann (Positionen bewegen sich nicht zufällig um 13 % — Klicks schon).
//
// Run:
//   node --env-file=.env target-keyword-set.js <domain> [--limit 30] [--min-volume 100]
//        [--pos-min 3] [--pos-max 20] [--location 2276] [--language de]
//        [--brand term,term] [--editorial /blog/,/magazin/] [--out file.json]
//   node target-keyword-set.js <domain> --fixture <ranked-keywords.json>   # offline
//   node target-keyword-set.js --selftest                                  # gegen den Fixture
//
// Auswahlregeln (jede muss gelten):
//   1. Die Domain rankt bereits zwischen pos-min und pos-max. Nur dort schlägt
//      Arbeit in Wochen in messbare Bewegung um; Begriffe ohne Ranking sind
//      ein Aufbauprojekt, keine Zielvereinbarung mit Frist.
//   2. Mindestvolumen (Zwölfmonatsschnitt).
//   3. Kaufabsicht laut Intent-Einstufung — ODER ausgeprägte Saisonalität.
//      Saisonbegriffe tragen oft das Label "informational", obwohl die
//      Suchergebnisseite aus Shops besteht ("herbstbettwäsche": acht der
//      ersten zehn Treffer Kategorie- und Produktseiten). Wo Modell und SERP
//      sich widersprechen, gilt der SERP; das Skript kann den SERP nicht
//      sehen und lässt Saisonbegriffe deshalb mit Vermerk durch.
//   4. Keine Markenbegriffe. Marke ist nicht durch Arbeit beeinflussbar; sie
//      in eine Zielvereinbarung zu nehmen, wäre geschenkte Zielerreichung.
//
// Gruppen:
//   A  halten      pos ≤ 10, passende Seite rankt — beobachten, nicht beschädigen
//   B  vorrücken   pos 11–pos-max, passende Seite rankt — der Arbeitsvorrat
//   C  falscher    Kaufbegriff, aber eine REDAKTIONELLE Seite hält ihn — der
//      Seitentyp   Kunde will kaufen, Google liefert einen Ratgeber; verkauft
//                  nichts, drückt die Klickrate
//   D  Saison      Spitze ≥ SEASON_FACTOR × Jahresschnitt — mit Spitzenmonat
//                  und Fensterbreite, weil eine neue Seite das Fenster oft
//                  nicht mehr erreicht
//
// Seitentyp-Erkennung ist in dieser Fassung ein URL-MUSTER (Standard:
// /blog/, /magazin/, /ratgeber/, /news/, /journal/). Das ist eine Heuristik
// aus zwei Domains (experimental_n1). Wer einen Crawl hat, klassifiziert
// besser über Product/CollectionPage gegen Article — dafür gibt es hier
// noch keinen Anschluss.
//
// Alle Volumen- und CPC-Werte sind Schätzungen von DataForSEO: gut zum
// Reihen, nicht als absolute Prognose. "Wertpunkte" (Volumen × CPC) sind
// eine Reihungshilfe, keine Euro.

const fs = require('node:fs');
const path = require('node:path');
const { safeReadFile, getCacheDir, writeFileExclusive } = require('../../lib/safe.js');

const SEASON_FACTOR = 1.8;     // Spitze/Jahresschnitt ab dem ein Begriff als saisonal gilt
const WINDOW_SHARE = 0.5;      // Monate ≥ 50 % der Spitze zählen zum Fenster
const COMMERCIAL = new Set(['transactional', 'commercial']);
const DEFAULT_EDITORIAL = ['/blog/', '/magazin/', '/magazine/', '/ratgeber/', '/news/', '/journal/', '/wissen/'];
const MONAT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// ---------------------------------------------------------------- Argumente
function flag(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : process.argv[i + 1];
}
function parseArgs() {
  const positional = process.argv.slice(2).filter((a, i, arr) => !a.startsWith('--') && !(arr[i - 1] || '').startsWith('--'));
  return {
    domain: positional[0] || null,
    limit: +flag('limit', 30),
    minVolume: +flag('min-volume', 100),
    posMin: +flag('pos-min', 3),
    posMax: +flag('pos-max', 20),
    location: +flag('location', 2276),
    language: flag('language', 'de'),
    brand: (flag('brand', '') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    editorial: (flag('editorial', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
    fixture: flag('fixture', null),
    out: flag('out', null),
    selftest: process.argv.includes('--selftest'),
  };
}

// ---------------------------------------------------------------- Daten
async function fetchRanked(domain, o) {
  const login = process.env.DATAFORSEO_LOGIN, pass = process.env.DATAFORSEO_PASSWORD;
  if (!login || !pass) throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD fehlen (node --env-file=.env …)');
  const body = [{
    target: domain, location_code: o.location, language_code: o.language, limit: 1000,
    filters: [
      ['ranked_serp_element.serp_item.rank_group', '<=', o.posMax], 'and',
      ['ranked_serp_element.serp_item.rank_group', '>=', o.posMin], 'and',
      ['keyword_data.keyword_info.search_volume', '>=', o.minVolume],
    ],
    order_by: ['keyword_data.keyword_info.search_volume,desc'],
  }];
  const r = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${login}:${pass}`).toString('base64'), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

function itemsOf(resp) {
  return resp?.tasks?.[0]?.result?.[0]?.items || resp?.items || [];
}

// ---------------------------------------------------------------- Regeln
function brandTermsFor(domain, extra) {
  // Standard: der Domainname ohne TLD, plus was der Nutzer angibt.
  const stem = String(domain || '').toLowerCase().replace(/^www\./, '').split('.')[0];
  const t = new Set(extra);
  if (stem && stem.length >= 3) t.add(stem);
  return [...t];
}
function isBrand(kw, terms) {
  const k = kw.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return terms.some((t) => k.includes(t.replace(/[^\p{L}\p{N}]+/gu, '')));
}
function isEditorial(url, patterns) {
  const u = String(url || '').toLowerCase();
  return patterns.some((p) => u.includes(p.toLowerCase()));
}
function season(monthly) {
  const entries = Object.entries(monthly || {}).filter(([, v]) => Number.isFinite(v));
  if (entries.length < 6) return null;
  const vals = entries.map(([, v]) => v);
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const peak = Math.max(...vals);
  const peakMonths = entries.filter(([, v]) => v === peak).map(([m]) => m);
  const window = entries.filter(([, v]) => v >= peak * WINDOW_SHARE).map(([m]) => m).sort();
  const factor = avg > 0 ? +(peak / avg).toFixed(2) : null;
  // Eine "Spitze" gibt es erst, wenn sie sich vom Schnitt abhebt. Eine flache
  // Reihe hat zwölf gleich hohe Monate — und keinen Spitzenmonat.
  const hasPeak = factor != null && factor >= 1.15 && peakMonths.length <= 3;
  return {
    avg: Math.round(avg), peak, factor,
    peak_months: hasPeak ? peakMonths : [], window_months: hasPeak ? window.length : null,
    peak_label: hasPeak ? peakMonths.map((m) => MONAT[+m.slice(5, 7) - 1]).join(', ') : null,
  };
}

function build(items, o) {
  const brand = brandTermsFor(o.domain, o.brand);
  const editorial = o.editorial.length ? o.editorial : DEFAULT_EDITORIAL;
  const rows = [];
  const dropped = { brand: 0, position: 0, volume: 0, intent: 0 };

  for (const it of items) {
    const kd = it.keyword_data || {}, ki = kd.keyword_info || {}, se = it.ranked_serp_element?.serp_item || {};
    const kw = kd.keyword; if (!kw) continue;
    const pos = se.rank_group, vol = ki.search_volume || 0;
    // Marke zuerst: Ein Markenbegriff ist draußen, egal wo er steht.
    if (isBrand(kw, brand)) { dropped.brand++; continue; }
    if (pos == null || pos < o.posMin || pos > o.posMax) { dropped.position++; continue; }
    if (vol < o.minVolume) { dropped.volume++; continue; }
    const intent = kd.search_intent_info?.main_intent || null;
    const s = season(ki.monthly_searches);
    const seasonal = !!(s && s.factor != null && s.factor >= SEASON_FACTOR);
    const commercial = COMMERCIAL.has(intent);
    // KEIN Intent-Filter hier. Schreibvarianten desselben Kerns tragen oft
    // verschiedene Labels ("hotelbettwäsche" transactional, "bettwäsche hotel"
    // navigational). Wer hier filtert, verliert die Variante, bevor sie ihrem
    // Cluster zugeordnet wurde. Entschieden wird unten je Cluster.
    const url = se.url || se.relative_url || '';
    rows.push({
      keyword: kw, core: kd.keyword_properties?.core_keyword || kw,
      position: pos, volume: vol, cpc: ki.cpc || 0, intent, seasonal, season: s,
      url, editorial: isEditorial(url, editorial),
      value: Math.round(vol * (ki.cpc || 0)),
    });
  }

  // Cluster über core_keyword: stärkster Vertreter, beste Position, Variantenzahl
  const byCore = new Map();
  for (const r of rows) {
    const g = byCore.get(r.core) || [];
    g.push(r); byCore.set(r.core, g);
  }
  const clusters = [];
  for (const g of byCore.values()) {
    // Ein Cluster bleibt, wenn IRGENDEIN Mitglied Kaufabsicht trägt oder
    // saisonal ist. Der Kopf ist der volumenstärkste Vertreter.
    const keep = g.some((r) => COMMERCIAL.has(r.intent) || r.seasonal);
    if (!keep) { dropped.intent++; continue; }
    const head = g.reduce((a, b) => (b.volume > a.volume ? b : a));
    const seasonalAny = g.some((r) => r.seasonal);
    const intent = COMMERCIAL.has(head.intent) ? head.intent : (g.find((r) => COMMERCIAL.has(r.intent))?.intent || head.intent);
    clusters.push({ ...head, intent, seasonal: seasonalAny, best_position: Math.min(...g.map((r) => r.position)), variants: g.length, variant_keywords: g.map((r) => r.keyword) });
  }

  // Gruppen
  for (const c of clusters) {
    if (c.seasonal) c.group = 'D';
    else if (c.editorial) c.group = 'C';
    else if (c.best_position <= 10) c.group = 'A';
    else c.group = 'B';
  }
  clusters.sort((a, b) => b.value - a.value);
  const chosen = clusters.slice(0, o.limit);

  // Kennzahlen
  const commercialClusters = clusters.filter((c) => COMMERCIAL.has(c.intent));
  const valueTotal = commercialClusters.reduce((s, c) => s + c.value, 0);
  const valueEditorial = commercialClusters.filter((c) => c.editorial).reduce((s, c) => s + c.value, 0);

  return {
    domain: o.domain, generated_at: new Date().toISOString(),
    rules: { pos_min: o.posMin, pos_max: o.posMax, min_volume: o.minVolume, season_factor: SEASON_FACTOR, brand_terms: brand, editorial_patterns: editorial, limit: o.limit },
    counts: { input: items.length, kept: rows.length, clusters: clusters.length, chosen: chosen.length, dropped },
    editorial_share: {
      commercial_clusters: commercialClusters.length,
      on_editorial_pages: commercialClusters.filter((c) => c.editorial).length,
      value_total: valueTotal, value_on_editorial: valueEditorial,
      share_pct: valueTotal ? +((valueEditorial / valueTotal) * 100).toFixed(1) : null,
    },
    groups: {
      A: chosen.filter((c) => c.group === 'A'), B: chosen.filter((c) => c.group === 'B'),
      C: chosen.filter((c) => c.group === 'C'), D: chosen.filter((c) => c.group === 'D'),
    },
    calendar: chosen.filter((c) => c.seasonal && c.season && c.season.peak_months.length).flatMap((c) => c.season.peak_months.map((m) => ({ month: m, keyword: c.keyword, peak: c.season.peak })))
      .sort((a, b) => (a.month < b.month ? -1 : 1)),
    caveats: [
      'Volumen und CPC sind Schätzungen (DataForSEO); zum Reihen geeignet, nicht als Prognose.',
      'Seitentyp per URL-Muster erkannt (experimental_n1). Mit Crawl besser über Product/CollectionPage vs. Article.',
      'Saisonbegriffe mit Label "informational" sind mit Vermerk enthalten; die Suchergebnisseite entscheidet, nicht das Label.',
      'Positionen sind Monatsstände des DataForSEO-Index, keine Tagesmessung.',
      'Ein Zielbegriffssatz ist Verhandlungsgegenstand, kein Messergebnis.',
    ],
  };
}

// ---------------------------------------------------------------- Ausgabe
const de = (n, d = 0) => n == null ? '–' : Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
function renderMd(res) {
  const title = { A: 'A — Halten (Platz ≤ 10, passende Seite rankt)', B: 'B — Vorrücken (Platz 11–' + res.rules.pos_max + ', passende Seite rankt)', C: 'C — Falscher Seitentyp: redaktionelle Seite hält einen Kaufbegriff', D: 'D — Saisonfenster' };
  const lines = [`# Zielbegriffe ${res.domain}`, '', `Stand ${res.generated_at.slice(0, 10)} · ${res.counts.chosen} Begriffe aus ${res.counts.clusters} Clustern (${res.counts.kept} Begriffe in Reichweite, ${res.counts.input} geprüft)`, ''];
  let n = 0;
  for (const g of ['A', 'B', 'C', 'D']) {
    const rows = res.groups[g]; if (!rows.length) continue;
    lines.push(`## ${title[g]}`, '', '| # | Zielbegriff | Ø/Monat | Spitze | Spitzenmonat | CPC | Pos. | Seite, die rankt |', '|---|---|---|---|---|---|---|---|');
    for (const c of rows) {
      n++;
      const s = c.season || {};
      lines.push(`| ${n} | ${c.keyword}${c.variants > 1 ? ` (+${c.variants - 1})` : ''} | ${de(c.volume)} | ${s.peak_label ? de(s.peak) : '–'} | ${s.peak_label || '–'} | ${de(c.cpc, 2)} | ${c.best_position} | ${c.editorial ? '⚠️ ' : ''}${c.url.replace(/^https?:\/\/[^/]+/, '')} |`);
    }
    lines.push('');
  }
  const e = res.editorial_share;
  if (e.share_pct != null) lines.push(`**Kommerzieller Wert auf redaktionellen Seiten:** ${e.on_editorial_pages} von ${e.commercial_clusters} Kaufbegriff-Clustern, ${de(e.value_on_editorial)} von ${de(e.value_total)} Wertpunkten = **${de(e.share_pct, 1)} %**.`, '');
  if (res.calendar.length) {
    lines.push('## Saisonkalender', '', '| Monat | Begriff | Spitze/Monat |', '|---|---|---|');
    for (const c of res.calendar) lines.push(`| ${MONAT[+c.month.slice(5, 7) - 1]} ${c.month.slice(0, 4)} | ${c.keyword} | ${de(c.peak)} |`);
    lines.push('');
  }
  lines.push('## Vorbehalte', '', ...res.caveats.map((c) => `- ${c}`), '');
  return lines.join('\n');
}

// ---------------------------------------------------------------- Selbsttest
function selftest() {
  const assert = require('node:assert/strict');
  const fx = path.join(__dirname, '..', '..', 'test-fixtures', 'target-keyword-set', 'ranked-keywords.synthetic.json');
  const items = itemsOf(JSON.parse(safeReadFile(fx)));
  const res = build(items, { domain: 'example-bedding.de', limit: 30, minVolume: 100, posMin: 3, posMax: 20, brand: [], editorial: [] });
  const kws = (g) => res.groups[g].map((c) => c.keyword);

  assert.deepEqual(res.counts.dropped, { brand: 1, position: 1, volume: 1, intent: 1 }, JSON.stringify(res.counts.dropped));
  assert.ok(!Object.values(res.groups).flat().some((c) => c.keyword === 'example bedding'), 'Marke muss raus');
  assert.ok(!Object.values(res.groups).flat().some((c) => c.keyword === 'bettwäsche waschen'), 'informativ+unsaisonal muss raus');
  assert.deepEqual(kws('A').sort(), ['bettdeckenbezug', 'hotelbettwäsche'].sort());
  assert.deepEqual(kws('B').sort(), ['bettwäsche für hotel', 'luxus handtücher'].sort());
  assert.deepEqual(kws('C').sort(), ['beste daunendecke', 'bettwäsche für allergiker'].sort());
  assert.deepEqual(kws('D').sort(), ['herbstbettwäsche', 'welche bettwäsche im winter'].sort());

  const hotel = res.groups.A.find((c) => c.keyword === 'hotelbettwäsche');
  assert.equal(hotel.variants, 2, 'Cluster über core_keyword');
  assert.equal(hotel.best_position, 9, 'beste Position aus dem Cluster');
  assert.equal(hotel.season.peak_label, 'Sep');

  const herbst = res.groups.D.find((c) => c.keyword === 'herbstbettwäsche');
  assert.ok(herbst.season.factor > 5, `Saisonfaktor ${herbst.season.factor}`);
  assert.equal(herbst.season.peak_label, 'Sep');
  assert.equal(herbst.season.window_months, 1, 'Herbstfenster = 1 Monat');

  // Wertanteil auf redaktionellen Seiten: allergiker 5400×2,09 + daunendecke 260×2,40 gegen alle Kaufbegriffe
  assert.equal(res.editorial_share.on_editorial_pages, 2);
  assert.ok(res.editorial_share.share_pct > 30 && res.editorial_share.share_pct < 60, `share ${res.editorial_share.share_pct}`);

  const md = renderMd(res);
  assert.ok(md.includes('## Saisonkalender') && md.includes('⚠️ /blog/'), 'Markdown enthält Kalender und Seitentyp-Warnung');
  console.log(`target-keyword-set selftest: OK — ${res.counts.chosen} Begriffe, Gruppen A${kws('A').length} B${kws('B').length} C${kws('C').length} D${kws('D').length}, redaktioneller Wertanteil ${res.editorial_share.share_pct} %`);
}

// ---------------------------------------------------------------- Main
(async () => {
  const o = parseArgs();
  if (o.selftest) return selftest();
  if (!o.domain) { console.error('Aufruf: target-keyword-set.js <domain> [--fixture f.json] [--limit N] [--min-volume N] [--pos-min N] [--pos-max N] [--brand a,b] [--editorial /x/,/y/] [--out f.json]'); process.exit(2); }
  o.domain = o.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const resp = o.fixture ? JSON.parse(safeReadFile(o.fixture)) : await fetchRanked(o.domain, o);
  const items = itemsOf(resp);
  if (!items.length) { console.error(`Keine Rankings für ${o.domain} in Reichweite (${o.posMin}–${o.posMax}, ≥ ${o.minVolume}/Monat) — oder API-Fehler: ${JSON.stringify(resp?.tasks?.[0]?.status_message || resp?.status_message || '')}`); process.exit(1); }
  const res = build(items, o);
  const outFile = o.out || path.join(getCacheDir(), `${o.domain.replace(/[^a-z0-9.-]/g, '_')}-target-set.json`);
  try { fs.rmSync(outFile, { force: true }); writeFileExclusive(outFile, JSON.stringify(res, null, 2)); } catch (e) { console.error(`Konnte ${outFile} nicht schreiben: ${e.message}`); }
  process.stdout.write(renderMd(res));
  console.error(`\nJSON: ${outFile}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
