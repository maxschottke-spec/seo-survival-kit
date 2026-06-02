'use strict';
// Subscription Monetization Audit — CSV import + KPI computation
//
// Reads a generic subscription-billing CSV export (Stripe, Chargebee, Recurly,
// Shopify Subscriptions, custom dashboards) and writes a JSON summary with
// MRR, ARR, ARPU, churn (30 / 60 / 90 day), cohort retention, plan
// distribution, CLV, pending cancellations, and win-back-pool size.
//
// Minimum CSV columns (case-insensitive header match):
//   subscription_id, customer_id, plan_name, billing_period, amount_eur,
//   currency, start_date, end_date, status, churn_date
//
// Optional columns used if present:
//   last_login_date, trial_end_date, payment_provider, country, coupon_code,
//   cancellation_reason
//
// Run: node csv-import.example.js <path-to-export.csv>
//
// Output: ~/.cache/seo-rescue/subscription-summary-<YYYY-MM-DD>.json

const fs = require('node:fs');
const path = require('node:path');
const { safeReadFile, getCacheDir, atomicWriteJSON } = require('../../lib/safe.js');

const REQUIRED = [
  'subscription_id', 'customer_id', 'plan_name', 'billing_period',
  'amount_eur', 'currency', 'start_date', 'end_date', 'status', 'churn_date',
];

function parseCsv(text) {
  // Minimal CSV parser. Handles quoted fields with commas and escaped quotes.
  // Does NOT handle multiline-quoted fields (rare in subscription exports).
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length < 2) throw new Error('CSV has fewer than 2 lines (header + 1 row minimum)');
  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { cur += c; }
      } else {
        if (c === ',') { out.push(cur); cur = ''; }
        else if (c === '"') { inQ = true; }
        else { cur += c; }
      }
    }
    out.push(cur);
    return out.map(v => v.trim());
  };
  const header = splitLine(lines[0]).map(h => h.toLowerCase());
  const missing = REQUIRED.filter(r => !header.includes(r));
  if (missing.length) {
    throw new Error(`CSV missing required columns: ${missing.join(', ')}\nFound: ${header.join(', ')}`);
  }
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = splitLine(lines[li]);
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = cols[i] || '';
    rows.push(obj);
  }
  return rows;
}

