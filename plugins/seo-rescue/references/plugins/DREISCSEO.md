# Plugin: DreiscSeo Pro

Shopware 6 paid plugin providing extended SEO functionality including a redirect management layer separate from Shopware's native `seo_url` table.

## Purpose

- URL redirects (301/302) configurable via admin UI
- Sitemap extensions
- Meta tag management beyond Shopware core
- Schema markup helpers

## Relevant Entities/Tables

| Entity | API Path | Purpose |
|---|---|---|
| `dreisc-seo-redirect` | `/api/dreisc-seo-redirect` | Redirect rules |
| `dreisc-seo-*` (other entities) | `/api/dreisc-seo-*` | Sitemap, meta, schema config |

## Typical SEO Effects

- Active redirects fire BEFORE Shopware's native 404 handling
- Can override `seo_url` table behavior
- Case-insensitive source matching (trap)
- No native rollback or version history

## Typical Failure Modes

| Mode | Symptom | Root Cause |
|---|---|---|
| 301 -> 404 chain | Source 301-redirects to a deactivated target | Active DreiscSeo redirect points to a category with `active: false` |
| Infinite redirect loop | Browser shows "too many redirects" | Source and target differ only in case |
| Conflicting redirects | Different live behavior than `seo_url` table suggests | DreiscSeo overrides Shopware |
| Phantom 301s | `seo_url` shows `isDeleted: true` but URL returns 301 | DreiscSeo active rule fires instead |

## Pre-Checks Before Changes

Before ANY category or product deactivation:

```
GET /api/dreisc-seo-redirect?filter[sourcePath]={url-slug}
GET /api/dreisc-seo-redirect?filter[redirectPath]={url-slug}
```

Document results in Change Plan:

```json
{
  "dreiscseo_precheck": {
    "redirects_from_url": [],
    "redirects_to_url": [],
    "would_create_301_to_404": false,
    "affected_redirect_ids": []
  }
}
```

## Live-Check Verification

After every change touching a URL that DreiscSeo might redirect:

1. `curl -o /dev/null -w "%{http_code}" --max-redirs 0 https://domain/source-url`
2. If 301: follow once, check final status
3. If chain detected (301 -> 301 or 301 -> 404): flag immediately

## Rollback Methods

| Change | Rollback |
|---|---|
| DreiscSeo redirect deactivated | PATCH `active: true` on entry ID |
| DreiscSeo redirect target changed | PATCH `redirectPath` back to original |
| DreiscSeo redirect deleted | POST new entry with original config |

## Stop Rules Specific to DreiscSeo

| Stop Reason | Trigger |
|---|---|
| `dreiscseo_precheck_missing` | Category/product deactivation without DreiscSeo pre-check |
| `dreiscseo_would_create_301_to_404` | Pre-check identified chain risk |
| `dreiscseo_redirect_chain` | Existing chain detected |
| `dreiscseo_case_loop_risk` | New redirect would create case-insensitive loop |

## See Also

- `references/DREISCSEO_PATTERNS.md` — Detailed pattern documentation
- `references/SHOPWARE_SEO_PATTERNS.md` — Interaction with Shopware native `seo_url`
