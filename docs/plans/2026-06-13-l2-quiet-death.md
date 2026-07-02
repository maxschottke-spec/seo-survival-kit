# L2 Quiet-Death-Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `gsc-deep-dive` bekommt eine Pro-Query-Wochen-Zeitreihe im Fetch und einen zero-dep Detector, der langsame, nicht-update-getriebene Klick-Declines ("Quiet Death") nach festen Kriterien flaggt, mit Update-Korrelation annotiert und als `experimental_n1` markiert.

**Architecture:** TDD am netzfreien Detector-Modul (`quiet-death-detect.example.js`, reine Funktionen via `module.exports`, getestet mit Fixtures). Die Fetch-Erweiterung (`gsc-fetch.example.js`) bleibt untested (braucht GSC-Creds, konsistent mit dem bestehenden Skript). Doku in SKILL.md.

**Tech Stack:** Node.js (zero-dep, plain script), Markdown (SKILL.md), `claude plugin validate`.

**Branch:** `feature/l2-quiet-death` (existiert, Spec committet `cd5e7aa`).

**Spec:** `docs/specs/2026-06-13-l2-quiet-death-design.md`

---

### Task 1: Fixtures (Snapshot + CORE_UPDATES-Auszug)

**Files:**
- Create: `plugins/seo-rescue/test-fixtures/ecommerce-recovery/gsc-quiet-death-fixture.json`
- Create: `plugins/seo-rescue/test-fixtures/ecommerce-recovery/core-updates-fixture.md`

- [ ] **Step 1: Snapshot-Fixture anlegen**

Erstelle `plugins/seo-rescue/test-fixtures/ecommerce-recovery/gsc-quiet-death-fixture.json` — drei Query-Reihen: eine klare Quiet-Death (kein Update), eine update-korrelierte (Drop im Mai-2026-Fenster), eine gesunde:

```json
{
  "site": "sc-domain:example.com",
  "search_appearance": [],
  "query_weekly_series": [
    { "query": "matratzen marken", "weeks": [
      { "iso_week": "2025-W40", "clicks": 48 },
      { "iso_week": "2025-W41", "clicks": 40 },
      { "iso_week": "2025-W42", "clicks": 34 },
      { "iso_week": "2025-W43", "clicks": 29 },
      { "iso_week": "2025-W44", "clicks": 25 },
      { "iso_week": "2025-W45", "clicks": 22 },
      { "iso_week": "2025-W46", "clicks": 20 },
      { "iso_week": "2025-W47", "clicks": 18 },
      { "iso_week": "2025-W48", "clicks": 15 },
      { "iso_week": "2025-W49", "clicks": 12 }
    ]},
    { "query": "boxspringbett 180x200", "weeks": [
      { "iso_week": "2026-W16", "clicks": 60 },
      { "iso_week": "2026-W17", "clicks": 58 },
      { "iso_week": "2026-W18", "clicks": 55 },
      { "iso_week": "2026-W19", "clicks": 52 },
      { "iso_week": "2026-W20", "clicks": 48 },
      { "iso_week": "2026-W21", "clicks": 20 },
      { "iso_week": "2026-W22", "clicks": 15 },
      { "iso_week": "2026-W23", "clicks": 12 },
      { "iso_week": "2026-W24", "clicks": 10 },
      { "iso_week": "2026-W25", "clicks": 9 }
    ]},
    { "query": "lattenrost 90x200", "weeks": [
      { "iso_week": "2026-W16", "clicks": 20 },
      { "iso_week": "2026-W17", "clicks": 22 },
      { "iso_week": "2026-W18", "clicks": 21 },
      { "iso_week": "2026-W19", "clicks": 23 },
      { "iso_week": "2026-W20", "clicks": 25 },
      { "iso_week": "2026-W21", "clicks": 24 },
      { "iso_week": "2026-W22", "clicks": 26 },
      { "iso_week": "2026-W23", "clicks": 28 },
      { "iso_week": "2026-W24", "clicks": 27 },
      { "iso_week": "2026-W25", "clicks": 30 }
    ]}
  ]
}
```

