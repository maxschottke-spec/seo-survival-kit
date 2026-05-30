# Plugin: CrayssnLabs Rich Snippets Creator

Shopware 6 plugin that renders Google review widgets and rich snippet markup. Configurable via `system-config` with sitewide effect.

## Purpose

- Render Google review widget (floating badge, sidebar, product page)
- Inject AggregateRating / Review schema markup
- Link to Google review page

## Relevant Config Keys

| Key | Purpose | Common Values |
|---|---|---|
| `CrayssnLabsRichSnippetsCreator.config.placesId` | Google Place ID | e.g., `ChIJ...` |
| `CrayssnLabsRichSnippetsCreator.config.linkType` | How the review link is constructed | `customer-review-overview` (deprecated, 404), `write-review` (working) |
| `CrayssnLabsRichSnippetsCreator.config.hideWidget` | Widget visibility | integer |
| `CrayssnLabsRichSnippetsCreator.config.displayWidget` | Toggle widget | bool |
| `CrayssnLabsRichSnippetsCreator.config.position` | Widget position on page | `fixed-left`, etc. |
| `CrayssnLabsRichSnippetsCreator.config.scale` | Widget scale | `scale-90`, etc. |

## Typical SEO Effects

- Sitewide effect: the widget renders on most pages
- Outgoing link in widget can be 404 / 302 / 200 depending on `linkType`
- Schema markup is injected sitewide (affects rich result eligibility)

## Typical Failure Modes

| Mode | Symptom | Root Cause |
|---|---|---|
| Sitewide 404 outgoing link | `search.google.com/local/reviews?placeid=...` returns 404 on every page | `linkType: customer-review-overview` — Google deprecated this URL format |
| 302 to login | Review link redirects to Google login | `linkType: write-review` — normal behavior, redirect to write-review form for non-logged-in users |
| Missing rich results in SERPs | Schema present but no rich snippets | Google trust signals, content quality, or schema validation issues |

## Pre-Checks Before Changes

Before changing `linkType`:

1. Live HTTP check of current configured URL across multiple pages
2. Live HTTP check of proposed new linkType URL
3. Verify Place ID is still valid (`google.com/maps/place/?q=place_id:{id}` returns 200)

## Live-Check Verification

After config change:

```bash
# Verify sitewide change took effect
curl -s https://domain/ | grep -o 'href=[^"]*google[^"]*review[^"]*' | head -1

# Verify final URL status
curl -o /dev/null -w "%{http_code}" "$EXTRACTED_URL"
```

## Rollback Methods

| Change | Rollback |
|---|---|
| `linkType` changed | PATCH `system-config/{id}` with previous value |
| Place ID changed | PATCH `system-config/{id}` with previous Place ID |
| Widget disabled | PATCH `displayWidget: true` |

## Stop Rules Specific to Rich Snippets Plugin

| Stop Reason | Trigger |
|---|---|
| `richsnippets_link_404` | Live check confirms outgoing link is 404 — but config change would also produce 404 |
| `richsnippets_invalid_placeid` | Place ID does not resolve via Google Maps |

## Known linkType Behavior

| linkType | URL Pattern | Status |
|---|---|---|
| `customer-review-overview` | `search.google.com/local/reviews?placeid=...` | **404** (deprecated by Google) |
| `write-review` | `search.google.com/local/writereview?placeid=...` | **302** -> login or review form |
| `google-maps` | `google.com/maps/place/?q=place_id:...` | **200** (preferred when available) |

## See Also

- `references/SHOPWARE_SEO_PATTERNS.md` — Plugin config patterns section
- `docs/TROUBLESHOOTING.md` — Google Review Link section
