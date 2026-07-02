# Decision Engine

Logic that turns diagnostic evidence into prioritized, sequenced, confidence-rated recommendations. Sits above individual skills; new skills feed the engine, the engine produces decisions.

Companion docs: [ARCHITECTURE.md](./ARCHITECTURE.md) for system shape, [RECOVERY_SYSTEM.md](./RECOVERY_SYSTEM.md) for the recovery-specific layer that the engine consumes, [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) for the weekly workflow that exercises the engine.

---

## 1. Decision-first manifesto

Five claims that shape the engine. They are not features. They are operating principles that every other section in this document derives from.

**1. Deciding is harder than executing.** Most operator pain during recovery and growth is not "I don't know how to execute"; it is "I don't know whether to execute this right now". The engine focuses on the decision.

**2. Sequencing matters more than action.** A correct action at the wrong time is often worse than an incorrect action at the right time. Sequencing logic is a core contribution, not an afterthought.

**3. Protection beats optimization during recovery.** The default during recovery is leave the winning URLs alone. Operator panic-edits during recovery are the highest-cost mistakes the engine guards against.

**4. Confidence is information.** A recommendation without confidence is dishonest. Every output carries explicit confidence. The engine refuses to project certainty it does not have.

**5. Profit gates priority.** Search volume does not equal revenue. CTR does not equal profit. The engine ranks opportunities by profitable leverage, not by traffic potential alone. When margin data is missing, the engine says so rather than substituting a proxy.

---

## 2. Decision rules catalog

Each rule is a short, named, source-cited entry that applies in specific conditions. Rules either block a recommendation, sequence one before another, or modify confidence. Rules grow as new patterns emerge through real cases.

### r-margin-unknown-no-scale

- **Condition.** Contribution margin unknown or not validated.
- **Blocks.** Any recommendation to scale paid spend on any channel.
- **Sequences.** Margin and COGS clarification first.
- **Reason.** Channels with positive ROAS can be unprofitable if contribution margin after ad spend is negative. Scaling amplifies the loss.
- **Confidence.** High.

### r-roas-positive-margin-negative

- **Condition.** ROAS reported positive but contribution margin after ad spend is negative.
- **Blocks.** Budget increase.
- **Sequences.** Margin review (COGS, fulfillment, refunds, fees).
- **Reason.** ROAS does not include COGS, fulfillment, refund costs. A 2.0 ROAS on a 60%-COGS product with 5% refund rate produces negative contribution margin per order.
- **Confidence.** High.

### r-seo-loss-low-revenue-impact

- **Condition.** SEO traffic loss is significant but revenue loss is proportionally smaller.
- **Sequences.** Position the SEO loss as visibility/pipeline risk rather than immediate revenue disaster. Continue recovery work without panic.
- **Confidence.** Medium-High.

### r-paid-low-seo-primary

- **Condition.** Paid spend is low and SEO is the primary acquisition channel.
- **Sequences.** SEO recovery before paid media expansion.
- **Confidence.** Medium-High.

### r-weak-lp-cro-first

- **Condition.** Landing-page conversion rate weak (significantly below channel benchmark) while ad CTR acceptable.
- **Sequences.** CRO before budget scaling.
- **Reason.** Scaling spend on a weak landing page wastes budget. CRO improvements compound across current and future spend.
- **Confidence.** High.

### r-no-revenue-data-low-confidence

- **Condition.** Revenue, margin, or conversion data cannot be provided.
- **Sequences.** Output confidence set to low; recommendations stated as hypotheses requiring validation.
- **Confidence.** High (framework principle).

### r-fiverr-no-guarantee

- **Condition.** Buyer asks for guaranteed rankings, revenue, or AI Overview citations.
- **Blocks.** Acceptance of the guarantee.
- **Sequences.** Offer diagnostic scope only. Refuse the guarantee plainly.
- **Confidence.** High (industry consensus).

### r-low-hourly-rate-flag

- **Condition.** Effective hourly rate on a productized offer below threshold.
- **Sequences.** Flag as commercially unattractive. Recommend repricing or descoping.
- **Confidence.** High.

