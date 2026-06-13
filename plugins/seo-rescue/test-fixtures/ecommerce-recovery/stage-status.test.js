'use strict';
// Zero-dependency structural + invariant check for the L4a stage_status befund field.
const fs = require('fs');
const path = require('path');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'befund.schema.json'), 'utf8'));
const befund = JSON.parse(fs.readFileSync(path.join(__dirname, 'befund-with-stage-status.json'), 'utf8'));

const def = schema.properties.stage_status;
const obj = befund.stage_status;

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name); failed++; }
}

check('schema defines stage_status as object', def && def.type === 'object');
check('stage_status NOT in top-level required', !(schema.required || []).includes('stage_status'));
check('fixture has stage_status', !!obj);

for (const key of def.required) {
  check('required key present: ' + key, obj && Object.prototype.hasOwnProperty.call(obj, key));
}

check('stage in enum', def.properties.stage.enum.includes(obj.stage));
check('frozen_reason in enum', def.properties.frozen_reason.enum.includes(obj.frozen_reason));
check('maturity is experimental_n1', obj.maturity === 'experimental_n1');

// Invariants (the L4a state-machine contract)
check('re_entry_detected => stage R1', !obj.re_entry_detected || obj.stage === 'R1');
check('frozen_reason set => progression not allowed', obj.frozen_reason === null || obj.progression_allowed === false);
check('progression allowed => frozen_reason null', !obj.progression_allowed || obj.frozen_reason === null);

console.log('\n' + (failed === 0 ? 'PASS: stage_status fixture conforms + invariants hold' : 'FAIL: ' + failed + ' check(s) failed'));
process.exit(failed === 0 ? 0 : 1);
