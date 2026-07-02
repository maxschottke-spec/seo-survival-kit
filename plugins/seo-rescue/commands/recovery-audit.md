---
description: "Audit all SEO changes made to a domain within a given period. Read-only audit_only mode."
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, mcp__*
---

# recovery-audit

Audit all SEO changes made to a domain within a given period. Read-only command — always `audit_only` mode, change budget 0.

## Trigger

```
/seo-rescue:recovery-audit <domain> --days 14
```

## Mode

Always `audit_only`. Change budget: 0. No live writes except report artifacts to `~/.cache/seo-rescue/{slug}/`.

## Reconstruction Priority

When `change-history.ndjson` is missing or incomplete, reconstruct from these sources **in priority order**:

1. `~/.cache/seo-rescue/{slug}/change-history.ndjson` (primary, audit-safe)
2. `~/.cache/seo-rescue/{slug}/snapshots/` (local CMS-Slot snapshots and other before/after artifacts)
3. **Shopware API `updatedAt` fields** with `--days` filter on:
   - `seo-url`
   - `category`
   - `product`
   - `cms-slot` (note: not reliable — see audit gap markers)
   - `system-config`
   - `dreisc-seo-redirect`
4. Shell history / Claude conversation logs (if accessible)
5. Shopware current state vs known snapshots
6. Screaming Frog crawl diffs (compare multiple crawls if available)
7. Live HTTP checks (current state)
8. DataForSEO / Sistrix / GSC snapshots
9. Manual derivation from operator memory or notes

### Reconstruction Markers

Every reconstructed entry must include:

```json
{
  "reconstructed": true,
  "reconstruction_sources": [...],
  "reconstruction_confidence": "high|medium|low",
  "audit_source": "shopware_updatedAt_reconstruction"
}
```

When change-history.ndjson is fully missing, set in audit output:

```json
{
  "not_audit_safe_reconstruction": true
}
```

## Audit Gap Markers

Common gaps that recovery-audit must flag explicitly:

| Marker | Description | Severity |
|---|---|---|
| `cms_slot_missing_snapshot` | CMS-Slot PATCH detected via crawl/state but no snapshot | high |
| `previous_session_not_available` | Prior Claude session has no logged history | medium |
| `dreiscseo_state_not_tracked` | DreiscSeo redirect change without log | medium |
| `shopware_api_no_updatedAt` | Entity does not reliably expose updatedAt | medium |
| `manual_admin_change` | Change made via Shopware Admin UI, not API | high |
| `external_redirect_layer` | Nginx/CDN rule applied outside Shopware | high |

## Mandatory Audit Fields

The audit must record for every detected change:

- Change inventory (table)
- Failed change attempts (API 500s, wrong slugs)
- Unverified changes (detected via API state but not live-confirmed)
- Risk assessment (total risk points consumed)
- Approval compliance (changes executed without proper approval)
- Rollback readiness (changes without documented rollback)
- **Shopware seo-url collisions detected** (entities with multiple non-deleted entries per foreignKey)
- **DreiscSeo 301->404 chains detected**
- **Medical/compliance term flags**
- Recommendations (keep / observe / fix / rollback / dev_ticket)

## Settlement Gate Detection

The audit must detect:

- **Last Major Batch** — most recent session that crossed the trigger thresholds in `references/SEO_SETTLEMENT_GATE.md` section 3
- **Number of changes** in that batch
- **Change Budget consumed** — total risk points across the batch
- **Settlement Gate Status** — active / ended / never_triggered
- **Current Unlock Level** — `blocked | partial | open` per `schemas/recovery-gate.schema.json`
- Whether any further live changes are currently permitted

If the audit detects a Major Batch that was not previously logged with `triggered_settlement_gate: true`, it must:

1. Compute `started_at`, `minimum_until`, `recommended_until`
2. Write `~/.cache/seo-rescue/{slug}/recovery-gate.json` with `settlement_gate_active: true` and back-dated values
3. Append a `gate_activated` event to the gate's `gate_history`
4. Emit a finding `gate_activated_retroactively` with severity `high`

The audit output must include a `settlement_gate` block:

