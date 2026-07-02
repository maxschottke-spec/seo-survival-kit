---
name: subscription-monetization-audit
description: 'Use when analyzing a subscription or recurring-revenue business (news site, paywall publisher, SaaS-light, membership platform, e-commerce with subscription tier) for monetization gaps and revenue-growth levers. Combines outside-in detection (paywall structure, tier visibility, ad density, trust signals) with optional inside-out import of MRR / churn / cohort data from a Stripe / Chargebee / Recurly CSV export. Triggers include "wir verbrennen Geld und wissen nicht woher das Wachstum kommen soll", "MRR stagniert", "Abo-Konversion ist zu niedrig", "subscription revenue model review", "premium tier evaluation", "warum wachsen wir nicht mehr", "Burn-Rate vs. Revenue-Lücke schließen". Anti-Use: NICHT für reine transaktionale E-Commerce-Shops ohne Subscription (`channel-economics-analyzer` ist dafür), NICHT für B2B-Enterprise-SaaS mit Custom-Pricing (anderes Playbook), NICHT für Pre-Revenue-Startups (Skill setzt eine bestehende Subscription-Basis voraus).'
user-invocable: true
argument-hint: '[domain | --csv path-to-export.csv]'
allowed-tools: [Read, Write, Bash(node:*), Bash(curl:*)]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.4'
  category: marketing
---

# Subscription Monetization Audit

## Overview

A framework for diagnosing revenue gaps in subscription / recurring-revenue businesses and identifying the five to seven monetization levers that close the gap. Works in two modes that produce different depth of insight:

- **Outside-In mode** — purely from the public website. Detects paywall structure, tier setup, ad-network density, trust signals, AI-shopping readiness. Lower confidence, no MRR / churn data.
- **Inside-Out mode** — adds a CSV export from the subscription billing system (Stripe / Chargebee / Recurly / Shopify Subscriptions / custom dashboard). Computes MRR, ARPU, churn, cohort retention, plan distribution. Much higher confidence.

The skill is consciously not vertical-specific. The same five-lever playbook applies to a news paywall, a SaaS plugin marketplace, a fitness membership site, or an e-commerce shop with a subscription tier — only the relative weights shift.

## When to use

- Subscription business with stagnant or declining MRR
- Need to identify ARPU-lift options (typically a Premium-Tier introduction)
- Acquisition has slowed and the team needs to know where the next 50–100k EUR / month is coming from
- Investor or board needs a structured monetization analysis with a 12 to 24 month outlook
- Workshop or strategy session preparation where the question is "wo kommt das Wachstum her"

