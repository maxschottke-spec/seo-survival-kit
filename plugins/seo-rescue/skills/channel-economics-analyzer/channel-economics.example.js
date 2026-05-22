'use strict';
// Channel Economics Analyzer — generic starter script.
// Reads ./channels.json + ./data/<name>-period.csv, prints per-channel P&L.

const fs = require('node:fs');
const path = require('node:path');
const { safeSlug, safeReadFile } = require('../../lib/safe.js');

const CFG = JSON.parse(safeReadFile('./channels.json'));
const DAYS = CFG.period_days || 90;

// Validate channel names at config-load. A hostile channels.json with
// name="../../etc/passwd" would otherwise read out-of-CWD via the
// `./data/${ch.name}-period.csv` interpolation below. safeSlug enforces
// the same alnum/dash/underscore charset as audit-config target slugs.
if (!Array.isArray(CFG.channels)) { console.error('channels.json must have channels:[]'); process.exit(1); }
for (const ch of CFG.channels) {
  if (!ch || typeof ch !== 'object') { console.error('channels[*] must be an object'); process.exit(1); }
  safeSlug(ch.name);
}

function loadCsv(filepath) {
  const lines = fs.readFileSync(filepath, 'utf8').trim().split('\n');
  const header = lines.shift().split(',').map(s => s.trim());
  return lines.map(line => {
    const cols = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, isNaN(+cols[i]) ? cols[i] : +cols[i]]));
  });
}

function sum(rows, key) { return rows.reduce((acc, r) => acc + (r[key] || 0), 0); }

function analyzeChannel(ch) {
  const file = `./data/${ch.name}-period.csv`;
  if (!fs.existsSync(file)) { console.error(`Skip ${ch.name}: ${file} missing`); return null; }
  const rows = loadCsv(file);

  const grossRev = sum(rows, 'gross_revenue');
  const refunds = sum(rows, 'refunds');
  const netRev = grossRev - refunds;
  const cogs = sum(rows, 'cogs');
  const shipping = sum(rows, 'shipping');
  const adSpend = sum(rows, 'ad_spend');
  const returnsHandling = sum(rows, 'returns_cost');
  const marketplaceFee = netRev * (ch.fee_rate || 0);
  const grossProfit = netRev - cogs - marketplaceFee - shipping;
  const operatingProfit = grossProfit - adSpend - returnsHandling;
  const orders = rows.length;
  const contributionPerOrder = orders ? (netRev - cogs - marketplaceFee - shipping) / orders : 0;
  const breakEvenOrders = contributionPerOrder > 0 ? adSpend / contributionPerOrder : Infinity;
  const margin = netRev ? operatingProfit / netRev * 100 : 0;
  const monthlyOrders = orders / (DAYS / 30);

  let status;
  if (margin >= 15) status = '✅ HEALTHY';
  else if (margin >= 5) status = '⚠️  RISKY';
  else if (margin >= 0) status = '⛔ LOSS-MAKING';
  else status = '🔥 NEGATIVE';

  return { ch, grossRev, refunds, netRev, cogs, marketplaceFee, shipping, grossProfit, adSpend, returnsHandling, operatingProfit, orders, monthlyOrders, contributionPerOrder, breakEvenOrders, margin, status };
}

function fmtEur(n) { return '€' + new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n); }
function fmtPct(n) { return n.toFixed(1) + ' %'; }

function printChannel(r) {
  const { ch } = r;
  console.log('═'.repeat(60));
  console.log(`${ch.label || ch.name.toUpperCase()} (last ${DAYS} days)`);
  console.log('═'.repeat(60));
  console.log(`  Gross Revenue:        ${fmtEur(r.grossRev)}`);
  console.log(`  Refunds:              ${fmtEur(r.refunds)} (${fmtPct(r.refunds / Math.max(1, r.grossRev) * 100)})`);
  console.log(`  Net Revenue:          ${fmtEur(r.netRev)}`);
  console.log(`  COGS:                 ${fmtEur(r.cogs)} (${fmtPct(r.cogs / Math.max(1, r.netRev) * 100)})`);
  console.log(`  Marketplace Fee:      ${fmtEur(r.marketplaceFee)} (${fmtPct((ch.fee_rate||0)*100)} ${ch.fee_label || ''})`);
  console.log(`  Shipping:             ${fmtEur(r.shipping)}`);
  console.log(`  Gross Profit:         ${fmtEur(r.grossProfit)} (${fmtPct(r.grossProfit / Math.max(1, r.netRev) * 100)} margin)`);
  console.log(`  Ad Spend:             ${fmtEur(r.adSpend)}`);
  console.log(`  Returns Handling:     ${fmtEur(r.returnsHandling)}`);
  console.log(`  Operating Profit:     ${fmtEur(r.operatingProfit)} (${fmtPct(r.margin)} margin) ${r.status}`);
  console.log('');
  console.log(`  Orders:               ${r.orders} (${r.monthlyOrders.toFixed(1)}/mo)`);
  console.log(`  Contribution/Order:   ${fmtEur(r.contributionPerOrder)}`);
  if (isFinite(r.breakEvenOrders)) {
    console.log(`  Break-Even Orders:    ${r.breakEvenOrders.toFixed(1)} total (${(r.breakEvenOrders / (DAYS/30)).toFixed(1)}/mo)`);
    if (r.monthlyOrders < r.breakEvenOrders / (DAYS / 30)) {
      console.log(`  ⚠️  CURRENT BELOW BREAK-EVEN — burning ad spend`);
    }
  } else {
    console.log(`  Break-Even Orders:    n/a (negative contribution per order)`);
  }
  console.log('');
}

const results = (CFG.channels || []).map(analyzeChannel).filter(Boolean);
results.forEach(printChannel);

// Portfolio summary
const totalOp = results.reduce((s, r) => s + r.operatingProfit, 0);
const totalRev = results.reduce((s, r) => s + r.netRev, 0);
console.log('═'.repeat(60));
console.log(`PORTFOLIO TOTAL`);
console.log('═'.repeat(60));
console.log(`  Net Revenue:    ${fmtEur(totalRev)}`);
console.log(`  Operating:      ${fmtEur(totalOp)} (${fmtPct(totalOp / Math.max(1, totalRev) * 100)} margin)`);
console.log('');
console.log('Channel ranking by margin:');
results.sort((a, b) => b.margin - a.margin).forEach((r, i) => {
  console.log(`  ${i+1}. ${r.ch.name.padEnd(20)} ${fmtPct(r.margin).padStart(8)} ${r.status}`);
});
