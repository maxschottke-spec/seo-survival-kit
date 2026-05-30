# SEO Change Governor

Claude must not execute unbounded live changes. Every session starts in `audit_only` mode with zero change budget. Updated with practice feedback from real Shopware recovery operations and the Settlement Gate hard block.

## Modes

| Mode | Budget | Purpose |
|---|---:|---|
| `audit_only` | 0 | Analysis, crawls, reads, reports, tickets, rollback plans |
| `micro_fix` | 3 | A single very small fix (one anchor, one broken link) |
| `low_risk_fix` | 10 | Small technical corrections with clear rollback |
| `controlled_recovery` | 20 | Bounded recovery batch with pre/post QA |
| `emergency_rollback` | 30 | Stabilization and rollback only |
| `high_risk_requires_approval` | 0 | Plan only, no execution without explicit per-change approval |

Default: `audit_only`. Mode escalation requires explicit user instruction naming the mode or budget.

## Settlement Gate behavior

When a Settlement Gate is active (`settlement_gate_active = true` — see `references/SEO_SETTLEMENT_GATE.md`), mode availability collapses to a hard subset:

| Mode | Status during gate |
|---|---|
| `audit_only` | Allowed, 0 budget points |
| `emergency_rollback` | Allowed, up to 30 points, stabilization only — no new optimization in same run |
| `micro_fix` | **Blocked**, unless a verified Technical Emergency per SEO_SETTLEMENT_GATE.md section 7.A |
| `low_risk_fix` | **Blocked** |
| `controlled_recovery` | **Blocked** |
| `structural_change` | **Blocked** |
| `high_risk_requires_approval` | **Blocked** (plan-only is permitted in `audit_only`) |

Stop reason `settlement_gate_active` must be emitted when a blocked mode is attempted.

### Reserve bleibt Reserve

**Unused change budget does not roll forward as permission for additional work.** A week in which 1 of 7 points was spent does not authorize 6 more points in the next week.

The formal rule, mirrored verbatim from `SEO_SETTLEMENT_GATE.md` section 11:

> Ungenutztes CG-Budget ist kein Umsetzungsauftrag. Es darf nicht spontan für weitere SEO-Änderungen verwendet werden. Jede zusätzliche Maßnahme braucht nach Gate-Ende einen neuen Change Plan, eigene Risikopunkte, Datenbasis, Rollback-Plan und explizite Freigabe.

If the operator uses pressure phrases that imply unused budget is permission ("wir haben ja noch Budget übrig", "lass uns die Reserve nutzen", "noch schnell ein paar kleine Fixes", "falls Zeit"), Claude must respond:

> **nicht ohne neuen Change Plan und explizite Freigabe**

and stop. Stop reason: `unused_budget_is_not_permission`.

## Change Type Classification

Every planned change must be classified as one of three categories:

### A. Structural / Risky Changes

Examples: category deactivation, canonical change, URL consolidation, content rewrite, template/sitewide change, broad internal link restructure.

- Default batch limit: **3-5 URLs per day**
- Small batches mandatory
- High QA discipline required

### B. Repair / Hygiene Changes

Examples: 404 -> exact 301 redirect, removing 301->404 chain, fixing broken link, neutralizing risky anchor, fixing review-link 404.

- Higher batch limit: **up to 10 URLs per run** when ALL of:
  - Every target is HTTP 200
  - Every target is self-canonical
  - Every target is index,follow
  - Thematic fit is high confidence
  - Rollback is documented per change
  - Post-change QA runs immediately per change

Marker in Change Plan: `"repair_hygiene": true`

### C. Emergency Stabilization

Examples: rolling back a problematic live change, reactivating a URL accidentally set to 404, deactivating a redirect that creates 301->404.

- Budget up to 30 points
- Only stabilization, no new optimization
- No new SEO improvements in the same run

## Risk Points

### 0 Points (always allowed)

Analysis, crawls, API reads, Sistrix/DataForSEO/GSC queries, live HTTP checks, canonical/robots checks, QA reports, tickets, monitoring plans, rollback plans, snapshot writes to local cache.

### 1 Point

- Single anchor text fix for risk reduction (e.g., medical term)
- Single broken internal link fixed to a clear 200/self-canonical/index target
- Single broken link removed
- Single obvious typo correction

### 2 Points

- Single 301 redirect from 404 to thematically exact target
- Single CMS link added
- Single canonical fix on one page
- Single meta fix without intent change
- Broken-link redirect with 100+ inlinks and exact target (still 2 points, marked `repair_hygiene: true`)

### 3 Points

- Category with 0 products deactivated
- Single URL consolidation with clearly stronger target
- Multiple links changed in one CMS slot (up to 3 links)
- H1 fix on a single page group
- Redirect fix for a cluster of up to 3 URLs

