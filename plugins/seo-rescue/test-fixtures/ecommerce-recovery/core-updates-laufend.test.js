'use strict';
// Zero-dependency checks for the "rollout still running" case (Rollout-Ende = laufend)
// and for the table contract of references/CORE_UPDATES.md (v0.5.6).
//
//   node plugins/seo-rescue/test-fixtures/ecommerce-recovery/core-updates-laufend.test.js
//
// What this can and cannot test: the correlation and the stage state machine are
// prose rules in commands/recovery-diagnose.md that Claude executes — there is no
// script to call. So this file checks (1) that the shipped table and the fixture
// table parse and obey the contract the rules rely on, (2) that a befund fixture
// for a running rollout satisfies the invariants the rules state, and (3) that the
// command still states the rules for `laufend`, `Last verified`, type and Verified.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name); failed++; }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => ISO.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const day = (s) => Date.parse(s + 'T00:00:00Z') / 86400000;

function parse(md) {
  const lv = md.match(/^Last verified:\s*(\S+)\s*$/m);
  const rows = [];
  for (const line of md.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 7 || cells[1] === 'Update' || /^-+$/.test(cells[1])) continue;
    rows.push({ name: cells[1], type: cells[2], start: cells[3], end: cells[4], verified: cells[5] });
  }
  return { lastVerified: lv ? lv[1] : null, rows };
}

function checkTable(label, md) {
  const { lastVerified, rows } = parse(md);
  console.log('\n' + label);
  check('has a "Last verified: YYYY-MM-DD" line', !!lastVerified && isDate(lastVerified));
  check('table has rows', rows.length > 0);
  check('every Type is core, spam or discover', rows.every((r) => ['core', 'spam', 'discover'].includes(r.type)));
  check('every Rollout-Start is a date', rows.every((r) => isDate(r.start)));
  check('every Rollout-Ende is a date or "laufend"', rows.every((r) => r.end === 'laufend' || isDate(r.end)));
  check('Rollout-Ende is never before Rollout-Start', rows.every((r) => r.end === 'laufend' || day(r.end) >= day(r.start)));
  check('every Verified starts with yes or no', rows.every((r) => /^(yes|no)\b/.test(r.verified)));
  check('rows are sorted newest first', rows.every((r, i) => i === 0 || day(rows[i - 1].start) >= day(r.start)));
  const open = rows.filter((r) => r.end === 'laufend');
  check('at most one rollout per type is open', ['core', 'spam', 'discover'].every((t) => open.filter((r) => r.type === t).length <= 1));
  check('an open rollout is the newest entry of its type', open.every((o) => rows.find((r) => r.type === o.type) === o));
  const verifiedDates = rows.map((r) => (r.verified.match(/\d{4}-\d{2}-\d{2}/) || [])[0]).filter(Boolean);
  check('Last verified is not older than any per-row verification date', !!lastVerified && verifiedDates.every((d) => day(d) <= day(lastVerified)));
  check('an open rollout started on or before Last verified', !!lastVerified && open.every((o) => day(o.start) <= day(lastVerified)));
  return { lastVerified, rows };
}

checkTable('references/CORE_UPDATES.md (shipped table)', read('references', 'CORE_UPDATES.md'));
const fx = checkTable('core-updates-laufend-fixture.md', read('test-fixtures', 'ecommerce-recovery', 'core-updates-laufend-fixture.md'));

console.log('\nbefund-with-active-update.json (running rollout)');
const schema = JSON.parse(read('schemas', 'befund.schema.json'));
const befund = JSON.parse(read('test-fixtures', 'ecommerce-recovery', 'befund-with-active-update.json'));
const def = schema.properties.stage_status;
const st = befund.stage_status;
const today = befund.timestamp.slice(0, 10);
const active = fx.rows.find((r) => r.name === st.active_update);

check('fixture table contains an open rollout', fx.rows.some((r) => r.end === 'laufend'));
check('stage_status has all required keys', def.required.every((k) => Object.prototype.hasOwnProperty.call(st, k)));
check('stage / frozen_reason in schema enum', def.properties.stage.enum.includes(st.stage) && def.properties.frozen_reason.enum.includes(st.frozen_reason));
check('active_update names a row of the fixture table', !!active);
check('that row is open (laufend) and started on or before the befund date', !!active && active.end === 'laufend' && day(active.start) <= day(today));
check('rule 2: open rollout => frozen_reason active_update_window', st.frozen_reason === 'active_update_window');
check('rule 2: open rollout => progression not allowed', st.progression_allowed === false);
check('rule 2: open rollout => days_since_rollout_end is null (never a number)', st.days_since_rollout_end === null);
check('rule 4: open rollout + vi_trend_4w_pct < -10 => re_entry_detected, stage R1', !(befund.vi_trend_4w_pct < -10) || (st.re_entry_detected === true && st.stage === 'R1'));
check('rule 4: re_entry_from equals recovery_stage_estimate', !st.re_entry_detected || st.re_entry_from === befund.recovery_stage_estimate);
check('rule 5: raw_stage equals recovery_stage_estimate', st.raw_stage === befund.recovery_stage_estimate);
check('core_update_name is a core entry, never spam/discover', !befund.core_update_name || (fx.rows.find((r) => r.name === befund.core_update_name) || {}).type === 'core');
const named = fx.rows.find((r) => r.name === befund.core_update_name);
check('"high" only against a Verified: yes entry', befund.core_update_correlation !== 'high' || (!!named && /^yes\b/.test(named.verified)));
check('"high" only within 4 weeks after rollout start', befund.core_update_correlation !== 'high' || (!!named && day(today) - day(named.start) <= 28 && day(today) >= day(named.start)));
check('Last verified is within 90 days of the befund date', day(today) - day(fx.lastVerified) <= 90);

console.log('\ncommands/recovery-diagnose.md states the rules');
const cmd = read('commands', 'recovery-diagnose.md');
const step8 = cmd.slice(cmd.indexOf('### Schritt 8'), cmd.indexOf('### Schritt 9'));
const machine = cmd.slice(cmd.indexOf('**Stage-State-Machine'), cmd.indexOf('**Deutschsprachige Zusammenfassung'));
check('step 8 uses the "Last verified" line, not the file date', /Last verified/.test(step8) && /NICHT das Aenderungsdatum/.test(step8));
check('step 8 correlates only against Type core', /nur gegen Eintraege mit Type `core`/.test(step8));
check('step 8 caps spam/discover windows at low', /`spam` oder `discover`/.test(step8) && /hoechstens `"low"`/.test(step8));
check('step 8 has the Verified cap', /Verified-Deckel/.test(step8) && /`Verified: no`/.test(step8));
check('rule 2 names days_since_rollout_end: null for laufend', /2\. \*\*active_update_window:\*\*[^\n]*`laufend`[^\n]*`days_since_rollout_end: null`/.test(machine));
check('rule 4 defines Re-Entry for laufend', /4\. \*\*Re-Entry:\*\*[^\n]*`laufend`/.test(machine));

console.log('\n' + (failed === 0 ? 'PASS: laufend fixture, CORE_UPDATES.md table and command rules conform' : 'FAIL: ' + failed + ' check(s) failed'));
process.exit(failed === 0 ? 0 : 1);
