# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **New skill wrapper: `recovery-audit`** ([SKILL.md](./plugins/seo-rescue/skills/recovery-audit/SKILL.md)) — the existing `commands/recovery-audit.md` spec is now plugin-discoverable and user-invokable like the other five recovery commands. recovery-audit is the documented **writer** of `recovery-gate.json` (Settlement-Gate state) and of the `hypothesis_registry` that `recovery-plan` consumes. Routed in the orchestrator and README. Skill count: seventeen → eighteen.
- `recovery-full` workflow now includes the audit step: diagnose → crawl → **audit** → plan → monitor (5 steps, shared run_id). The audit always runs and degrades gracefully when no change history exists.

### Changed

- **`change-budget.schema.json` v1.2.0 → v1.3.0** — three rule sets that were documentation-only are now schema-enforced via `if/then`: (1) per-change-type pre-check presence (`redirect` requires `seo_url_precheck` with `collision_detected`; `category_status`/`product_status` require `dreiscseo_precheck` with `would_create_301_to_404`; `cms_slot` requires `snapshot_paths.before_path`), (2) Settlement-Gate override requirements per `SEO_SETTLEMENT_GATE.md` section 7 (`explicit_emergency_approval` requires approval validation, post-change checks, per-change rollback method + pre-change state check + confidence ≥ medium; `technical_emergency` requires live-HTTP verification, API state alone is rejected), (3) Reserve-bleibt-Reserve during an active gate (`reserve_bleibt_reserve_acknowledged: true`, `unused_budget_handling: forfeit`). New per-change fields: `pre_change_state_check`, `hypothesis_id`, `hypothesis_status_snapshot`, `fix_scope_match`, `verified_by_source_tier`; new top-level `hypothesis_verification_gate` block.
- **`lib/safe.js`: two new governance validators** — `checkHypothesisScopeMatch()` (Hypothesis Verification Gate incl. fix-scope-expansion detection and graceful first-run degradation) and `validateSettlementOverride()` (deny-by-default section-7 override verdict with explicit missing-requirements list; catches broad-trigger approval text even when `is_valid` was forged). 19 new tests in `lib-safe-primitives.test.js` (55 total).

### Fixed

- **Hypothesis Verification Gate first-run deadlock** — `recovery-plan` Step 8a hard-stopped on missing `hypothesis_id` even when no `recovery-audit` output existed yet (the normal state on a first run). The gate now degrades gracefully: without audit output the full plan is still generated, all actions are segregated to `prepare_now_execute_later` (roadmap-only), warning `hypothesis_gate_no_audit_output` is recorded, and the gate block carries `audit_output_available: false`. Hard stops only apply when a `hypothesis_registry` is present.
- **Settlement-Gate pre-check** in `recovery-plan` now documents who writes `recovery-gate.json` (recovery-audit) and warns `gate_state_possibly_stale` when change history suggests an un-audited Major Batch.
- **`post-core-update-recovery`**: the "AI Citations as leading confirmation" acceleration factor was downgraded to an explicitly-marked N=1 hypothesis — the 2026-06-03 LESSONS correction rescinded exactly this claim (the observed +22 % trend was a pre-update plateau erased by the May 2026 Core Update).

### Security

- `lib/safe.js` — `acquireLock` back-off no longer shells out (`execSync('sleep …')` replaced with `Atomics.wait`), honoring the repo's own "never `execSync` a string" rule; portable and spawns no process.
- `lib/safe.js` — `atomicWriteJSON` now writes its temp file with `O_EXCL` (via `writeFileExclusive`), so a pre-existing symlink at the temp path aborts the write instead of being followed (parity with `appendNDJSON`/`writeFileExclusive`).
- `subscription-monetization-audit/csv-import.example.js` — summary write switched from unlink-then-exclusive (TOCTOU) to `atomicWriteJSON` (atomic, symlink-checked, idempotent).

### Changed

- **Version/consistency sweep (post-review):** `rescue` SKILL.md installable-version claim v0.5.0 → v0.5.2; RECOVERY_SYSTEM.md status note rewritten for v0.5.2 reality (sistrix-monday-recovery-check shipped, recovery commands partially implement the methodology); SISTRIX_MONDAY_RECOVERY_CHECK.md "planned v0.5.1" → shipped, companion-doc section numbers corrected (Recovery Signal Score §10, Winner/Loser §8, Money-KW §7, URL Recovery §9, sequencing §11).
- **Score disambiguation:** the weekly CSV-first **Recovery Signal Score** (RECOVERY_SYSTEM.md §10 / sistrix-monday-recovery-check) and the automated 5-component **Recovery Score** (recovery-monitor) are now explicitly documented as two distinct, non-comparable metrics — both 0-100, never to be mixed in one time series.
- **Batch-limit clarification:** structural changes are 3 URLs per **calendar day** (counted across sessions via change-history.ndjson), 4-5 only with an explicit batch plan, 5/day is the absolute ceiling; Governor Hard Stop rule 3 and SAFE_LIVE_CHANGE_RULES table now state the same rule.
- **R1-R5 disambiguation:** `recovery_stage_estimate` (diagnose, VI-trend-based diagnostic stage) vs `current_phase` (plan, operational work phase) documented as intentionally distinct signals with divergence rules (phase ≤ stage+1, divergence must be warned and explained, phase is recomputed every run).
- Documentation consistency sweep: reconciled the contradictory skill counts (was "eleven"/"ten"/"sixteen" across CLAUDE.md, ARCHITECTURE.md, and the orchestrator) to the canonical **seventeen skills/commands (one orchestrator + sixteen sub-skills and recovery commands)**; refreshed install pins and status lines to v0.5.2; aligned every per-skill `version:` frontmatter to 0.5.2.

