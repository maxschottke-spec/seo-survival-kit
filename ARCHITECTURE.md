# Architecture

Canonical source of truth for the seo-survival-kit and the larger Recovery Operating System that grows out of it. This document defines the vision, positioning, system shape, modules, governance, privacy posture, onboarding model, and what is intentionally not built. Operational detail for the recovery and decision layers lives in [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) and [DECISION_ENGINE.md](./DECISION_ENGINE.md). The version-by-version product plan lives in [ROADMAP.md](./ROADMAP.md).

Read this document first if you want to understand the system shape. Read the others when you need detail.

---

## 1. Vision

The seo-survival-kit is the first installable module of a **Recovery Operating System** for ecommerce growth. It supports operators making recovery and growth decisions across SEO and (in roadmap) paid media, tracking, CRO, and shop economics.

The contribution is not "another SEO audit tool". Plenty of those exist and several are mature. The contribution is the layer that sits above audit data and answers the operator's real question: given everything I know, **what should I do next, what should I not touch right now, and what should wait?**

Three convictions shape the system.

**Deciding is harder than executing.** Most operator pain during recovery is not "I don't know how to write a title tag"; it is "I don't know whether to rewrite this title tag right now". The framework focuses on the decision. Execution is well-served by other tools.

**Protection beats optimization during recovery.** The default during active recovery is to leave winning URLs alone, not to strengthen them aggressively. Operators under pressure routinely break their own recoveries by over-editing the URLs that just recovered. The framework codifies the protection rules so the operator does not have to remember them under stress.

**Profit gates priority.** Search volume does not equal revenue. CTR does not equal profit. The framework ranks opportunities by profitable leverage, not by traffic potential alone. When margin data is missing, the framework says so rather than substituting a proxy.

---

## 2. Positioning

**Recovery-first decision intelligence for ecommerce and D2C growth environments.**

That is the wedge. The architecture is intentionally modular and could later extend to SaaS, B2B, lead-generation, and content publishers, but the v1.0 narrative stays ecommerce-first.

### Why ecommerce/D2C is the initial wedge

Ecommerce has the densest cross-channel signal: organic traffic, paid acquisition, marketplace presence, conversion data, AOV, refund rates, contribution margin. The signals interact in ways that channel-specific tools cannot resolve. A keyword with high search volume but weak product margin and high refund rate is a "fake opportunity" that an SEO-only tool would push forward and the framework correctly de-prioritizes.

Ecommerce also has the strongest recovery visibility. A Core Update hits and revenue moves measurably within weeks. The operator can validate framework recommendations against actual business outcomes faster than in SaaS (long sales cycles, attribution lag) or content (ad-revenue volatility).

Ecommerce buyers (founders, e-commerce managers, multi-channel operators) are commercially understandable: they pay for diagnostic deliverables, they have budget rhythms compatible with the framework's offer ladder, and they generate the recurring weekly question (Monday recovery review) that the framework is structured around.

### Preferred positioning phrases

Use these consistently across README, MATURITY, external posts, and skill descriptions:

- Recovery Operating System for Ecommerce/D2C
- Recovery-first decision intelligence
- Profit-aware SEO Recovery System
- Cross-Channel Decision Layer (when emphasizing the v0.6+ expansion)
- Risk-Aware Growth Advisory

### Phrases to avoid

These overclaim, position against wrong reference points, or set expectations the framework does not meet:

- "Full-service agency replacement"
- "AI marketing automation"
- "Guaranteed growth"
- "Universal AI growth platform"
- "Works for everyone"
- "Complete agency replacement"
- "Autonomous SEO system"
- "Instant SEO recovery"
- "The first / the only / the best" (anti-overclaim doctrine)

### Anti-overclaim doctrine

The framework explicitly avoids absolutes. Recommendations carry calibrated confidence rather than guarantees. Comparable tools exist and are acknowledged (`claude-seo` for technical audits, `coreyhaines31/marketingskills` for broader marketing scope). The contribution is depth in a narrow surface, not breadth.

This shows up everywhere: README does not claim "first", SECURITY does not claim "fully secure", MATURITY does not claim "production-ready", outputs carry confidence levels rather than promises.

---

## 3. System shape

Three layers. New skills slot into the diagnostic layer; the decision and workflow layers stay coherent as the diagnostic surface grows.

