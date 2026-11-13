# Provider Capabilities

What each tool can and cannot tell you. Never rely on a single source.

## DataForSEO

**Strengths**:
- Live SERP data (real-time Google results)
- Keyword volume, difficulty, intent
- Domain ranked keywords with positions and URLs
- Relevant pages with ETV and position distribution
- Backlink summary (referring domains, rank, spam score)
- Competitor domain intersection
- Technology detection

**Limitations**:
- Backlink counts can show 0 even when links exist (crawl coverage varies)
- Position data is a snapshot, not a trend (no historical comparison in a single call)
- ETV is an estimate, not actual traffic
- Keyword data is for one location/language per call
- Costs per call — budget accordingly

**Verification pattern**: Cross-check backlink data with GSC Links report. Cross-check keyword positions with Sistrix if positions seem off.

## Sistrix

**Strengths**:
- Visibility Index (VI) as standardized visibility metric
- VI trend over weeks/months/years
- Keyword winners and losers
- Core Update correlation
- Competitor benchmarking

**Limitations**:
- VI is based on a fixed keyword set, not all keywords
- Daily VI can fluctuate without real ranking changes. Steps in the daily index can come from single head keywords entering or leaving the daily keyword subset on a few URLs
- A volume-weighted index can be uncorrelated with clicks when clicks come from a small high-CTR query population; measure the correlation before using it as the KPI
- Free tier severely limited
- No CMS-level data
- API tier restrictions (e.g., `domain.sichtbarkeitsindex` only)

**Verification pattern**: VI trends over 4+ weeks are more reliable than daily snapshots. Always check if a VI drop correlates with a published Core Update date; monthly snapshots and ranked-keyword counts cannot attribute a step to a specific update, only the daily curve can. Decompose a step per URL where the API tier allows it. Never compute a loss from a single-week peak.

## Screaming Frog

**Strengths**:
- Complete site crawl with all technical SEO data
- Internal link structure and inlink counts
- Canonical validation (self-referencing, missing, conflicting, multiple)
- H1/H2 analysis (missing, duplicate, multiple)
- Redirect chain and loop detection
- Broken link detection (internal and external)
- Structured data validation
- Content analysis (thin, near-duplicate, readability)
- Image analysis (alt text, dimensions, file size)

**Limitations**:
- Crawl reflects a point-in-time snapshot
- Does not know about rankings, traffic, or backlinks
- Cannot detect Shopware seo-url vs DreiscSeo redirect conflicts without API access
- German interface (filter/field names in German when locale is DE)
- MCP server must be running for programmatic access
- May fetch robots-blocked parameter URLs anyway. Raw counts for depth and duplicate titles then describe URLs a search engine never fetches. Compute content statistics (depth, duplicates, thin pages) on fetchable, indexable URLs only, and keep the status, redirect and indexability inventories on the full crawl, because 404s, redirect chains and accidental noindex are defects the checklists must still find
- A report from a feature that was not enabled in the crawl configuration (structured data, near-duplicates, sitemap import) is empty. That is "not measured", not "no issues"
- URL-pattern heuristics for page types misclassify; a template marker in the page (body class) is more reliable

**Verification pattern**: Always run a fresh crawl after live changes. Compare before/after crawl metrics.

## Google Search Console (GSC)

**Strengths**:
- Actual click and impression data from Google
- Indexation status and coverage report
- URL inspection for specific pages
- Search query data with CTR and position
- Sitemaps status
- Core Web Vitals field data

**Limitations**:
- Data is 2-3 days delayed
- Aggregated to date level (no hourly granularity)
- 1000 row export limit in UI
- API requires OAuth setup
- Cannot tell you WHY a page ranks or doesn't
- The most recent day is partial and keeps filling up for hours; a monitor that reads it too early reports a drop that is not there
- Position depends on the aggregation mode. Aggregated by property, a query's position is taken from the topmost own result per impression. As soon as the page dimension is in the request, every own URL shown for the query has its own position, and averaging those rows across URLs yields a worse number although the best page lost nothing
- Third-party rank trackers that scan result pages deep can create low-position impressions, in the observed case on brand queries. Impressions and average position are affected, clicks are not
- In the observed case the API returned rows click-descending whatever sort was requested, so high-impression, zero-click rows fell out of limited pulls. Paginate through the result within the API's row limits and report how much of the property total the returned rows cover; returned rows are never guaranteed to be all underlying rows
- Independent of cookie consent. That makes GSC clicks the stable denominator when analytics coverage is partial

**Verification pattern**: GSC is the ground truth for clicks. Impressions and positions need the checks above: report a position loss only if the best-ranking URL for the query got worse (state the aggregation mode used), and read the daily curve before trusting a week-over-week comparison (one or two spike days flip it). All other tools estimate; never report a third-party visibility estimate as a loss without a GSC click cross-check for the same period.

## Web analytics (GA4 and similar)

**Strengths**:
- Funnel events, engagement, channel and device split
- Landing-page level view of what visitors do after the click

**Limitations**:
- Depending on the consent setup it sees only consenting visitors. In consent-gated markets the capture rate can be far below 100 % and changes over time; a basic consent setup sends nothing without consent, so there is nothing to model from
- Often shares its on-site tagging with the ad platforms. Where it does, both failing together is one failure, not two confirmations
- The running day lags by hours; a day that is not yet processed shows traffic as "Unassigned" with zero engagement
- Cancelled orders, duplicate payment attempts and test orders stay in as purchases
- Headless and automated browsers can be dropped by bot filtering (observed). An HTTP 204 from the collect endpoint is not proof of arrival
- Hits can go to alternate collect hosts and batch several events in one POST body without the event name in the URL; a network filter on one host or on the URL misses them

