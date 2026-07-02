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
