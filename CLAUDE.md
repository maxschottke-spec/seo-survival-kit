# seo-survival-kit: project instructions for Claude Code

## What this repository is

seo-survival-kit is a Claude Code plugin (marketplace name `seo-survival-kit`, plugin name `seo-rescue`) that bundles **eleven skills (one orchestrator plus ten sub-skills)** built from real ecommerce/D2C recovery work after Google Core Updates. It is MIT-licensed, has zero npm runtime dependencies, and is published at https://github.com/maxschottke-spec/seo-survival-kit. Canonical skill registry: [ARCHITECTURE.md section 4](./ARCHITECTURE.md#4-modules-and-skill-registry).

Positioning: **Recovery Operating System for Ecommerce/D2C**. Recovery-first, decision-first, profit-aware, risk-aware. The framework supports operators making recovery and growth decisions; execution belongs to the operator's team, agency, or contractors. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the canonical source of truth.

## Architecture

```
seo-survival-kit/
├── .claude-plugin/
│   └── marketplace.json              # Marketplace catalog
├── .github/
│   └── workflows/
│       └── validate.yml              # claude plugin validate on every push/PR
├── plugins/
│   └── seo-rescue/
│       ├── .claude-plugin/
│       │   └── plugin.json           # Plugin manifest (path matters — see CHANGELOG v0.2.2)
│       ├── lib/
│       │   └── safe.js               # Shared safety primitives
│       ├── commands/                 # Recovery workflow command specifications
│       │   ├── recovery-diagnose.md
│       │   ├── recovery-crawl.md
│       │   ├── recovery-plan.md
│       │   ├── recovery-monitor.md
│       │   └── recovery-full.md
│       ├── scripts/                  # Node.js helpers for script-backed commands
│       │   ├── recovery-crawl.js
│       │   └── recovery-monitor.js
│       ├── references/               # Wissensbasis-Dokumente
│       │   ├── RECOVERY_SYSTEM.md
│       │   ├── DECISION_ENGINE.md
│       │   └── CORE_UPDATES.md
│       ├── schemas/                  # JSON Schema for command outputs
│       │   ├── befund.schema.json
│       │   ├── issues.schema.json
│       │   ├── action-plan.schema.json
│       │   └── history.schema.json
│       ├── docs/                     # Documentation and onboarding
│       │   ├── ONBOARDING.md
│       │   ├── SETUP.md
│       │   ├── TOOL_PROVIDERS.md
│       │   ├── FALLBACKS.md
│       │   └── TROUBLESHOOTING.md
│       ├── test-fixtures/            # Minimal test data for offline testing
│       └── skills/                   # 16 skills (1 orchestrator + 15 sub-skills/commands)
│           ├── rescue/                       # Orchestrator + routing table
│           ├── seo-audit-free/
│           ├── post-core-update-recovery/
│           ├── seo-outreach-report/          # SKILL.md + 4 Node.js scripts + .env.example
│           ├── channel-economics-analyzer/
│           ├── competitor-deep-audit/
│           ├── psi-weekly-cron-baseline/
│           ├── ai-search-rescue/
│           ├── ai-citations-tracker/         # v0.4 addition: weekly cron AI surface tracker
│           ├── gsc-deep-dive/                # v0.4 addition: one-call GSC API snapshot
│           └── sistrix-monday-recovery-check/  # v0.5.1 addition: CSV-first weekly recovery review
├── exports/                          # Platform-agnostic Markdown copies (Cursor / Custom GPT / Gemini / Aider / Codex)
├── examples/                         # Sample PDF + screenshots (synthetic data)
├── ARCHITECTURE.md                   # Canonical source of truth (vision, positioning, modules, governance, privacy)
├── RECOVERY_SYSTEM.md                # Recovery operational detail
├── DECISION_ENGINE.md                # Decision rules, prioritization, sequencing, cross-channel signals
├── SISTRIX_MONDAY_RECOVERY_CHECK.md  # Weekly workflow specification (skill ships in v0.5.1)
├── ROADMAP.md                        # Version-by-version product plan
├── ROADMAP-2026.md                   # Google search future-watch (separate from product roadmap)
├── CHANGELOG.md                      # Per-release notes
├── SECURITY.md                       # Threat model + verification steps
├── COSTS.md                          # Per-audit API cost breakdown
├── MATURITY.md                       # Honest comparison with mature alternatives
├── ONBOARDING.md                     # 15-minute first-PDF walkthrough
└── README.md                         # Entry point with Quick Reference table
```

