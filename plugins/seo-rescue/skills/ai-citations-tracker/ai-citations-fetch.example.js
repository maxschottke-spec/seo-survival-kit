'use strict';
// AI Citations Tracker — starter script.
// Queries configured AI surfaces (ChatGPT, Perplexity) with brand-mention prompts,
// parses each answer for brand + competitor mentions, appends to NDJSON history.
//
// Run: node ai-citations-fetch.example.js  (or via launchd / cron / GHA — see SKILL.md)

const fs = require('node:fs');
const path = require('node:path');
const { safeReadFile, safeLabel } = require('../../lib/safe.js');

const CFG_PATH = process.env.AI_CITATIONS_CONFIG || './ai-citations-config.json';
if (!fs.existsSync(CFG_PATH)) {
  console.error(`Config not found: ${CFG_PATH}\nCopy ai-citations-config.example.json to ai-citations-config.json and customize.`);
  process.exit(1);
}
const CFG = JSON.parse(safeReadFile(CFG_PATH));

// env-only API keys — same pattern as psi-fetch (closes the v0.3.2 H2 finding for this skill too).
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
if (CFG.openai_api_key || CFG.perplexity_api_key) {
  console.error('Refusing to run: ai-citations-config.json contains an api_key field. API keys must come from env vars only (OPENAI_API_KEY, PERPLEXITY_API_KEY).');
  process.exit(1);
}

// Validate-at-load + trust-at-use.
if (typeof CFG.brand !== 'string' || !CFG.brand) {
  console.error('config.brand must be a non-empty string'); process.exit(1);
}
if (!Array.isArray(CFG.brand_variants) || CFG.brand_variants.length === 0) {
  console.error('config.brand_variants must be a non-empty array'); process.exit(1);
}
for (const v of CFG.brand_variants) {
  if (typeof v !== 'string' || v.length === 0 || v.length > 200) {
    console.error(`config.brand_variants[*]: each must be a non-empty string <=200 chars, got ${JSON.stringify(v)}`); process.exit(1);
  }
}
if (!Array.isArray(CFG.competitors)) { console.error('config.competitors must be an array'); process.exit(1); }
for (const c of CFG.competitors) {
  if (typeof c !== 'string' || c.length === 0 || c.length > 253) {
    console.error(`config.competitors[*]: each must be a non-empty string <=253 chars, got ${JSON.stringify(c)}`); process.exit(1);
  }
}
if (!Array.isArray(CFG.prompts) || CFG.prompts.length === 0 || CFG.prompts.length > 100) {
  console.error('config.prompts must be a 1-100-element array'); process.exit(1);
}
for (const p of CFG.prompts) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 1000) {
    console.error(`config.prompts[*]: each must be a non-empty string <=1000 chars`); process.exit(1);
  }
}
const VALID_SURFACES = ['chatgpt', 'perplexity'];
if (!Array.isArray(CFG.surfaces) || CFG.surfaces.length === 0) {
  console.error('config.surfaces must be a non-empty array'); process.exit(1);
}
for (const s of CFG.surfaces) {
  if (!VALID_SURFACES.includes(s)) {
    console.error(`config.surfaces: unknown value ${JSON.stringify(s)} (allowed: ${VALID_SURFACES.join(', ')})`); process.exit(1);
  }
}
if (CFG.output_dir !== undefined) {
  if (typeof CFG.output_dir !== 'string') { console.error('config.output_dir must be a string'); process.exit(1); }
  if (path.isAbsolute(CFG.output_dir) || CFG.output_dir.includes('..')) {
    console.error(`config.output_dir: must be a relative path inside CWD (no absolute paths, no ..). Got: ${JSON.stringify(CFG.output_dir)}`);
    process.exit(1);
  }
}

if (CFG.surfaces.includes('chatgpt') && !OPENAI_KEY) {
  console.error('config.surfaces includes "chatgpt" but OPENAI_API_KEY env var is not set'); process.exit(1);
}
if (CFG.surfaces.includes('perplexity') && !PERPLEXITY_KEY) {
  console.error('config.surfaces includes "perplexity" but PERPLEXITY_API_KEY env var is not set'); process.exit(1);
}

const OUT_DIR = CFG.output_dir || './ai-citations-history';
fs.mkdirSync(OUT_DIR, { recursive: true });
const NDJSON = path.join(OUT_DIR, 'history.ndjson');

// --- AI surface queries ---

async function queryChatGPT(prompt) {
  // Network destination hardcoded — no SSRF possible from config.
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });
  const j = await r.json().catch(() => ({}));
  return {
    answer: j?.choices?.[0]?.message?.content || '',
    model: j?.model || 'gpt-4o-mini',
    cited_sources: [],
  };
}

