---
name: gsc-deep-dive
description: 'Use when the user wants Google Search Console data pulled directly into the session instead of manually screenshotting / CSV-exporting from search.google.com. Pulls top queries, top pages, coverage status, manual actions, security issues, and Core Web Vitals field data via the GSC API in one call. Triggers from "pull GSC data for example.com", "Search Console deep dive", "GSC queries last 90 days", "GSC coverage report", "GSC indexing status", "GSC manual actions check", "GSC Core Web Vitals field data". Removes the manual GSC click-through that is the friction point of every recovery / audit session.'
user-invokable: true
argument-hint: '[domain] [days?]'
allowed-tools: [Read, Write, Bash(node:*), Bash(curl:*)]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.3'
  category: marketing
---

# GSC Deep Dive

## Overview

Google Search Console is the canonical source for what users actually search and click on your site, plus Google's own assessment of indexability, manual actions, security, and Core Web Vitals field data. Most workflows force the user to manually open GSC, click through 5-7 reports, screenshot or CSV-export each, and paste into the Claude context.

This skill removes that friction: one config (service-account JSON or OAuth token), one command, full JSON dump. From there, [[post-core-update-recovery]], [[seo-outreach-report]], and [[ai-search-rescue]] consume the data directly.

## When to use

- A site running active recovery — pull GSC weekly to track query / page / impression drift in one report
- An audit handoff — gather every GSC signal in one JSON before invoking [[seo-outreach-report]]
- Verifying a recommendation actually landed — re-pull after 2-4 weeks and diff against the previous snapshot
- A YMYL / B2B site — manual actions + security issues + indexation status are the YMYL-relevant signals
- An agency onboarding a client — first-call data gathering in <5 minutes