**Verification pattern**: Orders and revenue come from the order system. Compute a dated capture rate (analytics purchases ÷ shop orders) and state it next to every analytics number. See `FUNNEL_DIAGNOSIS.md` Step 0.

## Ad platforms and merchant feed

**Strengths**:
- Spend, clicks and impressions per campaign are measured by the platform itself and independent of on-site consent
- Merchant Center / the ad account is the only place that shows what the platform actually received

**Limitations**:
- Reported conversions are attributed (cross-device, long click windows) and can over-count; the same order is routinely claimed by two platforms
- Platforms report on different bases (one net, another gross). Verify on a single known order; never add attributed revenue across platforms
- A feed tool between shop and platform can rewrite availability, titles and prices. The shop export is not what the platform sees
- Fallback titles from feed tools can drop or garble the attributes people search for (size, type). AI-generated supplemental feeds can insert wording you have banned
- A feed file's timestamp says nothing about freshness: a run without content changes may not write a new file
- Merchant status fields can be a roll-up over all target countries; "mostly disapproved" may be fully approved in the country that matters
- A merchant promotion running in parallel with a feed sale price can stack to a double discount (observed)
- Change-history endpoints can return empty while changes exist; older API versions hide fields without an error

**Verification pattern**: Statements about what the platform sees come from the platform. "Feed is stuck" needs a content comparison (shop price vs. feed file vs. merchant product), not a file date. Before blaming the feed for zero impressions, check when the item was created: a product that is days old has no history yet, and novelty, title and bid cannot be separated. Split paid results into brand and non-brand before judging a channel, inside automated campaign types too.

## Browser-based checks and tag verification

**Limitations** (observed configurations; verify on the target system):
- Headless browsers: may be dropped by analytics bot filtering, may not show pixel requests even with consent given, and may get no sponsored placements on marketplaces
- Private-mode browsers and browsers with tracking protection can block tag manager, analytics and pixels entirely. The owner's own device may be untracked, in which case the owner's test proves nothing
- A returning-visitor state (dismissed chat, stored consent) hides what a first-time visitor sees
- A walkthrough that stops before payment authorization does not test the checkout

**Verification pattern**: A zero from a measurement tool counts only after a positive control with the same tool on a known-positive case. See `HYPOTHESIS_VERIFICATION_GATE.md`, Negative findings.

## Shopware Admin / API

**Strengths**:
- Definitive source for category/product status (active/inactive)
- seo-url entries with all metadata
- CMS page and slot content
- Plugin configuration
- Product counts per category
- Media library

**Limitations**:
- seo-url state does not always match live HTTP behavior (see SHOPWARE_SEO_PATTERNS.md)
- No built-in change history / audit trail
- CMS slot PATCH responses don't include `updatedAt`
- DreiscSeo is a separate entity system
- API rate limits / timeout on large queries

**Verification pattern**: After every API write, always verify with a live HTTP check. The API says what Shopware thinks the URL does. Live HTTP says what the URL actually does. Live HTTP wins.

## Live HTTP Check (curl)

**Strengths**:
- Ground truth for what users and Googlebot see
- Cannot be fooled by database state
- Fast, but not cache-free: a page cache in front of the shop can serve the pre-change copy for a long time after an API write, and a cache-busting parameter shows a freshly rendered page instead of the delivered one
- Shows redirect chains, final status, canonical tags

**Limitations**:
- Point-in-time (CDN/cache state may differ)
- Cannot tell you about rankings, backlinks, or keywords
- Cannot inspect Shopware internals

**Verification pattern**: The final arbiter. Every claim about a URL's behavior must be backed by a live HTTP check. Not the seo-url table. Not the DreiscSeo config. The live response.

## Cross-Source Verification Matrix

| Claim | Primary Source | Verify With | Confidence if Both Agree |
|---|---|---|---|
| URL returns 301 | Live HTTP | — | **high** |
| URL has self-canonical | Live HTTP | Screaming Frog | **high** |
| Page has N keywords | DataForSEO | Sistrix / GSC | **high** |
| Page gets N clicks | GSC | — | **high** |
| Domain has N backlinks | DataForSEO | GSC Links / Ahrefs | **medium** (cross-check needed) |
| Category has 0 products | Shopware API | Live HTTP (empty listing) | **high** |
| seo-url redirect works | Shopware API | **Live HTTP** (mandatory) | Only **high** with live check |
| VI trend is positive | Sistrix | GSC clicks (an ETV trend shares inputs with the index and does not confirm it) | **medium** |
| Visibility was lost | Third-party index | **GSC clicks** for the same period (mandatory) | Only **high** with click cross-check |
| Query lost position | GSC query + page (best URL) | Daily curve, not the query-level mean | **high** |
| Shop had N orders / revenue | Order system (order date, net, status-filtered) | — | **high** |
| Analytics shows N purchases | Web analytics | **Order system** (mandatory), with capture rate | Only as high as the capture rate is stable |
| Platform X drove N sales | Ad platform | Shop orders carrying that platform's source code | **medium** |
| Google sees product state Y | Merchant Center / ad account | Feed file content | **high** (shop export alone: **low**) |
| Tag fires / does not fire | Browser check | Positive control with the same tool, then platform real-time view | Only **high** after positive control |
| "No changes" / "no items" / "no access" | Any API | A second, different signal | Empty result alone: **low** |
