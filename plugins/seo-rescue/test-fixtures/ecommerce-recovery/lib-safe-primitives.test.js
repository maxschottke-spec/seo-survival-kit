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
// checkHypothesisScopeMatch
// ---------------------------------------------------------------------------
section('checkHypothesisScopeMatch — Hypothesis Verification Gate');

const REGISTRY = [
  { hypothesis_id: 'hvg-canonical', hypothesis_status: 'verified', fix_scope: { affected_urls: ['/produkt-1/', '/produkt-2/'] } },
  { hypothesis_id: 'hvg-redirects', hypothesis_status: 'likely', fix_scope: { affected_urls: ['/kategorie-a/'] } },
  { hypothesis_id: 'hvg-noscope', hypothesis_status: 'fixed' },
];

test('no audit output: degrades to prepare_now_execute_later, no hard stop', () => {
  const r = safe.checkHypothesisScopeMatch([{ id: 'act-001', target: '/produkt-1/', hypothesis_id: 'hvg-canonical' }], null);
  assert.strictEqual(r.audit_output_available, false);
  assert.strictEqual(r.hard_stops.length, 0);
  assert.strictEqual(r.per_change[0].disposition, 'prepare_now_execute_later');
  assert.strictEqual(r.per_change[0].stop_reason, 'hypothesis_gate_no_audit_output');
});

test('verified hypothesis + target in scope: allowed_now', () => {
  const r = safe.checkHypothesisScopeMatch([{ id: 'act-001', target: '/produkt-1/', hypothesis_id: 'hvg-canonical' }], REGISTRY);
  assert.strictEqual(r.per_change[0].disposition, 'allowed_now');
  assert.strictEqual(r.all_planned_changes_verified, true);
});

test('verified hypothesis + target outside scope: fix_scope_expansion', () => {
  const r = safe.checkHypothesisScopeMatch([{ id: 'act-002', target: '/produkt-99/', hypothesis_id: 'hvg-canonical' }], REGISTRY);
  assert.strictEqual(r.per_change[0].disposition, 'prepare_now_execute_later');
  assert.strictEqual(r.per_change[0].stop_reason, 'fix_scope_expansion');
  assert.deepStrictEqual(r.scope_expansions_blocked, ['act-002']);
});

test('scope match normalizes scheme and slashes', () => {
  const r = safe.checkHypothesisScopeMatch([{ id: 'act-003', target: 'https://example.test/produkt-2', hypothesis_id: 'hvg-canonical' }], [
    { hypothesis_id: 'hvg-canonical', hypothesis_status: 'verified', fix_scope: { affected_urls: ['example.test/produkt-2/'] } },
  ]);
  assert.strictEqual(r.per_change[0].disposition, 'allowed_now');
});

test('likely hypothesis: prepare_now_execute_later, counted below verified', () => {
  const r = safe.checkHypothesisScopeMatch([{ id: 'act-004', target: '/kategorie-a/', hypothesis_id: 'hvg-redirects' }], REGISTRY);
  assert.strictEqual(r.per_change[0].disposition, 'prepare_now_execute_later');
  assert.strictEqual(r.per_change[0].stop_reason, 'hypothesis_below_verified');
  assert.strictEqual(r.below_verified_count, 1);
});

test('missing hypothesis_id: hard stop', () => {
  const r = safe.checkHypothesisScopeMatch([{ id: 'act-005', target: '/x/' }], REGISTRY);
  assert.strictEqual(r.per_change[0].disposition, 'hard_stop');
  assert.strictEqual(r.per_change[0].stop_reason, 'hypothesis_id_missing');
  assert.deepStrictEqual(r.hard_stops, ['act-005']);
});

test('hypothesis_id not in registry: hard stop', () => {
  const r = safe.checkHypothesisScopeMatch([{ id: 'act-006', target: '/x/', hypothesis_id: 'hvg-ghost' }], REGISTRY);
  assert.strictEqual(r.per_change[0].disposition, 'hard_stop');
  assert.strictEqual(r.per_change[0].stop_reason, 'hypothesis_not_in_registry');
});

test('fixed hypothesis without fix_scope: allowed_now (no scope to violate)', () => {
  const r = safe.checkHypothesisScopeMatch([{ id: 'act-007', target: '/anything/', hypothesis_id: 'hvg-noscope' }], REGISTRY);
  assert.strictEqual(r.per_change[0].disposition, 'allowed_now');
});