Erwartete Detector-Resultate (zur Orientierung): `matratzen marken` flagged, `update_correlation: "none"` (größter Drop 48→40 in W41 ≈ 2025-10-06, kein Update-Fenster); `boxspringbett 180x200` flagged, `update_correlation: "partial"` (größter Drop 48→20 in W21 ≈ 2026-05-18, im Mai-Core-Fenster ±1 Woche); `lattenrost 90x200` NICHT flagged (Klicks steigen, Verlust positiv).

- [ ] **Step 2: CORE_UPDATES-Fixture anlegen**

Erstelle `plugins/seo-rescue/test-fixtures/ecommerce-recovery/core-updates-fixture.md`:

```markdown
# Known Google Core Updates (test fixture)

| Update | Type | Rollout-Start | Rollout-Ende | Verified |
|--------|------|--------------|-------------|----------|
| May 2026 Core Update | core | 2026-05-21 | 2026-06-02 | yes |
| December 2025 Core Update | core | 2025-12-11 | 2025-12-29 | yes |
```

- [ ] **Step 3: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/test-fixtures/ecommerce-recovery/gsc-quiet-death-fixture.json plugins/seo-rescue/test-fixtures/ecommerce-recovery/core-updates-fixture.md
git commit -m "test(L2): fixtures for quiet-death detector (snapshot + core-updates)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Failing test für den Detector

**Files:**
- Create: `plugins/seo-rescue/test-fixtures/ecommerce-recovery/quiet-death-detect.test.js`

- [ ] **Step 1: Test schreiben**

Erstelle `plugins/seo-rescue/test-fixtures/ecommerce-recovery/quiet-death-detect.test.js`:

```js
'use strict';
// Offline unit test for the L2 quiet-death detector (zero-dep).
const fs = require('fs');
const path = require('path');
const det = require('../../skills/gsc-deep-dive/quiet-death-detect.example.js');

const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, 'gsc-quiet-death-fixture.json'), 'utf8'));
const coreMd = fs.readFileSync(path.join(__dirname, 'core-updates-fixture.md'), 'utf8');

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name); failed++; }
}

const windows = det.parseUpdateWindows(coreMd);
check('parseUpdateWindows finds 2 windows', windows.length === 2);
check('parseUpdateWindows reads May 2026 start', windows.some(w => w.start === '2026-05-21' && w.end === '2026-06-02'));

const res = det.detectQuietDeath(snapshot, windows, { brandTerms: [] });
check('maturity is experimental_n1', res.maturity === 'experimental_n1');
check('queries_analyzed is 3', res.queries_analyzed === 3);
check('flagged_count is 2', res.flagged_count === 2);

const byq = Object.fromEntries(res.quiet_death_queries.map(q => [q.query, q]));
check('matratzen marken flagged', !!byq['matratzen marken']);
check('matratzen marken correlation none', byq['matratzen marken'] && byq['matratzen marken'].update_correlation === 'none');
check('matratzen marken loss <= -50', byq['matratzen marken'] && byq['matratzen marken'].loss_pct <= -50);
check('boxspringbett flagged', !!byq['boxspringbett 180x200']);
check('boxspringbett correlation partial', byq['boxspringbett 180x200'] && byq['boxspringbett 180x200'].update_correlation === 'partial');
check('lattenrost NOT flagged', !byq['lattenrost 90x200']);

check('classifyPattern brand', det.classifyPattern('meinemarke matratze', ['meinemarke'], false) === 'brand_erosion');
check('classifyPattern serp_feature', det.classifyPattern('matratze 90x200', [], true) === 'serp_feature_absorption');
check('classifyPattern generic', det.classifyPattern('matratze 90x200', [], false) === 'generic_erosion');

console.log('\n' + (failed === 0 ? 'PASS: quiet-death detector behaves' : 'FAIL: ' + failed + ' check(s) failed'));
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/quiet-death-detect.test.js; echo "EXIT: $?"
```
Expected: FAIL — `Cannot find module '../../skills/gsc-deep-dive/quiet-death-detect.example.js'` (Modul existiert noch nicht), Exit ≠ 0.