**Diagnostic layer.** Skills that pull data and produce evidence. Today: SISTRIX recovery analysis, GSC deep dive, AI citations tracker, PSI weekly baseline, channel economics analyzer, competitor deep audit, post-Core-Update recovery framework, AI search rescue, SEO outreach report, free-tier audit. Roadmap: paid-media CSV audits (v0.8), GA4 read-only (v0.9), Merchant Center (v0.8), additional cross-channel data sources.

**Decision layer.** Rules that turn evidence into prioritized actions. Decision rules, evidence weighting, data quality layer, profitability signals, cross-channel signals, prioritization, sequencing. Detail in [DECISION_ENGINE.md](./DECISION_ENGINE.md).

**Workflow layer.** Recurring rhythms the operator follows. Today: weekly SISTRIX Monday Recovery Check, weekly PSI baseline, weekly AI citations tracking. Detail for the recovery rhythm in [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) and [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md).

Skills do not implement the decision layer themselves. They feed it. The user invokes a diagnostic skill; the decision layer evaluates the output against the active rule set and confidence model; the workflow layer wraps the result into a phased recommendation.

---

## 4. Modules and skill registry

### Active modules (v0.5.2)

**seo-rescue.** The current installable plugin. Eighteen skills and commands (one routing orchestrator plus seventeen sub-skills and recovery commands). Stable. The wedge.

### Planned modules (umbrella roadmap)

These exist as documentation in this PR; implementation lands in later versions per [ROADMAP.md](./ROADMAP.md).

- **revenue-rescue** (v0.6): bridges audit outputs to 30/60/90/180-day revenue scenarios. Commercial model + pricing logic detail moves to a v0.5.5 PR.
- **paid-media-rescue** (v0.8 docs, v0.9 read-only API beta): CSV-first Google Ads and Meta Ads account audits, search-terms waste, PMax diagnosis, creative fatigue, audience overlap, CAPI tracking audit.
- **tracking-rescue** (v0.8 docs, v0.9 beta): GA4 conversion audit, attribution confidence, consent-mode risk.
- **cro-rescue** (v0.8): landing-page diagnosis, conversion-friction audit, message-match audit, checkout-friction audit.
- **updater** (v0.5 docs in this PR are the only addition; functional implementation v0.6): review-first update checker, safe-update, rollback.

Skills that explicitly do not belong in this umbrella: content writing, brand voice, ad-creative generation, email-sequence drafting, copywriting. Those are well-covered elsewhere. Handoff boundaries are documented in section 9 (Compatibility).

### Skill registry

| Skill | Status | Input | Output | Risk | Data sensitivity |
|---|---|---|---|---|---|
| `rescue` (orchestrator) | stable | none | routing table | Low | None |
| `seo-audit-free` | stable | domain | Markdown report | Low | Public |
| `post-core-update-recovery` | stable | domain + VI trajectory + dates | Markdown plan | Low | User context |
| `seo-outreach-report` | stable | domain + API credentials (env) | 10-chapter A4 PDF ~1MB | Medium | Client-facing |
| `channel-economics-analyzer` | stable | user CSV | Markdown scorecard | Medium | High (financial) |
| `competitor-deep-audit` | stable | domain + DataForSEO creds | Markdown opportunity list | Medium | Public competitive |
| `psi-weekly-cron-baseline` | stable | domain list + PSI key | NDJSON + summary | Low | Public performance |
| `ai-search-rescue` | stable | domain + brand vars | Markdown framework | Low | None |
| `ai-citations-tracker` | beta | brand vars + OpenAI key | NDJSON history | Low | Public mention |
| `gsc-deep-dive` | beta | domain + GSC SA path | JSON snapshot | Medium | High (per-property) |

Planned skills (`sistrix-monday-recovery-check`, all v0.6+ revenue/paid/tracking/CRO/Fiverr skills) inherit the schema; entries land when the skills do.

### Status definitions

Six labels. Lifecycle progression: `planned` → `experimental` → `beta` → `stable`, with `deprecated` and `removed` as exit states.

- **planned**: documented, no implementation
- **experimental**: implementation exists, untested across real cases
- **beta**: implementation exists, used against multiple real cases, output contract provisional
- **stable**: implementation + documented contract, suitable for client deliverables, breaking changes only at major version
- **deprecated**: callable for at least one minor version after the deprecation announcement; documented in CHANGELOG with migration path
- **removed**: no longer in the repository; documented in CHANGELOG

