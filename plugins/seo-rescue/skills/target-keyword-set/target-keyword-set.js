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
// Flags mit Wert: ein fehlender Wert oder einer, der selbst mit "--" beginnt,
// ist ein Aufruffehler — kein stiller Rückfall auf den Standard. `--brand`
// ohne Wert schaltete sonst den Markenschutz ab, `--limit` ohne Wert wurde
// NaN (Codex-Befund 07.09.2026).
const BOOL_FLAGS = new Set(['selftest', 'no-auto-brand']);
function flag(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const v = process.argv[i + 1];
  if (v == null || v.startsWith('--')) { console.error(`Aufruffehler: --${name} braucht einen Wert`); process.exit(2); }
  return v;
}
function num(name, dflt, min, max) {
  const v = Number(flag(name, dflt));
  if (!Number.isFinite(v) || v < min || v > max) { console.error(`Aufruffehler: --${name} muss eine Zahl zwischen ${min} und ${max} sein`); process.exit(2); }
  return v;
}
function parseArgs() {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a, i) => {
    if (a.startsWith('--')) return false;
    const prev = argv[i - 1] || '';
    return !(prev.startsWith('--') && !BOOL_FLAGS.has(prev.slice(2)));
  });
  return {
    domain: positional[0] || null,
    limit: num('limit', 30, 1, 200),
    minVolume: num('min-volume', 100, 0, 1e7),
    posMin: num('pos-min', 3, 1, 100),
    posMax: num('pos-max', 20, 1, 100),
    location: num('location', 2276, 1, 1e7),
    language: flag('language', 'de'),
    brand: (flag('brand', '') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    noAutoBrand: argv.includes('--no-auto-brand'),
    editorial: (flag('editorial', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
    fixture: flag('fixture', null),
    out: flag('out', null),
    selftest: argv.includes('--selftest'),
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
// Marke aus dem Domainstamm: nur als GANZES WORT und nur, wenn der Stamm nicht
// generisch ist. "bett.de" darf "bett kaufen" nicht zur Marke machen — das wäre
// der wertvollste Begriff des Satzes, still aussortiert (Codex-Befund
// 07.09.2026). Jeder ausgeschlossene Begriff wird im Ergebnis genannt, damit
// ein Mensch sieht, was der Automat für Marke hielt.
const GENERIC_STEMS = new Set(['shop', 'store', 'home', 'online', 'bett', 'betten', 'matratze', 'matratzen', 'moebel', 'möbel', 'deko', 'mode', 'fashion', 'sport', 'auto', 'haus', 'garten', 'baby', 'kind', 'kinder', 'buch', 'buecher', 'bücher', 'schuhe', 'shoes', 'wein', 'food', 'kaffee', 'coffee', 'tee', 'tea', 'bio', 'natur', 'living', 'style', 'design', 'outlet', 'sale', 'markt', 'market', 'welt', 'world', 'land', 'city', 'pro', 'plus', 'direct', 'direkt', 'best', 'top', 'my', 'mein', 'meine', 'dein', 'deine', 'die', 'der', 'das']);
function brandTermsFor(domain, extra, noAuto) {
  const t = new Set(extra.map((e) => e.toLowerCase()));
  if (!noAuto) {
    const stem = String(domain || '').toLowerCase().replace(/^www\./, '').split('.')[0];
    if (stem && stem.length >= 4 && !GENERIC_STEMS.has(stem) && !/^\d+$/.test(stem)) t.add(stem);
  }
  return [...t];
}
function isBrand(kw, terms) {
  // Wortweise: "example bedding" trifft "example"; "bett kaufen" trifft
  // "bett" — deshalb stehen generische Stämme oben auf der Ausschlussliste.
  const words = kw.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const joined = words.join('');
  return terms.some((t) => {
    const tw = t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!tw.length) return false;
    if (tw.length === 1) return words.includes(tw[0]) || (tw[0].length >= 6 && joined.includes(tw[0]));
    return kw.toLowerCase().includes(tw.join(' ')) || joined.includes(tw.join(''));
  });
}
function isEditorial(url, patterns) {
  const u = String(url || '').toLowerCase();
  return patterns.some((p) => u.includes(p.toLowerCase()));
}
function season(monthly) {
  // Werte können als Zahl oder Ziffernstring kommen; 12 eindeutige Monate sind
  // Pflicht — sechs Monate mit Nullen und einer Spitze ergäben "Faktor 6" aus
  // einem halben Jahr (Codex-Befund 07.09.2026).
  const entries = Object.entries(monthly || {})
    .map(([m, v]) => [m, typeof v === 'string' ? Number(v) : v])
    .filter(([m, v]) => /^\d{4}-\d{2}$/.test(m) && Number.isFinite(v) && v >= 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (new Set(entries.map(([m]) => m)).size < 12) return null;
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
  const brand = brandTermsFor(o.domain, o.brand, o.noAutoBrand);
  const editorial = o.editorial.length ? o.editorial : DEFAULT_EDITORIAL;
  const rows = [];
  const dropped = { brand: 0, position: 0, volume: 0, intent: 0 };
  const droppedBrand = [];

  for (const it of items) {
    const kd = it.keyword_data || {}, ki = kd.keyword_info || {}, se = it.ranked_serp_element?.serp_item || {};
    const kw = kd.keyword; if (!kw) continue;
    const pos = se.rank_group, vol = ki.search_volume || 0;
    // Marke zuerst: Ein Markenbegriff ist draußen, egal wo er steht.
    if (isBrand(kw, brand)) { dropped.brand++; if (droppedBrand.length < 15) droppedBrand.push(kw); continue; }
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
    // saisonal ist.
    const keep = g.some((r) => COMMERCIAL.has(r.intent) || r.seasonal);
    if (!keep) { dropped.intent++; continue; }
    // Name = volumenstärkste Variante. Position, URL und Seitentyp kommen
    // aber ZUSAMMEN von der bestplatzierten Variante — der vorige Entwurf
    // mischte Kopf-URL mit fremder Bestposition und konnte eine Blogseite
    // auf Platz 5 als Produktseite in Gruppe A führen (Codex-Befund
    // 07.09.2026). Volumen und Wert werden über alle Varianten summiert:
    // drei Schreibweisen à 500 sind mehr als ein Einzelbegriff mit 1.000.
    const head = g.reduce((a, b) => (b.volume > a.volume ? b : a));
    const rep = g.reduce((a, b) => (b.position < a.position ? b : a));
    const volumeTotal = g.reduce((s, r) => s + r.volume, 0);
    const seasonalAny = g.some((r) => r.seasonal);
    const intent = COMMERCIAL.has(rep.intent) ? rep.intent : (g.find((r) => COMMERCIAL.has(r.intent))?.intent || rep.intent);
    clusters.push({
      keyword: head.keyword, core: head.core, volume: head.volume, volume_total: volumeTotal, cpc: head.cpc,
      season: head.season, seasonal: seasonalAny, intent,
      position: rep.position, best_position: rep.position, url: rep.url, editorial: rep.editorial, ranking_variant: rep.keyword,
      value: Math.round(volumeTotal * (head.cpc || 0)),
      variants: g.length, variant_keywords: g.map((r) => r.keyword),
    });
  }

  // Gruppen
  // Reihenfolge nach ART DER ARBEIT: Der falsche Seitentyp (C) ist der
  // teurere Befund und gewinnt vor dem Saisonfenster (D) — ein saisonaler
  // Kaufbegriff auf einer Blogseite verlor sonst genau diesen Befund in der
  // Vertragsanlage (Codex-Befund 07.09.2026). Saison bleibt als Merkmal an
  // jedem Begriff und im Kalender sichtbar.
  for (const c of clusters) {
    if (c.editorial && (COMMERCIAL.has(c.intent) || c.seasonal)) c.group = 'C';
    else if (c.seasonal) c.group = 'D';
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
    dropped_as_brand: droppedBrand,
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
      lines.push(`| ${n} | ${c.keyword}${c.variants > 1 ? ` (+${c.variants - 1}, zusammen ${de(c.volume_total)})` : ''} | ${de(c.volume)} | ${s.peak_label ? de(s.peak) : '–'} | ${s.peak_label || '–'} | ${de(c.cpc, 2)} | ${c.best_position} | ${c.editorial ? '⚠️ ' : ''}${c.url.replace(/^https?:\/\/[^/]+/, '')} |`);
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
  if (res.dropped_as_brand.length) lines.push(`**Als Marke ausgeschlossen (${res.rules.brand_terms.join(', ') || 'keine Markenbegriffe'}):** ${res.dropped_as_brand.join(', ')}${res.counts.dropped.brand > res.dropped_as_brand.length ? ' …' : ''}`, '');
  lines.push('## Vorbehalte', '', ...res.caveats.map((c) => `- ${c}`), '');
  return lines.join('\n');
}

// ---------------------------------------------------------------- Selbsttest
function selftest() {
  const assert = require('node:assert/strict');
  const fx = path.join(__dirname, '..', '..', 'test-fixtures', 'target-keyword-set', 'ranked-keywords.synthetic.json');
  const items = itemsOf(JSON.parse(safeReadFile(fx)));
  const res = build(items, { domain: 'example-bedding.de', limit: 30, minVolume: 100, posMin: 3, posMax: 20, brand: [], editorial: [], noAutoBrand: false });
  const kws = (g) => res.groups[g].map((c) => c.keyword);

  assert.deepEqual(res.counts.dropped, { brand: 1, position: 1, volume: 1, intent: 1 }, JSON.stringify(res.counts.dropped));
  assert.ok(!Object.values(res.groups).flat().some((c) => c.keyword === 'example bedding'), 'Marke muss raus');
  assert.ok(!Object.values(res.groups).flat().some((c) => c.keyword === 'bettwäsche waschen'), 'informativ+unsaisonal muss raus');
  assert.deepEqual(kws('A').sort(), ['bettdeckenbezug', 'hotelbettwäsche'].sort());
  assert.deepEqual(kws('B').sort(), ['bettwäsche für hotel', 'luxus handtücher'].sort());
  // C vor D: die beiden Saisonbegriffe liegen auf Blogseiten → falscher Seitentyp, Saison bleibt Merkmal
  assert.deepEqual(kws('C').sort(), ['beste daunendecke', 'bettwäsche für allergiker', 'herbstbettwäsche', 'welche bettwäsche im winter'].sort());
  assert.deepEqual(kws('D'), []);
  assert.ok(res.groups.C.find((c) => c.keyword === 'herbstbettwäsche').seasonal, 'Saison bleibt Merkmal in C');

  const hotel = res.groups.A.find((c) => c.keyword === 'hotelbettwäsche');
  assert.equal(hotel.variants, 2, 'Cluster über core_keyword');
  assert.equal(hotel.best_position, 9, 'beste Position aus dem Cluster');
  assert.equal(hotel.volume_total, 5800, 'Volumen über Varianten summiert');
  assert.equal(hotel.ranking_variant, 'bettwäsche hotel', 'Position/URL kommen von der bestplatzierten Variante');
  assert.deepEqual(res.dropped_as_brand, ['example bedding'], 'Markenausschluss sichtbar');
  // Generischer Stamm wird NICHT automatisch zur Marke
  const gen = build(items, { domain: 'bett.de', limit: 30, minVolume: 100, posMin: 3, posMax: 20, brand: [], editorial: [], noAutoBrand: false });
  assert.equal(gen.counts.dropped.brand, 0, 'bett.de darf "bettdeckenbezug" nicht zur Marke machen');
  assert.equal(hotel.season.peak_label, 'Sep');

  const herbst = res.groups.C.find((c) => c.keyword === 'herbstbettwäsche');
  assert.ok(herbst.season.factor > 5, `Saisonfaktor ${herbst.season.factor}`);
  assert.equal(herbst.season.peak_label, 'Sep');
  assert.equal(herbst.season.window_months, 1, 'Herbstfenster = 1 Monat');
  // Saison braucht 12 Monate: 6 Monate mit Nullen und einer Spitze sind kein Saisonfaktor
  assert.equal(season({ '2026-01': 0, '2026-02': 0, '2026-03': 0, '2026-04': 0, '2026-05': 0, '2026-06': 100 }), null, 'halbes Jahr = kein Saisonurteil');
  assert.equal(season({ '2026-01': '100', '2026-02': '100', '2026-03': '100', '2026-04': '100', '2026-05': '100', '2026-06': '100', '2026-07': '100', '2026-08': '100', '2026-09': '600', '2026-10': '100', '2026-11': '100', '2026-12': '100' }).peak_label, 'Sep', 'Ziffernstrings werden konvertiert');

  // Wertanteil auf redaktionellen Seiten: allergiker 5400×2,09 + daunendecke 260×2,40 gegen alle Kaufbegriffe
  assert.equal(res.editorial_share.on_editorial_pages, 2);
  // Sollwerte statt Spanne: allergiker 5400×2,09 + daunendecke 260×2,40 = 11.910; alle Kaufbegriff-Cluster (Volumen über Varianten) = 39.979
  assert.equal(res.editorial_share.value_on_editorial, 11910, `editorial ${res.editorial_share.value_on_editorial}`);
  assert.equal(res.editorial_share.value_total, 39979, `total ${res.editorial_share.value_total}`);
  assert.equal(res.editorial_share.share_pct, 29.8);

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
