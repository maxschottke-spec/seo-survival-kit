# Live Change QA Protocol

## Before Every Live Change

1. **Goal**: What specific SEO problem does this fix?
2. **Data basis**: Which tools confirmed the problem? (SF, DataForSEO, Live HTTP, GSC, Sistrix)
3. **Expected effect**: What should improve? By how much? In what timeframe?
4. **Affected URLs**: List every URL that will be changed or affected
5. **Risk points**: Calculate per SEO_CHANGE_GOVERNOR.md
6. **Rollback method**: How to undo this change, how long it takes
7. **Approval**: Has the user explicitly approved this specific change?
8. **Pre-checks for each target URL**:
   - HTTP status
   - Canonical (self-referencing?)
   - Robots (index,follow?)
   - Internal inlinks (count)
   - External backlinks (count, dofollow?)
   - Keywords/rankings (position, volume)
   - Product count (if category page)

## After Every Live Change

1. **HTTP status** of changed URL (curl, no redirect follow)
2. **Redirect final status** (curl, follow redirects)
3. **Canonical** of final target (must be self-referencing)
4. **Robots** of final target (must be index,follow unless intentionally not)
5. **Broken links introduced** (must be 0)
6. **Indexability** confirmed
7. **Shopware channel** correct (live storefront, not headless API)
8. **Change-history entry** appended to ndjson
9. **Monitoring date** set for +7d / +14d check

## Red Flags (immediate stop)

- Live test returns 404 after change
- 301 -> 404 chain created
- Redirect target is not 200
- Redirect target has different canonical than itself
- Redirect target has noindex
- Shopware API returns 500
- seo-url state says redirect exists but live HTTP shows 404
- DreiscSeo and seo-url produce contradictory redirects
- More broken links after change than before
