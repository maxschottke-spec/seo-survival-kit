'use strict';
// weekly-noise.js — misst, wie viel Woche-zu-Woche-Bewegung einer Kennzahl
// gewöhnliche Schwankung ist, und ob der Trend dahinter überhaupt sichtbar wird.
//
// Warum: Am 07.09.2026 stand in einem Wochenbericht "+9,3 %" neben einer
// durchgängig negativen Erzählung. Die Zahl war (nach Korrektur des Labels)
// richtig — aber sie beschrieb Zufall als Entwicklung. Gemessen an derselben
// Größenordnung (rund 200 Klicks je Woche): mittlere Woche-zu-Woche-Änderung
// 13 %, tatsächlicher Trend 1,4 % je Woche. Das Rauschen war neunmal so groß
// wie das Signal. Kein Takt unter einem Quartal trennt dort Entwicklung von
// Zufall. Ein Bericht, der so etwas wöchentlich als Bewegung meldet, sagt
// jede Woche etwas, das nicht stimmt.
//
// Was das Modul liefert (aus einer chronologischen Reihe {date, value}):
//   noise_pct           mittlere absolute Abweichung der Wochenschritte VOM
//                       Trendschritt, in Prozent — das "Band", innerhalb
//                       dessen eine einzelne Wochenbewegung nichts bedeutet
//   trend_pct_per_week  Steigung einer linearen Regression, relativ zum
//                       Mittelwert, je Woche
//   ratio               |trend| / noise — unter 1 ist eine Wochenbewegung
//                       überwiegend Zufall
//   weeks               Zahl der verwendeten Punkte
//   verdict             'unbekannt' (zu wenig Punkte) · 'rauschen' · 'signal'
//
// Was es NICHT tut: Es beweist keinen Trend. Es sagt nur, ob die Reihe lang
// und ruhig genug ist, dass ein einzelner Wochenvergleich etwas aussagt.
//
// Zeitliche Hygiene: Nur Paare mit 4–10 Tagen Abstand zählen als Wochenpaar.
// Ein Doppellauf am Folgetag (03./04.08.) und eine ausgefallene Woche (31.08.)
// dürfen das Rauschen weder drücken noch aufblähen.
//
// Selbsttest:  node weekly-noise.js --selftest

const MIN_WEEKS = 8;          // darunter: 'unbekannt' — vier Punkte sind kein Modell
const PAIR_MIN_DAYS = 4;      // enger = Doppellauf, kein Wochenpaar
const PAIR_MAX_DAYS = 10;     // weiter = Lücke, kein Wochenpaar