The plugin has two layers:

1. **Pure-Markdown framework skills** — `post-core-update-recovery`, `ai-search-rescue`, and parts of `seo-audit-free`. No scripts. They encode SEO decision frameworks that Claude applies to user-specific situations. Work as standalone documentation even without the rest of the plugin.

2. **Script-backed skills** — `seo-outreach-report`, `competitor-deep-audit`, `psi-weekly-cron-baseline`, and parts of `seo-audit-free`. Plain Node.js scripts that the user (or Claude on their behalf) invokes with `node script.js`. No `package.json`, so no install step, so no npm supply-chain attack surface.

3. **Recovery workflow commands** — `recovery-diagnose`, `recovery-crawl`, `recovery-plan`, `recovery-monitor`, `recovery-full`. Hybrid: Markdown command specifications in `commands/` with thin SKILL.md wrappers in `skills/` for plugin discovery. Script-backed commands (`recovery-crawl`, `recovery-monitor`) have Node.js helpers in `scripts/`. All commands share domain normalization, atomic write safety, and NDJSON history via `lib/safe.js`.

## Routing

The `rescue` skill is the orchestrator. Users can either:

- Type `/seo-rescue:rescue` to see the routing table and let Claude choose the right sub-skill, or
- Call any sub-skill directly via `/seo-rescue:<skill-name>` (e.g. `/seo-rescue:seo-audit-free example.com`)

Each sub-skill has `user-invokable: true` and an `argument-hint` in its YAML frontmatter so Claude Code's autocomplete shows it.

## Skill-naming convention

We use descriptive multi-word skill names (`post-core-update-recovery`, `channel-economics-analyzer`) over short verbs (`recovery`, `channels`). This is a deliberate trade-off: longer names are less autocomplete-friendly but clearer in search and discovery, and renaming would invalidate existing external references (Anthropic submission, dev.to article, awesome-list PR, MEMORY.md).

If a future plugin in the same marketplace needs shorter aliases, the `rescue` orchestrator can route them as subcommands (e.g. `/seo-rescue:rescue audit <url>` already aliases `/seo-rescue:seo-audit-free`).

## Release process