test('throws on non-array plannedChanges', () => {
  assert.throws(() => safe.checkHypothesisScopeMatch('nope', REGISTRY));
});

// ---------------------------------------------------------------------------
// validateSettlementOverride
// ---------------------------------------------------------------------------
section('validateSettlementOverride — Settlement Gate section 7');

const VALID_7C_PLAN = {
  settlement_gate_override_requested: true,
  override_type: 'explicit_emergency_approval',
  override_reason: 'Live 404 cluster on money pages discovered during gate',
  total_risk_points: 12,
  post_change_checks: ['live_http_recheck', 'canonical_check'],
  approval_validation: { approval_text: 'Fuehre genau diese 2 Redirect-Fixes auf /produkt-1/ aus, 12 Risikopunkte, Plan act-001', is_valid: true },
  planned_changes: [{
    id: 'act-001',
    risk_points_final: 12,
    data_sources: ['gsc', 'live_http'],
    confidence: 'high',
    rollback_method: 'deactivate redirect via API id',
    pre_change_state_check: { method: 'live_http_and_api' },
  }],
};

test('denies when no override requested', () => {
  const r = safe.validateSettlementOverride({ planned_changes: [] });
  assert.strictEqual(r.override_allowed, false);
  assert.ok(r.missing_requirements.includes('settlement_gate_override_requested'));
});

test('denies unknown override_type', () => {
  const r = safe.validateSettlementOverride({ settlement_gate_override_requested: true, override_type: 'because_i_want_to' });
  assert.strictEqual(r.override_allowed, false);
  assert.ok(r.missing_requirements.includes('override_type'));
});

test('allows complete 7.C plan', () => {
  const r = safe.validateSettlementOverride(VALID_7C_PLAN);
  assert.strictEqual(r.override_allowed, true);
  assert.deepStrictEqual(r.missing_requirements, []);
});

test('7.C denies when rollback_method missing on a change', () => {
  const plan = JSON.parse(JSON.stringify(VALID_7C_PLAN));
  delete plan.planned_changes[0].rollback_method;
  const r = safe.validateSettlementOverride(plan);
  assert.strictEqual(r.override_allowed, false);
  assert.ok(r.missing_requirements.includes('rollback_method:act-001'));
});

test('7.C denies low-confidence data basis', () => {
  const plan = JSON.parse(JSON.stringify(VALID_7C_PLAN));
  plan.planned_changes[0].confidence = 'low';
  const r = safe.validateSettlementOverride(plan);
  assert.strictEqual(r.override_allowed, false);
  assert.ok(r.missing_requirements.includes('confidence_medium_or_higher:act-001'));
});

test('7.C denies missing post_change_checks', () => {
  const plan = JSON.parse(JSON.stringify(VALID_7C_PLAN));
  plan.post_change_checks = [];
  const r = safe.validateSettlementOverride(plan);
  assert.strictEqual(r.override_allowed, false);
  assert.ok(r.missing_requirements.includes('post_change_checks'));
});

test('7.C denies broad-trigger approval text even with is_valid forged true', () => {
  const plan = JSON.parse(JSON.stringify(VALID_7C_PLAN));
  plan.approval_validation = { approval_text: 'alles', is_valid: true };
  const r = safe.validateSettlementOverride(plan);
  assert.strictEqual(r.override_allowed, false);
  assert.ok(r.missing_requirements.includes('approval_text_is_broad_trigger'));
});

test('technical_emergency requires live HTTP verification, api_state alone denied', () => {
  const r = safe.validateSettlementOverride({
    settlement_gate_override_requested: true,
    override_type: 'technical_emergency',
    override_reason: 'noindex on homepage',
    planned_changes: [{ id: 'act-009', pre_change_state_check: { method: 'api_state' } }],
  });
  assert.strictEqual(r.override_allowed, false);
  assert.ok(r.missing_requirements.includes('live_http_verification:act-009'));
});

test('technical_emergency allows live_http verification', () => {
  const r = safe.validateSettlementOverride({
    settlement_gate_override_requested: true,
    override_type: 'technical_emergency',
    override_reason: 'noindex on homepage verified live',
    planned_changes: [{ id: 'act-010', pre_change_state_check: { method: 'live_http' } }],
  });
  assert.strictEqual(r.override_allowed, true);
});

test('never throws on malformed plan', () => {
  const r = safe.validateSettlementOverride(null);
  assert.strictEqual(r.override_allowed, false);
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
