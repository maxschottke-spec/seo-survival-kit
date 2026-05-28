# DreiscSeo Redirect Patterns

DreiscSeo Pro is a separate redirect layer in Shopware 6 with its own entity (`dreisc-seo-redirect`). It operates independently of Shopware's native `seo_url` table and can produce redirects even when no `seo-url` entry exists.

## Why This Matters

In real recovery operations, 301 -> 404 chains were traced to DreiscSeo redirects, not Shopware `seo_url` entries. The `seo_url` table showed `isDeleted: true` for the source URL, but live HTTP returned 301 because DreiscSeo was still active.

**Operational rule**: Never deactivate a category without checking the DreiscSeo redirect table first.

## Entity Structure

```
/api/dreisc-seo-redirect/{id}
```

Key fields:
| Field | Purpose |
|---|---|
| `sourcePath` | The URL slug that triggers the redirect (case-insensitive matching) |
| `redirectPath` | The target URL the redirect points to |
| `redirectHttpStatusCode` | "301" or "302" |
| `active` | Whether the redirect is currently firing |
| `sourceSalesChannelDomainId` | Which storefront domain |
| `redirectSalesChannelDomainId` | Target domain (usually same) |
| `sourceType` | "url" or "category" or "product" |
| `redirectType` | "url" or "category" or "product" |

## Mandatory Pre-Checks Before Category/Product Deactivation

Every plan that deactivates a category or product must include a DreiscSeo pre-check:

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

### Check 1: Redirects FROM the URL being deactivated

Query: `dreisc-seo-redirect?filter[sourcePath]={url-slug}`

If `active: true` entries exist: these redirects will continue firing after deactivation. The redirect target must be verified live.

### Check 2: Redirects TO the URL being deactivated

Query: `dreisc-seo-redirect?filter[redirectPath]={url-slug}`

If `active: true` entries exist: deactivating the category will turn these into **301 -> 404 chains**. This is the critical pattern.

**Stop rule**: If Check 2 finds active redirects, do NOT proceed with deactivation. Either:
1. Deactivate the DreiscSeo redirects first (PATCH `active: false`), then deactivate the category, OR
2. Redirect the DreiscSeo entries to a different (still-active) target, OR
3. Cancel the deactivation plan

### Check 3: Chain detection

Trace each DreiscSeo redirect's target to its final destination. If the chain ends in a planned-deactivation URL, flag as `would_create_301_to_404`.

## Case-Insensitive Matching Trap

DreiscSeo matches `sourcePath` case-insensitively. This means:
- `Blog/article/` and `blog/article/` are treated as the same source
- A redirect from `/blog/` to `/Blog/` creates an **infinite redirect loop**

**Never** create DreiscSeo redirects where source and target differ only in case. Use Nginx-level case normalization instead.

## Stop Rules

| Condition | Stop Reason |
|---|---|
| Category deactivation planned without DreiscSeo pre-check | `dreiscseo_precheck_missing` |
| Category deactivation would create 301 -> 404 chain | `dreiscseo_would_create_301_to_404` |
| Redirect target is itself a 301 (chain detected) | `dreiscseo_redirect_chain` |
| Source and target differ only in case | `dreiscseo_case_loop_risk` |

## Verification Pattern

For every category/product status change:

1. Pre-check: query DreiscSeo redirects (both `sourcePath` and `redirectPath` filters)
2. Document `would_create_301_to_404` in Change Plan
3. If chain would form: fix DreiscSeo redirects first, then proceed
4. After change: live HTTP check on the source URL to confirm clean 404 (or correct redirect)

## Common Failure Mode

```
Before:
  /category-a/  (active) -> 200
  DreiscSeo: /old-variant/ -> /category-a/  (active, 301)

Action: PATCH /category-a/ active:false

After (BAD):
  /category-a/  -> 404 (correct)
  /old-variant/ -> 301 -> /category-a/ -> 404 (chain!)
```

The fix is to deactivate the DreiscSeo redirect (`active: false`) before or simultaneously with the category deactivation. After both: `/old-variant/` returns clean 404 (no chain).

## Audit Reconstruction

When auditing past changes without change-history:
1. Query `dreisc-seo-redirect` for entries with `active: false` and recent `updatedAt`
2. Cross-reference with category deactivations in the same time period
3. Mark as `reconstructed: true, reconstruction_confidence: medium`

## See Also

- `references/SHOPWARE_SEO_PATTERNS.md` — Shopware native `seo-url` patterns
- `references/plugins/DREISCSEO.md` — Plugin-specific config and tables
- `docs/TROUBLESHOOTING.md` — DreiscSeo 301->404 chain section