### Release gating

A release tag cannot be pushed without:

- `claude plugin validate plugins/seo-rescue` passing locally
- `claude plugin validate .` passing locally
- Privacy scan passing (no real-client identifiers, no private brand-domain references, no credential patterns)
- Anti-overclaim grep clear of new unjustified absolutes
- CHANGELOG.md entry exists for the version

`.github/workflows/validate.yml` runs the first two gates on every push and PR. Privacy and anti-overclaim gates are documented manual steps until v0.6 adds them to CI.

---

## 5. Privacy and client data

The framework runs locally on the operator's machine. There is no hosted backend, no telemetry, no phone-home. Client data flowing through the skills stays local unless the operator explicitly invokes a script that sends to a third-party API (DataForSEO, SISTRIX, OpenAI, Perplexity, Google PSI, Google Search Console).

### What never enters tracked files

- Real client names, real domain names of real clients
- Real revenue, ad-spend, margin, conversion, or order numbers
- Real account IDs (Google Ads CID, Meta ad account, GA4 property, GSC property)
- Real campaign names
- Real email addresses
- Screenshots of real client accounts or dashboards
- Raw CSV/JSON exports from real properties
- API keys, OAuth tokens, service-account JSON contents

These rules apply to every tracked file in the public repository, every PR, every issue comment, every release note.

### Gitignored local paths

The `.gitignore` reserves these paths for local-only material:

```
private/, client-data/, real-data/, exports/private/,
lessons/private/, case-notes/private/, local-notes/,
tokens/, credentials/, sistrix-exports/, gsc-exports/,
*_sistrix*.csv, *_visibility*.csv, *_keywords*.csv, *_ranking*.csv,
.growth-survival-kit/, .seo-survival-kit/,
audit-config.json, psi-config.json, channels.json,
gsc-config.json, ai-citations-config.json,
data/, psi-history/, gsc-history/, ai-citations-history/, *.ndjson
```

Verify with `git status` before any commit if you have been working in those paths.

### Credential handling

Per skill safety primitives in `plugins/seo-rescue/lib/safe.js`, all credentials come from environment variables. The scripts hard-fail if credential fields appear in config files (the v0.3.2 external audit H2 finding). PSI API keys, DataForSEO logins, SISTRIX keys, OpenAI keys, Perplexity keys, and GSC service-account JSON paths all use env vars exclusively. `.env.example` templates carry placeholders only.

### Privacy modes

Four runtime modes shape skill behavior. Set during onboarding, overridable per session via `SEO_SURVIVAL_KIT_PRIVACY_MODE`.

| Mode | Output path | Lessons can flow to public LESSONS.md | Skill warns before each external API call |
|---|---|---|---|
| `public-synthetic-only` | as configured | yes | no |
| `anonymized-real-data` | as configured | yes, with extraction | no |
| `private-local-data` | gitignored default | no, extraction required | no |
| `sensitive-client-data` | gitignored mode-0700 hashed filename | no, maintainer review required | yes |

A session in higher-sensitivity mode cannot lower mid-session.

### Private experience layer

The framework draws on actual recovery work. The conversion from private observation to public lesson follows a strict process:

1. Inspect privately. Source data lives in any gitignored path.
2. Extract the lesson in one sentence.
3. Strip identifying detail. Numbers become magnitude bands ("low five-figure budget"), dates lose specificity ("a published Core Update"), names become roles ("the shop owner").
4. Tag with an allowed abstraction label (German D2C ecommerce case, marketplace-heavy ecommerce case, Core Update recovery case, etc.) and add applicability + non-applicability conditions and a confidence level.
5. Land the public artifact in a skill's `LESSONS.md` or in [DECISION_ENGINE.md](./DECISION_ENGINE.md). The private source stays local and is not referenced by path or hash.

### Test for anonymization

If a stranger reading the public lesson could identify the originating client through public means, the lesson is not anonymized enough. Test before publishing.

### Pattern maturity model

Patterns from real recovery work progress through five maturity stages before they can influence public recommendations.