## [0.5.2] — 2026-06-02

### Added

- **SEO Change Governor + Settlement Gate** — session-mode change budgets (`audit_only` default with explicit operator escalation), per-change risk / evidence / rollback / approval rating, and a post-Major-Batch Settlement Gate that hard-blocks new optimization waves until enough data has accumulated to attribute cause and effect. Ships with `references/SEO_CHANGE_GOVERNOR.md`, `references/SEO_SETTLEMENT_GATE.md`, `references/SAFE_LIVE_CHANGE_RULES.md`, the `recovery-audit` command, governance JSON schemas (`change-budget`, `recovery-gate`, `seo-change-audit`, `hypothesis-verification`), platform/plugin SEO references, and ecommerce recovery test fixtures.
- **GitHub issue templates** — bug report, feature request, usage feedback, and a config router pointing open-ended questions to Discussions and security reports to private advisories.
- **New skill: `subscription-monetization-audit`** ([SKILL.md](./plugins/seo-rescue/skills/subscription-monetization-audit/SKILL.md)) — a 5-lever recurring-revenue playbook (pricing, packaging, retention, expansion, win-back) with an optional CSV import path for Stripe / Chargebee / Recurly exports that computes MRR, ARPU, churn, and cohort retention locally. CSV import via `csv-import.example.js` with `lib/safe.js` safety primitives (size-capped reads, no network calls). Routed in the `rescue` orchestrator as `/seo-rescue:rescue monetization` and listed in the README "Reporting and economics" table.

- **Recovery Workflow Commands**: Five new commands for automated SEO recovery
  - `recovery-diagnose` — Core Update diagnosis with capability-based provider fallbacks (Sistrix + DataForSEO MCP + GSC CSV + manual CSV)
  - `recovery-crawl` — Screaming Frog MCP crawl + local minimal-crawler fallback + issue classification
  - `recovery-plan` — Prioritized 30/60/90-day action plan with human approval gate and evidence arrays
  - `recovery-monitor` — Weekly tracking with deterministic 0-100 recovery score and component scores
  - `recovery-full` — Orchestrator chaining all four commands with graceful degradation
- **New runnable skill: `sistrix-monday-recovery-check`** ([SKILL.md](./plugins/seo-rescue/skills/sistrix-monday-recovery-check/SKILL.md)) — CSV-first weekly recovery review during an active SEO recovery. No SISTRIX API key required. Reads current and previous SISTRIX keyword exports (optionally a money-keyword list, optionally a GSC export, optionally CR data) and emits a fixed 17-section structured report: visibility-index interpretation, Top-100/50/20/10/5/3 recovery distribution, winner/loser neutralization, money-keyword protection table, URL-level recovery table, per-cluster recovery stage (0-5), Recovery Signal Score (0-100), optional GSC cross-check, optional conversion-rate validation, one of six recommended actions (Observe / Protect / Strengthen / Investigate / Correct / Escalate), explicit What-Not-To-Touch guard, next-7-day monitoring plan, next-Monday checklist, confidence level, data limitations. Methodology specification in [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md); operational detail in [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) sections 4-10.
- Synthetic example folder [`examples/synthetic-sistrix-monday-check/`](./examples/synthetic-sistrix-monday-check/) with the input SISTRIX CSV shape (current week + previous week + money-keyword list) and the expected output Markdown. All data uses the RFC 2606 reserved `.test` TLD.
- **lib/safe.js v2**: `normalizeDomain()`, `generateRunId()`, enhanced `acquireLock()` (PID/token/stale TTL), `atomicWriteJSON()` (collision-safe), `appendNDJSON()`, `safeReadJSON()`, `safeReadLatestImport()`, `maskSecrets()`, `safeLog()`
- **JSON Schemas**: schema_version, run_id, data_quality, confidence, providers_used, missing_capabilities in all command outputs
- **Reference documents**: `CORE_UPDATES.md` with 90-day freshness policy, `RECOVERY_SYSTEM.md`, `DECISION_ENGINE.md` under `plugins/seo-rescue/references/`
- **Documentation**: ONBOARDING.md, SETUP.md, TOOL_PROVIDERS.md, FALLBACKS.md, TROUBLESHOOTING.md under `plugins/seo-rescue/docs/`
- **Test fixtures**: Minimal CSV and JSON test data for offline testing under `plugins/seo-rescue/test-fixtures/`
- **Command/skill wrapper pattern**: Detailed command specs in `commands/` with thin `skills/*/SKILL.md` wrappers

