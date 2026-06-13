'use strict';
// Zero-dependency structural check for the L1 pre_hit_baseline befund field.
// Validates the fixture against the schema's pre_hit_baseline contract without ajv.
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'befund.schema.json');
const fixturePath = path.join(__dirname, 'befund-with-baseline.json');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const befund = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const def = schema.properties.pre_hit_baseline;
const obj = befund.pre_hit_baseline;

let failed = 0;
function check(name, cond) {
  if (cond) { console.log('  ✓ ' + name); }
  else { console.log('  ✗ ' + name); failed++; }
}

check('schema defines pre_hit_baseline as object', def && def.type === 'object');
check('pre_hit_baseline NOT in top-level required', !(schema.required || []).includes('pre_hit_baseline'));
check('fixture has pre_hit_baseline', !!obj);

for (const key of def.required) {
  check('required key present: ' + key, obj && Object.prototype.hasOwnProperty.call(obj, key));
}

const enums = { method: def.properties.method.enum, source: def.properties.source.enum, maturity: def.properties.maturity.enum, unit: def.properties.unit.enum };
for (const [key, allowed] of Object.entries(enums)) {
  if (obj && obj[key] !== undefined) {
    check(key + ' in enum', allowed.includes(obj[key]));
  }
}

check('maturity is experimental_n1', obj && obj.maturity === 'experimental_n1');
check('erosion < -15 implies multi_update_erosion_detected', !(obj && obj.erosion_vs_last_plateau_pct < -15) || obj.multi_update_erosion_detected === true);
check('value null implies method unavailable', !(obj && obj.value === null) || obj.method === 'unavailable');

console.log('\n' + (failed === 0 ? 'PASS: pre_hit_baseline fixture conforms' : 'FAIL: ' + failed + ' check(s) failed'));
process.exit(failed === 0 ? 0 : 1);