Releases follow [Semantic Versioning](https://semver.org/). The current installable version is in `plugins/seo-rescue/.claude-plugin/plugin.json`.

**Before tagging:**

```bash
claude plugin validate plugins/seo-rescue   # plugin
claude plugin validate .                     # marketplace
```

Both must show `✔ Validation passed`. Tags pushed without validation cost a release cycle (see CHANGELOG.md for v0.2.0 and v0.2.1, both un-installable due to missing manifest-path and YAML-frontmatter checks). The GitHub Actions workflow at `.github/workflows/validate.yml` runs the same checks on every push and PR, but local validation before `git tag` is the canonical gate.

After validation passes:

```bash
git tag -a v<X.Y.Z> -m "v<X.Y.Z> — short summary"
git push origin v<X.Y.Z>
gh release create v<X.Y.Z> --notes-file CHANGELOG-extract.md
```

## Security model

See [SECURITY.md](./SECURITY.md). Highlights:

- All slugs validated via shared `safeSlug()` in `plugins/seo-rescue/lib/safe.js`
- Cache moved from world-writable `/tmp/` to per-user `~/.cache/seo-rescue/` (mode 0700, refused on symlink)
- Strict CSP meta tag on rendered PDF HTML (`frame-src 'none'; object-src 'none'`)
- Chrome subprocess via `spawnSync` with argv-array (no shell), isolated `--user-data-dir`
- Size caps via `safeReadFile()` on all external-input file reads
- No telemetry, no phone-home, no postinstall hooks, no `npm install`

## Working with this codebase

When adding a new skill:

1. Create `plugins/seo-rescue/skills/<name>/SKILL.md` with frontmatter containing `name`, `description`, `user-invokable: true`, `argument-hint`, `license: MIT`, `metadata: { author, version, category }`.
2. Wrap any `description:` containing double-quotes in single quotes (`description: '...'`) — YAML 1.2 strict parsers reject unquoted scalars with internal double-quotes.
3. If the skill has a script, place it in the skill folder (not at plugin root). Read shared safety primitives from `../../lib/safe.js`.
4. Add a row to the `rescue` skill's Quick Reference table.
5. Update README Quick Reference table and CHANGELOG.md.
6. Run `claude plugin validate plugins/seo-rescue` and `claude plugin validate .` before commit.

When working with the existing 4 scripts in `seo-outreach-report`:

- All slugs pass through `safeSlug()` at config-load
- All `readFileSync` of external input goes through `safeReadFile()` (size-capped)
- All `writeFileSync` of cache files goes through `writeFileExclusive()` (O_EXCL, drops symlink targets)
- All subprocess calls use `spawnSync(cmd, [args], { shell: false })` — never `execSync` with a string

## SEO Recovery Operating Rules

These rules are derived from real recovery operations and apply to all commands that touch live shops.

### Defensive Recovery

- SEO recovery is defensive. Every change can make things worse.
- Sequence: Diagnose -> Crawl -> Plan -> (Approval) -> Execute -> QA -> Monitor. Never skip steps.
- No mass changes live without review. Use the Change Governor (`references/SEO_CHANGE_GOVERNOR.md`).
- No second wave of changes until the first wave has been measured (minimum 7 days GSC data).

### Live Change Discipline

- Every live change requires: source, target, before/after state, live HTTP check, canonical check, robots/indexability check, rollback plan.
- After a change is live, immediately QA. No further optimization until QA passes.
- If QA fails (404, broken chain, wrong canonical): stop all further changes and stabilize.

### Shopware Specifics

- Never trust only the seo-url table. Always verify with a live HTTP check. See `references/SHOPWARE_SEO_PATTERNS.md`.
- DreiscSeo redirects are a separate system. Check both seo-url AND dreisc-seo-redirect before deactivating categories.
- Shopware's seo-url API has an undocumented constraint: max one non-deleted redirect per foreignKey per channel. API 500 = this constraint.

### Data Source Discipline

- Every important claim needs a source and confidence level. See `references/PROVIDER_CAPABILITIES.md`.
- DataForSEO, Sistrix, and Screaming Frog are strong sources but not ground truth. Live HTTP and GSC are ground truth.
- When data is weak or contradictory: report `partial + low confidence` instead of false certainty.
- Backlink data from a single provider may be incomplete. Cross-check when counts seem off.

### Medical/Legal Compliance

- Handle medical and health-related terms carefully for mattress/sleep products.
- Do not use terms like "orthopaedisch", "heilend", "medizinisch empfohlen" in anchor texts or content without substantiation on the target page.
- Flag medical terms for review. Prefer neutral alternatives (e.g., "ergonomisch" instead of "orthopaedisch").

## Related resources

- Repository: https://github.com/maxschottke-spec/seo-survival-kit
- Anthropic community marketplace: pending review at claude-plugins-community
- Install: `/plugin marketplace add maxschottke-spec/seo-survival-kit#v0.5.0`
- Pilot-domain recovery case (anonymized): see `post-core-update-recovery/LESSONS.md` for the dated lesson entries that source the framework

## Canonical doc map

When working on this repository, the source-of-truth docs are:

- [ARCHITECTURE.md](./ARCHITECTURE.md) — vision, positioning, modules, governance, privacy, adaptive onboarding, knowledge layer, plugin architecture, compatibility, what is NOT implemented
- [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) — six-stage recovery framework, Recovery Risk Engine, Money Keyword Protection, Winner/Loser Neutralization, URL Recovery Analysis, Recovery Signal Score, five-phase recovery sequencing
- [DECISION_ENGINE.md](./DECISION_ENGINE.md) — decision rules catalog, evidence weighting, data quality, profitability signals, prioritization, sequencing, cross-channel signals
- [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) — weekly CSV-first workflow (skill ships in v0.5.1)
- [ROADMAP.md](./ROADMAP.md) — version-by-version product plan

Anti-bloat rule for new top-level docs: a new doc must pass the standalone test (own workflow / own inputs / own outputs / own user interaction / meaningful implementation complexity / independent future evolution). Otherwise it becomes a section in one of the existing docs.