### Changed

- Skill count is now sixteen (one orchestrator plus fifteen sub-skills/commands). [README.md](./README.md), [CLAUDE.md](./CLAUDE.md), and the orchestrator [`rescue/SKILL.md`](./plugins/seo-rescue/skills/rescue/SKILL.md) updated accordingly.
- `rescue/SKILL.md` Quick Reference table adds the `/seo-rescue:rescue monday` alias plus the five new recovery commands. Cost summary table extended. Latest installable version footer updated from a stale v0.3.0 to v0.5.1.

### Deferred to a later v0.5.x

- Optional Node.js helper script for deterministic CSV parsing + Recovery Signal Score computation. v0.5.1 ships as a pure-Markdown framework skill — Claude reads the CSVs via the Read tool and applies the methodology. The helper script would let the same workflow run in batch / cron mode and is the natural v0.5.2 follow-up if usage proves the demand.
- ARCHITECTURE.md skill registry and MATURITY.md comparison-table skill-count cosmetic updates land at v0.5.1 release alongside the manifest version bump.

## [0.5.0] — 2026-05-26

### Architecture consolidation

This release does not change runtime behavior. It reaches canonical-source-of-truth state for the documentation. Skill set remains the same 10 (1 orchestrator + 9 sub-skills). Plugin manifest, per-skill `version:` frontmatter, and install pin lines (`/plugin marketplace add maxschottke-spec/seo-survival-kit#v0.5.0`) bumped from `0.4.1` to `0.5.0` at release time.

#### Added

- [ARCHITECTURE.md](./ARCHITECTURE.md) — canonical source of truth: vision, ecommerce/D2C positioning, system shape (diagnostic/decision/workflow layers), skill registry, governance and lifecycle, privacy and client-data posture (private experience layer with pattern maturity model), adaptive user onboarding, knowledge layer with four-level evidence weighting, plugin architecture, compatibility with adjacent tools, versioning and release process, what is intentionally not implemented
- [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) — six-stage recovery framework, Recovery Risk Engine, Money Keyword Protection rules and at-risk classification, Winner/Loser Neutralization detection and severity, URL Recovery Analysis with per-type recommendations, Recovery Signal Score with twelve factors, five-phase recovery sequencing (R1 Protect → R2 Stabilize → R3 Improve internal links → R4 Fix intent conflicts → R5 Selective consolidation)
- [DECISION_ENGINE.md](./DECISION_ENGINE.md) — decision-first manifesto, codified decision rules (`r-margin-unknown-no-scale`, `r-roas-positive-margin-negative`, `r-sistrix-vi-flat-money-keywords-recovered`, `r-money-keywords-top3-protect`, `r-ai-citations-leading-indicator`, and others), evidence weighting at four levels, data quality layer with four dimensions, profitability signals as first-class concern, five-class prioritization (Immediate / Medium / Monitor only / Risky / False), sequencing constraints across phases, cross-channel signal integration patterns
- [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) — weekly CSV-first workflow specification (runnable skill ships in v0.5.1)
- [ROADMAP.md](./ROADMAP.md) — version-by-version product plan, distinct from ROADMAP-2026.md (future-watch document)

#### Changed

- README repositioned around ecommerce/D2C Recovery OS wedge. Skill-count corrected from "Nine" to "Ten skills (1 orchestrator + 9 sub-skills)". Status section updated from v0.3.x to v0.4.1 shipped / v0.5-dev in flight. Doc map added.
- CLAUDE.md architecture tree updated to include `ai-citations-tracker`, `gsc-deep-dive`, `exports/`, and the new top-level docs. Skill count corrected from "seven SEO skills" to ten.
- MATURITY.md version row updated to reflect v0.4.1 shipped + v0.5-dev in flight. Positioning paragraph added.
- `.gitignore` extended for private data paths: `private/`, `client-data/`, `real-data/`, `exports/private/`, `lessons/private/`, `case-notes/private/`, `local-notes/`, `tokens/`, `credentials/`, `sistrix-exports/`, `gsc-exports/`, `*_sistrix*.csv`, `*_visibility*.csv`, `*_keywords*.csv`, `*_ranking*.csv`, `.growth-survival-kit/`, `.seo-survival-kit/`, `gsc-config.json`, `ai-citations-config.json`, `gsc-history/`, `ai-citations-history/`

#### Fixed

