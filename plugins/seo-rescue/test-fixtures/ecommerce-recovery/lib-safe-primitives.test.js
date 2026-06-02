#!/usr/bin/env node
'use strict';

// Smoke tests for SEO Change Governor primitives in lib/safe.js v1.1.0.
//
// Run:
//   node plugins/seo-rescue/test-fixtures/ecommerce-recovery/lib-safe-primitives.test.js
//
// Exit codes:
//   0 = all tests passed
//   1 = at least one test failed
//
// No external dependencies. No live writes (uses ephemeral tmp dirs).

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const safe = require('../../lib/safe.js');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message}`);
    failures.push({ name, error: err.message });
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// validateApproval
// ---------------------------------------------------------------------------
section('validateApproval — Hard Stop triggers');

test('rejects "ALLESS" as invalid', () => {
  const r = safe.validateApproval('ALLESS');
  assert.strictEqual(r.is_valid, false);
  assert.match(r.reason, /broad batch/i);
});

test('rejects "alles" as invalid', () => {
  const r = safe.validateApproval('alles');
  assert.strictEqual(r.is_valid, false);
});

test('rejects "mach" as invalid', () => {
  assert.strictEqual(safe.validateApproval('mach').is_valid, false);
});

test('rejects single "ok" as invalid', () => {
  assert.strictEqual(safe.validateApproval('ok').is_valid, false);
});

test('rejects "go" as invalid', () => {
  assert.strictEqual(safe.validateApproval('go').is_valid, false);
});

test('rejects "passt" as invalid', () => {
  assert.strictEqual(safe.validateApproval('passt').is_valid, false);
});

test('rejects non-string as invalid', () => {
  const r = safe.validateApproval(123);
  assert.strictEqual(r.is_valid, false);
});

section('validateApproval — Valid informal approvals');

test('accepts "Ja, mach genau die 3 Redirects mit 6 Punkten."', () => {
  const r = safe.validateApproval('Ja, mach genau die 3 Redirects mit 6 Punkten.');
  assert.strictEqual(r.is_valid, true);
  assert.ok(r.matched_elements.length >= 3, `expected >=3 elements, got ${r.matched_elements.length}`);
});

test('accepts "Okay, fuehre diesen Change Plan mit 2 Anchor-Fixes aus."', () => {
  const r = safe.validateApproval('Okay, fuehre diesen Change Plan mit 2 Anchor-Fixes aus.');
  assert.strictEqual(r.is_valid, true);
});

test('accepts "Deaktiviere die 8 leeren Kategorien (0 Produkte)"', () => {
  const r = safe.validateApproval('Deaktiviere die 8 leeren Kategorien (0 Produkte), ich kenne die Folgen.');
  assert.strictEqual(r.is_valid, true);
});

test('accepts "Freigegeben: die 3 DreiscSeo-Ketten deaktivieren"', () => {
  const r = safe.validateApproval('Freigegeben: die 3 DreiscSeo-Ketten deaktivieren');
  assert.strictEqual(r.is_valid, true);
});

test('matched_elements is subset of APPROVAL_ELEMENTS', () => {
  const r = safe.validateApproval('Ja, mach die 3 Redirects mit 6 Punkten.');
  for (const elem of r.matched_elements) {
    assert.ok(safe.APPROVAL_ELEMENTS.includes(elem), `unexpected element: ${elem}`);
  }
});

// ---------------------------------------------------------------------------
// checkSeoUrlCollision
// ---------------------------------------------------------------------------
section('checkSeoUrlCollision');

test('detects collision when 2 non-deleted entries share foreignKey/channel/lang/route', () => {
  const entries = [
    { id: 'a', foreignKey: 'fk1', salesChannelId: 'ch1', languageId: 'l1', routeName: 'r1', isDeleted: false },
    { id: 'b', foreignKey: 'fk1', salesChannelId: 'ch1', languageId: 'l1', routeName: 'r1', isDeleted: false },
  ];
  const r = safe.checkSeoUrlCollision(entries, 'fk1', 'ch1', 'l1', 'r1');
  assert.strictEqual(r.collision_detected, true);
  assert.strictEqual(r.active_non_deleted_entries, 2);
  assert.deepStrictEqual(r.colliding_ids, ['a', 'b']);
});

test('does not flag collision when entries are in different channels', () => {
  const entries = [
    { id: 'a', foreignKey: 'fk1', salesChannelId: 'ch1', languageId: 'l1', routeName: 'r1', isDeleted: false },
    { id: 'b', foreignKey: 'fk1', salesChannelId: 'ch2', languageId: 'l1', routeName: 'r1', isDeleted: false },
  ];
  const r = safe.checkSeoUrlCollision(entries, 'fk1', 'ch1', 'l1', 'r1');
  assert.strictEqual(r.collision_detected, false);
  assert.strictEqual(r.active_non_deleted_entries, 1);
});

test('does not flag deleted entries', () => {
  const entries = [
    { id: 'a', foreignKey: 'fk1', salesChannelId: 'ch1', languageId: 'l1', routeName: 'r1', isDeleted: false },
    { id: 'b', foreignKey: 'fk1', salesChannelId: 'ch1', languageId: 'l1', routeName: 'r1', isDeleted: true },
  ];
  const r = safe.checkSeoUrlCollision(entries, 'fk1', 'ch1', 'l1', 'r1');
  assert.strictEqual(r.collision_detected, false);
  assert.strictEqual(r.active_non_deleted_entries, 1);
});

test('returns 0 entries when nothing matches', () => {
  const entries = [
    { id: 'a', foreignKey: 'fk-other', salesChannelId: 'ch1', languageId: 'l1', routeName: 'r1', isDeleted: false },
  ];
  const r = safe.checkSeoUrlCollision(entries, 'fk-not-present', 'ch1', 'l1', 'r1');
  assert.strictEqual(r.collision_detected, false);
  assert.strictEqual(r.active_non_deleted_entries, 0);
});

test('throws on non-array input', () => {
  assert.throws(() => safe.checkSeoUrlCollision('not-an-array', 'fk', 'ch', 'l', 'r'), /must be an array/);
});

// ---------------------------------------------------------------------------
// checkDreiscSeoPrecheck
// ---------------------------------------------------------------------------
section('checkDreiscSeoPrecheck');

test('flags would_create_301_to_404 when active redirect points to the URL', () => {
  const redirects = [
    { id: 'r1', active: true, sourcePath: '/old/', redirectPath: '/target/' },
    { id: 'r2', active: true, sourcePath: '/other/', redirectPath: '/target/' },
  ];
  const r = safe.checkDreiscSeoPrecheck(redirects, '/target/');
  assert.strictEqual(r.would_create_301_to_404, true);
  assert.deepStrictEqual(r.affected_redirect_ids, ['r1', 'r2']);
});

test('does not flag inactive redirects', () => {
  const redirects = [
    { id: 'r1', active: false, sourcePath: '/old/', redirectPath: '/target/' },
  ];
  const r = safe.checkDreiscSeoPrecheck(redirects, '/target/');
  assert.strictEqual(r.would_create_301_to_404, false);
  assert.strictEqual(r.affected_redirect_ids.length, 0);
});

test('matches case-insensitively (DreiscSeo behavior)', () => {
  const redirects = [
    { id: 'r1', active: true, sourcePath: '/old/', redirectPath: '/Target/' },
  ];
  const r = safe.checkDreiscSeoPrecheck(redirects, '/target/');
  assert.strictEqual(r.would_create_301_to_404, true);
});

test('finds redirects_from_url separately', () => {
  const redirects = [
    { id: 'r1', active: true, sourcePath: '/target/', redirectPath: '/elsewhere/' },
  ];
  const r = safe.checkDreiscSeoPrecheck(redirects, '/target/');
  assert.strictEqual(r.redirects_from_url.length, 1);
  assert.strictEqual(r.would_create_301_to_404, false);
});

test('throws on non-array redirects', () => {
  assert.throws(() => safe.checkDreiscSeoPrecheck('not-array', '/url/'), /must be an array/);
});

test('throws on empty urlSlug', () => {
  assert.throws(() => safe.checkDreiscSeoPrecheck([], ''), /urlSlug required/);
});

// ---------------------------------------------------------------------------
// writeSnapshot + readChangeHistory + appendChangeHistory (filesystem)
// ---------------------------------------------------------------------------
section('writeSnapshot / appendChangeHistory / readChangeHistory');

// Use an isolated test slug — uses real cache dir but a sandboxed slug name
const TEST_SLUG = 'test-fixture-lib-safe-' + process.pid + '-' + Date.now();

function cleanupTestSlug() {
  try {
    const home = os.homedir();
    const dir = path.join(home, '.cache', 'seo-rescue', TEST_SLUG);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch { /* best effort */ }
}

process.on('exit', cleanupTestSlug);

test('writeSnapshot writes before file to correct path', () => {
  const p = safe.writeSnapshot(TEST_SLUG, 'cms-slots', 'slot-abc-123', { content: 'before' }, 'before');
  assert.ok(p.includes('cms-slots'));
  assert.ok(p.endsWith('-before.json'));
  assert.ok(fs.existsSync(p));
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(data.content, 'before');
});

test('writeSnapshot writes after file to correct path', () => {
  const p = safe.writeSnapshot(TEST_SLUG, 'cms-slots', 'slot-abc-456', { content: 'after' }, 'after');
  assert.ok(p.endsWith('-after.json'));
});

test('writeSnapshot rejects invalid "when" value', () => {
  assert.throws(() => safe.writeSnapshot(TEST_SLUG, 'cms-slots', 'id', {}, 'middle'), /must be 'before' or 'after'/);
});

test('writeSnapshot rejects empty entityId', () => {
  assert.throws(() => safe.writeSnapshot(TEST_SLUG, 'cms-slots', '', {}, 'before'), /entityId required/);
});

test('writeSnapshot sanitizes path traversal in kind/entityId', () => {
  // writeSnapshot strips non-alphanumeric chars from kind and entityId.
  // After sanitization "../etc" becomes "etc" which is a safe identifier.
  // Verify the resulting path is contained within the slug directory.
  const p = safe.writeSnapshot(TEST_SLUG, '../etc', 'safe-id', { test: 'sanitization' }, 'before');
  const home = os.homedir();
  const slugDir = path.join(home, '.cache', 'seo-rescue', TEST_SLUG);
  assert.ok(p.startsWith(slugDir), `path escaped slug dir: ${p}`);
  // The "../" portion of kind must be stripped
  assert.ok(!p.includes('..'), `path contains "..": ${p}`);
});

test('appendChangeHistory writes valid entry', () => {
  const ts = safe.appendChangeHistory(TEST_SLUG, {
    run_id: 'test-run-1',
    change_id: 'test-001',
    domain: 'example.test',
    actor: 'script',
    mode: 'micro_fix',
    change_type: 'redirect',
    change_category: 'repair_hygiene',
    entity_system: 'shopware',
    url: '/test-url/',
    risk_points_final: 2,
    confidence: 'high',
    decision: 'keep',
  });
  assert.ok(ts);
  assert.match(ts, /^\d{4}-\d{2}-\d{2}T/);
});

test('appendChangeHistory rejects missing required fields', () => {
  assert.throws(() =>
    safe.appendChangeHistory(TEST_SLUG, { change_id: 'incomplete' }),
    /missing required field/
  );
});

test('readChangeHistory reads appended entries', () => {
  // Append a fresh entry then read all
  safe.appendChangeHistory(TEST_SLUG, {
    run_id: 'test-run-2',
    change_id: 'test-002',
    domain: 'example.test',
    actor: 'script',
    mode: 'audit_only',
    change_type: 'cache',
    change_category: 'repair_hygiene',
    entity_system: 'cms',
    url: '/another/',
    risk_points_final: 0,
    confidence: 'high',
    decision: 'keep',
  });
  const entries = safe.readChangeHistory(TEST_SLUG);
  assert.ok(entries.length >= 2);
  const ids = entries.map(e => e.change_id);
  assert.ok(ids.includes('test-002'));
});

test('readChangeHistory returns empty array for unknown domain', () => {
  const r = safe.readChangeHistory('nonexistent-test-domain-' + Date.now());
  assert.deepStrictEqual(r, []);
});

// ---------------------------------------------------------------------------
// Exports check
// ---------------------------------------------------------------------------
section('Module exports');

test('exports all 6 new Change Governor primitives', () => {
  const required = [
    'appendChangeHistory', 'validateApproval', 'writeSnapshot',
    'checkSeoUrlCollision', 'checkDreiscSeoPrecheck', 'readChangeHistory'
  ];
  for (const name of required) {
    assert.strictEqual(typeof safe[name], 'function', `Missing or non-function export: ${name}`);
  }
});

test('exports schema version constant', () => {
  assert.strictEqual(typeof safe.CHANGE_HISTORY_SCHEMA_VERSION, 'string');
  assert.match(safe.CHANGE_HISTORY_SCHEMA_VERSION, /^\d+\.\d+\.\d+$/);
});

test('exports APPROVAL_ELEMENTS array', () => {
  assert.ok(Array.isArray(safe.APPROVAL_ELEMENTS));
  assert.strictEqual(safe.APPROVAL_ELEMENTS.length, 6);
});

test('exports BROAD_APPROVAL_TRIGGERS array', () => {
  assert.ok(Array.isArray(safe.BROAD_APPROVAL_TRIGGERS));
  assert.ok(safe.BROAD_APPROVAL_TRIGGERS.includes('alless'));
  assert.ok(safe.BROAD_APPROVAL_TRIGGERS.includes('alles'));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);
if (failed > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
}
console.log(`${'='.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
