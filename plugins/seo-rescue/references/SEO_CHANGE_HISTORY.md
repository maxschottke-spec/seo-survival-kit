# SEO Change History

Every SEO-relevant live change must be documented before and after execution.

## Storage

```
~/.cache/seo-rescue/{slug}/change-history.ndjson
```

Append-only NDJSON. One line per change. Never edit or delete entries.

## Snapshots (CMS-Slot Required)

CMS-Slot PATCH operations have an additional requirement because Shopware does not reliably return `updatedAt` in the API response. Without snapshots, the change is not audit-safe reconstructable.

### Snapshot Paths

```
~/.cache/seo-rescue/{slug}/snapshots/cms-slots/{slotId}-{timestamp}-before.json
~/.cache/seo-rescue/{slug}/snapshots/cms-slots/{slotId}-{timestamp}-after.json
```

Snapshots must contain the complete slot data including `config`, `data`, and any plugin-specific fields.

## Change Log Entry Schema

Each line conforms to `schemas/change-log-entry.schema.json`.

### Required Fields

```json
{
  "schema_version": "1.1.0",
  "run_id": "uuid-of-session",
  "change_id": "change-001",
  "timestamp": "2026-05-27T19:43:15Z",
  "domain": "example-shop.com",
  "actor": "claude|script|human|unknown",
  "mode": "audit_only|micro_fix|low_risk_fix|controlled_recovery|emergency_rollback",
  "change_type": "redirect|category_status|product_status|cms_slot|internal_link|anchor_text|plugin_config|canonical|h1|template|cache|other",
  "change_category": "structural|repair_hygiene|emergency_stabilization",
  "entity_system": "shopware|dreiscseo|nginx|cms|plugin|filesystem|unknown",
  "entity_id": "shopware-entity-uuid-or-path",
  "url": "/affected-url/",
  "before": {},
  "after": {},
  "risk_points_final": 2,
  "data_sources": ["Screaming Frog", "Live HTTP Check", "Shopware API"],
  "confidence": "high|medium|low",
  "approval": {
    "required": true,
    "received": true,
    "approved_by": "user",
    "approval_text": "...",
    "validation": {
      "is_valid": true,
      "matched_elements": ["number", "type", "permission"]
    }
  },
  "pre_checks": {
    "http_status": null,
    "canonical": null,
    "robots": null,
    "inlinks": null,
    "backlinks": null,
    "keywords": null,
    "seo_url_precheck": null,
    "dreiscseo_precheck": null,
    "compliance_check": null
  },
  "post_checks": {
    "http_status": null,
    "final_status": null,
    "canonical": null,
    "robots": null,
    "broken_links_introduced": null,
    "unexpected_effects": []
  },
  "snapshots": {
    "before_path": null,
    "after_path": null,
    "content_hash_before": null,
    "content_hash_after": null
  },
  "cms_slot_metadata": {
    "slot_id": null,
    "cms_page_id": null,
    "section_id": null,
    "block_id": null,
    "urls_affected": [],
    "changed_links": [],
    "changed_anchors": [],
    "link_count_before": null,
    "link_count_after": null
  },
  "rollback": {
    "possible": true,
    "method": "...",
    "estimated_minutes": 5
  },
  "decision": "keep|observe|fix|rollback|dev_ticket|ignore",
  "notes": []
}
```

## Rules

1. Every live write operation produces at least one entry.
2. **Failed write attempts** (API 500, wrong slug, permission denied) must be logged with `"status": "failed"` in `after`.
3. Cache deletes count as `change_type: "cache"`.
4. If previous state is unknown, set `"before": {"unknown": true}`.
5. **CMS-Slot patches MUST have before/after snapshots**. Without snapshots: change is not audit-safe.
6. If no change-history.ndjson exists when `recovery-audit` runs, set `not_audit_safe_reconstruction: true`.
7. Entries are never edited. Corrections are new entries referencing the original `change_id`.
8. `run_id` groups all changes from a single session/command invocation.
9. `risk_points_final` must be calculated per SEO_CHANGE_GOVERNOR.md before execution.
10. **For seo-url operations**: `seo_url_precheck` must be populated in `pre_checks`.
11. **For category/product deactivations**: `dreiscseo_precheck` must be populated in `pre_checks`.
12. **For medical/health terms**: `compliance_check` must be populated in `pre_checks`.

## Post-Change QA Entry

Immediately after each live change, append a QA confirmation:

```json
{
  "change_id": "change-001",
  "qa_timestamp": "2026-05-27T19:43:45Z",
  "status": "success|partial|failed",
  "live_checks": {
    "http_status": 301,
    "final_url": "/target/",
    "final_status": 200,
    "canonical": "self",
    "robots": "index,follow",
    "broken_links_introduced": 0
  },
  "unexpected_effects": [],
  "rollback_needed": false
}
```

## Reconstruction Priority

When `change-history.ndjson` is missing or incomplete, `recovery-audit` reconstructs from these sources, **in priority order**:

1. `change-history.ndjson` (primary, audit-safe)
2. Local `snapshots/` directory (CMS-Slot reconstructions)
3. Shopware API `updatedAt` fields (seo-url, category, product, cms-slot, system-config, dreisc-seo-redirect)
4. Shell history / Claude logs (if accessible)
5. Shopware current state vs known snapshots
6. Screaming Frog crawl diffs (multiple crawls)
7. Live HTTP checks (current state)
8. DataForSEO / Sistrix / GSC snapshots
9. Manual derivation

Reconstructed entries must be marked:

```json
{
  "reconstructed": true,
  "reconstruction_sources": ["shopware_updatedAt", "live_http"],
  "reconstruction_confidence": "medium",
  "audit_source": "shopware_updatedAt_reconstruction"
}
```

## Audit Gap Markers

Common audit gaps and their markers:

| Marker | Trigger |
|---|---|
| `cms_slot_missing_snapshot` | CMS-Slot PATCH without before/after snapshot |
| `previous_session_not_available` | Prior Claude session has no history |
| `dreiscseo_state_not_tracked` | DreiscSeo redirect change without log |
| `shopware_api_no_updatedAt` | Entity does not expose updatedAt reliably |
| `manual_admin_change` | Change made via Shopware Admin UI, not API |
| `external_redirect_layer` | Nginx/CDN rule applied outside Shopware |

## See Also

- `references/SEO_CHANGE_GOVERNOR.md` — Risk points + change plan
- `references/SAFE_LIVE_CHANGE_RULES.md` — Approval validation
- `schemas/change-log-entry.schema.json` — JSON Schema for entries
- `schemas/seo-change-audit.schema.json` — JSON Schema for audit output