- `plugins/seo-rescue/skills/gsc-deep-dive/SKILL.md` Step 1a now warns explicitly against using Google AI Studio default projects (project IDs matching `gen-lang-client-XXXXXXXXXX`); these service accounts hit "Email not found" when added to GSC even after 12+ hours of propagation. Addresses real-user issue [#26](https://github.com/maxschottke-spec/seo-survival-kit/issues/26).
- `plugins/seo-rescue/skills/gsc-deep-dive/SKILL.md` private example-domain reference replaced with reserved-TLD example per redaction policy.
- `plugins/seo-rescue/skills/ai-citations-tracker/SKILL.md` brand-variant false-positive example updated to reserved-TLD `aero-mattress.test`.

#### Deferred to v0.5.5 (separate PR)

- Commercial Model documentation: agency model, decision-first agency principles, service model stages, productized offer hypotheses with pricing logic, Fiverr Interface positioning and planned commands, buyer-objection log schema, GTM experiment template, implementation partner model. Kept separate from v0.5 technical architecture for review clarity.

#### Deferred to v0.6+

- Runnable SISTRIX Monday Recovery Check skill (v0.5.1)
- Revenue Rescue runtime (v0.6)
- Safe updater implementation (v0.6); v0.5 documents the design only
- Test fixtures, expected-output assertions, evaluation rubric (v0.6+)

## [0.4.1] — 2026-05-22

### Added — cross-platform exports

New `exports/` directory with the framework-only skills in platform-agnostic Markdown, plus per-platform install snippets:

- **`exports/skills/seo-rescue-overview.md`** — top-level routing + framework index (replaces the Claude-Code-specific `/seo-rescue:rescue` orchestrator for non-Claude tools)
- **`exports/skills/post-core-update-recovery.md`** — diagnose tree + 4-phase Authority-First recovery plan, Claude-frontmatter stripped
- **`exports/skills/ai-search-rescue.md`** — 7 tactics + 3-layer measurement for AI Overview / ChatGPT / Perplexity citation visibility, Claude-frontmatter stripped
- **`exports/README.md`** — per-platform install guides for Cursor (`.cursor/rules/*.mdc`), OpenAI Custom GPT (Instructions + Knowledge files), Gemini CLI (`GEMINI.md`), Aider (`CONVENTIONS.md`), Continue.dev (config.json docs), Codex (`AGENTS.md`), plus a generic-Markdown fallback for any other LLM

### Why this matters

The MATURITY.md "agentskills.io compliant — works in Cursor / Codex / Gemini CLI" claim was only true for the **pure-Markdown framework skills**, and only if the user manually stripped the Claude-specific frontmatter. This release makes that automatic: paste the right file into the right place and the framework loads.

### Scope

Only the three pure-Markdown framework skills are exported. The seven script-backed skills (`seo-audit-free`, `seo-outreach-report`, `competitor-deep-audit`, `psi-weekly-cron-baseline`, `channel-economics-analyzer`, `ai-citations-tracker`, `gsc-deep-dive`) remain Claude-Code-specific because their SKILL.md routing depends on Claude Code's slash-command + `allowed-tools` conventions. The underlying Node scripts in each skill folder are platform-agnostic — `exports/README.md` documents how to run them directly with `node` on any system.

### Planned next

`v0.5.x` will add an MCP server wrapper exposing each script-backed skill as an MCP tool — real cross-LLM portability (Cursor, Codex, Continue, Aider, Claude Desktop, Goose, n8n) instead of just framework-knowledge portability.

### Changed

- `plugin.json` + 10 × SKILL.md frontmatter `version` bumped 0.4.0 → 0.4.1
- README / ONBOARDING / CLAUDE / SECURITY install commands bumped to `#v0.4.1`
- MATURITY version line bumped to 0.4.1

No code, skill behavior, or trigger-phrase changes vs v0.4.0.

## [0.4.0] — 2026-05-22

### Added — two new skills (the two leading-indicator + convenience picks from the strategic roadmap)

- **`ai-citations-tracker`** — weekly cron job that fires a configurable brand-mention prompt set against ChatGPT (OpenAI API) and Perplexity (Sonar API), parses each answer for brand vs competitor mentions, and appends NDJSON history for trend analysis. Same architecture pattern as `psi-weekly-cron-baseline`. Default cost: ~$0.10/year of OpenAI credits + Perplexity free tier. Manual workflow documented for Google AI Mode / AI Overviews / Bing Copilot / Claude.ai (no stable public APIs yet). Tracks the leading-indicator pattern from `post-core-update-recovery` LESSONS (2026-05-22 entry: AI citation counts often move 2–6 weeks before classical Sistrix VI recovers).
- **`gsc-deep-dive`** — one-call Google Search Console API snapshot. Pulls top queries, top pages, query-page pairs, search-appearance breakdown (incl. AI Overview impressions where GSC exposes them), and derives a summary with Quick-Win opportunity counts (pos 11-20 + >100 impressions). Authenticates via service-account JWT (zero npm deps, manual RS256 sign instead of pulling `googleapis`). Removes the manual GSC click-through that is the friction point of every recovery / audit session.

### Added — monetization-funnel surface (docs only)

- **README "Need help running this on your own site?" section** — explicit consulting CTA between Contributors and Status. Three engagement formats (Recovery Audit / Recovery Begleitung retainer / Outreach pipeline setup) with rationale (the maintainer ran the framework on a real Core-Update case, paying for a session = getting context on which patterns apply to your specific situation). Contact via GitHub Discussions or maintainer profile. Calendly link slot reserved.

### Changed

- **`rescue` orchestrator** updated routing table with the two new sub-aliases: `/seo-rescue:rescue ai-citations` and `/seo-rescue:rescue gsc <domain>`.
- **`plugin.json` + `marketplace.json` descriptions** updated to "Nine SEO skills + orchestrator" with the new slash commands embedded inline for catalog discoverability (same convention as v0.3.1).
- **All 10 SKILL.md frontmatter `version` lifted to `0.4.0`** (8 existing + 2 new — full alignment with plugin.json).

### Security notes for the new skills

Both new scripts follow the post-Round-1-audit hardening conventions established in v0.3.2:

- API keys env-only (`OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GSC_SERVICE_ACCOUNT_JSON`); hard-fail if config file contains a key field.
- Validate-at-load + trust-at-use for every config field (prompts as string arrays with length cap, competitors as hostname-shaped strings, surfaces as enum allowlist, site identifier with strict regex covering both `sc-domain:` and URL-prefix formats).
- All AI-surface responses (untrusted!) pass through the same 12-pattern `sanitize()` defense as `seo-onpage.js`. GSC `query` field gets the same treatment (Google indexes attacker-controllable search strings).
- Hardcoded network destinations only: `api.openai.com`, `api.perplexity.ai`, `oauth2.googleapis.com`, `searchconsole.googleapis.com`, `www.googleapis.com/pagespeedonline/v5`. No SSRF possible from config.
- NDJSON / JSON output files get `chmod 0o600` on first write (same defense as v0.3.3 L3).
- Symlink-clobber defense (`lstat` + unlink-if-symlink) on the GSC snapshot output path (same pattern as v0.3.3 L5).

### Upgrade notes

No breaking changes. Existing v0.3.x install commands keep working. The two new skills are opt-in — install + ignore them if you don't need AI-citation tracking or direct GSC access. The README CTA is purely additive.

```
/plugin marketplace add maxschottke-spec/seo-survival-kit#v0.4.0
```

## [0.3.3] — 2026-05-22

### Changed (polish-pass from Round 1 audit's LOW-severity list)

- **`lib/safe.js → getCacheDir`** — added an explicit cross-platform note. `fs.chmodSync` is a no-op on NTFS (Windows uses ACLs, not POSIX mode bits); the comment points users at the ONBOARDING PowerShell snippet for the equivalent ACL hardening when running on shared Windows boxes. Behavior unchanged on macOS/Linux.
- **`psi-fetch.example.js`** — NDJSON history file now `chmod 0o600` on first write (best-effort, no-op on Windows). Previously inherited the default umask (typically `0644 = world-readable`), which leaked per-domain perf history to other local users on shared boxes.
- **`seo-report-gen.js`** — symlink-clobber defense on the PDF output path. Before Chrome's `--print-to-pdf` writes, an `lstatSync` checks whether `pdfPath` already exists as a symlink. If yes (e.g. an attacker planted `~/Downloads/SEO-Auswertung-foo.pdf -> /etc/something` between runs), it's unlinked first so the next write lands on a real file owned by the running user. ENOENT is the expected path on fresh systems and is ignored.
- **`competitor-deep-audit.example.js`** — stderr log line stripping CR/LF from `c.domain` (DataForSEO API response) plus a 253-char cap. Defense against log injection if an attacker-controlled SERP entry contained embedded newlines. Low real-world likelihood, free hardening.
- **`seo-onpage.js`** — same CR/LF strip applied to `r.title` and `r.cms` in the per-target stderr summary. `sanitize()` already length-caps and pattern-filters those fields, but CR/LF wasn't a sanitize() concern — separate fix for log-parsing safety.
- **`seo-audit-free/SKILL.md`** — security note added at the start of Schritt 4 about writing to `/tmp/` on shared-host environments. Default behavior (Solo-Workstation) is safe; the note shows the `mktemp -d` + `trap rm` pattern for shared-host or server environments.

### Why not v0.4

Each item is a non-functional hardening of code that already worked correctly under normal use. No skill behavior changes, no SKILL.md trigger-phrase changes, no plugin-manifest surface changes. Existing v0.3.2 installs upgrade transparently.

## [0.3.2] — 2026-05-22

### Added (security hardening from external audit Round 1 — see SECURITY.md → External security reviews)

- **`lib/safe.js` new helpers** — `safeHostname` (strict RFC1123 hostname charset), `safeUrl` (URL.parse + http(s)-only + SSRF guard against loopback / RFC1918 / link-local incl. **169.254.169.254 cloud-metadata** / .local / IPv6 ::1), `safeLabel` (string + 200-char length cap). All three smoke-tested across 16 cases.
- **`validateConfigTargets` now covers `domain` + `host` + `label`** (previously only validated `slug`). Hostile audit-config can no longer flow unvalidated hostnames / URLs / labels into URL paths, HTML/PDF output, and filenames.
- **`sanitize()` helper in `seo-onpage.js`** — defense against indirect prompt injection via scraped third-party HTML. Type-coerces non-strings, length-caps every field (title 300, meta 500, headings 200, schema 64), pattern-matches 12 imperative-injection forms and redacts matches. Tested adversarially against 10 attack strings + 7 legitimate marketing phrases — 17/17 pass (negative-lookahead on `system prompt(?![a-z])` avoids redacting "system prompts you to…").
- **`allowed-tools` declared on every SKILL.md** — bounds the blast radius of any prompt-injection chain. Pure-Markdown framework skills get `[Read, Grep, Glob]`; script-runners get `[Read, Write, Bash(node:*), Bash(curl:*)]`; psi-weekly-cron extends with `Bash(launchctl:*), Bash(crontab:*)`; seo-audit-free extends with `Bash(npx lighthouse:*)`.
- **Routing-safety section in `rescue/SKILL.md`** — codifies that sub-skill routing decisions must come from the *initial user message*, never from tool-output content (scraped HTML, API responses, file contents). Closes the orchestrator-injection vector.
- **Untrusted-input section in `seo-outreach-report/SKILL.md`** — explicit threat-model documentation for installers and reviewers.
- **For-external-reviewers section in `SECURITY.md`** — anti-hallucination guardrails (`[VERIFIED]` / `[PROBABLE]` / `[UNVERIFIED]` labels, mandatory `file:line` citations, false-positive guidance for the bundled skill-security-auditor, copy-paste system prompt for free-tier/sandboxed LLM assistants).
- **External security reviews table in `SECURITY.md`** — Round 1 (external reviewer) and Round 2 (maintainer-driven senior-engineering + marketplace audit) both documented with scope and verdict.
- **Cross-platform env-var reference in `ONBOARDING.md`** — explicit table covering `CHROME_PATH`, `SEO_CACHE_DIR`, `SEO_PDF_OUTPUT_DIR`, `SEO_AUDIT_CONFIG`, `PSI_CONFIG` per-OS defaults + recommended overrides. Step 4w added with the PowerShell equivalent of `mkdir + cp + chmod 600` (including the NTFS ACL incantation for owner-only access).
- **Contributors section in `README.md`** crediting the external security reviewer.
- **`.github/dependabot.yml`** — weekly updates for the `github-actions` ecosystem.
- **`.github/CODEOWNERS`** — owner `@maxschottke-spec` on every path, explicit ownership of `/.github/`, both `.claude-plugin/` folders, `/lib/`, and `/SECURITY.md`.
- **Branch protection on `main`** — required status check (`validate`), required PR review (1 approval, code-owner-required), conversation-resolution required, no force-push, no deletion.
- **GitHub repo features** — `dependabot_security_updates` enabled, vulnerability alerts enabled (secret scanning and push-protection were already on).

### Changed (functional)

- **`.gitignore` expanded** to cover user-supplied runtime configs (`audit-config.json`, `psi-config.json`, `channels.json`) plus runtime working dirs (`data/`, `psi-history/`, `*.ndjson`). Previously, an installer following the example files' instruction to "copy to audit-config.json (gitignored)" would silently commit client domains, slugs, and editorial narrative to their fork's git history.
- **PSI `api_key` is now env-only.** `psi-fetch.example.js` previously fell back to `CFG.api_key` from `psi-config.json` if no env var was set. Combined with the gitignore gap this was a trivial path to commit a Google API key. Script now hard-fails if `api_key` is present in the config.
- **`psi-fetch.example.js` SSRF + config-input allowlist.** URLs go through `safeUrl` (loopback / RFC1918 / cloud-metadata blocked), `categories[]` allowlisted to the 5 PSI categories, `strategies[]` allowlisted to `mobile / desktop`, `output_dir` must be a relative path without `..` traversal. PSI can no longer be used as an SSRF proxy or pivot to cloud-metadata endpoints.
- **`channel-economics.example.js` path-traversal fix.** `./data/${ch.name}-period.csv` interpolation now safe-by-construction: `ch.name` passes through `safeSlug` at config-load.
- **`competitor-deep-audit.example.js` TARGET validation.** `process.argv[2]` is now `safeHostname`-validated before any network call or `writeFileSync`. `node competitor-deep-audit.example.js /tmp/poc` no longer writes outside CWD.
- **CI workflow hardening (`.github/workflows/validate.yml`).** SHA-pinned `actions/checkout` and `actions/setup-node`, top-level `permissions: contents: read`, `persist-credentials: false` on checkout, `find -print0 | while IFS= read -r -d ''` instead of `for f in $(find …)` (closes a CI-bypass vector where a malicious PR could supply a filename like `'); process.exit(99); //.example.json`). Filenames now pass through `FILE` env var, not shell interpolation.
- **`js-yaml@4` dependency removed from CI.** Replaced with an inline regex frontmatter validator. CI runtime supply chain is now bounded to the two SHA-pinned actions. `allowed-tools` is now a *required* frontmatter field so the per-skill hardening cannot regress silently.

### Changed (marketplace-readiness pass — non-functional)

- **README rewritten** for marketplace-submission tone. Lead-generation framing removed from the "What this is" section and from the previous "Who uses this" emoji-list. The audience-targeting table ("Freelance SEO consultant: outreach-report = lead-gen tool") was replaced with sachliche "When to use" and "When *not* to use" sections plus an explicit YMYL notice.
- **Public-Beta status prominent**. New status box at the top of the README plus a "Public Beta" badge. Status & Maintenance section at the bottom states the single-maintainer model explicitly (no SLA, no enterprise support, best-effort issue response).
- **Naming clarification table** added at the top of the README (repository vs. plugin vs. slash-command-prefix) because new users frequently asked "is it `seo-survival-kit` or `seo-rescue`?"
- **YMYL disclaimer** added to the `seo-outreach-report` SKILL.md and to the rendered PDF disclaimer block. Specifically calls out medical, legal, financial, and regulated-industry domains where action plans should be validated by a domain expert before publication or client delivery.
- **claude-seo trigger phrase softened.** `seo-outreach-report` SKILL.md description previously said "USE THIS instead of `claude-seo:seo-audit`" — now reads "Complements `claude-seo:seo-audit` when the goal is communication for a non-technical audience rather than technical depth." Same softening for `make-pdf`.
- **Recovery / AI-citation predictions reframed as observations** rather than predictions. `post-core-update-recovery` "Common outcome: 60-80%" now reads "Recovery outcome in observed cases is in the 50-80% range... observations from a small case-base, not population statistics — treat them as input hypotheses, not predictions." Same softening for `ai-search-rescue` "AI citations lead by 2-6 weeks" claim and `seo-audit-free` "ROI typisch 1-2 gewonnene Mandate" line.
- **channel-economics-analyzer fee-table disclaimer expanded.** The table now explicitly states the fees are starting estimates from public marketplace documentation and seller-community reports as of Q1 2026, that they vary by category / tier / region / fulfillment setup, and that the user must verify against current seller agreements before drawing business conclusions.
- **SECURITY.md** updated: pin example uses v0.3.2, explicit single-maintainer / bus-factor-1 section added before "Reporting Security Issues", and the contact path now mentions GitHub's private security advisory feature.
- **API cost expectation** documented in the `seo-outreach-report` SKILL.md per-run section so users know what they're about to spend before invoking the pipeline.
- Install commands in README, ONBOARDING, CLAUDE.md updated to `#v0.3.2`.

This is a documentation-only release. No functional code changes, no version-incompatible changes. Existing v0.3.1 installs continue to work; v0.3.2 makes the same plugin's positioning and disclaimers cleaner for marketplace submission and public-beta audience expectations.

## [0.3.1] — 2026-05-22

### Changed

- Plugin and marketplace descriptions now embed the namespaced slash commands inline. Catalog browsers (claude.ai/settings/plugins, claude-plugins-community marketplace.json) see the full command surface (`/seo-rescue:rescue`, `/seo-rescue:seo-audit-free [domain]`, `/seo-rescue:post-core-update-recovery [domain]`, `/seo-rescue:seo-outreach-report [domain]`, `/seo-rescue:channel-economics-analyzer`, `/seo-rescue:competitor-deep-audit [domain]`, `/seo-rescue:psi-weekly-cron-baseline`, `/seo-rescue:ai-search-rescue [domain]`) directly in the listing without having to click through.
- README, ONBOARDING.md, CLAUDE.md install commands updated to `#v0.3.1`.

## [0.3.0] — 2026-05-22

### Added

- New skill `ai-search-rescue` for AI-search visibility recovery (Google AI Overviews, AI Mode, ChatGPT, Perplexity, Bing Copilot, Claude.ai search). Framework includes a measurement layer across the six AI surfaces, seven optimization tactics (extractable passages, question-shaped headings, source-cited statements, author trust, schema for AI, llms.txt, Wikipedia), and a realistic 6-12 week recovery workflow.
- New orchestrator skill `rescue` at `plugins/seo-rescue/skills/rescue/SKILL.md`. Acts as the entry point for the plugin — type `/seo-rescue:rescue` to see the routing table covering all seven content skills, or use sub-aliases like `/seo-rescue:rescue audit <domain>` to route to a specific sub-skill. Modeled after the orchestrator pattern in `claude-seo:seo`.
- GitHub Actions CI workflow at `.github/workflows/validate.yml` running pure node/yaml structure and parse checks on every push and PR. Catches the same bug classes as `claude plugin validate` (manifest paths, JSON parse, YAML frontmatter parse, marketplace.json reference resolution). Prevents repeat of the v0.2.0/v0.2.1 un-installable releases.
- `CLAUDE.md` at repo root with project overview, architecture diagram, release process, security model, and contribution guidelines for working with the codebase.
- `CHANGELOG.md` (this file) for installer transparency.
- Quick Reference table at the top of README.md showing every namespaced slash command with one-line description and cost-per-audit.

### Changed

- All seven content SKILL.md frontmatters now declare `user-invokable: true`, `argument-hint`, `license: MIT`, and a `metadata` block (`author`, `version`, `category`). Discoverability via Claude Code's autocomplete and downstream catalog tooling improved to match the conventions used by `claude-seo`.
- Marketplace metadata updated to reflect seven skills instead of six.
- Marketplace keywords expanded with `ai-search`, `ai-overviews`, `geo`, `generative-engine-optimization`, `chatgpt`, `perplexity`, `llms-txt`.
- README skill count updated.

## [0.2.2] — 2026-05-22

First actually-installable release.

### Fixed

- Plugin manifest path. `plugin.json` was at `plugins/seo-rescue/plugin.json` instead of the required `plugins/seo-rescue/.claude-plugin/plugin.json`. Without this fix, `/plugin marketplace add` silently skipped the plugin — v0.2.0 and v0.2.1 were never actually installable from their published `marketplace.json`.
- YAML frontmatter in all six SKILL.md files. Unquoted double-quotes inside `description:` fields (`"kostenloser SEO-Check"`, `we don't`) broke YAML 1.2 parsing. All skills loaded with empty metadata at runtime, so trigger phrases didn't activate the skills. Fixed by single-quote-wrapping each `description` and escaping internal single quotes as `''`.

### Added

- `channel-economics-analyzer` expanded from 5 to ~30 channels across DACH marketplaces (Amazon, OTTO, Kaufland.de, eBay, Zalando, About You, Galeria, Avocadostore, manomano, Limango, Bonprix, MyToys), EU marketplaces (Bol.com, CDiscount, Allegro, ManoMano, Spartoo), US marketplaces (Amazon US, Walmart, Etsy, Wayfair, Target Plus), social commerce (TikTok Shop, Instagram, Pinterest, YouTube, Live-Commerce), B2B/Wholesale (Alibaba, Faire, Ankorstore), direct-shop PSPs (Shopify, Shopware, WooCommerce, Klarna, PayPal, Stripe), and affiliate channels (Awin, TradeDoubler, Influencer codes, Google Shopping, Idealo). Per-channel gotchas and channel-portfolio templates per business category included.
- `channels.example.json` expanded from 4 to 19 example entries.

## [0.2.1] — 2026-05-22 [YANKED]

Tagged but never actually installable due to the plugin manifest path issue fixed in v0.2.2. Skip this version — install v0.2.2 or newer instead.

### Fixed

The following changes shipped in this tag but were not reachable from any working install. They landed in installable form in v0.2.2.

- Realistic keyword position distribution. `ranked_keywords` API call was using `limit: 100` + `order_by: rank_group asc`, returning only the best-ranking 100 keywords. The PDF's position distribution chart was always near-100% Top 3 regardless of the real spread. Now `limit: 1000` + `order_by: search_volume desc`, with local re-sort for the Top-Keywords table.
- Competitor self-filter. DataForSEO's `competitors_domain` endpoint returns the target as competitor #1 with 100% overlap. Now filtered out by normalized domain (lowercase, strip www).

## [0.2.0] — 2026-05-22 [YANKED]

Tagged but never actually installable due to the plugin manifest path issue fixed in v0.2.2. Skip this version — install v0.2.2 or newer instead.

### Security

The following changes shipped in this tag but were not reachable from any working install. They landed in installable form in v0.2.2.

- Centralized input validation in shared `lib/safe.js` with `safeSlug`, `safeReadFile`, `cachePath`, `mkRunDir`, `writeFileExclusive`, `getCacheDir`.
- `safeSlug()` enforced at config-load in all scripts (previously only in `seo-report-gen.js`; `seo-extract-v2.js` and `seo-onpage.js` allowed path traversal).
- Cache moved from world-writable `/tmp/seo-*.json` to per-user `~/.cache/seo-rescue/` (mode 0700, refused on symlink). Defeats local symlink-clobber attacks.
- `esc()` HTML-escape extended to cover `'` and backtick in addition to `& < > "`. Previously-unescaped interpolations (`schema_types`, `first_seen`, numeric on-page fields) now wrapped.
- Strict Content-Security-Policy meta tag on rendered HTML — `default-src 'none'; frame-src 'none'; object-src 'none'; img-src data:`. Even if a string slips past `esc()`, Chrome refuses to load iframes or external resources during PDF render.
- `execSync` replaced with `spawnSync(CHROME_PATH, argv, { shell: false })`. Shell metacharacter injection via `CHROME_PATH` env var no longer possible. Chrome launched with isolated `--user-data-dir`.
- Size caps on every external-input `readFileSync` (10 MB default, 50 MB for raw homepage HTML).

## [0.1.0] — 2026-05-21

Initial public release.

### Added

- Three skills: `seo-audit-free`, `post-core-update-recovery`, `seo-outreach-report`.

### Changed

- Repository was previously named `seo-rescue-skills` and was renamed to `seo-survival-kit` on 2026-05-22.

[Unreleased]: https://github.com/maxschottke-spec/seo-survival-kit/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/maxschottke-spec/seo-survival-kit/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/maxschottke-spec/seo-survival-kit/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/maxschottke-spec/seo-survival-kit/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/maxschottke-spec/seo-survival-kit/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/maxschottke-spec/seo-survival-kit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/maxschottke-spec/seo-survival-kit/releases/tag/v0.1.0