function toMonthlyAmount(amount, period) {
  // Normalize amount to monthly-equivalent for MRR computation.
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) return 0;
  const p = String(period || '').toLowerCase();
  if (p === 'monthly' || p === 'month') return a;
  if (p === 'yearly' || p === 'year' || p === 'annual') return a / 12;
  if (p === 'weekly' || p === 'week') return a * 4.345;
  if (p === 'quarterly' || p === 'quarter') return a / 3;
  if (p === 'semiannual' || p === 'half-yearly') return a / 6;
  // Unknown period — fall back to assuming monthly
  return a;
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function summarize(rows) {
  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 86400000);
  const cutoff60 = new Date(now.getTime() - 60 * 86400000);
  const cutoff90 = new Date(now.getTime() - 90 * 86400000);

  let activeSubs = 0;
  let totalMrr = 0;
  const planAgg = new Map(); // plan_name -> { count, mrr, ltvSum, ltvN }
  const billingAgg = { yearly: 0, monthly: 0, weekly: 0, quarterly: 0, other: 0 };
  const cohorts = new Map(); // YYYY-MM -> count
  let churned30 = 0, churned60 = 0, churned90 = 0;
  let mrrChurned30 = 0;
  let pendingCancels = 0;
  let mrrAtRisk = 0;
  let totalCustomers = new Set();
  let winBackPool = new Set();
  const providerAgg = new Map();
  const countryAgg = new Map();

  for (const r of rows) {
    const status = (r.status || '').toLowerCase();
    const monthly = toMonthlyAmount(r.amount_eur, r.billing_period);
    const start = parseDate(r.start_date);
    const churnDate = parseDate(r.churn_date) || parseDate(r.end_date);
    const period = (r.billing_period || '').toLowerCase();

    totalCustomers.add(r.customer_id);

    // Plan aggregation
    if (!planAgg.has(r.plan_name)) planAgg.set(r.plan_name, { count: 0, mrr: 0, ltvSum: 0, ltvN: 0 });
    const pa = planAgg.get(r.plan_name);

    // Billing period
    if (billingAgg[period] !== undefined) billingAgg[period]++;
    else billingAgg.other++;

    // Provider / country aggregation (if present)
    if (r.payment_provider) providerAgg.set(r.payment_provider, (providerAgg.get(r.payment_provider) || 0) + 1);
    if (r.country) countryAgg.set(r.country, (countryAgg.get(r.country) || 0) + 1);

    // Cohort
    if (start) {
      const cohortKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      cohorts.set(cohortKey, (cohorts.get(cohortKey) || 0) + 1);
    }

    if (status === 'active' || status === 'trialing') {
      activeSubs++;
      totalMrr += monthly;
      pa.count++;
      pa.mrr += monthly;
    } else if (status === 'pending_cancellation' || status === 'pending_cancel' || status === 'pending') {
      pendingCancels++;
      mrrAtRisk += monthly;
      activeSubs++; // still active until end_date
      totalMrr += monthly;
      pa.count++;
      pa.mrr += monthly;
    } else if (status === 'canceled' || status === 'cancelled' || status === 'churned') {
      if (churnDate) {
        if (churnDate >= cutoff30) { churned30++; mrrChurned30 += monthly; }
        if (churnDate >= cutoff60) churned60++;
        if (churnDate >= cutoff90) churned90++;
      }
      // CLV computation: full subscription length × monthly
      if (start && churnDate) {
        const tenureMonths = Math.max(1, Math.floor(daysBetween(start, churnDate) / 30));
        pa.ltvSum += tenureMonths * monthly;
        pa.ltvN++;
      }
      // Win-Back-Pool: cancelled but had last_login_date in last 30d
      if (r.last_login_date) {
        const ll = parseDate(r.last_login_date);
        if (ll && ll >= cutoff30) winBackPool.add(r.customer_id);
      }
    }
  }

  const arpu = activeSubs > 0 ? totalMrr / activeSubs : 0;
  const churnRate30 = activeSubs > 0 ? (churned30 / (activeSubs + churned30)) * 100 : 0;

  // Plan distribution as array, sorted by sub count desc
  const planDist = [...planAgg.entries()]
    .map(([name, v]) => ({
      plan: name,
      active_subs: v.count,
      mrr_eur: Math.round(v.mrr * 100) / 100,
      arpu_eur: v.count > 0 ? Math.round((v.mrr / v.count) * 100) / 100 : 0,
      avg_clv_eur: v.ltvN > 0 ? Math.round((v.ltvSum / v.ltvN) * 100) / 100 : null,
    }))
    .sort((a, b) => b.active_subs - a.active_subs);

  // Cohort retention (just count per signup month; full retention requires per-customer status which needs more state)
  const cohortList = [...cohorts.entries()]
    .map(([month, count]) => ({ cohort_month: month, signups: count }))
    .sort((a, b) => a.cohort_month.localeCompare(b.cohort_month));

  return {
    snapshot_date: now.toISOString().slice(0, 10),
    rows_processed: rows.length,
    totals: {
      active_subscriptions: activeSubs,
      total_customers: totalCustomers.size,
      mrr_eur: Math.round(totalMrr * 100) / 100,
      arr_eur: Math.round(totalMrr * 12 * 100) / 100,
      arpu_eur: Math.round(arpu * 100) / 100,
    },
    churn: {
      churned_last_30d: churned30,
      churned_last_60d: churned60,
      churned_last_90d: churned90,
      mrr_churned_30d_eur: Math.round(mrrChurned30 * 100) / 100,
      churn_rate_30d_pct: Math.round(churnRate30 * 100) / 100,
    },
    pending_cancellations: {
      count: pendingCancels,
      mrr_at_risk_eur: Math.round(mrrAtRisk * 100) / 100,
    },
    win_back_pool: {
      churned_but_active_last_30d: winBackPool.size,
    },
    billing_distribution: billingAgg,
    plan_distribution: planDist,
    cohorts: cohortList,
    payment_providers: [...providerAgg.entries()].map(([k, v]) => ({ provider: k, count: v })),
    countries: [...countryAgg.entries()].map(([k, v]) => ({ country: k, count: v })),
  };
}

