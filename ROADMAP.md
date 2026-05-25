# Product Roadmap

Version-by-version plan for the seo-survival-kit and the larger [Recovery Operating System](./ARCHITECTURE.md) umbrella. Companion to [ROADMAP-2026.md](./ROADMAP-2026.md), which tracks Google search and AI search direction (separate from the product roadmap).

All versions before v1.0 are public beta. Breaking changes are possible between minor versions. Pin to a tag for reproducible installs.

## v0.4.1 (shipped)

Ten skills (one orchestrator plus nine sub-skills). Cross-platform exports for Cursor, Custom GPT, Gemini CLI, Aider, Codex. Two external security audit rounds closed. Anthropic plugin marketplace submission pending review.

See [CHANGELOG.md](./CHANGELOG.md) for the per-release history.

## v0.5.0-dev (this PR)

Architecture consolidation. No new runtime skills. Documentation reaches canonical-source-of-truth state in [ARCHITECTURE.md](./ARCHITECTURE.md).

Scope:

- [ARCHITECTURE.md](./ARCHITECTURE.md) as canonical source of truth: vision, positioning (ecommerce/D2C wedge), system shape, modules, skill registry, governance, privacy posture, adaptive onboarding, knowledge layer, plugin architecture, compatibility, versioning, what is intentionally not implemented
- [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) for recovery operational detail: six-stage recovery framework, Recovery Risk Engine, Money Keyword Protection, Winner/Loser Neutralization, URL Recovery Analysis, Recovery Signal Score, five-phase recovery sequencing
- [DECISION_ENGINE.md](./DECISION_ENGINE.md) for decision logic: decision rules catalog, evidence weighting, data quality layer, profitability signals, prioritization, sequencing constraints, cross-channel signals, channel conflict resolution
- [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) workflow specification (skill implementation in v0.5.1)
- README, CLAUDE, MATURITY reconciled: skill count fixed to 10, version status updated to v0.5-dev, ecommerce/D2C positioning, anti-overclaim wording
- `.gitignore` extended for private data paths
- Public `matze-matratze.de` references in SKILL.md files replaced with reserved-TLD example domains
- `gsc-deep-dive` SKILL.md gets explicit Google AI Studio default-project warning addressing real-user issue [#26](https://github.com/maxschottke-spec/seo-survival-kit/issues/26)

Not in this PR (deliberately deferred):

- No new runnable skills
- No live API integrations beyond what exists
- No SaaS scaffolding
- No automatic ad changes
- Commercial model docs (Revenue Rescue positioning, pricing logic, offer validation, Fiverr interface, buyer-objection log, GTM experiment template) move to a v0.5.5 PR for separate review
- Test/fixture/example/contract scaffolding not added (documented in ARCHITECTURE as planned)
- Updater scripts not added (planned for v0.6 functional implementation)

## v0.5.1

SISTRIX Monday Recovery Check ships as runnable skill.

Scope:

- Skill implementation matching the specification in [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md)
- CSV-first input. No SISTRIX API requirement.
- Output follows the documented contract: executive summary, recovery stage, Recovery Signal Score, visibility-index interpretation, top winners, top losers, money keyword protection list, URL-level recovery table, GSC cross-check if available, recommended action (Observe/Protect/Strengthen/Investigate/Correct/Escalate), what not to touch, next-7-day monitoring plan, next-Monday checklist
- Synthetic example folder `examples/synthetic-sistrix-monday-check/` with input shape and expected output

## v0.5.5

Commercial Model PR (separate from v0.5 to keep technical architecture review clean).

Scope:

- COMMERCIAL_MODEL.md or equivalent positioning doc: agency model, decision-first principles, productized offer hypotheses, service model stages, implementation partner model
- Revenue Rescue positioning, pricing logic, offer validation framework, scenario planning
- Fiverr Interface: planned commands, buyer-objection log schema, GTM experiment template
- All pricing in hypothesis form. No proven-benchmark claims.

## v0.6

Revenue Rescue runtime + safe updater implementation.

Scope:

- `revenue-opportunity-forecast` skill: 30/60/90/180-day horizon scenarios, three-scenario format (conservative/base/aggressive)
- Contribution-margin-aware prioritization in shared scoring utility
- `safe-update`, `check-updates`, `rollback-update` scripts with functional implementations (dry-run stubs land in v0.5 docs)
- First evaluation fixtures for the calculation logic

## v0.7

Growth Survival Kit umbrella architecture for paid-media expansion.

Scope:

- Document larger umbrella module map without forcing migration
- Paid-media expansion plan
- Tracking rescue plan
- CRO rescue plan
- Cross-channel report outline
- All new modules roadmap-only unless implemented

## v0.8

Paid Media CSV-first audits. Read-only, CSV-first. No write actions. No budget changes.

Scope:

- `google-ads-csv-account-audit`: account-level audit from CSV exports
- `search-terms-waste-analyzer`
- `pmax-diagnosis`
- `landing-page-gap-check`
- `merchant-feed-audit`
- `meta-ads-csv-account-audit`
- `creative-fatigue-check`
- `audience-overlap-check`
- `capi-tracking-audit` planning

## v0.9 (beta)

Read-only API integrations. OAuth and token handling enter the codebase for the first time, behind explicit user activation.

Scope:

- Read-only Google Ads integration
- Read-only Meta Ads integration
- Read-only GA4 integration
- Optional read-only SISTRIX API
- OAuth and token handling
- Rate-limit handling
- Local credential safety
- No write actions anywhere

## v1.0

Stable SEO module. Tagged release suitable for client work without per-release manual review.

Scope:

- Documentation complete and reconciled
- Tests, fixtures, expected-output assertions exist
- Output contracts stable
- Maturity policy stable
- Security policy stable
- Updater validation in CI
- Privacy scan in CI
- 5+ entries in each LESSONS.md
- At least one external contributor PR merged besides security collaborator
- DE hardcoding (`location_code: 2276`) lifted to user-configurable

## Post-v1.0 (hypothesis only)

Direction depends on adoption, feedback, contribution capacity. None of the following is committed scope.

- Cross-channel PDF report combining SEO, paid, tracking, CRO, revenue economics
- Local command center for agencies with parallel client engagements
- Agency internal operating system as productized fork pattern with templates and SOPs
- MCP / data connector layer wrapping the script-backed skills for non-Claude environments beyond the current pure-Markdown exports
- Commercial SaaS only as future possibility; would require OAuth, tenant isolation, billing, audit logs, support, compliance docs, rate-limit handling, human approval before any write action

## What stays out of scope

- Automatic ad-account writes. Automatic budget changes.
- Guaranteed rankings or guaranteed revenue.
- Scraping against platform terms of service.
- Private client data in public repository files.
- Hidden personalization. Silent updates.
- Replacement for comprehensive audit suites like `claude-seo` (this kit complements, it does not replace).