### 5 Points

- Blog post changed with more than 3 new internal links
- Change on a page with rankings or GSC impressions
- Change on a URL with external backlinks
- Category deactivation despite existing keywords
- Canonical change on an indexed page
- Template fix affecting 5-20 pages

### 8 Points

- Change on a Top-10 ranking page
- Change on a page with significant traffic
- Plugin config with sitewide effect
- Template fix affecting more than 20 pages
- Deactivation of an indexed page with traffic
- Redirect to thematically non-exact target

### 10 Points

- Mass change affecting more than 10 URLs
- More than 10 internal links added in one run
- Multiple categories deactivated
- URL/category cluster consolidation
- Change to navigation, footer, breadcrumbs, or sitewide internal linking
- Change affecting more than 50 pages

## Multipliers

| Condition | Multiplier |
|---|---|
| Target has Top-20 keyword ranking | x2 |
| Target has external backlinks | x2 |
| Live without staging environment | x2 |
| Only medium confidence data | x1.5 |
| Medical/health-related terms involved (DACH HWG context) | x2 |
| No rollback method documented | x3 |

Final score: always round up.

## Mandatory Pre-Checks

### Shopware seo-url Pre-Check

Every plan touching `seo-url` (PATCH or POST) MUST include:

```json
{
  "requires_pre_check_for_duplicate_foreignkey_in_channel": true,
  "seo_url_precheck": {
    "foreignKey": "...",
    "routeName": "...",
    "salesChannelId": "...",
    "languageId": "...",
    "active_non_deleted_entries": 0,
    "collision_detected": false
  }
}
```

If `active_non_deleted_entries > 1` for the same foreignKey/channel/language/route context: **stop**. Reason: `shopware_seo_url_foreignkey_collision`.

### DreiscSeo Redirect Pre-Check

Every plan deactivating a category or product MUST include:

```json
{
  "requires_dreiscseo_redirect_precheck": true,
  "dreiscseo_precheck": {
    "redirects_from_url": [],
    "redirects_to_url": [],
    "would_create_301_to_404": false,
    "affected_redirect_ids": []
  }
}
```

If `would_create_301_to_404: true`: **stop**. Reason: `dreiscseo_would_create_301_to_404`.

### CMS Slot Snapshot Pre/Post

Every CMS-Slot PATCH MUST create local snapshots:

- Before: `~/.cache/seo-rescue/{slug}/snapshots/cms-slots/{slotId}-{timestamp}-before.json`
- After: `~/.cache/seo-rescue/{slug}/snapshots/cms-slots/{slotId}-{timestamp}-after.json`

Reason: Shopware does not reliably return `updatedAt` for cms-slot PATCH responses. Without snapshots the change is not audit-safe reconstructable.

### Medical Term Compliance Check

Every anchor text or content change must run terms through `references/DACH_MEDICAL_SEO_TERMS.md` risk tiers. High-risk terms require explicit approval AND verified substantiation on target page.

## Hard Stop Rules

Claude must immediately stop when:

1. User says "alles", "mach alles", "ALLESS", "alles patchen", "ja alles", "passt", "ok", "go", "mach den Rest" — or similar broad/non-specific approval (see SAFE_LIVE_CHANGE_RULES.md for full list)
2. Change budget exceeded
3. More than 5 structural URLs in one step without explicit batch plan
4. More than 10 repair-hygiene URLs in one step without explicit batch plan
5. More than 3 new internal links to a single blog post (in one run, without specific approval)
6. Live test after a change returns 404
7. A 301 -> 404 chain is created
8. Redirect target is not 200
9. Redirect target is not self-canonical
10. Redirect target has noindex or is blocked
11. Shopware API returns 500
12. Shopware seo-url state contradicts live HTTP behavior
13. DreiscSeo and Shopware seo-url produce contradictory redirects
14. Category deactivation planned without product count, keywords, inlinks, backlinks check
15. Medical or legally risky term involved without compliance verification
16. Sitewide plugin/template fix without explicit approval
17. **NEW**: seo-url PATCH without `seo_url_precheck`
18. **NEW**: Category/product deactivation without `dreiscseo_precheck`
19. **NEW**: CMS-Slot PATCH without before/after snapshot
20. **NEW**: New High-Risk medical term being introduced as anchor without substantiation
21. **NEW**: `settlement_gate_active = true` and attempted mode is not in `allowed_modes` (audit_only, emergency_rollback) without an Explicit Emergency Approval per `SEO_SETTLEMENT_GATE.md` section 7
22. **NEW**: Attempt to spend unused budget as permission (the "Reserve bleibt Reserve" rule). Phrases like "Budget übrig", "Reserve nutzen", "noch schnell", "falls Zeit", "weitere kleine Fixes" trigger this stop
23. **NEW**: Operator pressure phrases ("sollen wir noch optimieren?", "mach weiter", "warum sind Klicks niedrig?", "lass Titles ändern", "noch Links setzen", "alles fixen", "was kann ich noch machen?") arrive during an active Settlement Gate and no Technical Emergency / new data signal is present
24. **NEW**: Hypothesis Verification Gate is not at `verified` or `fixed` for the cause being addressed. Live fixes targeting a `suspected` or `likely` cause are blocked regardless of how internally consistent the hypothesis appears. See `references/HYPOTHESIS_VERIFICATION_GATE.md`. The hypothesis status must be present and equal to `verified` (or higher) in any change plan referencing a root cause; planned changes referencing a hypothesis below `verified` produce an automatic stop with output template "hypothesis_status_below_verified".
25. **NEW**: Fix scope expansion beyond the verified scope. If a hypothesis is `verified` for a specific URL set or component scope, and the proposed change plan addresses URLs or components outside that scope, the expanded portion resets to `likely` and stops the plan for that portion. The verified portion may still proceed with a smaller-scope plan.
26. **NEW**: Verification relies exclusively on weak-tier sources. Open-source source-code reading alone, pattern matching alone, AI reasoning chain alone, or timing correlation alone is insufficient to produce `verified` status. The change plan must cite at least one strong-tier or strongest-tier verification source (direct API state read, server file inspection, GSC URL Inspection, staging reproduction, operator/developer inspection).