function days(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/**
 * @param {Array<{date:string, value:number}>} series chronologisch, value > 0
 * @param {{minWeeks?:number}} [opts]
 */
function noiseModel(series, opts = {}) {
  const minWeeks = opts.minWeeks ?? MIN_WEEKS;
  const sorted = (series || [])
    .filter((p) => p && p.date && Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Nachläufer KOLLABIEREN, nicht nur als Paar überspringen: Ein Punkt, der
  // näher als PAIR_MIN_DAYS am zuletzt behaltenen liegt, ist ein Wiederholungs-
  // lauf derselben Woche und fliegt raus. Der planmäßige (erste) Punkt bleibt.
  // Der erste Entwurf übersprang nur das Paar 03.→04.08. — und machte den
  // 04.08. dann zum Startpunkt des nächsten Wochenpaars, samt seinem Wert.
  // Der Selbsttest (Fall 4) hat das gefunden.
  const pts = [];
  for (const p of sorted) {
    if (pts.length && days(pts[pts.length - 1].date, p.date) < PAIR_MIN_DAYS) continue;
    pts.push(p);
  }

  const base = { weeks: pts.length, noise_pct: null, trend_pct_per_week: null, ratio: null, verdict: 'unbekannt', pairs: 0 };
  if (pts.length < 2) return base;

  // Trend und Rauschen im LOG-Raum. Grund (Codex-Befund 07.09.2026): Der
  // vorige Entwurf zog von jedem relativen Wochenschritt einen KONSTANTEN
  // relativen Trendschritt (slope/Mittelwert) ab. Für eine lineare Reihe ist
  // der erwartete relative Schritt aber slope/vorherigerWert und variiert —
  // deterministische Bewegung wurde so teilweise als Rauschen gezählt. Im
  // Log-Raum ist ein konstanter Prozenttrend eine Gerade, der Residuen-Schritt
  // ist skalenfrei, und "±x % um den Trend" ist genau das, was der Bericht
  // behauptet.
  const x = pts.map((p) => days(pts[0].date, p.date) / 7);
  const ly = pts.map((p) => Math.log(p.value));
  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = ly.reduce((s, v) => s + v, 0) / ly.length;
  const sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  const slope = sxx > 0 ? x.reduce((s, v, i) => s + (v - mx) * (ly[i] - my), 0) / sxx : 0; // ln-Einheiten je Woche
  const trend = (Math.exp(slope) - 1) * 100; // % je Woche

  // Rauschen = mittlere absolute Abweichung des Log-Wochenschritts vom
  // erwarteten Log-Trendschritt (slope × Tage/7), zurück in Prozent.
  const resid = [];
  for (let i = 1; i < pts.length; i++) {
    const d = days(pts[i - 1].date, pts[i].date);
    if (d < PAIR_MIN_DAYS || d > PAIR_MAX_DAYS) continue;
    const logStep = Math.log(pts[i].value / pts[i - 1].value);
    resid.push(Math.abs(logStep - slope * (d / 7)));
  }
  const noiseLog = resid.length ? resid.reduce((s, v) => s + v, 0) / resid.length : null;
  const noise = noiseLog != null ? (Math.exp(noiseLog) - 1) * 100 : null; // UNGERUNDET für die Klassifikation

  // ratio: |Trend| gegen Rauschen. Null Rauschen bei vorhandenem Trend heißt:
  // jede Bewegung ist Signal. Gedeckelt, damit der Snapshot JSON-fähig bleibt
  // (JSON.stringify(Infinity) wäre null).
  let ratio = null;
  if (noise != null) ratio = noise > 1e-9 ? Math.min(Math.abs(trend) / noise, 999) : (Math.abs(trend) > 1e-9 ? 999 : null);
  const enough = pts.length >= minWeeks && resid.length >= Math.max(3, minWeeks - 2);
  const verdict = !enough ? 'unbekannt' : ratio != null && ratio < 1 ? 'rauschen' : 'signal';

  return {
    weeks: pts.length,
    pairs: resid.length,
    noise_pct: noise != null ? +noise.toFixed(3) : null, // 3 Stellen: Klassifikation braucht den Wert, Anzeige rundet selbst
    trend_pct_per_week: trend != null ? +trend.toFixed(2) : null,
    ratio: ratio == null ? null : +ratio.toFixed(2),
    verdict,
    first: pts[0].date,
    last: pts[pts.length - 1].date,
  };
}

/** Liegt eine relative Wochenbewegung innerhalb des Bandes? null = Modell fehlt. */
function withinBand(relChange, model) {
  if (!model || model.noise_pct == null || model.verdict === 'unbekannt') return null;
  if (!Number.isFinite(relChange)) return null;
  // Inklusiv, und eine Null-Bewegung ist immer "innerhalb" — sonst schreibt
  // eine flache Reihe (Rauschen 0) "außerhalb der üblichen Schwankung ±0,0 %"
  // an eine Bewegung von 0,0 % (Codex-Befund 07.09.2026).
  if (relChange === 0) return true;
  return Math.abs(relChange) * 100 <= model.noise_pct;
}

module.exports = { noiseModel, withinBand, MIN_WEEKS };

// ---- Selbsttest mit vorgegebenen Sollwerten ----------------------------------
if (require.main === module && process.argv.includes('--selftest')) {
  const assert = require('node:assert/strict');
  const wk = (i) => new Date(Date.UTC(2026, 0, 5 + 7 * i)).toISOString().slice(0, 10);

  // 1) Zu wenig Punkte → unbekannt, aber Rauschen wird trotzdem berechnet
  let m = noiseModel([0, 1, 2, 3].map((i) => ({ date: wk(i), value: 100 + (i % 2 ? 10 : -10) })));
  assert.equal(m.verdict, 'unbekannt');
  assert.equal(m.weeks, 4);

  // 2) Reines Rauschen, kein Trend: ±10 % im Wechsel über 12 Wochen → rauschen
  m = noiseModel([...Array(12)].map((_, i) => ({ date: wk(i), value: i % 2 ? 110 : 90 })));
  assert.equal(m.verdict, 'rauschen');
  assert.ok(m.noise_pct > 15 && m.noise_pct < 25, `noise ${m.noise_pct}`); // 90→110 = +22 %, 110→90 = −18 %
  assert.ok(Math.abs(m.trend_pct_per_week) < 1, `trend ${m.trend_pct_per_week}`);

  // 3) Klarer Trend, wenig Rauschen: +5 %/Woche, glatt → signal
  m = noiseModel([...Array(12)].map((_, i) => ({ date: wk(i), value: 100 * 1.05 ** i })));
  assert.equal(m.verdict, 'signal');
  assert.ok(m.ratio > 1, `ratio ${m.ratio}`);

  // 4) Doppellauf am Folgetag zählt NICHT als Wochenpaar, Lücke von 14 Tagen auch nicht
  const s = [...Array(10)].map((_, i) => ({ date: wk(i), value: 100 }));
  s.push({ date: '2026-01-06', value: 50 });   // Folgetag von wk(0) — würde als −50 % zählen
  s.splice(5, 1);                               // eine Woche fehlt → 14-Tage-Lücke
  m = noiseModel(s);
  assert.equal(m.pairs, 7, `pairs ${m.pairs}`);  // 9 Wochenpunkte, 8 Übergänge, einer ist die Lücke
  assert.equal(m.noise_pct, 0);

  // 5) withinBand
  const band = { noise_pct: 13, verdict: 'rauschen' };
  assert.equal(withinBand(0.05, band), true);
  assert.equal(withinBand(-0.20, band), false);
  assert.equal(withinBand(0.05, { verdict: 'unbekannt' }), null);
  assert.equal(withinBand(0, { noise_pct: 0, verdict: 'rauschen' }), true, 'Null-Bewegung bei Null-Rauschen ist innerhalb');
  assert.equal(withinBand(Infinity, band), null, 'Infinity (Vorwoche 0) → kein Urteil');

  // 6) Linearer Trend (nicht exponentiell): +5 je Woche auf 100 → im Log-Raum fast gerade, Residuen klein → signal
  m = noiseModel([...Array(12)].map((_, i) => ({ date: wk(i), value: 100 + 5 * i })));
  assert.equal(m.verdict, 'signal', `linear: ${JSON.stringify(m)}`);

  console.log('weekly-noise selftest: 6/6 OK');
}
