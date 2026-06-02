# Shopware SEO Patterns

Shopware 6 specific SEO behaviors, traps, and verification patterns. Authoritative source for Shopware-specific checks during `recovery-crawl`, `recovery-plan`, and `recovery-audit`.

## seo-url Entity

Shopware stores URL routing in the `seo_url` table. Each entry maps a `seoPathInfo` (URL slug) to a `foreignKey` (category/product UUID) via a `pathInfo` (internal route).

### Key Fields

| Field | Purpose | Trap |
|---|---|---|
| `seoPathInfo` | URL slug the visitor sees | Case-sensitive. `/Blog/` and `/blog/` are different entries |
| `foreignKey` | Target entity UUID | Changing this creates a redirect |
| `pathInfo` | Internal route (`/navigation/{uuid}`) | Must match `routeName` semantics |
| `routeName` | Route type (e.g., `frontend.navigation.page`) | Must match the entity type |
| `salesChannelId` | Which storefront | Entries in wrong channel are invisible |
| `languageId` | Language-specific slug | Wrong language = entry ignored |
| `isDeleted` | Soft-deleted; Shopware returns 404 | Can be PATCHed back |
| `isCanonical` | Whether this is THE canonical URL | One canonical per foreignKey per channel |
| `isModified` | Whether manually overridden | Prevents auto-regeneration |

## Critical Constraint: Duplicate foreignKey Collision

**Shopware allows at most one non-deleted `seo-url` entry per `foreignKey` per `salesChannelId` per `languageId` per `routeName` context.**

Attempting to PATCH or POST a second non-deleted entry to the same context returns **HTTP 500**.

### Mandatory Pre-Check Before Every seo-url PATCH/POST

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
GET /api/seo-url?
  filter[foreignKey]={fk}&
  filter[salesChannelId]={sc}&
  filter[languageId]={lang}&
  filter[routeName]={route}&
  filter[isDeleted]=false
```

If `active_non_deleted_entries > 1`: **stop**. Reason: `shopware_seo_url_foreignkey_collision`. Recommendation: manual Shopware Admin cleanup or Nginx redirect.

## Critical Pattern: seo-url Says Redirect, Live Says 404

**Symptom**: Entry has `isDeleted: false`, `isModified: true`, correct `foreignKey`, but URL still returns 404.

**Causes** (check in order):

1. **Wrong Sales Channel**: Entry in headless/API channel (`018e34f4...`) instead of live storefront (`e4bf3aa9...`)
2. **Slug mismatch**: Entry slug has different prefix than request URL (e.g., `Section1/Category/` vs `/Category/`)
3. **Collision constraint**: Multiple entries for same foreignKey (see above)
4. **Target deactivated**: `foreignKey` points to category with `active: false`
5. **Cache stale**: Shopware caches URL resolution aggressively. `DELETE /_action/cache` required.

**Verification rule**: After every seo-url PATCH, verify with live HTTP check. Never trust API response alone.

## Category Behavior

### `active: false`

Setting `active: false` on a category returns 404 for its URL. Shopware also sets the category's seo-url entry to `isDeleted: true`.

**Side effects**:
- Navigation links lead to 404
- DreiscSeo redirects TO the category still fire (301 -> 404 chain risk)
- seo-url entries that redirect to this category via `foreignKey` break
- Products without alternative category assignment may become unreachable

**Mandatory pre-check**: Before category deactivation, run DreiscSeo pre-check (see `references/DREISCSEO_PATTERNS.md`).

### Reactivation as Fallback

When a redirect attempt fails (API 500, wrong slug, channel conflict), reactivating the category with `active: true` is the safest fallback. URL returns 200 immediately. Preferred over leaving broken 404 during active recovery.

## Blog URL Patterns

### `/Blog/` vs `/blog/`

Shopware serves blog content at both case variants. Both return HTTP 200 with identical content. Canonical points to uppercase `/Blog/...`.

**Trap**: DreiscSeo or seo-url redirect from `/blog/` to `/Blog/` creates infinite loop (DreiscSeo matches case-insensitively).

**Proper fix**: Nginx-level redirect:

```nginx
location ~ ^/blog/ { rewrite ^/blog/(.*)$ /Blog/$1 permanent; }
```

### Duplicate Canonical on Blog Detail Pages

Blog detail pages may render two `<link rel="canonical">` tags:
1. Correct: blog post URL (from blog plugin)
2. Wrong: homepage `/` (from theme's base `layout_head_canonical` block, rendering root navigation canonical)

**Detection**: `curl -s URL | grep 'rel="canonical"' | wc -l` — if > 1, conflict exists.

**Fix**: Override `{% block layout_head_canonical %}` in theme blog template. Not fixable via API.

## H1 on Category Pages

Some themes do not render category name as `<h1>`. Category name appears in breadcrumbs, navigation, and `<title>`, but main content area has no `<h1>`.

**Detection**: Screaming Frog filter "H1: Fehlende" on indexable HTML pages.

**Fix**: Twig template `<h1>{{ category.translated.name }}</h1>`.

## Image Dimensions

Shopware themes commonly output `<img>` without `width`/`height`. Causes CLS issues.

**Detection**: SF filter "Bilder: Fehlende Groessenattribute".

**Fix**: Twig template modification.

## CMS Slot updatedAt Limitation

Shopware does NOT reliably return `updatedAt` in CMS-Slot PATCH API responses. This means:

- CMS-Slot changes are not auditable via `updatedAt` filters
- Without local snapshots, the change is not audit-safe reconstructable

**Mandatory workflow**: Every CMS-Slot PATCH must write before/after snapshots to `~/.cache/seo-rescue/{slug}/snapshots/cms-slots/`. See `references/SEO_CHANGE_HISTORY.md`.

## Plugin Config Patterns

See `references/plugins/` for plugin-specific patterns:
- `plugins/DREISCSEO.md` — DreiscSeo Pro redirect layer
- `plugins/CRAYSSN_RICH_SNIPPETS.md` — Review widget plugin
- `plugins/SHOPWARE_SEO_URL.md` — Core seo-url constraints

## Verification Checklist

For every Shopware SEO change:

1. ✅ Pre-check: `seo_url_precheck` for seo-url operations
2. ✅ Pre-check: `dreiscseo_precheck` for category/product deactivations
3. ✅ Pre-check: Snapshot before CMS-Slot PATCH
4. ✅ Live HTTP status after change (not just API state)
5. ✅ Canonical is self-referencing
6. ✅ Robots is index,follow (unless intentionally not)
7. ✅ No 301 -> 404 chain created
8. ✅ Correct Sales Channel
9. ✅ Cache cleared after change
10. ✅ Snapshot after CMS-Slot PATCH

## See Also

- `references/DREISCSEO_PATTERNS.md` — Required reading for category deactivations
- `references/plugins/SHOPWARE_SEO_URL.md` — seo-url specifics
- `references/plugins/DREISCSEO.md` — DreiscSeo plugin specifics
- `docs/TROUBLESHOOTING.md` — Common error patterns