- **Stage 1.** Observed once in a single case.
- **Stage 2.** Observed repeatedly in the same case at different time points.
- **Stage 3.** Cross-channel confirmation (the pattern explains signals visible in more than one channel).
- **Stage 4.** Reliable sequencing evidence (the pattern's recommended sequence reliably produces the expected next-stage signal).
- **Stage 5.** Operational rule candidate (the pattern can be codified into a decision rule in [DECISION_ENGINE.md](./DECISION_ENGINE.md) section 2).

Only Stage 4 and Stage 5 patterns influence public recommendations with medium confidence or higher. Earlier stages are local-only.

### Decision memory

The operator maintains a decision log in `private/decisions/` (gitignored) with per-decision entries: proposed action, why proposed, data available at the time, confidence level assessed, risk level, what was actually done, observed result, delayed effects (1-week, 1-month follow-up), whether the decision was correct in retrospect, what should have happened instead.

Decision-memory entries are the most operationally valuable source of pattern maturity progression. Repeated correct decisions on the same pattern type promote the pattern toward Stage 5.

### Failure tracking

The operator maintains a failure log in `private/failures/` (gitignored) covering: rankings that returned temporarily and disappeared, visibility improvements without revenue, revenue improvements despite visibility decline, internal-link changes with no measurable effect, 301 merges that destabilized recovery, title rewrites that caused ranking volatility, false cannibalization assumptions, SERP intent mismatches.

Failures are at least as valuable as successes for shaping decision rules. The framework explicitly tracks both.

### Confidence evolution

Confidence in a pattern increases only when the pattern repeats, outcomes are observed multiple times, multiple data sources align, sequencing logic proves reliable, and similar environments behave similarly. False certainty from one-case conclusions is the trap the maturity model exists to prevent.

### Operator handbook location

The operational detail for running the private experience layer (folder structure, pattern entry format, decision memory template, failure log template, redaction checklist) lives in `private/README.md`. That file is in `.gitignore` and is created locally by the maintainer; it does not appear in the public repository.

### Redaction guard rules

- Specific numbers replaced with magnitude bands
- Real domains replaced with reserved-TLD examples (`example-mattress-shop.test`, `example-furniture-shop.test`)
- Screenshots of any real account excluded
- Quotes from copyrighted material kept to brief titles and statistics with attribution
- API keys and tokens removed (or never present)

### Accidental commit response

If client data lands in the repo:

1. Rewrite history immediately (`git filter-repo`)
2. Force-push corrected history (requires bypassing branch protection temporarily)
3. Notify pulled-down users via release note or Discussion
4. Treat leaked credentials as compromised; rotate
5. Post-incident note describing what leaked and what process prevents recurrence

Prevention is much cheaper. The `scripts/privacy-scan.sh` stub (v0.5 doc, v0.6 implementation) and the grep snippets in this section exist to make prevention the default.

---

## 6. Adaptive user onboarding (planned, v0.6+)

**Planned for v0.6+.** This section is a specification, not a description of current runtime behavior. None of the questions, profile schema, modes, or intent-router rules below are implemented in v0.5.0. They describe what the adaptive onboarding will look like when it ships in v0.6+. For current v0.5.0 behavior, skills run with sensible defaults without an onboarding flow.

The planned framework asks what the operator wants to achieve before running anything. The answers shape workflow defaults, output format, and privacy mode.

### First-run questions (eight, all optional, "skip" always available)

1. **What do you want to do?** Recover from a traffic drop / build an audit / run the SISTRIX Monday check / forecast revenue / analyze paid-media exports / improve this plugin / other.
2. **Who are you using this as?** Solo consultant / agency owner / agency employee / in-house marketer / founder-operator / plugin developer.
3. **What type of business?** D2C ecommerce / marketplace-heavy ecommerce / SaaS / local / lead-gen / content/publisher / B2B services.
4. **What data do you have?** GSC export / SISTRIX export / GA4 / Google Ads / Meta Ads / shop export / margin data / screenshots only / full access / private notes (multi-select).
5. **What output do you want?** Quick diagnosis / detailed audit / decision-maker report / PDF / SISTRIX Monday summary / 30-60-90 plan / implementation backlog / Fiverr gig / pricing recommendation / client email / GitHub roadmap / internal SOP.
6. **Privacy level?** Public/synthetic / anonymized-real / private-local / sensitive-client / no-storage.
7. **Target market and language?** DACH / EU / US-UK / international, German / English / bilingual output.
8. **How direct should recommendations be?** Conservative / balanced / aggressive / founder-direct / client-safe-professional.

### Profile schema

The answers land in `.seo-survival-kit/profile.local.json` (gitignored). Fields:

```json
{
  "schema_version": 1,
  "intent": { "current_task": "..." },
  "user_role": { "type": "..." },
  "business_context": { "type": "...", "country": "DE", "language": "de" },
  "data_inventory": { /* booleans per data source */ },
  "output_preferences": { "format": "...", "verbosity": "...", "language": "...", "tone": "..." },
  "privacy": { "mode": "...", "output_dir": "./output", "persist_profile": true },
  "market_context": { "location_code": 2276, "currency": "EUR", "default_country_filter": "DE" },
  "recommendation_style": { "directness": "...", "include_alternatives": true, "include_uncertainty": true, "include_what_not_to_do": true },
  "telemetry": { "enabled": false }
}
```

`telemetry.enabled` is always false; no telemetry endpoint exists.

### Defaults

If no profile exists: D2C-ecommerce / DE / German output / public-synthetic-only mode / balanced tone. The defaults reflect the originating wedge. v1.0 international expansion lifts the hardcoded DE assumption per [ROADMAP.md](./ROADMAP.md).

### User modes

Workflow defaults the intent router selects from:

- **SEO Recovery Mode**: post-Core-Update, traffic drops, GSC analysis. Default skills: `post-core-update-recovery`, `gsc-deep-dive`, `psi-weekly-cron-baseline`, `seo-audit-free`, `ai-search-rescue`.
- **SISTRIX Monday Recovery Mode**: weekly recovery review. Default skill: `sistrix-monday-recovery-check` (v0.5.2).
- **Agency Delivery Mode**: client audits, PDF reports. Default skills: `seo-outreach-report`, `competitor-deep-audit`, `channel-economics-analyzer`, `psi-weekly-cron-baseline`, `gsc-deep-dive`.
- **Founder/Operator Mode**: prioritization, cost control, fast decisions on the operator's own business. Default skills: `channel-economics-analyzer`, `psi-weekly-cron-baseline`, `post-core-update-recovery`, `ai-search-rescue`.
- **Revenue Forecast Mode** (v0.6): scenario-based forecasting.
- **Fiverr Offer Mode** (v0.6+): productized service validation.
- **Paid Media Audit Mode** (v0.8 docs, v0.9 beta): CSV-first paid audits.
- **Plugin Developer Mode**: building or extending the framework.

Mode is not session-locked. The intent router switches mode based on the operator's next request, with the constraint that privacy mode never lowers within a session.

### Intent router signals

Free-form request phrases trigger mode selection. Examples: "Core Update" → SEO Recovery Mode. "Monday recovery" → SISTRIX Monday Recovery Mode. "Fiverr offer" → Fiverr Offer Mode. "Google Ads waste" → Paid Media Audit Mode. "Schema markup" or "rich results" → out-of-scope; suggest `claude-seo`.

Out-of-scope requests get an explicit "this is not the framework's focus" response with a suggested handoff per section 9 (Compatibility).

---

## 7. Knowledge layer

The framework's recommendations are calibrated to the best available evidence. Knowledge sources are weighted, attributed, and reviewed periodically.

### Source quality (four levels)

- **Level A**: official platform documentation (Google Search Central, Quality Rater Guidelines, PSI methodology, schema.org, DataForSEO docs, OpenAI/Perplexity API docs), first-party data from real projects, verified exports.
- **Level B**: strong agency case studies with disclosed methodology, conference talks with evidence, reputable industry reports.
- **Level C**: practitioner blog posts without before/after data, podcast commentary, single-case lessons from private experience not yet confirmed across multiple cases.
- **Level D**: unverified claims, forum comments, competitor marketing, weak screenshots. Generally excluded from the source registry.

Recommendations backed by A can be stated directly with high confidence. B-backed are stated as patterns. C-backed are stated as hypotheses with explicit medium confidence. D-backed are not used.

### Evidence and data combined

Overall recommendation confidence is the minimum of evidence quality and data quality. A platform-documented recommendation applied to one week of GSC data drops to low confidence. The skill output names both factors.

### Source registry approach

A maintained registry tracks sources that materially shape framework lessons. Each entry carries: type, author/org, date, public URL if available, topic, extracted lesson, applies-when conditions, does-not-apply-when conditions, confidence, related skill, last-reviewed date.

The registry is not a comprehensive bibliography. Only sources that change framework behavior appear. The registry is reviewed at each minor version; entries older than 6 months are re-checked for relevance and link rot.

### Allowed citation patterns

Allowed: titles of public talks and articles, public URLs, author names, outlet names, short factual stats with attribution, the framework's own paraphrased generalization.

Not allowed: verbatim quotes longer than a sentence or two from copyrighted material, screenshots of slides or articles or dashboards, copying agency framework names presented as proprietary, reproducing agency case studies in their entirety, posting agency-internal documents.

### Private experience integration

Anonymized lessons from real recovery work feed the registry through the [Section 5 privacy process](./ARCHITECTURE.md#5-privacy-and-client-data). Level C until confirmed across multiple cases.

---

## 8. Plugin architecture

### Current repository structure

```
seo-survival-kit/                  # Repository / marketplace name
├── .claude-plugin/
│   └── marketplace.json           # Marketplace catalog
├── .github/
│   └── workflows/validate.yml     # claude plugin validate on push/PR
├── plugins/
│   └── seo-rescue/                # Plugin (technical name)
│       ├── .claude-plugin/
│       │   └── plugin.json        # Plugin manifest (path matters — v0.2.0/v0.2.1 yanked for wrong path)
│       ├── lib/
│       │   └── safe.js            # Shared safety primitives
│       └── skills/                # 18 skills/commands (1 orchestrator + 17 sub-skills/commands)
├── exports/                       # Platform-agnostic Markdown for Cursor / Custom GPT / Gemini / Aider / Codex
├── examples/                      # Sample PDF + screenshots only (synthetic data)
├── ARCHITECTURE.md                # This document
├── RECOVERY_SYSTEM.md             # Recovery operational detail
├── DECISION_ENGINE.md             # Decision logic
├── SISTRIX_MONDAY_RECOVERY_CHECK.md  # Weekly workflow specification
├── ROADMAP.md                     # Version-by-version plan
├── ROADMAP-2026.md                # Google search future-watch (separate)
├── README.md, CLAUDE.md, ONBOARDING.md, MATURITY.md, SECURITY.md, COSTS.md, CHANGELOG.md, LICENSE
```

### Two-layer naming

Repository and marketplace are `seo-survival-kit`. The technical plugin inside is `seo-rescue`. Slash commands are namespaced `/seo-rescue:<skill>`. The split is documented at the top of README.

### Two skill types

**Pure-Markdown framework skills.** `rescue`, `post-core-update-recovery`, `ai-search-rescue`. No scripts. Cross-platform copies in `exports/`. Work in any LLM environment that supports skill loading.

**Script-backed skills.** `seo-outreach-report`, `competitor-deep-audit`, `psi-weekly-cron-baseline`, `ai-citations-tracker`, `gsc-deep-dive`, parts of `seo-audit-free`. Plain Node.js scripts invoked via `node script.js`. No `package.json`, no npm install step, no npm supply-chain surface. MCP wrapper planned for v1.0+.

### Why the unusual manifest path

The plugin manifest at `plugins/seo-rescue/.claude-plugin/plugin.json` (not at repo root) is required by the Anthropic plugin marketplace pattern. Two early tags (v0.2.0, v0.2.1) shipped un-installable because the manifest was at the wrong path. The location is enforced by `claude plugin validate` in CI.

### Future plugin-ready structure (v0.7+)

When the umbrella grows beyond `seo-rescue`, the structure expands without forcing migration:

```
growth-survival-kit/               # Separate umbrella repo
├── plugins/
│   ├── seo-rescue/                # Unchanged
│   ├── revenue-rescue/            # v0.6
│   ├── google-ads-rescue/         # v0.8
│   ├── meta-ads-rescue/           # v0.8
│   ├── tracking-rescue/           # v0.8
│   ├── cro-rescue/                # v0.8
│   └── updater/                   # v0.6
```

`seo-survival-kit` continues to exist and be installable on its own. The `/seo-rescue:` command namespace must continue to resolve; no rename for installed users.

---

## 9. Compatibility

### Claude Marketing handoff

The framework does not collide with or copy any Claude Marketing plugin that may exist.

- **Claude Marketing** (if available): content writing, campaign planning, brand voice, performance reports, email sequences, ad creative.
- **seo-survival-kit**: SEO diagnosis, SEO recovery, Core Update recovery, AI search visibility, GSC analysis, SISTRIX recovery interpretation, decision-maker reports.
- **Growth Survival Kit umbrella** (roadmap): cross-channel diagnosis, paid-media audit, tracking risk, CRO risk, revenue prioritization.

Optional handoffs are documented but not enforced as dependencies. If the framework identifies a content gap, the operator can hand off to Claude Marketing for content. If Revenue Rescue identifies an email opportunity, the operator can hand off for email sequence drafting. The framework does not auto-install or hard-depend on any other plugin.

### Cross-platform exports

Pure-Markdown framework skills live in `exports/` with platform-specific install snippets for Cursor, OpenAI Custom GPT, Gemini CLI, Aider, Continue.dev, and Codex. Script-backed skills remain Claude-Code-specific until the planned v1.0+ MCP wrapper.

### Comparable Claude Code SEO plugins

`AgriciDaniel/claude-seo` (6.9k stars): comprehensive technical audit, schema, content, GEO, e-commerce, international, PDF reports. **Use for technical audits; complementary to this framework.**

`aaron-he-zhu/seo-geo-claude-skills` (1.7k stars): 20 skills around keyword research, content writing, technical audits, rank tracking. **Use for ongoing content/keyword work.**

`zubair-trabzada/dataforseo-claude` (79 stars): DataForSEO-focused with 13 skills + 5 subagents. **Good if DataForSEO is the primary data source.**

`coreyhaines31/marketingskills` (12.9k stars): broader marketing stack (CRO, copy, paid, SEO). **Use for marketing breadth.**

This framework complements rather than competes. The narrow contribution is recovery-first decision intelligence with profit-aware prioritization and risk-aware sequencing.

---

## 10. Versioning and release process

Semantic versioning. Major for breaking changes, minor for new skills/modules, patch for fixes and docs.

### Three update channels

- **Stable**: reviewed tagged releases. Recommended for client work.
- **Beta**: recent tags with new skills or experimental workflows. Acceptable for internal testing.
- **Dev**: latest commits on `main`. Not recommended for client audits or paid-media recommendations.

### Release process

```bash
claude plugin validate plugins/seo-rescue    # plugin
claude plugin validate .                     # marketplace
# privacy scan + anti-overclaim grep
git tag -a v<X.Y.Z> -m "v<X.Y.Z> — short summary"
git push origin v<X.Y.Z>
gh release create v<X.Y.Z> --notes-file CHANGELOG-extract.md
```

`main` is branch-protected. PRs require external review per the maintainer's published collaboration model. Self-merges are blocked.

### Update policy (planned, v0.6 implementation)

Review-first update checker (no silent self-updater). Safe-update with backup, validation, and rollback. No overwriting of user data, exports, credentials, or project-specific lessons. Dry-run script stubs in `scripts/` ship in v0.5 docs only; functional implementation lands in v0.6.

---

## 11. What is intentionally NOT implemented

These are out of scope for the framework. Knowing what is not built is as important as knowing what is.

### Out of scope permanently

- Automatic ad-account writes
- Automatic budget changes
- Automatic campaign edits
- Automatic Fiverr publishing
- Automated buyer messaging
- Guaranteed rankings or guaranteed revenue
- Scraping against platform terms of service
- Hidden personalization
- Telemetry endpoints
- Phone-home behavior

### Out of scope until v1.0

- Tests with real assertions (`tests/README.md` documents the planned surface; actual cases land in v0.6+)
- MCP server wrapper for script-backed skills (pure-Markdown skills are already platform-portable via `exports/`)
- International expansion beyond German market assumptions (`location_code: 2276` is hardcoded; lifting requires the adaptive onboarding implementation to ship first)
- Full parser implementations for all input formats (data contracts documented; parsers ship as needed)
- Benchmark harness (`EVALUATION.md` planning; runtime in v0.6+)

### Out of scope until post-v1.0

- Cross-channel PDF report combining SEO, paid, tracking, CRO, revenue economics
- Local command center for parallel client engagements
- Agency internal operating system as a productized fork
- Commercial SaaS (post-v1.0 hypothesis only; would require OAuth, tenant isolation, billing, audit logs, support, compliance docs, rate-limit handling, human approval before any write action — none of which exist today)

### Out of scope for this repository specifically

- Content writing, brand voice, ad creative, email sequences, copywriting (handed off per section 9)
- Schema markup generation beyond what `seo-outreach-report` already checks (use `claude-seo:seo-schema`)
- Comprehensive technical audit of hundreds of URLs (use `claude-seo:seo-audit`)
- Tier-1 editorial coverage and brand-authority backlinks. Editorial relationships require sustained beat-coverage work over multiple years. The skill set can identify which publications a brand needs to be in and draft pitch briefs; it cannot make an editor open a stranger's email. Pair this kit with a digital-PR partner or in-house PR capacity when editorial authority is the bottleneck.

---

## 12. Roadmap pointer

Version-by-version plan lives in [ROADMAP.md](./ROADMAP.md). Highlights:

- **v0.5** (this PR): architecture, governance, privacy, adaptive onboarding, knowledge layer documented in ARCHITECTURE.md + RECOVERY_SYSTEM.md + DECISION_ENGINE.md. SISTRIX Monday Recovery Check workflow specification.
- **v0.5.1**: SISTRIX Monday Recovery Check ships as runnable skill.
- **v0.5.5**: Commercial Model PR (Revenue Rescue positioning, pricing logic, offer validation, Fiverr interface, buyer-objection log, GTM experiment template). Kept separate from technical architecture for review clarity.
- **v0.6**: Revenue Rescue runtime + safe updater implementation.
- **v0.7**: Growth Survival Kit umbrella architecture for paid-media expansion.
- **v0.8**: Paid Media CSV-first audits, tracking docs, CRO docs.
- **v0.9**: Read-only API beta (Google Ads, Meta Ads, GA4, SISTRIX).
- **v1.0**: Stable SEO module with tests, fixtures, validated output contracts, lifted DE hardcoding.

---

## 13. Appendices

### A. Glossary

- **Recovery Operating System.** Umbrella concept for the system shape: diagnostic layer + decision layer + workflow layer, recovery-first and decision-first.
- **Decision-first.** The framework focuses on what to do (and what not to do), not on what is technically wrong.
- **Recovery-first.** During active recovery, protect winners before optimizing them. Default to leave-alone, not strengthen.
- **Profit-aware prioritization.** Rank opportunities by profitable leverage (traffic × conversion × AOV × margin / effort × risk × confidence), not by search volume.
- **Risk-aware sequencing.** Order recommended actions by recovery risk and dependencies, not by ease of execution.
- **Money keyword.** A keyword where a ranking improvement directly translates to revenue (commercial intent, transactional pattern, ranks on a conversion-capable URL).
- **Recovery Signal Score.** Composite 0-100 score summarizing the strength of a recovery signal from a SISTRIX Monday comparison. Detail in [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md).
- **Winner/Loser Neutralization.** Pattern where many small/mid keyword gains are offset by a few large losses, producing a flat visibility index despite real ranking improvements. Detail in [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md).
- **Decision rule.** A short, named, source-cited rule that gates or sequences recommendations under specific conditions. Catalog in [DECISION_ENGINE.md](./DECISION_ENGINE.md).
- **Confidence (Low/Medium/High).** Output-level statement of how strong the evidence backing a recommendation is. Drops to the minimum of evidence quality and data quality.

### B. Document map

| Document | Purpose |
|---|---|
| **README.md** | Entry point. What this is, current status, install, quick reference. |
| **ARCHITECTURE.md** | This file. Canonical source of truth. |
| **RECOVERY_SYSTEM.md** | Recovery framework operational detail: protection rules, signal score, neutralization, URL recovery, recovery sequencing. |
| **DECISION_ENGINE.md** | Decision rules catalog, evidence weighting, data quality, prioritization, sequencing, cross-channel integration, profitability signals. |
| **SISTRIX_MONDAY_RECOVERY_CHECK.md** | Weekly workflow specification (CSV-first, no API). |
| **ROADMAP.md** | Version-by-version product plan. |
| **ROADMAP-2026.md** | Google search and AI search future-watch. Separate from product roadmap. |
| **CLAUDE.md** | Project instructions for Claude Code sessions. |
| **ONBOARDING.md** | 15-minute first-PDF install walkthrough. |
| **MATURITY.md** | Honest comparison with mature alternatives. |
| **SECURITY.md** | Threat model + verification + reviewer protocol. |
| **COSTS.md** | Per-audit API cost breakdown. |
| **CHANGELOG.md** | Per-release notes. |

If a concept is not in this map, it lives as a section inside one of the listed docs. Adding a new top-level doc requires it to pass the test: own workflow, own inputs, own outputs, own user interaction, meaningful implementation complexity, independent future evolution.