- [ ] **Step 3: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/test-fixtures/ecommerce-recovery/quiet-death-detect.test.js
git commit -m "test(L2): failing unit test for quiet-death detector

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Detector-Modul implementieren

**Files:**
- Create: `plugins/seo-rescue/skills/gsc-deep-dive/quiet-death-detect.example.js`

- [ ] **Step 1: Modul schreiben**

Erstelle `plugins/seo-rescue/skills/gsc-deep-dive/quiet-death-detect.example.js`:

```js
'use strict';
// L2 Quiet-Death detector for seo-survival-kit (gsc-deep-dive).
// EXPERIMENTAL N=1 (Lesson 2, case-001). Flags slow, non-update-driven click
// declines in a per-query weekly series. Zero runtime dependencies.
//
// CLI:  node quiet-death-detect.example.js <gsc-snapshot.json> [--core <CORE_UPDATES.md>] [--brand a,b]
// API:  require(...) → { detectQuietDeath, parseUpdateWindows, classifyPattern, isoWeekToMonday }
const fs = require('fs');
const path = require('path');

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

function rollingMean(values, window) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(mean(slice));
  }
  return out;
}

function longestNonIncreasingRun(means, tolerance = 0.02) {
  if (!means.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < means.length; i++) {
    if (means[i] <= means[i - 1] * (1 + tolerance)) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

function parseUpdateWindows(md) {
  const windows = [];
  for (const line of String(md).split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cols = line.split('|').map(c => c.trim());
    const start = cols[3], end = cols[4];
    if (/^\d{4}-\d{2}-\d{2}$/.test(start || '') && /^\d{4}-\d{2}-\d{2}$/.test(end || '')) {
      windows.push({ start, end });
    }
  }
  return windows;
}

function isoWeekToMonday(isoWeek) {
  const [y, w] = String(isoWeek).split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7; // Mon=0
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function dropCorrelatesWithUpdate(dropWeekMonday, windows) {
  const d = new Date(dropWeekMonday + 'T00:00:00Z').getTime();
  const wk = 7 * 24 * 3600 * 1000;
  return windows.some(w => {
    const s = new Date(w.start + 'T00:00:00Z').getTime() - wk;
    const e = new Date(w.end + 'T00:00:00Z').getTime() + wk;
    return d >= s && d <= e;
  });
}

function classifyPattern(query, brandTerms, hasAIO) {
  const q = String(query).toLowerCase();
  if ((brandTerms || []).some(t => t && q.includes(String(t).toLowerCase()))) return 'brand_erosion';
  if (hasAIO) return 'serp_feature_absorption';
  return 'generic_erosion';
}

function detectQuietDeath(snapshot, updateWindows, opts = {}) {
  const C = { min_start_clicks: 5, min_loss_pct: 50, min_decline_weeks: 6, rolling_window: 4 };
  const brandTerms = opts.brandTerms || [];
  const series = (snapshot && snapshot.query_weekly_series) || [];
  const aioPresent = ((snapshot && snapshot.search_appearance) || [])
    .some(r => /overview|ai/i.test((r && (r.searchAppearance || r.query)) || ''));
  const flagged = [];
  for (const item of series) {
    const weeks = item.weeks || [];
    if (weeks.length < C.min_decline_weeks) continue;
    const clicks = weeks.map(w => Number(w.clicks) || 0);
    const startMean = mean(clicks.slice(0, C.rolling_window));
    const endMean = mean(clicks.slice(-C.rolling_window));
    if (startMean < C.min_start_clicks) continue;
    const lossPct = Math.round((endMean - startMean) / startMean * 100);
    if (lossPct > -C.min_loss_pct) continue;
    const declineWeeks = longestNonIncreasingRun(rollingMean(clicks, C.rolling_window));
    if (declineWeeks < C.min_decline_weeks) continue;
    let maxDrop = 0, dropIdx = 1;
    for (let i = 1; i < clicks.length; i++) {
      const drop = clicks[i] - clicks[i - 1];
      if (drop < maxDrop) { maxDrop = drop; dropIdx = i; }
    }
    const correlated = dropCorrelatesWithUpdate(isoWeekToMonday(weeks[dropIdx].iso_week), updateWindows || []);
    flagged.push({
      query: item.query,
      start_clicks: Math.round(startMean),
      end_clicks: Math.round(endMean),
      loss_pct: lossPct,
      decline_weeks: declineWeeks,
      update_correlation: correlated ? 'partial' : 'none',
      pattern_hint: classifyPattern(item.query, brandTerms, aioPresent),
    });
  }
  return {
    maturity: 'experimental_n1',
    criteria: C,
    window_weeks: series.length ? Math.max(...series.map(s => (s.weeks || []).length)) : 0,
    queries_analyzed: series.length,
    flagged_count: flagged.length,
    quiet_death_queries: flagged,
  };
}

module.exports = { detectQuietDeath, parseUpdateWindows, classifyPattern, isoWeekToMonday, rollingMean, longestNonIncreasingRun };

if (require.main === module) {
  const args = process.argv.slice(2);
  const snapPath = args.find(a => !a.startsWith('--'));
  const coreIdx = args.indexOf('--core');
  const corePath = coreIdx >= 0 ? args[coreIdx + 1] : path.join(__dirname, '..', '..', 'references', 'CORE_UPDATES.md');
  const brandIdx = args.indexOf('--brand');
  const brandTerms = brandIdx >= 0 ? (args[brandIdx + 1] || '').split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!snapPath) { console.error('usage: node quiet-death-detect.example.js <gsc-snapshot.json> [--core <CORE_UPDATES.md>] [--brand a,b]'); process.exit(1); }
  const snapshot = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  let windows = [];
  try { windows = parseUpdateWindows(fs.readFileSync(corePath, 'utf8')); }
  catch (e) { console.error('[quiet-death] CORE_UPDATES not readable, all correlations = none:', e.message); }
  const res = detectQuietDeath(snapshot, windows, { brandTerms });
  const site = (snapshot.site || 'site').replace(/[^a-z0-9.-]/gi, '-').slice(0, 80);
  const outDir = path.join(path.dirname(snapPath));
  const date = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `${site}-quiet-death-${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(res, null, 2));
  const none = res.quiet_death_queries.filter(q => q.update_correlation === 'none').length;
  const partial = res.flagged_count - none;
  console.error(`[quiet-death] ${snapshot.site}: ${res.flagged_count}/${res.queries_analyzed} queries flagged (${none}× none, ${partial}× partial update-correlation)`);
  console.error(`✅ ${outPath}`);
}
```

- [ ] **Step 2: Test ausführen — muss bestehen**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/quiet-death-detect.test.js; echo "EXIT: $?"
```
Expected: alle `✓`, `PASS: quiet-death detector behaves`, Exit 0.

