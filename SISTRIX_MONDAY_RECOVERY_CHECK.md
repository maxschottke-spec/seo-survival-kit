# SISTRIX Monday Recovery Check

CSV-first workflow for recurring Monday-morning recovery review during an active SEO recovery. Shipped as the `sistrix-monday-recovery-check` skill in v0.5.2.

Companion doc: [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) carries the operational detail for Recovery Signal Score (section 10), Winner/Loser Neutralization (section 8), Money Keyword Protection (section 7), URL Recovery Analysis (section 9), and the five-phase recovery sequencing (section 11). [DECISION_ENGINE.md](./DECISION_ENGINE.md) carries the decision rules that fire during a Monday check.

## Why this exists

During an active SEO recovery, a recurring question shows up every Monday: did rankings recover, are money keywords holding, are winners and losers offsetting each other, and is the visibility index lagging the actual ranking gains.

Without a structured workflow, this question gets answered ad hoc and inconsistently. The operator opens SISTRIX, eyeballs the visibility chart, scrolls the keyword tab, and forms an impression. The impression often misses neutralization patterns (small gains across many keywords offset by large losses on a few head terms) and money-keyword protection issues (an important transactional keyword slips while the operator focuses on aggregate metrics).

The SISTRIX Monday Recovery Check turns this into a 15-20 minute repeatable workflow that produces a structured summary every Monday.

## Recommended command

```
/seo-rescue:sistrix-monday-recovery-check
```

Alternative shorter alias:

```
/sistrix:monday-recovery-check
```

Runnable skill implementation ships in v0.5.1.

## Important constraints

CSV-first. The skill does not require a SISTRIX API key. The user exports CSVs from the SISTRIX UI and points the skill at the file paths.

Optional future SISTRIX API support is documented as planned but not active. The current framework does not call the SISTRIX API and does not store SISTRIX API keys in any public file.

No exports are committed. The CSVs the user feeds in are protected by [.gitignore](./.gitignore) entries for `sistrix-exports/`, `*_sistrix*.csv`, `*_visibility*.csv`, `*_keywords*.csv`, `*_ranking*.csv`.

## Inputs

### Required minimum

- Current week's SISTRIX keyword export (CSV)
- Previous week's SISTRIX keyword export, or last Monday's export (CSV)

The skill compares these two CSVs to detect keyword movement, winner/loser distribution, and URL-level recovery.

### Recommended

- Pre-change baseline export (from before the recovery work started, useful for measuring total progress)
- Current Sistrix visibility index value
- Previous visibility index value
- List of URLs changed since the previous export
- List of important money keywords with current target positions
- GSC export for the same period (impressions, clicks, CTR, position per query and per page)
- Notes on SEO changes implemented since the previous export (so the framework can attribute movement)
- Date of changes (so the framework can align attribution windows)
- Target country and language
- Device split if available

### Optional

- Competitor visibility data
- Competitor keyword export
- SERP feature data per query
- URL type classification (category, product, guide, blog, homepage, comparison, brand)
- Product or category mapping per URL
- Revenue or conversion data per URL
- Future SISTRIX API data if the optional integration is implemented

## Core analysis

### 1. Visibility Index interpretation

Compare current VI value to previous. Classify as one of:

- Rising
- Falling
- Flat
- Lagging behind ranking improvements (visible in keyword movement but not yet in VI)
- Neutralized by losses elsewhere

The visibility index can be flat while individual keyword positions improve significantly. This happens when winners are offset by losers, or when winners are in lower-volume keywords while losers are in higher-volume keywords. The skill flags this explicitly to prevent the operator from drawing the wrong conclusion ("nothing is working").

### 2. Keyword recovery distribution

For both exports, compute:

- Top 100 count
- Top 50 count
- Top 20 count
- Top 10 count
- Top 5 count
- Top 3 count
- Newly returned keywords (in current, not in previous)
- Lost keywords (in previous, not in current)
- Improved keywords (in both, position lower)
- Declined keywords (in both, position higher)

Surface the delta as a table. The Top 3 and Top 10 deltas are the most operationally meaningful during recovery.

### 3. Winner / loser neutralization