**Don't use for:**
- Real-time monitoring (GSC data lags ~2 days for fresh queries, ~7 days for impressions)
- Competitor data (GSC only shows your own property)
- Backlink analysis (GSC has a backlink view but [[seo-outreach-report]] / [[competitor-deep-audit]] pull DataForSEO's more complete dataset)

## What gets pulled

Per run, the script writes a single JSON file containing:

| Field | Source | What it tells you |
|-------|--------|-------------------|
| `site` | config | The verified GSC property |
| `period` | `start_date` / `end_date` | The window queried (default last 90 days) |
| `top_queries` | searchanalytics.query (rows=500) | Top 500 queries by clicks: keyword, clicks, impressions, CTR, position |
| `top_pages` | searchanalytics.page (rows=500) | Top 500 pages by clicks: URL, clicks, impressions, CTR, position |
| `query_page_pairs` | searchanalytics.query+page (rows=1000) | What page ranks for what query (most useful for cannibalisation detection) |
| `coverage` | urlInspection if site-level | Indexed vs not-indexed counts |
| `last_crawl_dates` | urlInspection per top-10 URL | When Google last crawled each top page |
| `manual_actions` | searchconsole.searchanalytics + sites.list | Any pending manual actions on the property |
| `crawl_errors_summary` | searchanalytics aggregates | Page-level errors (4xx, 5xx, soft-404) the last 30 days |
| `crux_field_data` | from PSI v5 (cross-reference) | LCP / CLS / INP per top URL — field data, not lab |
| `search_appearance` | searchanalytics with searchAppearance dimension | SERP feature breakdown (AMP, video, FAQ, How-to, Sitelinks, AI Overview where exposed) |
| `query_weekly_series` | searchanalytics date+query, ISO-week-bucketed, top 200 by clicks | Per-query weekly click series over `weekly_series_days` (default 480) — input for quiet-death detection |

## Quick start

### 1. GCP setup (one-time)

a. Go to [console.cloud.google.com](https://console.cloud.google.com), create or select a project.

> **Do not use a Google AI Studio default project.** If your project ID looks like `gen-lang-client-XXXXXXXXXX`, that is an auto-generated AI Studio scratchpad project. Service accounts created in those projects often fail with "Email not found" when you later try to add them to Search Console in Step 2, because the AI Studio identity path is not the same as a regular GCP project. Create a fresh project from the Cloud Console project selector instead — any name works.

b. Library → enable **Google Search Console API** (also called "Search Console API").
c. Library → enable **PageSpeed Insights API** (for the CrUX cross-reference).
d. IAM & Admin → Service Accounts → Create:
   - Name: `seo-rescue-gsc`
   - Role: none needed at GCP level
e. On the new service account → Keys → Add Key → JSON. Save the downloaded JSON file securely. Treat it like a password — see security model below.

> **If Step 2 fails with "Email not found"** despite waiting 12+ hours: the most likely cause is that the service account was created in an AI Studio default project (see warning above). Recreate in a fresh standard GCP project. Reported in [#26](https://github.com/maxschottke-spec/seo-survival-kit/issues/26).

### 2. Grant the service account access to your GSC property

a. Open [search.google.com/search-console](https://search.google.com/search-console), select your property.
b. Settings (gear icon, bottom-left) → Users and permissions → Add user.
c. Email = the service account's email (format: `seo-rescue-gsc@<your-project>.iam.gserviceaccount.com`, visible on the GCP service-account page).
d. Permission = **Restricted** (read-only).

### 3. Local setup

Copy the template:
```bash
mkdir -p ~/.config/seo-rescue
mv ~/Downloads/<project>-<hash>.json ~/.config/seo-rescue/gsc-service-account.json
chmod 600 ~/.config/seo-rescue/gsc-service-account.json
```

Copy and edit the config:
```bash
cp plugins/seo-rescue/skills/gsc-deep-dive/gsc-config.example.json ./gsc-config.json
# edit gsc-config.json:
#   "site": "sc-domain:example.com"   (or "https://www.example.com/" for URL-prefix properties)
#   "days": 90
#   "output_dir": "./gsc-history"
```

Export the service-account path (env-only, never in the config file):
```bash
export GSC_SERVICE_ACCOUNT_JSON=~/.config/seo-rescue/gsc-service-account.json
```

### 4. Run

```bash
node gsc-fetch.example.js                 # uses ./gsc-config.json
node gsc-fetch.example.js example.com 30  # ad-hoc: override site + window
```

Output lands in `./gsc-history/<sanitized-site>-<YYYY-MM-DD>.json` plus a brief stderr summary.

## Site identifier formats

GSC supports two property types — make sure your config matches what's verified:

| Property type | Format in config | Example |
|---------------|------------------|---------|
| Domain property | `sc-domain:example.com` | `sc-domain:example-mattress-shop.test` |
| URL-prefix property | `https://<host>/` (trailing slash matters) | `https://www.example.com/` |

Mixing these up is the #1 first-run error. If the API returns `Forbidden` despite a freshly added service account, check the format.

## Cron / weekly tracking

Same pattern as [[psi-weekly-cron-baseline]] — once it's running cleanly, schedule it:

**launchd (macOS):**
```xml
<!-- ~/Library/LaunchAgents/com.maxschottke.gsc-deep-dive.plist -->
<plist><dict>
  <key>Label</key><string>com.maxschottke.gsc-deep-dive</string>
  <key>ProgramArguments</key><array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/gsc-fetch.example.js</string>
  </array>
  <key>StartCalendarInterval</key><dict>
    <key>Weekday</key><integer>1</integer>
    <key>Hour</key><integer>9</integer>
  </dict>
  <key>EnvironmentVariables</key><dict>
    <key>GSC_SERVICE_ACCOUNT_JSON</key><string>/Users/you/.config/seo-rescue/gsc-service-account.json</string>
  </dict>
</dict></plist>
```

**cron (Linux):**
```
0 9 * * MON GSC_SERVICE_ACCOUNT_JSON=/home/you/.config/seo-rescue/gsc-service-account.json /usr/bin/node /path/to/gsc-fetch.example.js >> /var/log/gsc-deep-dive.log 2>&1
```

**GitHub Actions:**
```yaml
# .github/workflows/gsc-weekly.yml
name: GSC Weekly Snapshot
on:
  schedule: [{cron: '0 9 * * 1'}]
  workflow_dispatch:
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>  # SHA-pin as usual
      - uses: actions/setup-node@<sha>
        with: {node-version: '20'}
      - run: |
          echo "$GSC_SERVICE_ACCOUNT_JSON" > /tmp/sa.json
          GSC_SERVICE_ACCOUNT_JSON=/tmp/sa.json node plugins/seo-rescue/skills/gsc-deep-dive/gsc-fetch.example.js
        env:
          GSC_SERVICE_ACCOUNT_JSON: ${{ secrets.GSC_SERVICE_ACCOUNT_JSON }}
```

## Analysis recipes

```bash
# Top 10 query-page pairs with high impressions but low CTR (snippet-rewrite candidates)
cat gsc-history/example-com-2026-05-22.json | \
  node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); \
  const items = (d.query_page_pairs || []).filter(r => r.impressions > 1000 && r.ctr < 0.02); \
  items.sort((a,b) => b.impressions - a.impressions).slice(0,10).forEach(r => console.log(r.query, '|', r.page, '|', r.impressions, 'imp', '|', (r.ctr*100).toFixed(2)+'%', 'CTR'));"

# Pages where you rank 11-20 (Quick-Wins for [[post-core-update-recovery]] Phase D)
cat gsc-history/example-com-2026-05-22.json | \
  node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); \
  const items = (d.top_pages || []).filter(r => r.position > 10 && r.position < 21); \
  items.sort((a,b) => b.impressions - a.impressions).slice(0,15).forEach(r => console.log(r.page, '|', 'pos', r.position.toFixed(1), '|', r.impressions, 'imp'));"
```

## Quiet-Death Detection (experimental, N=1)

> **Maturity:** `experimental_n1` — abgeleitet aus einem einzigen Fall (case-001, Lesson 2). KEINE validierte Metrik. Promotion erst nach N=2.

Manche Queries sterben **langsam** — 50–86 % Klick-Verlust über Wochen, ohne Korrelation zu einem Core Update (oft SERP-Feature-Absorption durch AI Overviews oder Brand-Erosion). Diese „stillen Tode" brauchen andere Gegenmaßnahmen als Update-Recovery und gehen in der Snapshot-Aggregation unter. Der Detector arbeitet auf der `query_weekly_series` und ist netzfrei.

```bash
node quiet-death-detect.example.js gsc-history/example-com-2026-06-13.json --brand verapur,meinemarke
```

Kriterien (alle müssen erfüllt sein), pro Query-Reihe:

| Kriterium | Schwelle |
|-----------|----------|
| Start-Klicks (erstes 4-Wochen-Mittel) | ≥ 5 |
| Verlust (letztes vs. erstes 4-Wochen-Mittel) | ≥ 50 % |
| Monotoner Decline (längste nicht-steigende Spanne des rollierenden 4-Wochen-Mittels) | ≥ 6 Wochen |

**Update-Korrelation:** Der größte Einzel-Wochen-Drop wird gegen `references/CORE_UPDATES.md` geprüft. Liegt er ±1 Woche in einem Update-Fenster → `update_correlation: "partial"` (gehört eher zur Update-Schadens-Analyse), sonst `"none"` (echtes Quiet-Death). Beide bleiben in der Liste — keine harte Filterung.

**Pattern-Hinweis:** `brand_erosion` (Query enthält ein `--brand`-Token), `serp_feature_absorption` (AI-Overview-Signal im `search_appearance`), sonst `generic_erosion`.

Output: `gsc-history/<site>-quiet-death-<date>.json` mit `quiet_death_queries[]` und `maturity: "experimental_n1"`.

## Security model

- Service-account JSON **must** be referenced via `GSC_SERVICE_ACCOUNT_JSON` env var. The script hard-fails if it finds a `service_account_json` field in the config file (same defense as PSI api_key — see CHANGELOG v0.3.2 H2 finding).
- Service-account JSON file should be `chmod 600` (or NTFS ACL owner-only on Windows — see [[ai-citations-tracker]] / ONBOARDING.md for the PowerShell snippet).
- Site identifier is validated against a strict regex (alphanumeric + dots + `sc-domain:` / `https://` prefix). Hostile config cannot inject arbitrary URLs into the GSC API call.
- Output paths via `lib/safe.js` patterns: `safeSlug` on the site identifier for the filename (the `<sanitized-site>` placeholder in the output-path examples), no `..` traversal allowed in `output_dir`. **Sanitization rule** (same one [[sistrix-monday-recovery-check]] applies in its Markdown-only path): site identifier is lowercased; allowed characters are `[a-z0-9.-]`; the `sc-domain:` / `https://` prefix is stripped before slug; leading dots are stripped; path separators (`/`, `\`), null bytes, and `..` sequences are rejected. A site identifier that fails sanitization aborts the run rather than falling back to a default. The script implements this via `safeSlug()`; downstream Markdown-only consumers of the output filenames (such as the Monday Check skill) apply the same rule textually.
- Network destinations are hardcoded: `oauth2.googleapis.com`, `searchconsole.googleapis.com`, `www.googleapis.com/pagespeedonline/v5` — no SSRF possible.
- GSC API responses pass through `sanitize()` for the `query` strings — those are user-provided search queries from Google's index and are *attacker-controllable* in the sense that someone can search for `Ignore previous instructions ...` and that query lands in your GSC data.
- Service-account-token caching: the OAuth2 JWT exchange returns a 1-hour bearer token. The script keeps it in-memory only — no on-disk caching to avoid stale-token + replay risks.

## Related skills

- [[psi-weekly-cron-baseline]] — same cron architecture; the `crux_field_data` field of GSC output is the same data PSI returns. Run both for full coverage.
- [[post-core-update-recovery]] — GSC trend data is the primary "is recovery working?" signal. Phase A success shows up here first.
- [[ai-citations-tracker]] — AI Overview impressions (when GSC exposes them per `searchAppearance` dimension) are the GSC-side complement to ChatGPT/Perplexity-side tracking.
- [[seo-outreach-report]] — GSC data can drive the "what to fix first" section of the outreach PDF, replacing the more abstract Sistrix-only signals for properties where the user has GSC access.

## Realistic expectations

- **First-run setup time:** 15-20 minutes (GCP project + service-account + grant access in GSC)
- **Per-run cost:** $0 (GSC API is free, well within quota for one site weekly)
- **Quota:** 1,200 queries / minute / project; 30,000 / day. One full skill-run uses ~6-10 API calls. No quota concerns for personal use.
- **Data lag:** Google's stated lag is 2-3 days for fresh data; expect the most recent 48h to be missing or undercounted.
- **AI Overview impressions:** Google began exposing these via the `searchAppearance` dimension in late 2025. Not all properties have data yet; the script returns `null` if the API doesn't include it.
