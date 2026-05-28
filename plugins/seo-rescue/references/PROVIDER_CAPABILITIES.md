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
- Daily VI can fluctuate without real ranking changes
- Free tier severely limited
- No CMS-level data
- API tier restrictions (e.g., `domain.sichtbarkeitsindex` only)

**Verification pattern**: VI trends over 4+ weeks are more reliable than daily snapshots. Always check if a VI drop correlates with a published Core Update date.

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

**Verification pattern**: GSC is the ground truth for clicks and impressions. All other tools estimate — GSC measures.

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
- Instant — no caching delay
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
| VI trend is positive | Sistrix | DataForSEO ETV trend | **medium** |