Falls ein Fixture-Datum-Check fehlschlägt (z.B. `update_correlation` unerwartet): das `iso_week` der Drop-Woche im Fixture prüfen und an ein klar update-freies bzw. klar im-Fenster liegendes Datum anpassen — NICHT die Schwellen im Modul verbiegen.

- [ ] **Step 3: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/skills/gsc-deep-dive/quiet-death-detect.example.js
git commit -m "feat(gsc-deep-dive): quiet-death detector module (L2, experimental_n1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Fetch-Erweiterung — query_weekly_series

**Files:**
- Modify: `plugins/seo-rescue/skills/gsc-deep-dive/gsc-fetch.example.js` (Main-Block ~Z.190–205)
- Modify: `plugins/seo-rescue/skills/gsc-deep-dive/gsc-config.example.json`

- [ ] **Step 1: ISO-Week-Helper + Weekly-Series-Aufbau einfügen**

Im `gsc-fetch.example.js`, unmittelbar vor `// --- Main ---` (Z.178) einfügen:

```js
// --- Weekly per-query series (L2 quiet-death input) ---
const WEEKLY_DAYS = Number(CONFIG.weekly_series_days) || 480;
const WEEKLY_TOP_N = 200;

function isoWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - ftDay + 3);
  const week = 1 + Math.round((d - firstThu) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function buildWeeklySeries(rows) {
  // rows: searchAnalytics ['date','query'] → keys [date, query]
  const byQuery = new Map();
  for (const r of rows || []) {
    const [date, query] = r.keys || [];
    if (!date || !query) continue;
    const wk = isoWeekLabel(date);
    if (!byQuery.has(query)) byQuery.set(query, { total: 0, weeks: new Map() });
    const q = byQuery.get(query);
    const c = Number(r.clicks) || 0;
    q.total += c;
    q.weeks.set(wk, (q.weeks.get(wk) || 0) + c);
  }
  const all = [...byQuery.entries()].map(([query, q]) => ({
    query: sanitizeQuery(query),
    total: q.total,
    weeks: [...q.weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([iso_week, clicks]) => ({ iso_week, clicks })),
  }));
  all.sort((a, b) => b.total - a.total);
  const kept = all.slice(0, WEEKLY_TOP_N);
  if (all.length > WEEKLY_TOP_N) {
    console.error(`[quiet-death] weekly series capped to top ${WEEKLY_TOP_N} queries; ${all.length - WEEKLY_TOP_N} omitted`);
  }
  return kept.map(({ query, weeks }) => ({ query, weeks }));
}
```

