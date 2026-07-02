# Recovery System

Operational methodology for SEO recovery within the [Recovery Operating System](./ARCHITECTURE.md). This document defines what an operator does during SEO recovery: how decisions get made, what gets protected, what does not get touched, how risk is evaluated, and how time windows shape conclusions. The aim is operator-grade methodology, not a feature list.

> **Status note (v0.5.2).** This document is methodology specification. Sections 5 (Recovery Risk Engine), 6 (Risk Matrix), 7 (Money Keyword Protection), 8 (Winner/Loser Neutralization), 9 (URL Recovery Analysis), 10 (Recovery Signal Score), and 12 (Time-based Recovery Logic) are exercised by the `sistrix-monday-recovery-check` skill (shipped in v0.5.2, CSV-first weekly workflow). The recovery workflow commands (`recovery-diagnose/crawl/audit/plan/monitor/full`, also v0.5.2) implement parts of the methodology in runtime form: Do-Not-Touch and batch limits in `recovery-plan`, stage estimation in `recovery-diagnose`, and an **automated 5-component Recovery Score in `recovery-monitor` that is a separate metric from the section-10 Recovery Signal Score** (see section 10 note). Sections without a runtime are applied manually by reading them; the skill registry is in [ARCHITECTURE.md §4](./ARCHITECTURE.md#4-modules-and-skill-registry).

Companion docs: [ARCHITECTURE.md](./ARCHITECTURE.md) for system shape, [DECISION_ENGINE.md](./DECISION_ENGINE.md) for the decision rules consumed here, [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) for the weekly workflow that exercises this methodology.

---

## 1. The recovery problem

A site in recovery generates more questions than answers. The visibility index is flat but money keywords are returning. A few head terms are still losing while many smaller queries are gaining. The operator wants to "do something" but most somethings make the recovery slower.

The recovery system codifies what experienced recovery operators apply intuitively: protect first, investigate before strengthening, treat the visibility index as one signal among several, recognize that the recovery sequence has stages that do not skip, and accept that timing matters as much as action quality.

---

## 2. Recovery Decision Flow

The operational methodology. Every recovery decision moves through these ten steps, in order. Skipping steps is how operators damage their own recoveries.

**Step 1. Detect signal.** Something in the data moved. A keyword returned, a position changed, a visibility-index point shifted, a GSC impression count rose. Note the signal. Do not yet act on it.

**Step 2. Validate signal.** Check the signal against at least one other source. SISTRIX ranking change should be visible in GSC impressions. GSC click change should be visible in shop revenue if the keyword is transactional. A signal that appears in only one source at this stage is weak evidence (see [DECISION_ENGINE.md section 3](./DECISION_ENGINE.md#3-evidence-weighting)).

**Step 3. Protect winners.** Identify URLs and money keywords that are recovering. Apply do-not-touch logic before any other action (see section 3). The default during recovery is leave the winning URLs alone, not strengthen them aggressively.

**Step 4. Analyze losers.** If signals are mixed (winners and losers), run Winner/Loser Neutralization detection (see section 8). A flat visibility index can mask broad recovery offset by a few head-term losses. Investigate losers before strengthening winners.

**Step 5. Check intent alignment.** For each surfaced opportunity or risk, verify the ranking URL matches the intent the query represents. URL Recovery Analysis (section 9) groups movements by URL type. A money keyword ranking on a blog post instead of a category page is a cannibalization problem, not a strengthening problem.

**Step 6. Evaluate risk.** Apply the Recovery Risk Matrix (section 6) to any proposed action. Score it on action type, recovery timing, reversibility, evidence quality, expected volatility, dependency complexity. High-risk actions during early recovery phases are deferred regardless of upside.

**Step 7. Sequence actions.** Use the five-phase sequencing model (section 11) to order what happens this week, what waits until next Monday, what waits for Phase R3+. A correct action at the wrong phase is often worse than no action at all.

**Step 7a. Verify root-cause hypothesis against a real source of truth.** Before any planned action moves from sequenced to executed, the root-cause hypothesis that justifies the action must reach `verified` status in the Hypothesis Verification Gate (see `references/HYPOTHESIS_VERIFICATION_GATE.md`). A hypothesis that is `suspected` (pattern-match only) or `likely` (live HTML signature, open-source code reading) is sufficient for fix-planning and stakeholder communication, not for live execution. Verification requires at least one strong-tier source: direct API state read, server file inspection of the installed component, GSC URL Inspection, staging reproduction, or operator/developer review at the real stack. AI-generated diagnoses, however internally consistent and however well-supported by open-source repository code, do not produce `verified` on their own. Step 8 starts only when step 7a closes. The classic failure mode this step exists to prevent: a fix planned against a hypothesis derived from open-source code reading of one component, deployed without confirming that the component is the actual producer of the behavior on the operator's installed stack. The fix may work mechanically (canonical block override does eliminate duplicate canonicals regardless of which component produced them) while attributing wrongly, leaving the real upstream bug intact in third-party code and untouched by the operator's vendor outreach.

**Step 8. Implement cautiously.** Execute the sequenced actions, smallest blast radius first. Document the exact change (URL, before, after, date) so attribution is possible at step 9. The implementation scope must strictly match the verified hypothesis `fix_scope`; expanding the scope at implementation time resets the expanded portion to `likely` and requires fresh verification for that portion.

**Step 9. Monitor.** Apply time-based recovery logic (section 12). Different windows give different signal strength. The 24h window tells you almost nothing. The next-Monday cycle is the primary decision rhythm.

**Step 10. Re-validate next cycle.** At the next Monday check, the signal that triggered the decision is re-validated against actual outcome. Update the operator's decision memory: was the call correct, what should have happened instead, does this confirm or invalidate a pattern.

The ten steps repeat weekly. Steps 1-2 happen continuously. Steps 3-7 happen at Monday review. Step 8 happens during the week. Step 9 happens continuously and at Monday review. Step 10 happens at the following Monday.

---

## 3. Do-Not-Touch principle

Core doctrine. During active recovery, the default is **leave the winning URLs alone**. Operators under pressure tend toward panic-edits on the URLs that just recovered, breaking the state that produced the recovery. The Do-Not-Touch principle exists to make the inertia explicit so the operator does not override it without context.

### What triggers Do-Not-Touch

- Top-3 or Top-10 ranking on a money keyword (highest protection class)
- Recovering URL with rising impressions over the last 14 days
- URL inside an active recovery wave (less than 30 days since detected wave start)
- Unstable ranking state (position swings ≥5 between two Monday snapshots)
- Volatile URL swaps (different pages ranking for the same query across snapshots)
- Visibility-lag scenario where money keywords are back but SISTRIX VI is flat per `r-sistrix-vi-flat-money-keywords-recovered` ([DECISION_ENGINE.md section 2](./DECISION_ENGINE.md#2-decision-rules-catalog))

### What Do-Not-Touch forbids

Specifically forbidden on URLs in protected state:

- Title rewrites
- H1 rewrites
- URL changes
- Canonical changes
- Noindex flag changes
- 301 redirects involving the URL
- Template changes affecting the URL
- Schema removal or major restructuring
- Internal-link removals touching the URL
- Sitewide CSS or layout changes that shift the main-content area
- Content additions that bury the existing content lower in the page
- Content removals that thin the existing content
- Product variant restructuring that changes URL structure (for product pages)

### What Do-Not-Touch allows

Specific carefully-scoped changes are acceptable on protected URLs:

- Fixing factual errors (price, stock, delivery time)
- Adding trust signals (reviews, ratings, warranties) without restructuring the page
- Adding internal links INTO the page from related content (additive only)
- Improving Core Web Vitals (image compression, deferring non-critical scripts) without changing visible layout
- Fixing accessibility issues (alt text, color contrast) without changing main-content text
- Pure cosmetic CSS changes (colors, fonts, spacing, borders, shadows, hover states, button styling) that do not alter content visibility, HTML structure, or above-the-fold content order

### Styling changes during recovery — clarification

A common operator question during recovery: "Can I restyle the site?" The answer depends on what "restyle" means:

**Green (safe, no SEO impact):**
- CSS-only changes: colors, typography, spacing, border-radius, shadows, animations
- Button and form styling, hover/focus states
- Header/footer visual design (navigation links unchanged)
- Mobile responsive adjustments that keep all content visible

**Yellow (verify before deploying):**
- Changes that move above-the-fold content lower (e.g., large hero banner pushing product content down)
- Accordion/tab patterns that hide text content by default (Google may devalue hidden content)
- Layout shifts that affect CLS (images without explicit dimensions, late-loading elements)

**Red (treat as template change, Do-Not-Touch applies):**
- `display:none` or `visibility:hidden` on content that was previously visible and indexed
- Changing heading hierarchy (H1/H2/H3 restructuring)
- Removing semantic HTML elements (nav, article, section) in favor of generic divs
- Template changes that alter the rendered HTML structure (not just its appearance)

**Deployment pattern:** When restyling during recovery, deploy to 2-3 non-critical pages first. Monitor for one week (CLS regression, crawl errors, position changes). Then roll out sitewide. This limits blast radius if something goes wrong.

### How long Do-Not-Touch lasts

A URL leaves protected state when:

- Stage 4 or higher in the six-stage recovery framework, AND
- 30+ days of stable rankings since entering protection, AND
- No money keyword regressions in that window, AND
- Operator explicitly confirms recovery is established

**"Stable rankings" (definition, used throughout this document):** no position swing of ≥5 between consecutive Monday snapshots AND no money-keyword regression, sustained over N consecutive snapshots (default N=3). Both the Do-Not-Touch exit above and the phase-advancement criteria in §11 use this definition.

The default is "stay protected longer". Lifting protection prematurely is more costly than keeping it on too long.

### Override

The operator can override Do-Not-Touch with context the framework does not have. When the override happens, the decision is logged (see [ARCHITECTURE.md section 5](./ARCHITECTURE.md#5-privacy-and-client-data) decision memory), the specific risk acknowledged, and the result watched closely at the next Monday cycle.

---

## Stage & phase vocabulary — three namespaces

Three distinct vocabularies share similar labels in this framework. They are NOT interchangeable:

| Namespace | Labels | Defined in | Meaning |
|---|---|---|---|
| **Recovery stages** | Stage 0–5 | §4 (this document) | Keyword-milestone sequence: how far recovery has propagated, from Top-100 returns to aligned revenue |
| **Diagnostic stage** | R1–R5 | `commands/recovery-diagnose.md`, Schritt 10 (`recovery_stage_estimate` / `stage_status.stage`) | VI-trend-based diagnostic state of the domain (numeric default bands over `vi_trend_4w_pct` and `vi_current` vs `vi_peak`) |
| **Work phase** | R1–R5 | §11 (this document); operative value `current_phase` in `commands/recovery-plan.md`, Schritt 4 | Which kind of recovery work is appropriate now (Protect → Stabilize → Links → Intent → Expansion) |

Both R-namespaces are strictly ordered: **R1 < R2 < R3 < R4 < R5**. Diagnostic stage and work phase may legitimately differ for the same domain (e.g. diagnostic stage R2 but work phase R1 while winners are still unprotected); `recovery-plan` constrains `current_phase` to at most `recovery_stage_estimate` + 1 and reports both values with a warning when they diverge (see `commands/recovery-plan.md`, Schritt 4). When reporting, always name which namespace is meant.

---

## 4. Recovery framework: six stages

Recovery follows a sequence. Each stage represents a milestone in how recovery propagates from underlying signals to business outcomes.

- **Stage 0.** No recovery signal.
- **Stage 1.** Keywords return to Top 100 / Top 50. Visibility index typically unchanged or slightly negative still.
- **Stage 2.** Keywords move into Top 20. Visibility index begins to register some movement on higher-volume terms.
- **Stage 3.** Important keywords move into Top 10. GSC impressions and clicks begin to rise materially.
- **Stage 4.** Money keywords move into Top 5 / Top 3. Revenue signals begin to follow.
- **Stage 5.** Visibility index, GSC clicks, and revenue all move in alignment. Recovery is established.

A possible early signal (hypothesis, N=1, currently unproven): rising AI Overview / ChatGPT / Perplexity mentions while classical SISTRIX VI is still flat MAY indicate that authority work is being recognized. This hypothesis suffered a setback on 2026-06-03: in the pilot case, the AI-citation rise coincided with a pre-update plateau that a subsequent Core Update erased (see `post-core-update-recovery/LESSONS.md`, 2026-06-03 correction). Treat rising AI citations as worth logging via the `ai-citations-tracker` skill, not as confirmation — do not change course or report recovery based on this signal alone. Independent of that hypothesis: Stage 4 commonly arrives before Stage 5, and operators should not panic when Stage 5 lags.

Recovery does not always follow the sequence linearly. A site can be at Stage 4 on its highest-priority keyword cluster while Stage 1 on a secondary cluster. Stage classification is per-cluster as well as global.

---

## 4a. Structural Quality Baseline

Core Update drops are often framed as pure authority problems. Operational evidence shows they are frequently **authority × structural quality** — the drop is compounded by the proportion of broken, thin, or duplicate pages on the site.

This is a methodology pattern that the operator applies externally through a crawl, manual audit, or third-party tooling; seo-survival-kit does not currently include an automated structural-quality crawler.

### The multiplier effect

A site with 90 % healthy pages hit by a Core Update loses authority signal on those pages individually. A site with 40 % healthy pages loses authority AND sends a site-wide quality signal that amplifies the per-page loss. Google's quality raters and crawlers encounter broken pages, empty content divs, rendering failures, and duplicates — each one reduces the site's overall trust floor.

### How to measure

Crawl all indexable pages (Screaming Frog, Sitebulb, or manual curl audit) and classify each as:

- **Healthy**: renders correctly, has substantive content (>300 words for content pages, valid product data for product pages), no rendering errors
- **Broken**: HTTP 500, rendering failure (empty content divs with correct CMS source), soft-404 (page loads but shows no meaningful content)
- **Thin**: <150 words of unique content, auto-generated placeholder text, Lorem ipsum
- **Duplicate**: self-canonical but shares >80 % content with another indexed page on the same domain

### Thresholds

| Healthy % | Classification | Recovery implication |
|---|---|---|
| >80 % | Clean | Authority-only recovery plan applies |
| 60–80 % | Moderate structural debt | Fix broken/thin pages in parallel with Phase A authority work; expect faster recovery than authority-only |
| <60 % | Severe structural debt | Structural cleanup is a recovery accelerator, not just hygiene. Prioritize fixing broken pages before investing in new content. Recovery timeline shortens materially when structural baseline improves |

These threshold bands are derived from one observed case (N=1) plus practitioner heuristics — treat them as starting defaults to calibrate per engagement, not as validated cutoffs.

### Operational pattern

In observed cases with severe structural debt (>50 % non-healthy pages), recovery has been materially faster when structural cleanup ran in parallel with authority work. The structural fixes did not cause the recovery but removed the multiplier that was suppressing it. Specific timelines and recovery percentages are case-dependent and should be documented in engagement-specific private playbooks.

### Recovery velocity observation

In one observed case, ~95 % recovery to pre-update average visibility was achieved in under 8 weeks — roughly half the 3–4 month baseline expectation. The ranking distribution during this recovery showed a characteristic pattern:

- **Page 1 rankings** recovered from ~11 % to ~15 % (pre-update: ~22 %)
- **Page 5+ rankings grew significantly** (from ~17 % to ~32 %), indicating Google was testing many new positions simultaneously
- **Blog/editorial pages carried the recovery** at 6–8x more clicks per URL than category/product pages, confirming that pre-existing authority content serves as the trust anchor

In one observed case (N=1), this pattern suggests that when a site has strong editorial authority content that survived the Core Update, the recovery propagates FROM that content outward to commercial pages via internal link signals. The editorial content acts as a trust bridge. The generalization — protect trust-anchor pages with the highest Do-Not-Touch priority and use them as internal-link sources to commercial pages that need to recover — is a single-case inference, not a validated rule; apply it as a sensible default and log deviations.

---

## 4b. Pre-Hit Baseline Selection (experimental, N=1)

> **Maturity:** `experimental_n1` — abgeleitet aus einem einzigen Fall (case-001, Multi-Update-Sequenz über 14 Monate). KEINE validierte Methode. Promotion zu `validated` erst nach N=2-Bestätigung (zweiter Fall) + Reverse-ID-Check.

Bei einer **Multi-Update-Sequenz** (mehrere Algorithmus-Updates über Monate) ist das „letzte stabile Plateau vor dem jüngsten Hit" oft selbst schon durch frühere Updates erodiert. Eine Recovery-Bewertung gegen dieses erodierte Plateau überschätzt die Erholung.

`recovery-diagnose` (Schritt 9) wählt die Baseline daher als **historisches Peak-Plateau**:

1. Längste verfügbare Zeitreihe nutzen (GSC-Klicks bevorzugt, sonst Sistrix-VI).
2. Peak-Plateau = Maximum des rollierenden 4-Perioden-Mittelwerts (kein Einzel-Spike).
3. Erosions-Flag: liegt das letzte stabile Plateau vor dem Hit > 15 % unter dem Peak, ist das ein Multi-Update-Erosions-Signal (`multi_update_erosion_detected`).
4. Fortschritt wird gegen den wahren Peak gemeldet (`recovery_vs_baseline_pct`).

**Abgrenzung:** Dieses Signal ist bisher reines Reporting im Feld `pre_hit_baseline`. Die R1–R5-Stage-Formel bleibt VI-Peak-basiert; die Umstellung der Stage-Logik auf baseline-relative Bewertung inkl. Stage-Re-Entry ist separat (Lesson 4).

---

## 4c. Stage State Machine (experimental, N=1)

> **Maturity:** `experimental_n1` — abgeleitet aus einem einzigen Fall (case-001, Lesson 4). KEINE validierte Methode. Promotion erst nach N=2.

Die lineare Erholungssequenz — die Keyword-Meilensteine Stage 0–5 (§4) ebenso wie die diagnostische Stage R1→R5 (definiert in `commands/recovery-diagnose.md`, Schritt 10; siehe Vokabular-Tabelle oben) — ist der Happy-Path. Bei Multi-Update-Sequenzen ist sie unvollständig: Schaden kann wiederkehren, während der Operator schon Erholung misst. Case-001 wurde als „Stage 3 stabil" bewertet (Keyword-Meilenstein-Namespace, §4) — einen Tag später schloss ein neues Core Update seinen Rollout ab und warf die Site auf Stage 1 (§4).

`recovery-diagnose` (Schritt 10) überlagert die rohe Stage daher mit einer State-Machine und schreibt das Ergebnis nach `stage_status`:

- **active_update_window** — läuft heute ein Rollout (heute ∈ [Start, Ende] eines `CORE_UPDATES.md`-Eintrags), wird die Progression eingefroren (`progression_allowed: false`).
- **post_update_settlement** — bis 28 Tage nach Rollout-Ende des jüngsten Updates bleibt die Progression eingefroren; Google justiert nach, die Stage-Bewertung ist unzuverlässig.
- **Stage-Re-Entry** — ein frischer Major-Hit (jüngstes Update endete ≤ 28 Tage, VI-4-Wochen-Trend < −10 %) setzt die effektive Stage hart auf R1 zurück (`re_entry_detected`), statt die Erholung weiter hochzuzählen.

`recovery_stage_estimate` bleibt der rohe VI-Trend-Wert (`stage_status.raw_stage`); `stage_status.stage` ist der effektive Wert nach den Regeln.

**Abgrenzung zum Settlement Gate (§12a):** Der Settlement Gate ist operator-batch-getriggert und blockt Live-Writes. `post_update_settlement` ist rollout-getriggert und friert nur die Stage-Bewertung ein — kein Write-Block, andere Trigger.

**Noch offen (Lesson 4b):** Kumulative Schadens-Verfolgung über Update-Sequenzen, Multi-Hit-Progressions-Formel (≥ 2 Hits / 90 Tage) und ein „time-since-last-major-hit"-Gate.

---

## 5. Recovery Risk Engine

The Recovery Risk Engine prevents destructive changes during recovery by detecting recovering URLs, flagging proposed edits that would touch them, and surfacing the risk to the operator. It is the runtime expression of the Do-Not-Touch principle.

### What it detects

- Recovering URLs (current position better than previous; was previously lost; carries money keywords)
- Top-3 money keywords (highest protection class)
- Unstable rankings (position swings of 5+ between two snapshots)
- Rising impressions in GSC paired with stable or improving position
- Volatile ranking swaps (a URL bouncing between two pages for the same query)
- URL-level recovery clusters (multiple keywords improving on the same URL)
- Dangerous timing (recovery wave in progress; less than 30 days since detected wave start)

### What it warns against during active recovery

Per section 3 Do-Not-Touch principle. Warnings are loud and explicit, with the affected URLs and the recovery state spelled out, so the operator decides knowing the cost.

### Trigger conditions

The `sistrix-monday-recovery-check` skill shipped in v0.5.2. The Recovery Risk Engine is on by default during:

- The 90 days following a detected Core Update impact
- Any session where the SISTRIX Monday Recovery Check produces a Recovery Signal Score above 40
- Any session where the user profile's `intent.current_task` is `recover-from-traffic-drop` (profile schema still planned for v0.6+ per ARCHITECTURE.md §6)

It can be toggled off explicitly when the operator confirms the recovery is established (Stage 5 sustained for 30+ days).

### What it does not do

It does not block edits by default, except when a Settlement Gate is active (section 12a). It surfaces risk; the operator decides. It does not predict ranking impact of specific edits. It does not protect against unrelated work — non-recovering URLs can be edited freely while the engine is on.

---

## 6. Recovery Risk Matrix

Practical risk framework. Every proposed action during recovery gets scored on six dimensions. The combined score classifies the action as Green (safe), Yellow (cautious), Red (high risk), or Black-flag (do not execute).

### Dimensions

| Dimension | Low risk | Medium risk | High risk |
|---|---|---|---|
| Action type | Internal link addition, alt-text fix, schema addition | Snippet tuning, content addition, trust-signal addition | Title rewrite, H1 rewrite, URL change, canonical change, 301 merge, template change |
| Recovery timing | Stage 5 sustained 30+ days | Stage 3-4 stabilizing | Stage 1-2 active recovery wave |
| Reversibility | Fully reversible in minutes | Reversible with manual work | Irreversible or expensive to reverse |
| Evidence quality | Strong (Level A or B per DECISION_ENGINE) | Medium (Level C with multiple confirmations) | Weak (single observation, untested) |
| Expected volatility | Low (similar changes have produced stable results) | Medium (mixed historical outcomes) | High (no track record or known volatility) |
| Dependency complexity | Single URL, no upstream/downstream | Few related URLs | Sitewide template, navigation, or category structure |

### Risk classes

| Class | Criteria | Behavior |
|---|---|---|
| Green | All dimensions low or one medium | Execute with normal monitoring |
| Yellow | Two or more medium, no high | Execute with explicit monitoring plan; document the change for attribution at next Monday |
| Red | One or more high dimensions | Defer unless override with logged reason and explicit monitoring |
| Black-flag | Action type high AND recovery timing high (active recovery + destructive action) | Do not execute. Override requires Stage 4+ status. |

### Examples

| Action | Action type | Timing | Reversibility | Evidence | Volatility | Dependencies | Class |
|---|---|---|---|---|---|---|---|
| Add internal link from related blog post to recovering category | Low | Stage 3 (medium) | Fully reversible | Strong | Low | Single URL | **Green** |
| Rewrite title on Top-3 money keyword URL | High | Stage 4 (medium) | Reversible | Weak | Medium | Single URL | **Red** |
| 301 merge two competing URLs during active recovery wave | High | Stage 2 (high) | Expensive | Weak | High | Cross-URL | **Black-flag** |
| Compress images on recovering product URL | Low | Stage 3 (medium) | Fully reversible | Strong | Low | Single URL | **Green** |
| Sitewide template change affecting recovering URLs | High | Any | Reversible with work | Medium | High | Sitewide | **Red** |
| Add a review snippet (Trustpilot widget) to recovering product URL | Medium | Stage 4 (low) | Reversible | Medium | Low | Single URL | **Yellow** |
| Change canonical on a URL with rising impressions | High | Stage 2-3 (high) | Reversible | Weak | High | Single URL | **Black-flag** |
| Add a new supporting article in the topic cluster | Low | Stage 4-5 (low) | Reversible | Medium | Low | New URL | **Green** |
| Switch 5+ category pages to new CMS templates in one day | High | Stage 3-4 (medium) | Reversible with work | Medium | High | Multi-URL | **Red** |
| Deploy content to a shared CMS layout (affects multiple categories) | High | Any | Reversible | Weak | High | Sitewide | **Black-flag** |

### Batch-change velocity rule

During active recovery, limit URL changes to **3 per calendar day** — 4–5 only with an explicit batch plan naming the count and acknowledging the higher risk, more than 5 never (see the "Batch Limits by Change Category" table in `SAFE_LIVE_CHANGE_RULES.md`, which is the binding rule; "per calendar day" is counted across all sessions of that day via `change-history.ndjson`). CMS template switches (changing which layout a category uses) count as high-impact changes because Google sees a different rendered HTML structure on the same URL — even if the text content is unchanged.

Observed pattern: switching 5 category pages to new dedicated CMS layouts in a single day during Stage 3-4 recovery caused a same-day live visibility drop of ~11 %. The weekly trend remained positive, and the drop corrected within days, but the intraday signal was measurable and avoidable.

If a batch of changes is necessary, spread them across 3–5 days with monitoring between each batch. Prepare a rollback script before starting. Monitor live visibility (if the SEO tool supports intraday checks) after each batch.

### Shared CMS layout trap

In CMS platforms that allow multiple categories to share a single layout/template (Shopware "Shopping Experiences", WordPress shared page templates), adding a content block to the shared layout deploys that content to ALL categories using it — not just the intended one. This creates instant duplicate content across multiple URLs.

Before adding content blocks to any CMS page:
1. Query how many categories/pages use that CMS layout
2. If more than one: create a dedicated layout for the target category first, reassign it, then add content
3. Known high-risk layouts in Shopware: the "Standard Kategorie-Layout" (often 20–50+ categories) and any layout named generically ("Default", "Standard", "Product List")

This trap is particularly dangerous during recovery because the duplicated content may appear on high-ranking pages (observed: content intended for a secondary category appeared on a #1-ranking page for several hours before detection).

The matrix is not a substitute for operator judgment. It is a forced-pause mechanism that makes the operator state the risk before acting.

---

## 7. Money Keyword Protection

A money keyword is a keyword where a ranking improvement directly translates to revenue. The framework treats money keywords with extra protection during recovery because operator panic-edits on the URLs that rank for them are the highest-cost mistake the framework guards against.

### What counts as a money keyword

- Product or category keyword with commercial intent ("running shoes nike air zoom", "wireless headphones noise cancelling")
- Size or specification combined with product type ("monitor 27 inch 4k", "office chair ergonomic")
- Brand combined with product ("apple macbook pro 14")
- Comparison or buying-intent terms ("test", "vergleich", "beste", "kaufen")
- Local intent for local businesses
- High-intent transactional queries with a clear conversion path on the ranking URL

A keyword can have high search volume without being a money keyword. Informational terms ("what is an ergonomic office chair") often dwarf transactional terms in volume but convert at a fraction of the rate.

### Where the money keyword list comes from

Three sources in order of preference:

1. **User-provided list.** A `money_keywords.json` or `.csv` with keyword, target position, intended ranking URL, intent, commercial priority, notes.
2. **Inferred from category/product mapping.** If the user provided a URL-type mapping, the framework treats keywords ranking on category and product URLs as candidates.
3. **Heuristically inferred.** Search volume, intent signal tokens, URL type heuristics. Flagged as "inferred" so the user can confirm before treating as locked-in.

### At-risk classification

A money keyword is `at risk` if any of:

- Current position worse than previous position
- Currently ranking URL differs from the intended `ranking_url` (cannibalization)
- Current position outside Top 10 and commercial priority is `high`
- The ranking URL appears as a top loser in section 8
- The ranking URL recently changed (URL, canonical, content thinning) per section 9

A money keyword is `protected` if all of: position equal or better, currently ranking URL matches intended URL, ranking URL is not a top loser, no recent destructive changes.

Intermediate states: `stable`, `under-monitoring`.

### Protection rules

For a `protected` money keyword: hold steady. Monitor weekly. Verify trust signals (reviews, return policy, delivery info) and product availability remain intact. Do not touch.

For a `stable` money keyword: monitor. No edits to the ranking URL.

For `under-monitoring`: investigate volatility. Pull GSC query-page pair for the keyword over the last 30 days. Look for ranking-volatility patterns.

For `at risk`: protect first, optimize never. Do not edit beyond reversing the change that put the keyword at risk. Investigate the cause indicated by the at-risk condition.

### Cannibalization handling

When the currently ranking URL differs from the intended `ranking_url`:

- Flag the cannibalization
- Identify competing URLs (from GSC query-page pairs if available, else from the SISTRIX URL field)
- Recommend resolving before acting on the keyword

Resolution patterns:

- **Consolidate**: redirect the unintended URL to the intended URL, merge content
- **Differentiate**: rewrite the unintended URL to target a different keyword variant
- **De-rank**: noindex or thin-deprecate the unintended URL
- **Accept**: if the unintended URL converts better, accept and update the intended `ranking_url`

The choice depends on URL types, commercial value, and content strategy. The framework surfaces the options; the operator decides.

---

## 8. Winner/Loser Neutralization

A site recovering can have 200+ keywords improving in position, 10+ keywords moving into Top 10, a money keyword moving from position 18 to position 2, and still have a flat or slightly negative visibility index.

The cause is usually that 3-10 head-term losses (very high search volume, previously top SERP positions) drag the aggregate visibility metric down. If the operator looks only at the visibility index, the operator concludes "nothing is working" and may abandon strategy or panic-edit. If the operator looks only at keyword-count delta, the operator concludes "recovery is great" and misses revenue still being lost on head terms.

Neutralization detection makes both views visible simultaneously.

### Detection logic

1. **Classify by visibility weight.** Each keyword gets a visibility weight from search volume × position-CTR curve at its previous position. A position-3 keyword with 10k monthly searches is ~20x heavier than a position-30 keyword with 1k searches. The canonical position-CTR reference values (rule-of-thumb expected-CTR table) live in `commands/recovery-diagnose.md`, Schritt 11 — use that single table wherever a position-CTR curve is needed.

2. **Separate winners and losers.** Winner = position improved. Loser = position worsened. Newly returned keyword = winner with previous treated as out-of-range. Lost keyword = loser with current treated as out-of-range.

3. **Aggregate visibility delta per group.**

4. **Check for concentration.** Top-5 losers' share of total negative delta. Top-5 winners' share of total positive delta.

5. **Classify severity.**

| Net delta | Top-5 losers' share of negative | Severity |
|---|---|---|
| Positive, top-5 < 30% of positive | < 60% | Low (gains dominate, spread out) |
| Positive | > 60% | Medium (gains exist but concentrated losses) |
| Near zero | > 60% | High (gains and losses cancel; losses concentrated) |
| Negative | any | High (losses dominate) |

### Common neutralization causes

The framework's pattern library tags likely causes per top loser:

- **Head-term URL change.** The URL that previously ranked changed, was deleted, redirected to a non-equivalent page, canonical changed.
- **Head-term cannibalization.** A new page competes with the previously ranking URL.
- **Head-term content thinning.** The previously ranking URL had a content update that reduced match quality.
- **Head-term template change.** A sitewide template change affected the page's match quality.
- **Competitor head-term improvement.** A competitor specifically targeted the term and dislodged the URL.
- **External factor.** Search volume shifted, SERP layout changed, AI Overview claimed the snippet position.

The skill annotates each top loser with the most likely cause based on available signals. The annotation is a hypothesis; the operator confirms before acting.

### Recommended action when neutralization is High

The recommended action is `Investigate`, not `Protect` or `Strengthen`:

1. List top 3 losers.
2. For each, retrieve URL history (changed, deleted, redirected, thinned).
3. For each, retrieve SERP (new competitors, AI Overview claiming position).
4. For each, retrieve GSC query-page pair (right URL ranking, cannibalization).
5. Pick the most actionable case; apply the targeted fix.
6. Do not touch winning URLs until the loser is addressed.

### When neutralization is Low

Net positive delta dominated by spread-out winners is the strongest recovery signal. Recommend `Strengthen`: internal links to winning URLs, snippet tuning for CTR, confirm conversion elements.

### When neutralization is Medium

Split: `Strengthen` for winning URLs (small additive actions only), `Investigate` for top 3 losers (separate work track).

---

## 9. URL Recovery Analysis

URL-level grouping of keyword movements. Reveals patterns invisible to keyword-level analysis: broad recovery across many URLs vs narrow recovery on 2 URLs, URL Type A improving while Type B declining.

### URL grouping

For each URL: count of gained keywords, count of lost keywords, Top 10 net change, Top 3 net change, commercial keyword net change, visibility impact estimate, winner/loser/mixed classification.

### URL type classification

URL type assigned via URL patterns plus optional user-provided URL-type mapping.

- `/category/`, `/c/`, `/kategorie/`, `/kollektion/` → Category
- `/product/`, `/p/`, `/produkt/`, slug ending with size pattern (`-90x200`, `-2tb`) → Product
- `/guide/`, `/ratgeber/`, `/how-to/`, `/anleitung/` → Guide
- `/blog/`, `/news/`, `/magazine/` → Blog/content
- Root `/` → Homepage
- `/vergleich/`, `/test/`, `/comparison/` → Comparison
- `/marken/`, `/brands/`, `/<known-brand-name>/` → Brand
- Anything else → Unknown

User override available via `url_type_mapping.json`.

### Recommended actions per URL classification

**Net winner, Category URL.** Strengthen internal links INTO this URL. Verify product feed is complete. Verify category page has unique content. Avoid restructuring the URL or breadcrumb. Do not split into sub-categories during the protection window.

**Net winner, Product URL.** Verify product in stock. Verify trust signals intact (reviews, returns, warranty). Verify product schema (Product, Offer, AggregateRating) emits correctly. Avoid renaming, slug changes, canonical changes. Do not retire the SKU during the protection window.

**Net winner, Guide/Blog URL.** Verify recent publish/updated dates if touched. Verify author byline if EEAT is part of the recovery framework. Add internal links TO related Category and Product URLs. Avoid restructuring heading hierarchy. Do not republish at a new URL.

**Net loser, Category URL.** Investigate URL history. Investigate product inventory (did category lose products, leaving thin pages). Investigate sitewide template changes. Pull GSC query-page pairs.

**Net loser, Product URL.** Investigate availability (out of stock, SKU retired, noindexed). Investigate price changes correlating with decline. Investigate competitor SERP. Avoid panic-editing; restore previous state if recent change correlates.

**Net loser, Guide/Blog URL.** Investigate content age (thinned, restructured, author info removed). Investigate competitor content. Investigate AI Overview (is an AI Overview now claiming the answer). Consider an Update pass only if the framework's recovery phase calls for it.

**Mixed, any type.** Pull GSC query-page pair data for both gained and lost keywords. Investigate the pattern. Do not act until understood.

**Homepage.** Brand-keyword movements often reflect external factors (PR, AI Overview brand mentions, paid search brand defense). Cross-check with `ai-citations-tracker`.

### URL change correlation

If the operator provided a list of URLs changed since the previous export, the framework cross-references:

- Changes followed by gains (high-confidence positive learnings to apply elsewhere)
- Changes followed by losses (high-confidence negative learnings; recommend revert if possible)
- Gains on unchanged URLs (recovery from external factors or earlier changes)
- Losses on unchanged URLs (the most concerning pattern; investigate)

### Common URL-level recovery patterns

- **D2C ecommerce case: category recovery before product recovery.** Category URLs often recover before product URLs because category content is more durable across SERP feature shifts. If categories are recovering and products are not yet, patience > product-page edits.
- **Content site case: deep content recovery before homepage recovery.** Long-tail content often recovers before the homepage in Authority-First recovery. Homepage VI lag does not mean recovery is failing.
- **Marketplace-heavy case: owned-site recovery without marketplace recovery.** Marketplace listings recover separately via marketplace-specific mechanics; SISTRIX visibility is per-domain.

---

## 10. Recovery Signal Score

**Shipped in v0.5.2** as the output of the `sistrix-monday-recovery-check` skill. The factor list, weights, and calculation below are the canonical specification for that skill.

Composite 0-100 score summarizing strength of recovery signal from a SISTRIX Monday comparison.

> **Disambiguation — two scores exist by design.** This section defines the **Recovery Signal Score**: weekly, CSV-first, multi-factor, computed by `sistrix-monday-recovery-check` from SISTRIX Monday exports. The `recovery-monitor` command computes a different metric — the **Recovery Score**: automated, 5-component (VI trend 30 % / keyword stability 25 % / quick-win progress 20 % / issue reduction 15 % / backlink quality 10 %), continuous, from cached artifacts. Both are 0-100 but are NOT comparable with each other and must not be mixed in one time series. When reporting, always name which score is meant.

### Why a score

Raw signals (returned keywords, Top 10 deltas, money keyword status, GSC trend, neutralization risk, tracking confidence) move on different scales and horizons. Looking individually invites confirmation bias. The score combines them with calibrated interpretation bands.

### Bands

| Range | Band | Meaning |
|---|---|---|
| 0-20 | No meaningful recovery | Continue underlying work. Do not declare recovery. |
| 21-40 | Weak early signal | Too early to act. Monitor weekly. |
| 41-60 | Early recovery, needs validation | Wait one more Monday cycle to confirm before acting. |
| 61-80 | Strong recovery signal | Switch to Protect mode for winning URLs. Strengthen carefully. |
| 81-100 | Strong recovery with business impact | Rankings, visibility, business signals aligned. Focus on durability. |

### Factors

Twelve positive factors and one penalty multiplier. Default weights reflect the originating recovery case and operational findings.

| # | Factor | Weight | Measures |
|---|---|---|---|
| 1 | Returned keywords | 8 | Newly present keywords, normalized to category size |
| 2 | Top 50 growth | 6 | Delta in Top 50 count |
| 3 | Top 20 growth | 10 | Delta in Top 20 count |
| 4 | Top 10 growth | 12 | Delta in Top 10 count |
| 5 | Top 3 growth | 12 | Delta in Top 3 count |
| 6 | Money keyword recovery | 14 | Weighted count of money keywords with improved position |
| 7 | Affected URL recovery | 8 | URLs that had losses now showing gains |
| 8 | GSC impression growth | 6 | Week-over-week delta (gated on GSC provided) |
| 9 | GSC click growth | 8 | Week-over-week delta (gated on GSC provided) |
| 10 | Visibility index trend | 6 | VI delta if values provided |
| 11 | Loser neutralization risk | -8 | Penalty if winners offset by significant losers |
| 12 | Wrong URL / cannibalization risk | -6 | Penalty if money keywords on wrong URL type |
| 13 | Tracking / data confidence | multiplicative | Caps maximum achievable score |

Data confidence is a multiplier (0.6 to 1.0). Low data confidence caps the score at 60 even when all positive factors maximize.

### Calculation

```
gross_score = sum(weight_i * normalize(factor_i)) for positive factors
penalty = sum(weight_j * normalize(factor_j)) for penalty factors
multiplier = clamp(data_confidence, 0.6, 1.0)
final_score = clamp((gross_score + penalty) * multiplier, 0, 100)
```

### What the score does not measure

Revenue impact (Revenue Rescue v0.6+). Brand health (use `ai-citations-tracker`). Recovery durability (requires next Monday's score). Future stages (the six-stage classification is a sequence model, not a prediction model).

### Week-over-week delta

The skill stores last week's score in the gitignored output dir and computes the delta automatically when both files are present. The delta is part of the executive summary. A score moving from 35 to 52 in one week is a stronger signal than a score sitting at 62 with no movement.

### Score vs stage

The score (0-100, continuous) and the stage classification (0-5, discrete) are complementary. The score says how strong the evidence is right now. The stage says what milestone is the recovery at in its sequence. A site can be at Stage 4 with a score of 65 (losers neutralizing visibility). A site can be at Stage 2 with a score of 78 (strong trajectory, high data confidence).

---

## 11. Recovery sequencing (five phases)

Sequencing decides when work happens, not just what work matters. The framework codifies five recovery phases.

### Phase R1: Protect winners

First 2 weeks of recovery work, and whenever winners are detected after a recovery wave.

Actions: identify recovering URLs and money keywords; apply do-not-touch rules; document baseline (URL slug, title, H1, canonical, internal links); set up monitoring (PSI baseline, weekly GSC snapshot, SISTRIX Monday check).

Produces protection, not improvement.

### Phase R2: Stabilize rankings

After 2-4 weeks of protection, if rankings held.

Actions: strengthen internal links pointing TO recovering URLs (additive); confirm snippet quality (title and meta unchanged from recovered state; CTR is the next lever); confirm trust signals on transactional URLs; address easy CWV regressions if any.

Small, additive, low-risk. No URL renames, no canonical changes, no template changes.

### Phase R3: Improve internal links

After 4-6 weeks of stable rankings.

Actions: map current internal-link graph; identify orphaned recovering URLs; add internal links from related content TO recovering URLs; avoid removing existing internal links.

Highest-leverage low-risk action during middle phases.

### Phase R4: Fix intent conflicts

After 6-10 weeks.

Actions: detect cannibalization; resolve with the chosen path (consolidate, differentiate, de-rank, accept); fix obvious intent mismatches; audit multi-intent pages and consider splitting.

More invasive. Only triggers once R1-R3 produced stable conditions.

### Phase R5: Selective consolidation and controlled content expansion

After 10+ weeks of stable, recovering trajectory.

Actions: consolidate clearly thin pages with low traffic and low recovery potential; expand content on URLs with proven recovery and high commercial value; add depth to YMYL pages with weak EEAT; strategic new-URL creation for topic gaps.

Most invasive. Only when underlying recovery is established. Phase R5 in a fragile recovery is the classic operator mistake the framework guards against.

### Phase advancement criteria

- R1 → R2: 2+ weeks of stable rankings on identified winners
- R2 → R3: 2+ additional weeks of stable rankings, no money keyword regressions
- R3 → R4: 4+ weeks of stable rankings, no new cannibalization
- R4 → R5: 4+ weeks of stable rankings, intent conflicts resolved

"Stable rankings" as defined in §3 (Do-Not-Touch exit): no ≥5-position swing between consecutive Monday snapshots and no money-keyword regression over N consecutive snapshots (default N=3).

Minimum durations. Real cases may require longer. The framework biases toward staying in earlier phases longer rather than advancing prematurely.

### Sequencing constraints

- Protection blocks optimization on recovering URLs
- Data gathering before recommendations under low confidence
- Margin work before paid scaling
- Tracking work before paid scaling
- Recovery before growth during active recovery
- Investigate before strengthen during High neutralization severity

These are codified as decision rules in [DECISION_ENGINE.md](./DECISION_ENGINE.md).

---

## 12. Time-based Recovery Logic

Timing matters as much as action quality. Recovery signals at different time horizons carry different evidence strength. Acting on a 24h signal as if it were a 7-day signal is a recurring operator mistake.

### Signal windows

| Window | What changed | Evidence strength | What it means | What to do |
|---|---|---|---|---|
| 0-24h | Position shift, impression spike | Very weak (single Google index update; SERP retest probable) | Nothing reliable | Note, do not act |
| 24-48h | Position holds, GSC begins to register | Weak (early signal; volatility high) | Maybe real, probably noise | Continue monitoring |
| 48h - 7d | Position stable, GSC impressions track | Medium (cross-source agreement begins) | First credible signal | Begin gentle validation actions; protect winners |
| 7d - next Monday | Next SISTRIX snapshot captures the state | Strong (cross-snapshot evidence; primary decision rhythm) | Primary recovery decision point | Run Monday Recovery Check; classify; sequence next week |
| Next Monday onwards | Re-validation cycle | Strong (compounding evidence) | Pattern emerging or fading | Update decision memory; promote/demote pattern maturity |
| 30 days | Post-action window for most additive actions | Strong (full short-term effect visible) | Action attribution possible | Confirm or revert based on outcome |
| 90 days | Stabilization period after recovery wave | Strong (durable effect or relapse visible) | Recovery established or not | Consider Phase R3+ advancement |
| 4-12 weeks delayed | Effects from earlier actions show up | Variable (depends on action type) | Delayed effect attribution | Cross-reference decision memory; pattern confirmation |

### When timing changes the decision

A keyword returning to position 5 on Tuesday could be:

- Genuine recovery if it holds through the next Monday cycle
- SERP retest rotation if it disappears by Thursday
- A SERP feature swap (AI Overview claims the position, then releases it)
- A competitor pause (their page temporarily de-indexed, returning shortly)

The operator cannot distinguish these on Tuesday. The week-long monitoring window is what makes the distinction. Acting on Tuesday treats noise as signal.

### Post-Core-Update windows

A published Google Core Update has its own time signature:

- Days 0-3: rollout in progress, rankings move continuously
- Days 4-7: rollout still settling, partial picture
- Days 7-14: first stable look at the new state
- Days 14-30: secondary adjustments (Google fine-tunes), false-positive recoveries possible
- Days 30-90: settled state; recovery work has measurable effects

The framework's Core-Update recovery skill triggers on Day 14+ signals, not on Day 3 signals.

### Stabilization periods

After a successful recovery wave, a stabilization period applies:

- Money keywords moved into Top 3: 30-day stabilization before considering aggressive strengthening
- Money keywords moved into Top 10: 14-day stabilization before any edit
- Category URLs returned to Top 20: 14-day stabilization before adding internal links
- Lost keywords returning to Top 50: stabilization is the period during which they typically continue to climb without intervention

Premature action during stabilization is the most common cause of operator-induced recovery setbacks.

### Delayed effects

Some actions produce effects on different time scales:

- Internal-link additions: 2-4 weeks
- Content thinning: 1-3 weeks (negative) or 6-12 weeks (positive, if part of a consolidation)
- URL renames with 301: 2-8 weeks; sometimes permanent loss
- Title rewrites: 1-7 days (rapid CTR effect) plus 2-8 weeks (deeper ranking effect)
- Schema additions: 2-6 weeks
- Author-byline EEAT additions: 4-12 weeks
- Authority-First recovery work: 6-12 months for full effect

The framework's decision memory tracks "what was the action, when was it done, when did the expected effect appear, did it match expectations". Patterns emerge over multiple cycles.

---

## 12a. Settlement Gate · Hard block after a Major Batch

The post-action stabilization periods in section 12 describe **default operator discipline**. When a session exceeds the Major Batch thresholds defined in `references/SEO_SETTLEMENT_GATE.md` (more than 10 SEO-relevant changes, more than 5 URL/redirect/category operations, more than 10 internal links changed, two or more category deactivations, plugin config with sitewide effect, CMS-slot batch across multiple blogposts, template/canonical/H1 multi-page fix, any change that produced a 404 / 301→404 / API 500 / reactivation, or a DACH medical/legal risk anchor change), the discipline is **enforced rather than recommended**.

A Settlement Gate activates automatically:

- **Minimum 5 days** before any non-emergency live operation
- **7 days** during active recovery (default)
- **10-14 days** before evaluating CTR / title / content / link batch effects

During the gate, only `audit_only` and `emergency_rollback` modes are available. New live optimization is blocked regardless of operator pressure. Low GSC click counts during the gate are the expected state, not a trigger to act.

The gate ends only when **all** unlock criteria are met: time minimum passed, two refreshed data sources, no new stability defects, a Re-Evaluation report written, a new Change Plan with explicit approval. Time alone is never sufficient.

Operationally, the gate is the codified version of every post-batch stabilization period in section 12, applied as a hard rule because operator self-discipline alone has not been sufficient in practice. See `references/SEO_SETTLEMENT_GATE.md` for the full definition, exceptions (technical emergency, rollback/stabilization, explicit emergency approval), and unlock criteria.

---

## 13. What this recovery methodology does not do

It does not block edits **by default**, except when a Settlement Gate is active (section 12a / `references/SEO_SETTLEMENT_GATE.md`). Outside of an active gate, warnings are loud and explicit; the operator decides.

It does not predict ranking outcomes of specific edits.

It does not require an SEO API. CSV-first throughout. SISTRIX API integration is roadmap-only.

It does not measure revenue impact directly (Revenue Rescue v0.6+).

It does not predict the next Monday (the next Monday's data is required for the next assessment).

It does not assign blame for losses (could be competitor action, Google SERP change, the operator's own work; the layer reports the pattern, the operator investigates the cause).

---

## 14. Cross-link to weekly workflow

The methodology above is exercised by the [SISTRIX_MONDAY_RECOVERY_CHECK.md](./SISTRIX_MONDAY_RECOVERY_CHECK.md) workflow every Monday. The Monday check is the primary integration point between this recovery system and the operator's recurring rhythm. New skills that surface recovery signals (planned cross-channel skills for v0.6-v0.8) plug into the same protection, neutralization, URL recovery, and sequencing logic without re-implementing them.

---

## Appendix A: False Signal Library

Catalog of misleading recovery signals. Each entry: what the signal looks like, what it actually means, the validation rule, and how long to wait before treating it as real.

### A1. Visibility increases without revenue

**Looks like.** SISTRIX VI rises week-over-week. The operator concludes recovery is underway.

**Actually means.** Possibly the VI gained on lower-converting queries (informational, brand-defensive) while transactional queries are flat or losing. Revenue is the actual recovery indicator; VI is a positioning indicator.

**Validation rule.** Cross-check GSC click volume on commercial queries. Cross-check shop revenue. VI rise + revenue flat = positioning recovery without business recovery; do not declare recovery yet.

**Time-to-trust.** Minimum 2 Monday cycles with both VI and revenue moving together.

### A2. Rankings return temporarily

**Looks like.** A money keyword returns to Top 3 on Tuesday. By Friday it is back at position 18.

**Actually means.** Google SERP retest. Google occasionally tests pages at higher positions to gather click and engagement data. If the page fails the test (low CTR, low dwell time, poor engagement), it drops back.

**Validation rule.** A position held for less than 7 days is not a recovery. Wait for the next SISTRIX Monday snapshot.

**Time-to-trust.** Position must hold through at least one full Monday cycle (7-14 days) before treated as real.

### A3. Wrong URL ranking for a money keyword

**Looks like.** A money keyword returns to Top 5. The operator declares Money Keyword Protection status.

**Actually means.** The ranking URL is a blog post, not the intended product or category URL. The traffic converts at the blog's conversion rate (often near zero for transactional intent), not the product's conversion rate.

**Validation rule.** Always check the `ranking_url` field. A money keyword on the wrong URL is a cannibalization problem, not a recovery success.

**Time-to-trust.** Immediate — the wrong-URL state is detectable on day one.

### A4. Traffic increases without conversion

**Looks like.** GSC clicks rise 30% week-over-week.

**Actually means.** Possibly the increased clicks are on informational queries that do not convert. Possibly the SERP added a SERP feature (Image pack, Video pack) that brought new clicks with weak intent. Possibly a single referral spike from non-search.

**Validation rule.** Pair click delta with order delta in shop data. Pair with conversion rate change. If clicks rose and conversions did not, traffic mix shifted; the ranking improvement is not a revenue improvement.

**Time-to-trust.** Minimum 2 weeks for conversion-rate change to emerge from noise.

### A5. SERP retesting mistaken as recovery

**Looks like.** A previously stable URL drops to position 12 for a few days, then returns to position 4. The operator concludes recovery from a momentary dip.

**Actually means.** Google routinely retests rankings, especially after Core Updates. The dip-and-return cycle is part of normal SERP volatility and does not indicate any underlying state change.

**Validation rule.** Compare the URL's position trajectory over 30+ days. If oscillation is within 8 positions and the page is otherwise unchanged, it is volatility, not recovery.

**Time-to-trust.** 30-day trajectory required.

### A6. Unstable Top-3 rankings

**Looks like.** A money keyword reaches position 2 on Monday. By next Monday, it is at position 7.

**Actually means.** The ranking is unstable. Google's confidence in this URL for this query is low. The page may have weak EEAT signals, weak relevance, or be in active competitive churn.

**Validation rule.** Money keyword in Top 3 must hold for at least 2 consecutive Monday cycles before treated as durable protection target.

**Time-to-trust.** 2 Monday cycles minimum; 4 cycles for high commercial priority.

### A7. GSC impressions rising without clicks

**Looks like.** GSC impressions up 50% week-over-week. Operator concludes ranking improvement.

**Actually means.** Position likely moved into a higher impression-but-low-click range (page 1 lower half, position 7-10, or page 2 top). Impressions accrue without click conversion. The CTR is low because the snippet is weak, the SERP feature dominates, or the position is below the click threshold.

**Validation rule.** Impressions rise + CTR fall = position moved into a lower-CTR slot. Not a click improvement. Check average position from GSC.

**Time-to-trust.** Immediate; the impressions-without-clicks pattern is detectable in the same snapshot.

### A8. CTR increase masking ranking weakness

**Looks like.** GSC CTR up 30%. Operator concludes recovery.

**Actually means.** Possibly the URL has lost ranking on some queries but improved on others where CTR is naturally higher. Possibly a SERP feature changed (no AI Overview anymore, exposing standard snippets again). Possibly seasonality moved query mix.

**Validation rule.** Pair CTR delta with average-position delta. CTR up + position down = mix shift, not improvement.

**Time-to-trust.** 2-4 weeks for query mix to settle.

### A9. AI Overview claims the snippet position

**Looks like.** Money keyword shows position 1 in SISTRIX. Impressions are flat or rising, but clicks are way down.

**Actually means.** AI Overview now answers the query. The URL still ranks position 1 below the AI Overview, but click-through is heavily compressed because the user reads the AI summary and does not click.

**Validation rule.** Cross-check GSC clicks on the affected URL. Cross-check whether AI citations data shows the brand cited in the AI Overview. Run `ai-citations-tracker` on the relevant queries.

**Time-to-trust.** Immediate; the click decoupling is visible in the same snapshot.

### A10. Single-day ranking spike from SERP test rotation

**Looks like.** Position 4 today on a previously page-2 keyword.

**Actually means.** Google's SERP testing rotated this page into a high position for a single index update. The next index update returns the page to its baseline.

**Validation rule.** A single-day spike with no surrounding signal (no GSC impression rise, no related-keyword improvement) is noise.

**Time-to-trust.** Wait for the next Monday cycle.

### A11. Branded query rise from external PR

**Looks like.** GSC impressions and clicks rise sharply on brand-name queries.

**Actually means.** A PR mention, podcast appearance, conference talk, or external article drove brand search demand. This is not SEO recovery; it is external attention.

**Validation rule.** Distinguish brand queries from non-brand queries. Recovery is signaled by non-brand commercial query movement. Brand query movement is a separate signal (positive but distinct).

**Time-to-trust.** Immediate; brand-vs-non-brand split is detectable in GSC.

### A12. Cannibalization artifact

**Looks like.** A new page on the site briefly ranks for a money keyword previously held by another URL. The operator concludes the new page is "winning the keyword".

**Actually means.** Google is undecided between the two URLs. Both may rank intermittently. Eventually one settles; the operator does not control which.

**Validation rule.** Two URLs alternating positions for the same query over 4+ weeks is unresolved cannibalization, not recovery. Apply resolution patterns from section 7.

**Time-to-trust.** 4-week observation period before classifying the resolution.

---

## Appendix B: Decision Log Format (operator-facing)

The operator maintains a decision log to build judgment over time. Lightweight format, expected to live in the operator's local gitignored `private/decisions/` directory (see [ARCHITECTURE.md section 5](./ARCHITECTURE.md#5-privacy-and-client-data)).

```markdown
# YYYY-MM-DD — Brief decision title

**Proposed action.** Specific action under consideration.

**Why proposed.** What signal or evidence triggered the consideration.

**Data available at the time.** What the operator could see.

**Recovery phase at the time.** R0 / R1 / R2 / R3 / R4 / R5.

**Risk Matrix class.** Green / Yellow / Red / Black-flag (per section 6).

**Confidence assessment.** Low / Medium / High. Reason.

**Decision rules considered.** Which DECISION_ENGINE.md rules fired or could have fired.

**What was actually done.** May differ from the proposed action.

**Observed result at +1 week.**
**Observed result at +1 month.**

**Delayed effects (if any).** Often the most informative signal.

**Was the decision correct in retrospect?** Yes / partially / no. Explanation.

**Pattern affected.** Reference any pattern this decision confirms, weakens, or surfaces.
```

The decision log is the primary source of pattern maturity progression. Repeated correct decisions on the same pattern type promote the pattern toward higher confidence. Repeated wrong decisions identify gaps in the existing rule set and trigger candidate new decision rules.

The log is local-only. Public artifacts (new decision rules, new patterns documented in this file) are produced via the redaction process in [ARCHITECTURE.md section 5](./ARCHITECTURE.md#5-privacy-and-client-data).