```json
{
  "settlement_gate": {
    "settlement_gate_active": true,
    "started_at": "2026-05-27T19:43:00Z",
    "minimum_until": "2026-06-02T00:00:00Z",
    "recommended_until": "2026-06-06T00:00:00Z",
    "unlock_status": "blocked",
    "missing_unlock_criteria": [
      "time_minimum_until_passed",
      "gsc_post_batch_pull",
      "screaming_frog_post_batch_crawl",
      "re_evaluation_report_written"
    ],
    "allowed_actions": [
      "read_only_analysis",
      "rollback_plan",
      "schema_draft",
      "briefing"
    ],
    "blocked_actions": [
      "title_rewrite",
      "new_internal_links",
      "cms_slot_patch",
      "category_deactivation",
      "linkblock_reduction"
    ],
    "next_allowed_review_date": "2026-06-06",
    "retroactively_activated": false
  }
}
```

This block is required even when no Settlement Gate is active. In that case all flags are `false` / `null` / `"never_triggered"` and the audit explicitly records that no Major Batch was detected in the period.

## Output

```
~/.cache/seo-rescue/{slug}/change-audit.json    (schema: seo-change-audit.schema.json)
~/.cache/seo-rescue/{slug}/change-audit.md       (human-readable report)
```

## Output Schema (Required Fields)

Per `schemas/seo-change-audit.schema.json`:

- `schema_version`
- `run_id`
- `domain`
- `period_start`
- `period_end`
- `status`
- `data_quality`
- `confidence`
- `not_audit_safe_reconstruction`
- `sources_checked` (array of consulted sources)
- `missing_sources` (array of sources not available)
- `changes` (array of change-log entries)
- `failed_change_attempts` (API errors, wrong slugs, etc.)
- `unverified_changes` (detected but not live-confirmed)
- `audit_gaps` (explicit gap markers with severity)
- `findings` (synthesized observations)
- `risks` (current risks, severity-classified)
- `tickets` (dev/operator tickets generated)
- `monitoring_plan` (post-audit monitoring schedule)
- `rollback_matrix` (per-change rollback methods)
- `summary` (aggregate statistics)
- `settlement_gate` (Settlement-Gate-Status-Block per `schemas/recovery-gate.schema.json`)
- `hypothesis_registry` (Array of hypothesis entries per `schemas/hypothesis-verification.schema.json`, one per identified root cause; mandatory for any change in `changes[]` or `unverified_changes[]` that has a cause attribution)

## Hypothesis Verification Gate

The audit must emit a `hypothesis_registry` array. For every cause attribution that the audit identifies (whether to a successful change, a failed change, or an open risk), the registry contains a hypothesis entry per `schemas/hypothesis-verification.schema.json`.

The audit itself does not move a hypothesis to `verified` — it only records the status it observes. Specifically:

- If the audit finds a change in `changes[]` with a documented cause-attribution but no strong-tier verification source, the hypothesis is recorded as `likely` regardless of whether the change appeared to succeed
- If the audit finds a change with strong-tier verification (file inspect, API state, GSC URL Inspection, staging reproduction, operator/developer review) cited in the change log, the hypothesis is recorded as `verified` or `fixed` depending on post-deploy state
- If the audit finds an `unverified_change` (change occurred but cause unclear), the hypothesis is recorded as `suspected` with the observed evidence noted
- If a change in `changes[]` was deployed without any hypothesis verification at all, the audit must add an `audit_gap` entry of severity `high` with marker `hypothesis_verification_missing`

This registry feeds downstream commands: `recovery-plan` reads it to determine which planned actions reference verified causes (and are therefore live-fix-eligible) versus which reference suspected/likely causes (which must remain in fix-planning state only).

## Integration with Other Commands

- `recovery-plan` references audit findings when planning next steps
- `recovery-full` must run `recovery-audit` before executing any changes
- `recovery-monitor` checks whether changes are producing expected effects, using audit baseline

## See Also

- `references/SEO_CHANGE_HISTORY.md` — NDJSON logging spec
- `references/SHOPWARE_SEO_PATTERNS.md` — Shopware-specific reconstruction patterns
- `references/DREISCSEO_PATTERNS.md` — DreiscSeo redirect audit patterns
- `references/SEO_SETTLEMENT_GATE.md` — Settlement Gate, Major Batch trigger thresholds, unlock criteria
- `references/HYPOTHESIS_VERIFICATION_GATE.md` — Hypothesis verification status definitions and verification source hierarchy
- `schemas/seo-change-audit.schema.json` — Output JSON Schema
- `schemas/recovery-gate.schema.json` — Gate state schema
- `schemas/hypothesis-verification.schema.json` — Hypothesis registry entry schema