### Stop Output Format

```
1. Why execution was stopped
2. Which changes have already been executed
3. Which changes were still planned
4. Current live status of all affected URLs
5. Risks
6. Rollback plan
7. What explicit approval would be needed to continue
```

## Change Plan Format

```json
{
  "schema_version": "1.1.0",
  "mode": "controlled_recovery",
  "change_budget": 20,
  "planned_changes": [
    {
      "id": "change-001",
      "type": "redirect",
      "change_category": "repair_hygiene",
      "target": "/example-url/",
      "description": "...",
      "risk_points_base": 2,
      "multipliers": ["live_no_staging"],
      "risk_points_final": 4,
      "data_sources": ["Screaming Frog", "Live HTTP", "Shopware API"],
      "confidence": "high",
      "rollback_method": "PATCH seo-url isDeleted:true",
      "requires_explicit_approval": true,
      "requires_pre_check_for_duplicate_foreignkey_in_channel": true,
      "seo_url_precheck": { "...": "..." },
      "requires_dreiscseo_redirect_precheck": false,
      "compliance_review": "none",
      "medical_terms_detected": [],
      "hypothesis_id": "hvg-canonical-doppel-blog-detail",
      "hypothesis_status": "verified",
      "hypothesis_verified_by": "developer",
      "fix_scope_matches_verified": true
    }
  ],
  "total_risk_points": 4,
  "budget_remaining": 16,
  "stop_required": false,
  "stop_reasons": [],
  "hypothesis_verification_gate": {
    "all_planned_changes_verified": true,
    "below_verified_count": 0,
    "scope_expansions_blocked": []
  }
}
```

Every entry in `planned_changes` must reference a `hypothesis_id` that exists in the run's hypothesis registry (see `schemas/hypothesis-verification.schema.json`) and carry `hypothesis_status` equal to `verified` or `fixed`. Entries referencing a hypothesis below `verified` are rejected by Hard Stop rule 24. Entries whose target URLs or components exceed the verified `fix_scope` are rejected by Hard Stop rule 25.

## Post-Change QA Format

```json
{
  "change_id": "change-001",
  "status": "success|partial|failed",
  "live_checks": {
    "http_status": 301,
    "final_url": "/target/",
    "final_status": 200,
    "canonical": "self",
    "robots": "index,follow",
    "broken_links_introduced": 0
  },
  "snapshots": {
    "before_path": "...",
    "after_path": "..."
  },
  "unexpected_effects": [],
  "rollback_needed": false
}
```

## See Also

- `references/SEO_SETTLEMENT_GATE.md` — Settlement Gate definition, exceptions, unlock criteria
- `references/HYPOTHESIS_VERIFICATION_GATE.md` — Hypothesis Verification Gate concept, status values, verification source hierarchy
- `references/SAFE_LIVE_CHANGE_RULES.md` — Approval validation, standard gate response
- `references/SHOPWARE_SEO_PATTERNS.md` — seo-url collision details
- `references/DREISCSEO_PATTERNS.md` — DreiscSeo redirect layer
- `references/DACH_MEDICAL_SEO_TERMS.md` — Medical term risk tiers
- `references/SEO_CHANGE_HISTORY.md` — NDJSON logging requirements
- `schemas/recovery-gate.schema.json` — Gate state object schema
- `schemas/hypothesis-verification.schema.json` — Hypothesis entry schema