**Don't use for:**
- Pure transactional e-commerce without a subscription tier (use `channel-economics-analyzer`)
- B2B Enterprise SaaS with negotiated custom pricing (different playbook entirely)
- Pre-revenue startups (skill assumes an existing subscription base to optimize against)
- Pure ad-supported sites with no paywall (the levers don't apply)

## YMYL notice

If the subscription business is in a regulated industry (medical telemedicine, financial advisory, legal advice, gambling), the action plan output by this skill should be reviewed by a domain compliance expert before publication or implementation. The skill treats all subscription models uniformly at the monetization-mechanics level and does not validate industry-specific regulatory constraints.

## Two analysis modes

### Outside-In mode (always available)

Anything the skill can detect from the public website without authenticated access:

| Signal | What it tells you |
|---|---|
| Paywall present? Where? | Hard / soft / metered / freemium model |
| Number of pricing tiers | 1-tier = ARPU-Lift potential, 3+ tier = mature optimization needed |
| Tier price range (lowest to highest) | ARPU ceiling estimate |
| Trial period length / Reverse-Trial signals | Conversion-funnel design quality |
| Annual-vs-monthly visibility | Yearly-bias often missed, ARPU-stabilizer |
| Ad networks detected (Google, Plista, Outbrain, Ströer, Taboola) | Ad-revenue diversification status |
| Newsletter sign-up prominence | Owned-channel-growth posture |
| Live event / conference mentions | Event-revenue potential |
| Affiliate / shop integration | Adjacent revenue streams |
| Donation / membership CTAs | Genossenschaft-style stream |
| Cancel-flow accessibility | Retention-engineering quality |

### Inside-Out mode (CSV import, optional)

Hand the skill a subscription-export CSV (see CSV format below). The included `csv-import.example.js` script computes:

- **MRR + ARR + ARPU** (total and per plan)
- **Active subscriptions** by status, plan, billing period
- **Churn 30/60/90 day rates** (logo + revenue)
- **Cohort retention** (signup-month against active-after-N-days)
- **Plan distribution** (yearly vs monthly vs other)
- **Customer Lifetime Value** by plan (median + average)
- **Pending cancellations and MRR at risk**
- **Win-Back-Pool size** (customers with ended subscription, optionally still active on site)

Inside-Out doubles or triples the analytical depth versus Outside-In, because the levers can be quantified against the actual user base.

## The five standard monetization levers

Each lever has a real-market vorbild documented so it does not read as speculation. Each lever has a default sizing formula that the skill applies to the user's actual numbers (Inside-Out) or to industry-typical benchmarks (Outside-In).

### Lever 1: Premium-Tier introduction (largest ARPU effect)

**Mechanik:** A subscription base on a single tier at low ARPU (e.g. 9-15 EUR / month) leaves significant pricing-power unused. Introducing a Premium-Tier at 2 to 3x the base price, with three to four clear additional benefits (exclusive content, audio-version, no-ads, early access, premium newsletter), typically converts 15-30 percent of existing subs and 25-40 percent of new subs to the higher tier.

**Rechnung (Inside-Out):** New ARPU = (1 - premium_share) × base_arpu + premium_share × premium_arpu. With 25 percent premium share at 2.5x base price, blended ARPU rises 38 percent.

**Vorbild:** WELTplus (Springer) WELTplus Premium tier, Bild Plus Bild+ tier, Apple News+, Politico Pro tier structure.

**Aufwand:** 2 to 3 months product + content setup. Engineering is moderate, the bottleneck is the content pipeline for exclusive Premium content.

### Lever 2: Conversion-Pool activation (largest sub-count effect)

**Mechanik:** Most subscription sites have a substantial active-non-subscriber base (users who read regularly but never converted). Structured soft-paywall sequences with progressive escalation (limit after 3 articles, reminder after 5, soft-sealing after 8 with first-purchase discount) typically lift conversion-rate from this pool by 2-5x over baseline.

**Rechnung (Inside-Out):** Pool-size × conversion-rate-lift × ARPU × 12 = annual incremental MRR. Even a 1 percent monthly conversion improvement on a 10,000 active-non-sub pool yields 100 new subs / month, 1,200 / year, at ARPU × 12 ARR per cohort.

**Vorbild:** Bild Plus 2023-2024 conversion-rate doubling, New York Times metered-paywall optimization, Politico EU member conversion funnel.

**Aufwand:** 1 to 2 months, primarily conversion-optimization and marketing-automation work.

### Lever 3: Win-Back of churned subscribers

**Mechanik:** Subscribers who cancelled and are still active on the site are a high-intent reactivation pool. Structured win-back-sequences (E-Mail "we miss you / here are 3 articles you've missed", 50-percent-off for 3 months, personalized editor offer for power-users) typically reactivate 10-25 percent of the still-active-churned cohort.

**Rechnung (Inside-Out):** Churned-but-active-on-site × reactivation-rate × ARPU × average-tenure-after-reactivation. Smaller absolute numbers than Lever 1 and 2 but very high ROI because operating cost is low.

**Vorbild:** Substack publisher win-back-flows, Netflix winback playbook documented across multiple Forbes / Variety pieces.

**Aufwand:** 1 month, primarily marketing-sequence design.

### Lever 4: B2B Adjacency / Professional Newsletter

**Mechanik:** For news, publisher, or content-driven subscription businesses, there is often a professional B2B audience (lobbyists, PR agencies, public-affairs managers, agencies, competitors) who would pay 5-20x consumer-ARPU for a paid professional version of the same content cleanly packaged. Examples: morning briefings, weekly trend reports, exclusive data access.

**Rechnung:** Even 200 Standard + 50 Pro subscribers at 100 EUR + 500 EUR / month = 45,000 EUR / month = 540,000 EUR / year, at low ongoing cost.

**Vorbild:** Politico Pro EU, Tagesspiegel Background, FT Confidential, Axios Pro, Stratechery Pro.

**Aufwand:** 3 to 6 months for product + editorial design.

### Lever 5: Live Events / Conferences

**Mechanik:** Subscription audiences with engagement and brand affinity convert into ticket buyers at high margins. One or two events per year, 500-1000 attendees at 250-800 EUR + sponsorship from category-aligned brands.

**Rechnung:** First year 200,000-400,000 EUR brutto. Year 2 with two events plus livestream-tier: 800,000-1,500,000 EUR.

**Vorbild:** Axios (30 percent of revenue from events), Stratechery (annual conference), every major publisher in DACH (Wirtschaftswoche, Welt, Tichys, Compact).

**Aufwand:** 200,000 EUR setup year one, profitable from year two.

## Two bonus levers

### Bonus 6: Overdue invoice collection (immediate cash)

If Inside-Out mode reveals significant overdue receivables (typical pattern: 10-15 percent of ARR sits in 30+ day-overdue status), a structured dunning process plus optional collections for 90+ day items typically recovers 60-80 percent of the overdue volume within 60-90 days.

**Aufwand:** 1 month operations work.

### Bonus 7: Ad-stack optimization (where applicable)

If the site monetizes with display ads alongside subscriptions and currently runs only Google Ads sparsely, adding 2-3 premium ad networks (Plista, Outbrain, Ströer, Taboola in DACH) and fixing Mobile-PageSpeed below the Google threshold (often a 30→65 PSI jump) typically lifts RPM from 2-3 EUR to 8-15 EUR, multiplying ad revenue.

This lever is secondary for subscription-first businesses. It is a primary lever in `seo-outreach-report` for ad-supported sites.

## The negative-trend discipline

**The rule:** Before applying any conversion-lever (1, 2, 3), if the signup trend is declining month-over-month, the underlying cause of the decline must be diagnosed and addressed first.

**Why:** Conversion-rate improvements on a shrinking acquisition base produce shrinking absolute numbers. The hebel sizes in this skill all assume stable or growing acquisition.

**Common causes of signup decline (in order of frequency):**

1. Marketing budget cut or campaign halted (verify with marketing-spend history per channel per month)
2. Channel algorithm change (YouTube, Facebook, Google Discover, Apple News)
3. Saisonality (US-election-cycle for political content, summer-slump for news, Black-Friday-anchor for e-commerce)
4. Competitive entry (a new site in the same vertical absorbing attention)
5. Editorial / programmatic shift losing audience-fit

**Output:** the skill explicitly flags signup-trend in the report and prefixes lever-rechnung with the disciplinary note "lever sizing assumes acquisition stabilization."

## Premium-Tier ARPU calculator pattern

For Inside-Out mode, the skill computes whether the user's stated goal (e.g. "100,000 subscribers by end of 2027") is consistent with the burn-coverage requirement. The 2-tier rechnung:

```
target_subs = 100,000
target_arr_needed = 16,000,000 EUR (= burn requirement)
required_blended_arpu = target_arr_needed / target_subs / 12 = 13.33 EUR

If current ARPU is 9 EUR, blended ARPU 13.33 EUR requires:
  - all-base scenario: 100,000 × 9 × 12 = 10,800,000 EUR (insufficient — 5.2M gap remains)
  - 30 percent premium at 25 EUR base 9 EUR scenario:
    100,000 × (0.7 × 9 + 0.3 × 25) × 12 = 100,000 × 13.80 × 12 = 16,560,000 EUR (covers)
```

This pattern surfaces the most common subscription-business mistake: "more subscribers" is treated as the only growth lever, when "higher blended ARPU" achieves the same dollar goal with less acquisition risk.

## CSV import format

The CSV-import script accepts a generic format that maps from most major subscription-billing systems (Stripe, Chargebee, Recurly, Shopify Subscriptions, custom). Minimum required columns:

```
subscription_id, customer_id, plan_name, billing_period, amount_eur, currency, start_date, end_date, status, churn_date
```

Optional columns the script uses if present:
- `last_login_date` — for active-non-subscriber pool detection
- `trial_end_date` — for trial-conversion tracking
- `payment_provider` — for provider-distribution breakdown
- `country` — for geo-segmentation
- `coupon_code` — for promo-effectiveness tracking
- `cancellation_reason` — for churn-cause analysis

The script:
1. Validates column-presence and rejects with clear error if minimum columns missing
2. Computes the KPI snapshot (MRR, ARR, ARPU, churn 30/60/90, cohort retention, plan distribution)
3. Writes a `subscription-summary-<date>.json` to `~/.cache/seo-rescue/`
4. The skill reads that summary and constructs the lever-rechnung against actual data

Run as: `node csv-import.example.js path-to-export.csv`

A worked example CSV with synthetic data is at `csv-import.example.csv`.

## Common rationalization traps

| Statement | Reality |
|-----------|---------|
| "We just need more subscribers" | Without ARPU lift, even 10x subscribers may not cover the burn |
| "Premium-Tier will cannibalize our base subs" | Empirical data from Welt Plus, Bild Plus, NYT shows the opposite: Premium-Tier accelerates total subscriber growth because it gives a higher-intent commitment-path |
| "We can't introduce a B2B tier, our content isn't B2B" | If your content reaches a professional audience (journalists, agencies, lobbyists, competitors), there's a B2B version. The question is packaging, not content |
| "Events are too operations-heavy" | First year is. Year two onwards is 30-50 percent margin if format is right |
| "Win-Back is a small lever, not worth it" | Wrong unit-economics. ROI per hour of work is highest of any lever because operating cost is near-zero |
| "Our paywall is hard-walled, that's why ARPU is low" | Hard-walled paywalls minimize the conversion-pool (Lever 2). Soft / metered models almost always outperform hard models on total revenue |

## Output

In Outside-In mode: a structured Markdown report covering the seven detection signals, the five-lever sizing against typical benchmarks, the negative-trend discipline check, and four open questions the team would need to answer for a full Inside-Out analysis.

In Inside-Out mode: same structure but with quantified hebel-rechnung against the actual numbers, plus the Premium-Tier-ARPU-Goal calculator output, plus a cohort-retention diagnosis.

Both modes can be rendered into a PDF via the `make-pdf` skill or `seo-outreach-report`-style pipeline if the user wants a workshop-grade deliverable.

## Related skills

- `seo-outreach-report` — for the SEO + visibility side of the same domain. Often run together.
- `channel-economics-analyzer` — for pure transactional e-commerce without subscriptions.
- `ai-search-rescue` — for the AI-visibility layer that increasingly drives subscription-acquisition.
- `post-core-update-recovery` — if subscription growth has slowed because of a Google Core Update affecting acquisition.
- `make-pdf` — to render the analysis as a workshop-grade PDF deliverable.

## Real-world anchor data (anonymized)

The skill's lever-sizing benchmarks (Premium-Tier 25-30 percent conversion, Conversion-Pool 1-2 percent monthly, Win-Back 10-25 percent on still-active-churned cohort) come from a combination of:

- One DACH news-site case (mid-five-digit subscriber base, recent monetization-gap diagnosis, full Inside-Out access)
- Two SaaS-light memberships (subscriber bases 1,000-5,000)
- Published Substack publisher win-back data
- Springer / Burda / Madsack public investor-report disclosures about ARPU and tier-conversion
- Axios and Politico publicly documented event-revenue and B2B-newsletter performance

These are observation-based starting hypotheses for the lever-sizing. Calibrate against your actual numbers in Inside-Out mode.