Identify whether many small or mid-sized gains are being offset by a few large losses. See [RECOVERY_SYSTEM.md section 8](./RECOVERY_SYSTEM.md#8-winnerloser-neutralization) for the detection logic.

Output:

- Top winners by position gain
- Top winners by commercial value (volume * intent weight)
- Top winners by visibility impact (volume * CTR-curve-position)
- Top losers by position loss
- Top losers by visibility impact
- The likely reason why the index is flat or moving in the opposite direction from keyword movement

### 4. Money keyword protection

Detect important commercial keywords that should be protected. The user provides a money keyword list; the skill checks status. If no list is provided, the skill heuristically identifies candidates by combining search volume, intent signals, and the user's category data.

For each money keyword, output:

- Keyword
- Current position
- Previous position
- Change
- Ranking URL
- Intent (transactional, commercial-investigation, navigational, informational)
- Commercial priority (high, medium, low)
- Protection recommendation
- What not to change

See [RECOVERY_SYSTEM.md section 7](./RECOVERY_SYSTEM.md#7-money-keyword-protection) for the protection rules.

### 5. URL-level recovery analysis

Group keyword movements by ranking URL. For each URL:

- Number of gained keywords
- Number of lost keywords
- Top 10 changes
- Top 3 changes
- Commercial keyword changes
- Visibility impact estimate
- URL type (category, product, guide, blog, homepage, comparison, brand, unknown)
- Recommended action

See [RECOVERY_SYSTEM.md section 9](./RECOVERY_SYSTEM.md#9-url-recovery-analysis).

### 6. Recovery stage classification

Classify the recovery into one of six stages. Each stage represents a milestone in the recovery sequence.

- Stage 0: no recovery signal
- Stage 1: keywords return to Top 100 / Top 50
- Stage 2: keywords move into Top 20
- Stage 3: important keywords move into Top 10
- Stage 4: money keywords move into Top 5 / Top 3
- Stage 5: visibility index, GSC clicks, and revenue follow

The framework's operational finding is that AI Overview citations and ChatGPT/Perplexity mentions often move 2-6 weeks before classical SISTRIX VI does. The recovery stage classification reflects this: Stage 4 commonly arrives before Stage 5, and the operator should not panic when Stage 5 lags.

#### Per-cluster stage classification

Recovery does not progress uniformly across all keyword clusters. A site can be Stage 5 on its brand/authority cluster while Stage 1 on a competitive commercial cluster. The Monday check should output a stage classification **per keyword cluster**, not just a single global stage.

Cluster identification:
- Group keywords by the ranking URL's topic area (e.g., "brand terms", "authority guides", "product variants", "product features", "long-tail terms")
- If URL-type classification is available, group by URL type (category, product, blog, brand)
- Assign each cluster its own stage independently

Output format per cluster:

| Cluster | Stage | Key signal | Top keyword | Position | Trend |
|---|---|---|---|---|---|
| Brand terms | Stage 5 | Revenue follows | brand-anchor query | Pos 2 | Stable |
| Authority guides | Stage 4 | Pos 1–5 on multiple guide queries | informational anchor query | Pos 1 | Rising |
| Product variants | Stage 2 | Entering Top 20 | variant-specifier query | Pos 19 | New |
| Long-tail terms | Stage 1 | Pos 40–90 test positions | various | Pos 40–90 | Volatile |

The global stage classification remains as the minimum stage across commercially important clusters, or the weighted average if the operator prefers. The per-cluster view prevents the misleading conclusion that "recovery is at Stage X" when different parts of the site are at very different stages.

### 7. Recovery Signal Score

A composite score from 0 to 100 summarizing the strength of the recovery signal. See [RECOVERY_SYSTEM.md section 10](./RECOVERY_SYSTEM.md#10-recovery-signal-score) for the calculation.

Interpretation:

- 0 to 20: no meaningful recovery
- 21 to 40: weak early signal
- 41 to 60: early recovery, needs validation
- 61 to 80: strong recovery signal
- 81 to 100: strong recovery with business impact

### 8. Action classification

The skill returns one of six recommended actions:

- **Observe.** Positive early signal. Do not make large changes yet. Wait for the next Monday cycle to confirm.
- **Protect.** Important rankings are back. Avoid risky edits. Strengthen winners carefully.
- **Strengthen.** Winners are promising but need internal links, snippet tuning, or supporting content.
- **Investigate.** Index is flat because important losers may be neutralizing gains. Investigate before acting.
- **Correct.** Wrong URLs are ranking, cannibalization is present, or technical problems block recovery.
- **Escalate.** Important rankings and visibility continue to fall despite changes. Escalate to root-cause work.

### 9. What not to do

If important keywords are back in Top 3 or Top 10, the skill warns against:

- Major title rewrites
- H1 rewrites
- URL changes
- Canonical changes
- Noindex changes
- Removing internal links
- Radical content restructuring
- Deleting supporting content
- Changing templates without reason

The pattern this guards against: an operator under pressure who sees rankings recover and decides to "optimize" the winning page further, breaking the very state that produced the recovery.

### 10. Recommended safe actions

If the recovery signal is positive, the skill recommends:

- Monitor 48-72 hours for stability
- Compare next Monday
- Protect winning URLs
- Strengthen internal links pointing to winning URLs
- Check snippets carefully (CTR is the next lever after position)
- Confirm product availability for transactional pages
- Check price, trust, delivery, and conversion elements
- Track GSC impressions and clicks
- Check whether rankings convert (not just whether they exist)
- Document exact changes and dates for next-week attribution

### 11. GSC cross-check

If a GSC export is provided, the skill compares:

- Impressions
- Clicks
- CTR
- Average position
- Winning queries
- Losing queries
- Winning pages
- Losing pages

Interpretation patterns:

- SISTRIX keywords improve, GSC impressions do not: possible low-volume keyword recovery, possible ranking volatility, check date range and query sample.
- GSC impressions rise, clicks do not: rankings may still be outside high-click positions, snippets may be weak, SERP features may compress CTR.
- GSC clicks rise, SISTRIX index flat: business signal may be better than the visibility index suggests. Trust the click data for revenue impact; trust the index for competitive positioning.

### 12. Conversion rate validation layer

If conversion rate (CR) or revenue data is available alongside the ranking data, the Monday check should include a CR validation that answers: is the recovery bringing the right traffic?

#### Interpretation matrix

| VI trend | CR trend | Interpretation |
|---|---|---|
| Rising | Rising | Genuine recovery. Rankings are attracting qualified users who convert. Strongest validation signal. |
| Rising | Flat | Recovery traffic is reaching the site but not converting yet. Possible causes: landing page issues, pricing mismatch, product availability problems, wrong URL ranking for the intent. Investigate page experience on recovering URLs. |
| Rising | Falling | Warning signal. Traffic is increasing but conversion quality is declining. Possible causes: recovery on informational rather than transactional queries, cannibalization sending users to wrong pages, or a UX regression coinciding with the recovery. Do not celebrate the VI improvement until CR stabilizes. |
| Flat | Rising | Silent recovery. Rankings may not be dramatically improving, but the existing traffic is converting better — possibly due to technical fixes (page speed, checkout flow) or trust signal additions (reviews, schema). Track whether this CR gain holds as traffic grows. |

#### CR baseline

The operator should establish a CR baseline at the start of recovery work. The Monday check compares current-week CR against that baseline. A material CR improvement (>20 % relative) during recovery is a positive validation signal independent of VI movement.

#### Stock-out interaction

If a recovering product page has out-of-stock products (see decision rule `r-stockout-mutes-recovery` in [DECISION_ENGINE.md](./DECISION_ENGINE.md)), the CR for that URL should be excluded from the aggregate CR calculation or flagged separately. OOS pages will show zero conversions regardless of traffic quality, skewing the CR validation downward.

### 13. Output contract

The final report follows a fixed shape (updated to include CR validation and per-cluster stages):

- Executive Summary (3-4 lines)
- Recovery Stage (global + per-cluster table)
- Recovery Signal Score
- Visibility Index Interpretation
- Top Keyword Winners
- Top Keyword Losers
- Money Keyword Protection List
- URL-Level Recovery Table
- Winner/Loser Neutralization summary
- Conversion Rate Validation (if CR data available)
- GSC Cross-Check if available
- Recommended Action (one of the six classes)
- What Not To Touch
- Next 7-Day Monitoring Plan
- Next Monday Checklist
- Confidence Level
- Data Limitations

### 14. Example interpretation

If the user has 200+ keywords returned, an important transactional keyword at position 2, and a flat visibility index, the skill should output:

> This is a positive recovery signal. The visibility index may be lagging or neutralized by losses elsewhere. Do not make aggressive changes to winning URLs. Analyze whether important losing keywords are offsetting the gains. Protect the ranking URL for the important money keyword. Cross-check impressions, clicks, and revenue in GSC and shop data.

The recommended action would be `Protect`. The Recovery Signal Score would be in the 61-80 range pending GSC confirmation.

### 15. Synthetic example

A synthetic example folder ships at `examples/synthetic-sistrix-monday-check/`. The example uses:

- Domain: `example-furniture-shop.test`
- Important keyword: `office chair ergonomic 27 inch`
- Scenario: current position 2, previous position 18, 200+ keywords returned, visibility index flat, some head terms lost, GSC impressions rising, clicks not yet fully recovered

All data is synthetic. No real company names, no real exports, no real revenue numbers. The README in that folder shows the input CSV shape and the expected output Markdown.

## Privacy

Files to protect per [.gitignore](./.gitignore):

- SISTRIX exports (`sistrix-exports/`, `*_sistrix*.csv`)
- GSC exports (`gsc-exports/`)
- Client keyword exports (`*_keywords*.csv`)
- Private visibility reports (`*_visibility*.csv`)
- Real ranking exports (`*_ranking*.csv`)

The skill writes its output to a gitignored directory by default (`./output/sistrix-monday-checks/<sanitized-domain>-<YYYY-MM-DD>.md`).

When the user runs the skill in private-local-data or sensitive-client-data mode (see [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-privacy-and-client-data) for the privacy posture), the output filename is further hashed and the path is mode-0700.

## What this skill does not do

It does not call the SISTRIX API in v0.5.1. CSV-first only.

It does not predict ranking with certainty. The Recovery Signal Score is a calibrated heuristic, not a forecast.

It does not recommend rewriting winning content. The "What Not To Touch" section is explicit about this.

It does not require API keys.

It does not send any data outside the user's machine.