function premiumTierGoalCheck(summary, goalSubs, premiumArpuEur, premiumShare) {
  // Compute whether a stated subscriber-goal hits a target ARR with current vs blended ARPU.
  // Caller passes goalSubs, the premium-tier price they want to test, and the premium share assumption.
  const baseArpu = summary.totals.arpu_eur;
  const blendedArpu = (1 - premiumShare) * baseArpu + premiumShare * premiumArpuEur;
  return {
    goal_subs: goalSubs,
    current_arpu_eur: baseArpu,
    premium_arpu_eur: premiumArpuEur,
    premium_share: premiumShare,
    blended_arpu_eur: Math.round(blendedArpu * 100) / 100,
    goal_arr_at_current_arpu_eur: Math.round(goalSubs * baseArpu * 12),
    goal_arr_at_blended_arpu_eur: Math.round(goalSubs * blendedArpu * 12),
  };
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node csv-import.example.js <path-to-export.csv>');
  console.error('');
  console.error('Required CSV columns: ' + REQUIRED.join(', '));
  process.exit(1);
}
if (!fs.existsSync(csvPath)) {
  console.error('CSV not found: ' + csvPath);
  process.exit(1);
}

const csv = safeReadFile(csvPath, 50 * 1024 * 1024); // 50 MB cap
const rows = parseCsv(csv);
console.error(`[csv-import] parsed ${rows.length} rows`);

const summary = summarize(rows);

// Add Premium-Tier-Goal scenarios if user has passed env vars
if (process.env.GOAL_SUBS && process.env.PREMIUM_ARPU_EUR && process.env.PREMIUM_SHARE) {
  summary.goal_scenarios = premiumTierGoalCheck(
    summary,
    Number(process.env.GOAL_SUBS),
    Number(process.env.PREMIUM_ARPU_EUR),
    Number(process.env.PREMIUM_SHARE),
  );
}

const out = path.join(getCacheDir(), `subscription-summary-${summary.snapshot_date}.json`);
// Atomic, symlink-checked, idempotent overwrite (no unlink-then-recreate TOCTOU).
atomicWriteJSON(out, summary);

console.error('');
console.error('=== KPI SNAPSHOT ===');
console.error(`Active subscriptions:      ${summary.totals.active_subscriptions}`);
console.error(`MRR:                       ${summary.totals.mrr_eur.toFixed(2)} EUR`);
console.error(`ARR:                       ${summary.totals.arr_eur.toFixed(2)} EUR`);
console.error(`ARPU:                      ${summary.totals.arpu_eur.toFixed(2)} EUR`);
console.error(`Churn 30d:                 ${summary.churn.churn_rate_30d_pct.toFixed(2)} % (${summary.churn.churned_last_30d} subs)`);
console.error(`Pending cancellations:     ${summary.pending_cancellations.count} (MRR at risk: ${summary.pending_cancellations.mrr_at_risk_eur.toFixed(2)} EUR)`);
console.error(`Win-Back-Pool (active 30d): ${summary.win_back_pool.churned_but_active_last_30d}`);
console.error('');
console.error('Top 5 plans by sub count:');
summary.plan_distribution.slice(0, 5).forEach(p => {
  console.error(`  ${p.plan.padEnd(40)} ${String(p.active_subs).padStart(6)} subs · ${p.arpu_eur.toFixed(2)} EUR ARPU · ${p.mrr_eur.toFixed(2)} EUR MRR`);
});
console.error('');
console.error(`Written: ${out}`);
