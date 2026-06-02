# Plugin: Shopware Native seo-url

Shopware 6 core URL routing system. Not a third-party plugin, but documented here for symmetry with other plugin references.

## Purpose

Maps URL slugs to internal entity routes (products, categories, landing pages, blog posts).

## Relevant Entity

| Entity | API Path |
|---|---|
| `seo-url` | `/api/seo-url` |

## Key Fields

See `references/SHOPWARE_SEO_PATTERNS.md` for the canonical field documentation.

## Critical Constraint (Undocumented)

Shopware allows **at most one non-deleted `seo-url` entry per `foreignKey` per `salesChannelId` per `languageId` per `routeName`**.

Attempting to create or PATCH a second non-deleted entry to the same context returns **HTTP 500**.

## Mandatory Pre-Check Before seo-url PATCH/POST

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

Pre-check query:

```
GET /api/seo-url?filter[foreignKey]={fk}&filter[salesChannelId]={sc}&filter[languageId]={lang}&filter[routeName]={route}&filter[isDeleted]=false
```

If `active_non_deleted_entries > 1`: do not proceed. Set `collision_detected: true`.

## Stop Rules Specific to seo-url

| Stop Reason | Trigger |
|---|---|
| `shopware_seo_url_foreignkey_collision` | Multiple active entries for same foreignKey/channel/language context |
| `shopware_seo_url_wrong_channel` | Entry exists but in headless API channel, not live storefront |
| `shopware_seo_url_slug_mismatch` | Entry slug does not match request URL path |
| `shopware_seo_url_cache_stale` | Live HTTP shows different state than API |

## Live-Check Pattern

After every seo-url PATCH/POST:

```bash
# Clear cache
curl -X DELETE https://domain/api/_action/cache -H "Authorization: Bearer ..."

# Wait briefly
sleep 2

# Live verify
curl -o /dev/null -w "%{http_code}|%{redirect_url}" --max-redirs 0 "https://domain/{slug}"
```

Live status MUST match the intended state. If not:
- Check sales channel
- Check slug exact match (case-sensitive, trailing slash)
- Check for collisions
- Check for DreiscSeo conflict

## Rollback

```
PATCH /api/seo-url/{id}
{ "isDeleted": true }
```

Sets entry to deleted state. URL returns 404 (assuming no other rules fire).

To restore previous redirect state, store before-snapshot of the entry in change-history.

## Common Failure Mode: API 500 Cascade

When patching multiple seo-url entries to point to the same target in one batch:
- First PATCH succeeds
- Subsequent PATCHes return HTTP 500 (collision constraint)
- Batch appears partially successful but is inconsistent

**Mitigation**: Process one PATCH at a time. After each: pre-check the next.

## See Also

- `references/SHOPWARE_SEO_PATTERNS.md` — Detailed behavior documentation
- `references/plugins/DREISCSEO.md` — Interaction with DreiscSeo redirect layer