async function queryPerplexity(prompt) {
  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PERPLEXITY_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  const j = await r.json().catch(() => ({}));
  // Perplexity returns citations as an array of URLs
  const cited = Array.isArray(j?.citations) ? j.citations : [];
  // Extract hostnames for matching
  const cited_sources = cited.map(u => {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
  }).filter(Boolean);
  return {
    answer: j?.choices?.[0]?.message?.content || '',
    model: j?.model || 'sonar',
    cited_sources,
  };
}

// --- Parsing helpers ---

// Sanitize untrusted AI output before it lands in NDJSON / Claude context.
// Same pattern as sanitize() in seo-onpage.js — length cap + 12 imperative-injection patterns.
const INJECTION_PATTERNS = [
  /ignore (?:previous|prior|above|all)\s+(?:instructions|prompts?|context|rules?)/i,
  /disregard (?:previous|prior|above|all|the)\s+(?:instructions|prompts?|context|rules?)/i,
  /forget (?:everything|all|previous|prior)\s+(?:above|context|instructions)?/i,
  /you are now (?:a|an|the)\s/i,
  /act as (?:a|an|the)\s/i,
  /pretend (?:to be|you are)\s/i,
  /<\/?(?:system|instructions?|prompt)>/i,
  /\[\/?(?:system|instructions?|prompt)\]/i,
  /system prompt(?![a-z])/i,
  /jailbreak/i,
  /print (?:your|the)\s+(?:system|instructions?|prompt)/i,
  /reveal (?:your|the)\s+(?:system|instructions?|prompt)/i,
];
function sanitizeAnswer(s, max = 500) {
  if (typeof s !== 'string') return '';
  const trimmed = s.slice(0, max);
  for (const re of INJECTION_PATTERNS) {
    if (re.test(trimmed)) return '[REDACTED: suspected prompt-injection pattern in AI surface response]';
  }
  return trimmed;
}

function findMentions(answer, needles) {
  // Case-insensitive substring search. Returns the subset of needles that appear in answer.
  const lowerAnswer = String(answer).toLowerCase();
  return needles.filter(n => lowerAnswer.includes(String(n).toLowerCase()));
}

function brandPosition(answer, brandVariants) {
  // If the answer contains a numbered or bulleted list, returns the 1-indexed position
  // of the first line that contains any brand variant. Returns null if no list-like
  // structure is detected or no brand mention found.
  const lines = String(answer).split(/\r?\n/);
  let pos = 0;
  for (const line of lines) {
    if (/^\s*(?:\d+\.|[-*•])/.test(line)) {
      pos++;
      const lower = line.toLowerCase();
      if (brandVariants.some(v => lower.includes(String(v).toLowerCase()))) return pos;
    }
  }
  return null;
}

// --- Main loop ---

(async () => {
  const now = new Date();
  const records = [];

  for (const prompt of CFG.prompts) {
    for (const surface of CFG.surfaces) {
      console.error(`[${surface}] ${prompt.slice(0, 60)}...`);
      let result;
      try {
        if (surface === 'chatgpt') result = await queryChatGPT(prompt);
        else if (surface === 'perplexity') result = await queryPerplexity(prompt);
        else continue;
      } catch (e) {
        console.error(`  ERROR: ${e.message}`);
        continue;
      }

      const answer = result.answer || '';
      const competitors_mentioned = findMentions(answer, CFG.competitors);
      const rec = {
        timestamp: now.getTime(),
        date: now.toISOString().slice(0, 10),
        prompt,
        surface,
        brand_mentioned: findMentions(answer, CFG.brand_variants).length > 0,
        brand_position: brandPosition(answer, CFG.brand_variants),
        competitors_mentioned,
        competitor_count: competitors_mentioned.length,
        cited_sources: result.cited_sources || [],
        answer_excerpt: sanitizeAnswer(answer, 500),
        model: result.model || surface,
      };
      records.push(rec);
      console.error(`  brand=${rec.brand_mentioned ? 'YES' : 'no'} ${rec.brand_position ? `(pos ${rec.brand_position})` : ''} | competitors=${rec.competitor_count}`);
    }
  }

  // Append to NDJSON. First-write chmod 0o600 (same defense as psi-fetch post-v0.3.3).
  const existed = fs.existsSync(NDJSON);
  fs.appendFileSync(NDJSON, records.map(r => JSON.stringify(r)).join('\n') + '\n');
  if (!existed) {
    try { fs.chmodSync(NDJSON, 0o600); } catch {}
  }
  console.error(`\n✅ Appended ${records.length} rows to ${NDJSON}`);

  // Brief stats
  const mentioned = records.filter(r => r.brand_mentioned).length;
  console.error(`   Brand mentioned in ${mentioned}/${records.length} prompts (${Math.round(100*mentioned/records.length)}%)`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