### r-account-access-low-ticket

- **Condition.** Service requires deep account access; sold as low-ticket gig.
- **Blocks.** Selling access-required offer as low-ticket.
- **Sequences.** Move to scoped consulting with appropriate pricing.
- **Confidence.** High.

### r-sistrix-vi-flat-money-keywords-recovered

- **Condition.** Visibility index flat or slightly negative; 200+ keywords returned; important transactional money keywords moved into Top 5 or Top 3.
- **Sequences.** Classify as positive recovery signal with visibility lag or neutralization. Switch to Protect mode. Investigate possible loser neutralization per [RECOVERY_SYSTEM.md section 8](./RECOVERY_SYSTEM.md#8-winnerloser-neutralization).
- **Reason.** Visibility index is volume-weighted; a few high-volume losses can mask broad mid-volume recovery. Money keyword recovery is the leading revenue indicator, not the VI.
- **Confidence.** Medium-High.

### r-money-keywords-top3-protect

- **Condition.** Important money keywords back in Top 3 or Top 10 on intended URLs.
- **Sequences.** Recommend Protect before further aggressive SEO changes. Do not edit winning URLs beyond the safe-to-make list in [RECOVERY_SYSTEM.md section 7](./RECOVERY_SYSTEM.md#7-money-keyword-protection).
- **Confidence.** High.

### r-ai-citations-leading-indicator

- **Condition.** Recovery work is multi-week into Phase R1 or R2; AI citation counts rising while classical SISTRIX VI flat.
- **Sequences.** Continue Authority-First recovery on its own merits and log the AI-citation signal. Do not abandon strategy because VI is flat — but also do not report recovery or change course based on rising AI citations alone.
- **Reason.** Hypothesis (N=1, currently unproven): AI citation growth MAY be an early signal of Authority-First recovery being recognized, with classical VI following on a 2-6 week lag. The pilot-case observation behind this rule was rescinded on 2026-06-03 — the AI-citation rise coincided with a pre-update plateau that a subsequent Core Update erased (see `post-core-update-recovery/LESSONS.md`).
- **Confidence.** Low (single rescinded case observation; direction consistent with EEAT-weighted signals informing AI surfaces, but unvalidated).

### r-csv-first-no-api-claim

- **Condition.** Skill without active live API integration being documented or marketed.
- **Blocks.** Framing that suggests API integration is active.
- **Sequences.** Document as CSV-first with optional future API support marked as planned.
- **Confidence.** High (framework anti-overclaim principle).

### r-stockout-mutes-recovery

- **Condition.** Recovering product page ranks on a money keyword, but the product is out of stock (OOS) or has critical delivery delays.
- **Blocks.** Content or SEO optimization work on that URL while OOS persists.
- **Sequences.** Stock replenishment or availability fix before any content/SEO investment on the URL.
- **Reason.** Out-of-stock products on recovering URLs can corrupt the engagement and revenue signals that validate recovery work. Full mechanism analysis belongs in engagement-specific private playbooks.
- **Confidence.** Medium-High (one confirmed case; consistent with known Google behavior toward low-engagement pages).

### r-refund-rate-exceeds-threshold

- **Condition.** A sales channel's refund/return rate exceeds 25 % (industry norm for most product categories: 10–15 %).
- **Blocks.** Budget scaling or inventory expansion on that channel.
- **Sequences.** Root cause analysis (listing quality mismatch? fulfillment issues? product-expectation gap? size/variant confusion?) before any growth investment.
- **Reason.** High refund rates eliminate margin regardless of topline revenue. A channel with 3,000 € monthly revenue and 35 % refunds delivers ~1,950 € net before COGS — often below break-even after fulfillment and return processing costs. Scaling amplifies the loss. ROAS calculations that ignore refunds overstate channel health.
- **Confidence.** Medium-High (one confirmed case; threshold aligns with marketplace seller benchmarks).

### r-batch-change-velocity-cap

- **Condition.** Operator plans to change more than 5 URLs in a single day during active recovery (Stage 1–4).
- **Blocks.** Executing all changes on the same day.
- **Sequences.** Spread changes across 3–5 days. CMS template switches count as high-impact changes. Monitor live visibility between batches.
- **Reason.** Observed pattern: 13 URL changes + 5 CMS template switches in a single day during Stage 3-4 recovery caused an 11 % same-day live visibility drop. The weekly trend remained positive and the drop corrected within days, but the intraday signal was measurable and avoidable. Each CMS template switch changes the rendered HTML structure on the same URL — Google treats this as a page-level change even when text content is identical.
- **Confidence.** Medium (one confirmed case; consistent with known Google behavior during re-evaluation periods).

### r-shared-cms-layout-content-block

- **Condition.** Operator plans to add a content block to a CMS page/layout that is shared by multiple categories or URLs.
- **Blocks.** Adding the content block to the shared layout.
- **Sequences.** First create a dedicated layout for the target category, reassign it, then add content to the dedicated layout.
- **Reason.** In CMS platforms that allow layout sharing (Shopware "Shopping Experiences", WordPress shared templates), a content block added to a shared layout deploys to ALL pages using that layout — not just the intended one. Observed: content intended for a secondary category appeared on a #1-ranking page and 5 other unrelated categories for several hours before detection. This creates instant duplicate content and can corrupt ranking signals on high-value pages.
- **Confidence.** High (one confirmed case with immediate visible impact; platform behavior is deterministic, not probabilistic).

### r-blog-authority-carries-recovery

- **Condition.** During recovery, blog/editorial pages deliver 5x+ more clicks per URL than category/product pages.
- **Sequences.** Protect blog pages with Do-Not-Touch. Use blog authority to bridge trust to category pages via internal links (blog → category). Do not restructure, move, or merge blog content during recovery.
- **Reason.** Observed pattern: 24 blog URLs delivered 6.5 clicks/URL average while 335 category/product URLs delivered 0.8 clicks/URL. Blog pages retained authority through the Core Update while category pages lost it. The blog serves as the trust anchor for recovery — internal links from blog to category transfer this trust signal.
- **Confidence.** Medium-High (one confirmed case; consistent with Core Update authority-preservation pattern where editorially strong content survives while thin commercial content drops).

### r-high-impressions-low-ctr-page2

- **Condition.** A page has >1,000 monthly impressions but <0.5 % CTR, positioned on page 2 (positions 11–20).
- **Sequences.** Investigate before optimizing. Check: (a) is the meta title/description compelling? (b) is the ranking URL the correct intent-match for the query? (c) is a SERP feature (AI Overview, Shopping carousel) compressing organic CTR? Only after diagnosis: optimize meta description for CTR, or add content depth to push from page 2 to page 1.
- **Reason.** High impressions with near-zero CTR on page 2 is a recovery-phase signal: Google is testing the page for relevance but users aren't clicking. The page needs either a position improvement (to reach above-fold visibility) or a snippet improvement (to compete for clicks at current position). Premature content changes can disrupt the testing phase.
- **Confidence.** Medium (one confirmed case with 2,000+ impressions at 0.2 % CTR on a page-2 position).

### Adding rules

New rules land per the lifecycle in [ARCHITECTURE.md governance](./ARCHITECTURE.md#release-gating): observe across 3+ confirmed cases, document with all required fields, tie to source(s), add to relevant skill's `LESSONS.md`, reference in skill output when fired. Rules added without 3+ confirmations are labeled "experimental" and apply at low confidence only.

### Removing rules

Rules retire when underlying conditions change (Google behavior shifts), additional cases contradict the rule, or a more refined rule replaces it. Retired rules are documented in CHANGELOG.md with the version they were removed in and the rationale.

---

## 3. Evidence weighting

Four levels of source quality. Higher levels produce higher-confidence recommendations.

**Level A (highest).** Official platform documentation (Google Search Central, Quality Rater Guidelines, PSI methodology, schema.org, DataForSEO docs, OpenAI/Perplexity API docs), first-party data from real projects, verified exports, documented client outcomes. Recommendations backed by A can be stated directly with high confidence.

**Level B (high).** Strong agency case studies with disclosed methodology and concrete before/after data, conference talks with disclosed evidence (not opinion), reputable industry reports with disclosed methodology, well-documented public frameworks independently validated. Recommendations backed by B are stated as patterns with high confidence.

**Level C (medium).** Practitioner blog posts without before/after data, podcast expert commentary, well-tracked-author social posts, single-case lessons from private experience not yet confirmed across multiple cases. Recommendations backed by C are stated as hypotheses with explicit medium confidence.

**Level D (lowest, generally excluded).** Unverified claims, forum comments, competitor marketing, weak screenshots, "I once saw this work" anecdotes. The framework does not base recommendations on Level D sources.

### Confidence levels for output

- **High.** Backed by Level A, or multiple converging Level B, or Level B + first-party data.
- **Medium.** Backed by Level B alone, or Level B + C, or Level C pattern with consistent observations across multiple cases.
- **Low.** Backed by Level C alone, or single-case lesson from private experience not yet confirmed.

A recommendation that cannot reach at least medium confidence is presented as a hypothesis, not a recommendation. The engine deliberately avoids confident statements built on weak evidence.

### Hypothesis verification overlay

Evidence-weighting governs what the engine recommends. The Hypothesis Verification Gate (see `references/HYPOTHESIS_VERIFICATION_GATE.md`) governs whether a recommendation may be executed live. The two layers are independent.

A medium-confidence recommendation built from Level B sources may still be at hypothesis status `suspected` if it has not been verified against the operator's specific stack. The engine emits the recommendation; the gate blocks the live execution until verification occurs.

Mapping between evidence levels and hypothesis verification:

- **Level A or strong-tier verification source** (direct API state, server file, GSC URL Inspection, staging, developer/operator inspection) → hypothesis may reach `verified`
- **Level B or medium-tier verification source** (cross-checked live HTML, crawl signals, third-party tool output specific to the URL) → hypothesis at most `likely`, requires escalation to a strong-tier source for `verified`
- **Level C or weak-tier verification source** (pattern match, AI reasoning chain, timing correlation, open-source code reading alone) → hypothesis at most `suspected`

Multiple weak-tier sources do not aggregate into `verified`. They aggregate into `likely` if they cross-confirm in independent dimensions, but the strong-tier verification step is still required before any live action.

### Source quality vs author authority

Sources are rated, not authors. A respected practitioner publishing a blog post without methodology is Level C. The same practitioner publishing a case study with before/after data is Level B. The same practitioner contributing to platform documentation is Level A. This prevents over-weighting any single voice.

### Source citation in output

Allowed in public docs: titles of public talks and articles, public URLs, author and outlet names, short factual stats with attribution, the framework's own paraphrased generalizations.

Not allowed: verbatim quotes longer than a sentence or two from copyrighted material, screenshots of slides/articles/dashboards, copying agency framework names presented as proprietary, reproducing agency case studies in their entirety, posting agency-internal documents.

---

## 4. Data quality layer

Data quality is treated as input to the engine's confidence assessment, not as a secondary concern. Each input is evaluated across four dimensions.

### Completeness

Does the input cover what the analysis needs? Examples: 500-keyword SISTRIX export for a 5,000-tracked-keyword site = 10% complete. 7-day GSC export when 90 days needed = ~8% complete. Channel economics with revenue but no COGS or fees = incomplete (margin uncomputable). AI citations data with only ChatGPT, missing Perplexity = partial.

### Recency

Is the data fresh enough that conclusions reflect current reality? Examples: GSC data from 14 days ago = fresh for most queries. SISTRIX export from 30 days ago = stale enough for recovery analysis unreliability. Channel economics from 90 days ago = usable for trend analysis, unreliable for current-state decisions.

### Accuracy

Is the data correct? Examples: GSC data with consent-mode gaps = accuracy reduced. Shop data with manual fixes applied = accuracy depends on fix quality. Channel economics with attributed (vs first-touch) revenue = accuracy depends on attribution model. AI citations with false positives from short brand tokens = accuracy reduced.

The hardest dimension to evaluate from the data alone. The engine relies on user-declared accuracy notes + pattern-based heuristics.

### Consistency

Do multiple data sources agree? Examples: GSC impressions and SISTRIX keyword movements directionally aligned = high consistency. GSC clicks rising while SISTRIX VI flat = explainable per rule `r-sistrix-vi-flat-money-keywords-recovered` but warrants investigation. Channel economics positive ROAS but shop CMS negative contribution margin = inconsistency that requires reconciliation before any recommendation.

Inconsistency between sources is information. The engine surfaces it rather than averaging it away.

### Data quality score

Per skill invocation, the engine computes a score per input:

- 1.0 — all dimensions strong
- 0.7-0.9 — one dimension weak
- 0.5-0.7 — two dimensions weak
- 0.3-0.5 — multiple dimensions weak; analysis confidence significantly reduced
- 0.0-0.3 — too low for defensible recommendations

A score below 0.3 causes the skill to refuse high-confidence recommendations and surface only directional observations with explicit data quality callouts.

### How data quality affects overall confidence

Recommendation confidence is the **minimum** of evidence quality and data quality. A platform-documented (Level A) recommendation applied to one week of GSC data on a site that needs 90 days of context has effective confidence "low", not "high".

The output names both factors. Example: "This recommendation is based on platform-documented principles (high evidence) but applied to limited data (data quality 0.4). Combined confidence: low. More data needed before increasing confidence."

### Data improvement recommendations

The engine surfaces concrete data-improvement actions ordered by impact: which addition would raise overall confidence the most. Example: "Add 60 more days of GSC data to raise SEO data quality from 0.5 to 0.8."

---

## 5. Profitability signals

Profitability is a first-class signal, not a derived afterthought. Profit-aware prioritization is one of the engine's core differentiators.

### Profit signals used

- **Gross margin per product/channel.** Revenue minus direct cost of goods.
- **Contribution margin after ad spend.** Gross margin minus ad spend allocable to channel/product.
- **Refund and return rates.** Percent of orders refunded or returned.
- **LTV and payback period.** Total customer revenue over a defined window; time to recover acquisition cost.
- **Conversion quality.** Conversion rate, AOV, quality-of-conversion (full-cart vs single-item, returning vs new).
- **MER (Marketing Efficiency Ratio).** Total revenue / total marketing spend.

### Profit signals NOT used

Lifetime value derived from ML attribution. Predicted revenue from ad-platform forecasting. Imputed margin estimates from industry benchmarks. The bias: real data from the user beats estimated data from any source. When real data is missing, the engine surfaces the gap rather than filling it.

### Profit-aware prioritization formula

```
profitable_leverage = (
  expected_traffic_gain
  × conversion_rate_estimate
  × AOV_estimate
  × contribution_margin_rate
  / implementation_effort_hours
  × recovery_risk_multiplier
  × confidence_multiplier
)
```

Each factor has its own confidence. Missing factors are surfaced as data gaps, not substituted with assumptions. When margin data is missing, the engine cannot compute profitable leverage and falls back to traffic-based prioritization with explicit "margin-blind" labels on recommendations.

---

## 6. Prioritization: five classes

The engine ranks recommended actions into five named classes. The classes are visible in skill output so the operator knows what the engine concluded and can override.

**Immediate priority.** This week. High profitable leverage, low recovery risk, high confidence, implementation effort fits operator's capacity. Examples: protect a recovering money keyword (do not touch the winning URL), strengthen internal links to a stable recovering URL with high commercial value, fix a clear technical issue blocking indexing on a non-recovering URL.

**Medium priority.** Next 2-4 weeks. High or moderate profitable leverage, low to medium recovery risk, medium to high confidence, may depend on data gathering or earlier action completion. Examples: add supporting articles to a recovering topic cluster (after R3), re-export GSC weekly to confirm a hypothesis before R4 actions, set up tracking for a channel with unreliable measurement.

**Monitor only.** Looks interesting; do not execute yet. High or moderate profitable leverage, high recovery risk OR low confidence OR data dependency. Examples: restructure a mixed-intent ranking URL (wait for stable rankings first), consolidate two similar recovering URLs (wait until one is clearly dominant), increase paid spend on a profitable channel (wait until tracking confidence is higher).

**Risky opportunity.** High potential, high downside risk. Specific failure modes known. Suitable only with careful, reversible execution. Examples: major content rewrite on a URL ranking for multiple queries (some may improve, others decline), URL consolidation during active recovery, new-URL creation in a topic the operator has not yet executed well.

Flagged but not blocked. The operator may proceed; the engine surfaces the risk explicitly.

**False opportunity.** Looks attractive in isolation; not commercially attractive given cross-channel picture. Examples: high-volume keyword for a product with negative contribution margin, high-traffic blog post target with no conversion path, high-volume keyword that the matching URL cannot realistically rank for due to authority gap.

Surfaced as "appears to be opportunity but is not"; explains why; recommends de-prioritizing.

### Override and feedback

The operator can override the engine's prioritization. The skill output supports: "Move to Immediate" with reason, "Move to Monitor only" with reason, "Block this recommendation" with reason.

Overrides are logged. After several overrides on the same pattern, the framework surfaces the pattern as a potential decision-rule update.

---

## 7. Sequencing across phases

Sequencing decides when actions happen, not just which actions matter. Every skill producing actionable recommendations runs them through a sequencer before output.

### Sequencing constraints

- **S1: Protection blocks optimization.** If a URL is in "winning during recovery" state, the sequencer blocks recommendations beyond the safe-to-make list per [RECOVERY_SYSTEM.md section 7](./RECOVERY_SYSTEM.md#7-money-keyword-protection).
- **S2: Data gathering before recommendations under low confidence.** If data confidence is low, the sequencer reorders to put data-gathering actions first.
- **S3: Margin work before paid scaling.** Per rule `r-margin-unknown-no-scale`.
- **S4: Tracking work before paid scaling.** Per future rule `r-paid-tracking-low-no-scale` (v0.8 codification).
- **S5: Recovery before growth during active recovery.** If post-Core-Update + less than 90 days into recovery, recovery actions take precedence over growth actions even when growth looks high-impact in isolation.
- **S6: Investigate before strengthen during High neutralization.** Strengthening winners while losers offset visibility produces no aggregate movement; losers are the lever.

### Cross-channel sequencing (roadmap)

When v0.6 ships Revenue Rescue and v0.8 ships paid media, the sequencer extends: recovery work on dominant channel before scaling minor channels; tracking before paid scaling; margin work before any channel investment increase; CRO work before paid scaling on weak landing pages.

### Sequencing output

When a skill produces a recommendation list, output includes:

- Current recovery phase (R0 to R5)
- Recommended actions for this week (current phase)
- Recommended actions for the upcoming 2-4 weeks (current phase + prep for next)
- Actions explicitly deferred to a later phase (with phase label)
- Actions blocked by sequencing constraints (with constraint cited)
- Phase advancement criteria for moving to the next phase

The operator sees the full plan but only the current-week actions are immediately actionable.

---

## 8. Cross-channel signals

How the engine integrates signals from multiple channels into coherent recommendations. v0.5 documents the architecture; v0.6-v0.8 implementation extends as channel skills ship.

### Signal taxonomy per channel

- **Volume signals.** Traffic, impressions, orders. Generally available, often unreliable as sole input.
- **Quality signals.** Conversion rate, AOV, CAC, refund rate. Higher-effort to obtain, much more decision-relevant.
- **Economics signals.** Contribution margin, gross margin, payback period, MER. Hardest to obtain, most decision-relevant. Often missing or unreliable.

The engine's bias: economics when available, quality when economics missing, volume only when nothing else is.

### Integration patterns

**P1: opportunity gating by margin.** SEO surfaces high-volume keyword. Paid shows positive ROAS for matching campaigns. Shop shows weak margin on matching products. Conclusion: lower priority despite search volume. Margin gates the opportunity.

**P2: business recovery exceeding visibility recovery.** SEO VI flat. Money keywords returning to Top 10 and Top 3. AI citations growing. GSC impressions and clicks rising. Revenue recovering. Conclusion: business recovery stronger than VI suggests. Switch to Protect mode. Do not panic-edit.

**P3: paid scaling blocked by tracking confidence.** Paid healthy ROAS. Tracking confidence low (consent-mode active, server-side incomplete, cross-device attribution unclear). Conclusion: do not scale paid. Tracking work first.

**P4: SEO recovery first when SEO is primary.** Site primary acquisition is SEO. SEO recovery in Phase R2. Paid channel small but profitable. Temptation: scale paid. Conclusion: do not divert attention. Protect and progress SEO. Paid scaling waits until SEO in Phase R3+.

**P5: weak landing page blocks paid scaling.** Paid acquires traffic cheaply. Landing-page conversion rate significantly below benchmark. Ad CTR acceptable. Conclusion: CRO first. Scaling spend on weak landing page wastes budget.

### Conflict resolution rules of preference

- Economics over volume
- Recovery before growth during active recovery
- First-party over third-party data
- Recent over historical when conditions changed
- High-data-confidence over low-data-confidence

### Cross-channel attribution

The engine does not attempt multi-touch attribution. Real attribution requires server-side tracking, consent-aware modeling, and assumptions the framework cannot validate. Instead the engine uses: channel-level economics from user-provided CSVs (user's own attribution model), last-click signals from GSC and paid platforms as channel-specific indicators, cross-channel comparison via MER when total revenue and total spend are both known.

Attribution improvements are v0.8 docs / v0.9 read-only API beta — and even there the engine remains agnostic on attribution model. It surfaces the assumption rather than picking one.

### Signal availability

Most operators do not have all signals. The engine handles partial sets gracefully: missing margin = surface "consider when margin data available", missing paid = surface SEO-only, missing tracking = reduce paid-recommendation confidence, missing first-party shop data = drop revenue projections to low confidence, missing competitor data = positioning recommendations are local-context only.

The skill output names what's missing and how to improve it.

---

## 9. Channel conflict resolution

When channels produce conflicting signals, the engine applies the rules of preference above. Common conflict patterns surfaced explicitly:

**SEO says opportunity high; margin low; return rate high.** -> Lower priority despite search volume. Surface the conflict; show the margin and return-rate context.

**SEO visibility weak; revenue stable; branded search rising.** -> Do not panic. Brand and revenue signals dominate; visibility lag is acceptable for recovery work.

**Paid traffic profitable; organic unstable.** -> Protect recovery before scaling SEO changes. Paid can hold its current spend; no new SEO experiments on the recovery surface.

**Multiple agencies recommend different actions.** -> Rank by recovery risk, revenue impact, effort, confidence, sequencing. Output ranked list with reasons.

---

## 10. What the engine does not do

It does not replace operator judgment. A rule is a default; the operator can override with context the engine does not have.

It does not aggregate by counting. Three blog posts agreeing do not outweigh one platform documentation page.

It does not chase the latest. Recent sources are not automatically prioritized; a 2024 case study with clear evidence outweighs a 2026 blog post without evidence.

It does not predict the future. Scenarios are calibrated hypotheses, not forecasts.

It does not write to any system. No automatic budget changes, no automatic edits, no autonomous publishing.

It does not integrate with CRM, marketing automation, or dashboard platforms.

---

## 11. Planned output contract (v0.6+)

**Planned for v0.6+.** The v0.4.1 skills (10 in `plugins/seo-rescue/skills/`) do not currently emit a structured decision-layer wrapper. This section specifies the output contract that the planned Decision Engine integration will produce when skills are revised to feed the engine in v0.6+. Treat the list below as the target shape, not as a description of current skill outputs.

The planned skill output will include the engine's decision-layer wrapper:

- Selected user mode and reason
- Assumptions the engine is making
- Missing data callouts
- Recommended first step
- Required data
- Expected output shape
- Privacy mode warnings if needed
- Decision rules triggered (any rule that blocked, sequenced, or modified the recommendation)
- Data quality summary
- Confidence statement
- Explicit "what this workflow will not do"

The format is consistent across skills so operators can read across them without re-learning each output shape.

---

## 12. Roadmap of the engine

- **v0.5** (this PR): rules catalog, evidence and data weighting, prioritization classes, sequencing constraints, cross-channel patterns documented. Partial implementation in existing skills.
- **v0.6**: shared scoring utility, Revenue Rescue integration with profit-aware prioritization.
- **v0.7-v0.8**: cross-channel integration as paid-media and tracking skills ship.
- **v0.9**: read-only API beta increases data quality and unlocks new decision rules.
- **v1.0**: stable engine, tests + fixtures + expected-output assertions, breaking changes only at major version.

Post-v1.0: more decision rules accrue as the case library grows; the engine itself stabilizes.

---

## Operational Decision Patterns (from live recovery)

These patterns were codified from real Shopware ecommerce recovery operations. They complement the abstract decision rules above with concrete if/then logic.

### Redirect Decisions

| Condition | Decision | Confidence |
|---|---|---|
| Source is 404, target is 200 + self-canonical + index,follow + thematically exact | **Set 301** | high |
| Source is 404, 0 products, 0 inlinks, 0 backlinks, no rankings | **Leave as 404** | high |
| Source is 404, has external backlinks, no clean redirect target available | **Dev ticket** (manual redirect needed) | high |
| Redirect attempt fails (API 500, wrong slug) and source was previously live | **Reactivate** source as fallback | high |
| Redirect target is 301 itself (chain) | **Do not redirect** — find the final 200 target | high |
| Redirect target is thematically wrong (e.g., Product A -> Category B (different vertical/intent)) | **Accept temporarily** if source has <5 inlinks and 0 backlinks. Otherwise: dev ticket | medium |
| DreiscSeo redirect and seo-url redirect conflict | **DreiscSeo wins** at runtime. Deactivate DreiscSeo entry if it causes 301->404 | high |

### Internal Link Decisions

| Condition | Decision |
|---|---|
| Target is 200, self-canonical, index,follow | Link allowed |
| Target is 301 | **Do not link** — link to the final 200 target instead |
| Target is 404 or noindex | **Do not link** |
| Anchor is exact-match keyword | Acceptable for internal e-commerce links (category names). Flag if >50% of links in a block are exact-match |
| Anchor contains medical term (orthopaedisch, Skoliose, Bandscheibenvorfall) | **Flag for review**. Use neutral alternative if target page does not substantiate the claim |
| More than 3 new links in one blog post in one session | Requires explicit approval per Change Governor |
| More than 10 links in one `<ul>` block | **Risk**: Google may classify as boilerplate. Recommend distributing into body text |

### Category Deactivation Decisions

| Check | Required Before Deactivation |
|---|---|
| Product count | Must be 0 |
| Keyword rankings | Must be Pos 50+ or none |
| Internal inlinks | Must be <5 (or sitewide navigation only) |
| External backlinks | Must be 0 |
| DreiscSeo redirects pointing TO this URL | Must be deactivated first |
| 404 vs 301 decision | Document whether clean 404 or 301 to parent/sibling |

### Backlink Verification

DataForSEO backlink data should not be the sole source:
- If DataForSEO shows 0 total backlinks but 291 referring domains: the data is inconsistent. Mark as `needs_verification`.
- Cross-check with: GSC Links report, Ahrefs, Semrush, Sistrix Links, or Majestic.
- When in doubt, assume backlinks exist and do not deactivate or redirect without checking.

### Priority Sequencing

1. Technical indexation bugs (broken canonicals, 301->404 chains, noindex on important pages) — fix FIRST
2. H1/meta/redirect fixes on existing pages — fix SECOND
3. Internal link improvements — THIRD (after technical fixes are live)
4. Content expansion — FOURTH (after link improvements are measured)
5. Backlink outreach — ONGOING, but not a blocker for steps 1-4

**Rule**: No second wave of changes before the first wave has GSC data (minimum 7 days). Monitoring before optimization.
