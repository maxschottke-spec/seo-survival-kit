'use strict';
// Recomputes the countable facts of the synthetic Monday-check example from its
// CSVs and checks that the expected output states them (v0.5.6: the expected
// output said "21 of 25 improved" and "Top-3 from 4 to 5"; the inputs give
// 20 of 25 and 1 to 3).
//
//   node plugins/seo-rescue/test-fixtures/ecommerce-recovery/monday-example.test.js
const fs = require('fs');
const path = require('path');

const skillDir = path.join(__dirname, '..', '..', 'skills', 'sistrix-monday-recovery-check', 'examples');
const repoDir = path.join(__dirname, '..', '..', '..', '..', 'examples', 'synthetic-sistrix-monday-check');
const FILES = ['input-current.example.csv', 'input-previous.example.csv', 'money-keywords.example.csv', 'expected-output.example.md'];

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name); failed++; }
}

function csv(file) {
  const [head, ...lines] = fs.readFileSync(path.join(skillDir, file), 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
}

const cur = new Map(csv(FILES[0]).map((r) => [r.keyword, Number(r.position)]));
const prev = new Map(csv(FILES[1]).map((r) => [r.keyword, Number(r.position)]));
const money = csv(FILES[2]);
const out = fs.readFileSync(path.join(skillDir, FILES[3]), 'utf8');

const both = [...cur.keys()].filter((k) => prev.has(k));
const improved = both.filter((k) => cur.get(k) < prev.get(k)).length;
const declined = both.filter((k) => cur.get(k) > prev.get(k)).length;
const same = both.length - improved - declined;
const lost = [...prev.keys()].filter((k) => !cur.has(k));
const returned = [...cur.keys()].filter((k) => !prev.has(k));
const top = (m, n) => [...m.values()].filter((p) => p <= n).length;

console.log('inputs');
check('current export has 25 keywords, previous 28', cur.size === 25 && prev.size === 28);
check('25 keywords in both, 0 returned, 3 left the export', both.length === 25 && returned.length === 0 && lost.length === 3);
check('20 improved, 4 declined, 1 unchanged', improved === 20 && declined === 4 && same === 1);
check('Top 3: 1 -> 3', top(prev, 3) === 1 && top(cur, 3) === 3);
check('Top 10: 6 -> 9', top(prev, 10) === 6 && top(cur, 10) === 9);
check('Top 20: 18 -> 16, Top 50: 26 -> 24', top(prev, 20) === 18 && top(cur, 20) === 16 && top(prev, 50) === 26 && top(cur, 50) === 24);
check('every money keyword is in both exports', money.every((m) => cur.has(m.keyword) && prev.has(m.keyword)));
const tm = money.filter((m) => m.intent === 'transactional').map((m) => m.keyword);
check('transactional money keywords in Top 10: 0 of 9 -> 6 of 9', tm.length === 9 && tm.filter((k) => prev.get(k) <= 10).length === 0 && tm.filter((k) => cur.get(k) <= 10).length === 6);

console.log('\nexpected output states them');
check(`"${improved} improved, ${declined} declined and ${same} is unchanged"`, out.includes(`${improved} improved, ${declined} declined and ${same} is unchanged`));
check('Top 3 row: "1 → 3 (+2)"', out.includes(`${top(prev, 3)} → ${top(cur, 3)} (+2)`));
check('Top 10 row: "6 → 9 (+3)"', out.includes(`${top(prev, 10)} → ${top(cur, 10)} (+3)`));
check('Top 20 row: "18 → 16 (−2)"', out.includes(`${top(prev, 20)} → ${top(cur, 20)} (−2)`));
check('Top 50 row: "26 → 24 (−2)"', out.includes(`${top(prev, 50)} → ${top(cur, 50)} (−2)`));
check('no "21 of 25" claim outside the correction note', (out.match(/21 of 25/g) || []).length === 1);
check('no "0.5.1-dev" left', !out.includes('0.5.1-dev'));
check('all 17 sections present', Array.from({ length: 17 }, (_, i) => new RegExp(`^## ${i + 1}\\. `, 'm').test(out)).every(Boolean));
for (const k of lost) check(`names the keyword that left the export: ${k}`, out.includes('`' + k + '`'));
for (const m of money) {
  const row = out.split('\n').find((l) => l.startsWith('| `' + m.keyword + '` | ' + cur.get(m.keyword) + ' | ' + prev.get(m.keyword) + ' |'));
  check(`money row matches the CSVs: ${m.keyword}`, !!row);
}

console.log('\ncopies');
if (fs.existsSync(repoDir)) {
  for (const f of FILES) {
    check(`examples/ copy identical to the skill copy: ${f}`, fs.readFileSync(path.join(repoDir, f), 'utf8') === fs.readFileSync(path.join(skillDir, f), 'utf8'));
  }
} else {
  console.log('  - repository examples/ folder not present (installed plugin): copy check skipped');
}

console.log('\n' + (failed === 0 ? 'PASS: Monday example is consistent with its inputs' : 'FAIL: ' + failed + ' check(s) failed'));
process.exit(failed === 0 ? 0 : 1);
