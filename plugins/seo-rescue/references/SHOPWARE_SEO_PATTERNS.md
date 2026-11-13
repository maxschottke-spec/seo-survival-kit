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

When a redirect attempt fails (API 500, wrong slug, channel conflict), reactivating the category with `active: true` is the fastest fallback. URL returns 200 immediately. Preferred over leaving broken 404 during active recovery.

**Precondition**: activation publishes every text stored in the category and its layout, including stale meta texts and claims that were removed elsewhere since. Scan them first (`SAFE_LIVE_CHANGE_RULES.md` rule 13). A reactivated category may also need its deleted seo-url entry restored.

## Blog URL Patterns

### `/Blog/` vs `/blog/`

Shopware serves blog content at both case variants. Both return HTTP 200 with identical content. Canonical points to uppercase `/Blog/...`.

**Trap**: DreiscSeo or seo-url redirect from `/blog/` to `/Blog/` creates infinite loop (DreiscSeo matches case-insensitively).

**Check first whether a fix is needed at all.** In the originating case the search engine consolidated the case variants on its own choice regardless of the declared canonical, and the duplicates carried a negligible share of clicks. The remaining defect was a shared footer link block in many layouts pointing at the non-canonical casing. Repairing internal links in controlled batches removed the cause without putting a redirect in front of the strongest pages.

**If a redirect is still wanted**, do it at server level:

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

## Rendering and Storage Patterns

Observed in one case (experimental, N=1 — **Maturity:** `experimental_n1`). Platform behaviour may differ by version and plugin set; verify on your instance.

### Override beats base slot

A per-category slot override wins over the layout slot. A verified write to the base slot then changes nothing on the page. Overrides bound to slot IDs of a previous layout stay stored and are never rendered; they inflate field inventories and are lost when a layout is cloned (a cloned landing layout can come up empty). An override PATCH replaces the override object; it does not merge. Resolve the rendering object before every content write.

### Inherited null fields on variants

Variant fields inherit from the parent and are stored as null. Consequences: a filter on an explicit value (for example active = true) undercounts live variants; a parent-only write has no effect where children carry own values; a variant without an own meta title renders the parent's; a product stream that filters on parent IDs can empty a listing. For every bulk field write count three groups (target value, other value, null) and require the sum to equal the scope.

### The same text lives in several carriers

Product text can sit in the description and in a tab field. Product boxes embed the parent description on other pages. FAQ or custom fields may exist as copies on every variant. Properties hang on variants, not on the parent. "Suitable alternatives" blocks show another product's text. Many supposed theme strings are plugin settings, property descriptions, system configuration or text snippets and can be changed without a theme recompile.

### Page cache and acceptance

API writes to CMS slots, overrides and product texts do not necessarily invalidate the page cache. Accept a change only on the plain URL and only on a copy created after the write. A query parameter creates its own cache key. Do not assume a cache lifetime; measure it. After a full purge, listings can render incomplete for minutes.

### Structured data sources

Inventory every schema source: hand-written blocks on legacy landing pages, SEO-plugin settings, product fields. Patterns seen:

- **Availability derived from stock level.** Wherever products are orderable at zero stock (backorder, drop-ship, production on demand), markup that derives availability from the stock figure reports OutOfStock on buyable products. That contradicts the visible page and the merchant feed and can cost shopping eligibility. A passing rich-results test does not catch it. One global plugin setting can drive all sales channels; check the scope before changing it, and check which availability values the plugin offers at all.
- `priceValidUntil` set to the current date.
- Hand-written product markup with ratings and prices that no longer match anything on the page.
- A sitewide business rating emitted on every page from one plugin switch.
- A review count equal to the "maximum reviews shown" setting instead of the total.
- Dimensions in mixed units.
- A breadcrumb derived from the product's main category; a main category set to the root produces a wrong path. Fixing the main category creates no new URLs.

### Variants, canonicals, sitemap

- A parent product URL can canonicalise to its first variant. Without an explicitly set main variant the canonical may flip between crawls.
- Variant pages reachable only through a script-driven configurator are internally unlinked. Check whether that pre-dates the drop before treating it as its cause.
- The scheduled sitemap job can skip runs while its next-run time keeps advancing. Monitor sitemap last-modified and URL count against an expected value.
- Two categories with the same name: on re-indexing the single SEO URL can move to the twin, and the other is served under its internal route with a self-canonical. A case-insensitive path lookup can return the twin, so a rebuild lands on an object that is not live on that URL. Confirm that the object found is the one whose canonical and H1 are live.
- Categories without an SEO URL are served under the internal route.
- After moving categories, the products' category tree updates only with an index run.

### Markup and snippets

- A block element nested inside the H1 makes the parser close the heading early: the H1 is empty, the text sits next to it, and crawlers report "H1 missing". Inspect the rendered DOM; repair the structure with the text held invariant.
- A missing text snippet can be rendered as its key inside a link target, creating thousands of internal links to 404 URLs. When internal 404s cluster on one odd path, look for an unresolved snippet key. Several snippet sets can share one locale; a write to the wrong set succeeds without effect. Resolve the active set through the storefront domain.
- A hidden landing page may only be settable to noindex through a category-level field, not through the landing-page entity.

### Operations

- One upload in an image format the server cannot process can stall thumbnail generation for all later uploads. There is no retroactive generation, and the page cache hides the repair.
- A null restock field can remove the delivery-time line on orderable products.
- Plugins that copy product data into their own public endpoints can publish more fields than intended, internal ones included. Inspect what a plugin exposes through the public store API, and re-check after saving its configuration.

## Plugin Config Patterns

See `references/plugins/` for plugin-specific patterns:
- `plugins/DREISCSEO.md` — DreiscSeo Pro redirect layer. Note: SEO plugins of this kind typically also control structured-data availability, price validity, business markup, review counts, robots per category and breadcrumbs. Treat the plugin as a schema source, not only as a redirect layer
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
9. ✅ Cache cleared after change, and acceptance on a copy created after the write (plain URL, no parameter)
10. ✅ Snapshot after CMS-Slot PATCH

## See Also

- `references/DREISCSEO_PATTERNS.md` — Required reading for category deactivations
- `references/plugins/SHOPWARE_SEO_URL.md` — seo-url specifics
- `references/plugins/DREISCSEO.md` — DreiscSeo plugin specifics
- `docs/TROUBLESHOOTING.md` — Common error patterns