- [ ] **Step 2: Weekly-Series-Call in Main einbauen**

Ersetze exakt:

```js
  const [byQuery, byPage, byQueryPage, bySearchAppearance] = await Promise.all([
    searchAnalytics(token, ['query'], startDate, endDate, TOP_N),
    searchAnalytics(token, ['page'], startDate, endDate, TOP_N),
    searchAnalytics(token, ['query', 'page'], startDate, endDate, Math.min(TOP_N * 2, 1000)),
    searchAnalytics(token, ['searchAppearance'], startDate, endDate, 50).catch(e => ({ error: String(e) })),
  ]);
```

durch:

```js
  const weeklyStartObj = new Date(today); weeklyStartObj.setDate(weeklyStartObj.getDate() - WEEKLY_DAYS);
  const weeklyStart = weeklyStartObj.toISOString().slice(0, 10);

  const [byQuery, byPage, byQueryPage, bySearchAppearance, byDateQuery] = await Promise.all([
    searchAnalytics(token, ['query'], startDate, endDate, TOP_N),
    searchAnalytics(token, ['page'], startDate, endDate, TOP_N),
    searchAnalytics(token, ['query', 'page'], startDate, endDate, Math.min(TOP_N * 2, 1000)),
    searchAnalytics(token, ['searchAppearance'], startDate, endDate, 50).catch(e => ({ error: String(e) })),
    searchAnalytics(token, ['date', 'query'], weeklyStart, endDate, 25000).catch(e => ({ error: String(e), rows: [] })),
  ]);
```

- [ ] **Step 3: query_weekly_series ins Output-Objekt aufnehmen**

Ersetze exakt:

```js
    search_appearance: (bySearchAppearance.rows || []).map(r => mapRow(r, ['searchAppearance'])),
  };
```

durch:

```js
    search_appearance: (bySearchAppearance.rows || []).map(r => mapRow(r, ['searchAppearance'])),
    query_weekly_series: buildWeeklySeries(byDateQuery.rows),
  };
```

- [ ] **Step 4: Config-Beispiel um weekly_series_days ergänzen**

Run zum Prüfen der aktuellen Struktur:
```bash
cd ~/Projekte/seo-survival-kit && cat plugins/seo-rescue/skills/gsc-deep-dive/gsc-config.example.json
```
Füge den Key `"weekly_series_days": 480` als zusätzliches Feld ein (chirurgisch per Edit, Komma-Syntax beachten). JSON-Parse-Check danach:
```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/seo-rescue/skills/gsc-deep-dive/gsc-config.example.json','utf8')); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 5: Syntax-Check des Fetch-Skripts**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node --check plugins/seo-rescue/skills/gsc-deep-dive/gsc-fetch.example.js && echo "OK: syntax valid"
```
Expected: `OK: syntax valid`

- [ ] **Step 6: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/skills/gsc-deep-dive/gsc-fetch.example.js plugins/seo-rescue/skills/gsc-deep-dive/gsc-config.example.json
git commit -m "feat(gsc-deep-dive): pull per-query weekly series for quiet-death (L2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: SKILL.md — Doku + Version-Bump

**Files:**
- Modify: `plugins/seo-rescue/skills/gsc-deep-dive/SKILL.md` (What-gets-pulled-Tabelle Z.43–51; neue Sektion; Frontmatter-Version Z.10)

- [ ] **Step 1: Tabellen-Zeile ergänzen**

Ersetze exakt:

```
| `search_appearance` | searchanalytics with searchAppearance dimension | SERP feature breakdown (AMP, video, FAQ, How-to, Sitelinks, AI Overview where exposed) |
```

durch:

```
| `search_appearance` | searchanalytics with searchAppearance dimension | SERP feature breakdown (AMP, video, FAQ, How-to, Sitelinks, AI Overview where exposed) |
| `query_weekly_series` | searchanalytics date+query, ISO-week-bucketed, top 200 by clicks | Per-query weekly click series over `weekly_series_days` (default 480) — input for quiet-death detection |
```

- [ ] **Step 2: Neue Sektion vor „## Security model" einfügen**

Ersetze exakt:

```
## Security model
```

durch:

````
## Quiet-Death Detection (experimental, N=1)

> **Maturity:** `experimental_n1` — abgeleitet aus einem einzigen Fall (case-001, Lesson 2). KEINE validierte Metrik. Promotion erst nach N=2.

Manche Queries sterben **langsam** — 50–86 % Klick-Verlust über Wochen, ohne Korrelation zu einem Core Update (oft SERP-Feature-Absorption durch AI Overviews oder Brand-Erosion). Diese „stillen Tode" brauchen andere Gegenmaßnahmen als Update-Recovery und gehen in der Snapshot-Aggregation unter. Der Detector arbeitet auf der `query_weekly_series` und ist netzfrei.

```bash
node quiet-death-detect.example.js gsc-history/example-com-2026-06-13.json --brand meinemarke,zweitmarke
```

Kriterien (alle müssen erfüllt sein), pro Query-Reihe:

| Kriterium | Schwelle |
|-----------|----------|
| Start-Klicks (erstes 4-Wochen-Mittel) | ≥ 5 |
| Verlust (letztes vs. erstes 4-Wochen-Mittel) | ≥ 50 % |
| Monotoner Decline (längste nicht-steigende Spanne des rollierenden 4-Wochen-Mittels) | ≥ 6 Wochen |

**Update-Korrelation:** Der größte Einzel-Wochen-Drop wird gegen `references/CORE_UPDATES.md` geprüft. Liegt er ±1 Woche in einem Update-Fenster → `update_correlation: "partial"` (gehört eher zur Update-Schadens-Analyse), sonst `"none"` (echtes Quiet-Death). Beide bleiben in der Liste — keine harte Filterung.

**Pattern-Hinweis:** `brand_erosion` (Query enthält ein `--brand`-Token), `serp_feature_absorption` (AI-Overview-Signal im `search_appearance`), sonst `generic_erosion`.

Output: `gsc-history/<site>-quiet-death-<date>.json` mit `quiet_death_queries[]` und `maturity: "experimental_n1"`.

## Security model
````

- [ ] **Step 3: Version-Bump in der Frontmatter**

Ersetze exakt:

```
  version: '0.5.2'
```

durch:

```
  version: '0.5.3'
```

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add plugins/seo-rescue/skills/gsc-deep-dive/SKILL.md
git commit -m "docs(gsc-deep-dive): document quiet-death detection + weekly series (L2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: CHANGELOG + Validierungs-Gate

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Added`)

- [ ] **Step 1: CHANGELOG-Eintrag**

Ersetze exakt:

```
### Added

- **L1 Pre-Hit-Baseline-Selektion**
```

durch:

```
### Added

- **L2 Quiet-Death-Detection** (Phase 2, experimental N=1) — `gsc-deep-dive` now pulls a per-query weekly click series (`query_weekly_series`, top 200, up to `weekly_series_days` days) and ships a zero-dep detector (`quiet-death-detect.example.js`) that flags slow non-update-driven declines (≥50 % loss over ≥6 monotonic weeks, ≥5 start clicks), annotated with `update_correlation` (none/partial vs `CORE_UPDATES.md`) and a `pattern_hint`. Marked `maturity: experimental_n1`.
- **L1 Pre-Hit-Baseline-Selektion**
```

- [ ] **Step 2: Detector-Test + Regressions-Suite**

Run:
```bash
cd ~/Projekte/seo-survival-kit && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/quiet-death-detect.test.js && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/pre-hit-baseline.test.js | tail -1 && node plugins/seo-rescue/test-fixtures/ecommerce-recovery/lib-safe-primitives.test.js | tail -3
```
Expected: `PASS: quiet-death detector behaves`, `PASS: pre_hit_baseline fixture conforms`, `Passed: 55  Failed: 0  Total: 55`

- [ ] **Step 3: Plugin + Marketplace validieren**

Run:
```bash
cd ~/Projekte/seo-survival-kit && claude plugin validate plugins/seo-rescue && claude plugin validate .
```
Expected: zweimal `✔ Validation passed`

- [ ] **Step 4: Commit**

```bash
cd ~/Projekte/seo-survival-kit
git add CHANGELOG.md
git commit -m "docs(changelog): note L2 quiet-death detection [Unreleased]

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (vom Plan-Autor)

**Spec-Coverage:**
- Spec „Komponente 1 — Fetch" (query_weekly_series, 480d, top-200-cap + log, ISO-Wochen) → Task 4 ✓
- Spec „Komponente 2 — Detector" (Kriterien, update_correlation none/partial, pattern_hint, Output, reine Funktionen + CLI) → Task 3 ✓
- Spec „Komponente 3 — SKILL.md" (Tabellenzeile, Sektion, Version-Bump) → Task 5 ✓
- Spec „Testing" (Fixtures, parseUpdateWindows-Test, detector-Verhalten, 55er-Suite) → Task 1 + 2 + 6 ✓
- Spec „Bewusst ausgeklammert" (Befund-Integration, Fetch-untested, L3/4/5) → keine Tasks, korrekt.

**Platzhalter-Scan:** keine TBD/TODO; vollständiger Modul-Code + Test-Code + Fetch-Edits ausgeschrieben. Einziger gelesener-statt-fester Wert: aktuelle `gsc-config.example.json`-Struktur (Task 4 Step 4) — bewusst, plus Parse-Check.

**Typ-/Namens-Konsistenz:** Modul-Exports (`detectQuietDeath`, `parseUpdateWindows`, `classifyPattern`, `isoWeekToMonday`, `rollingMean`, `longestNonIncreasingRun`) stimmen mit den `require()`-Aufrufen im Test (Task 2) überein. Output-Feldnamen (`maturity`, `criteria`, `queries_analyzed`, `flagged_count`, `quiet_death_queries[]` mit `query/start_clicks/end_clicks/loss_pct/decline_weeks/update_correlation/pattern_hint`) konsistent zwischen Spec, Modul (Task 3) und Test-Assertions (Task 2). Fetch-Feld `query_weekly_series` mit `{query, weeks:[{iso_week, clicks}]}` konsistent zwischen Task 4 (Erzeugung) und Task 1/3 (Konsum).
