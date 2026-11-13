# Safe Live Change Rules

Every plan with `total_risk_points > 0` requires explicit user approval. Updated with informal-German handling and Shopware-specific pre-check rules.

## Approval Validation

A user response counts as **valid approval** only when it contains at least **three** of the following elements:

1. Concrete number of changes (e.g., "die 3", "die 7", "diesen einen")
2. Change type (redirect, anchor-fix, deactivation, link, canonical)
3. Risk points or budget (e.g., "6 Punkte", "low risk")
4. Concrete URLs or cluster names (e.g., "die Topper-Redirects", "die Lattenrost-Kategorien")
5. Explicit reference to the shown Change Plan (e.g., "diesen Plan", "wie geplant")
6. Explicit execution permission ("fuehre aus", "mach das", "execute")
7. Explicit scope limit ("sonst nichts", "keine weiteren Aenderungen", "nur diesen Micro-Fix")

### Valid Informal German Examples

- "Ja, mach genau die 3 Redirects mit 6 Punkten." (number + type + risk + permission)
- "Okay, fuehre diesen Change Plan mit 2 Anchor-Fixes aus." (plan reference + number + type + permission)
- "Freigegeben: die 3 DreiscSeo-Ketten deaktivieren, keine weiteren Aenderungen." (number + type + cluster + permission + scope)
- "Mach die eine Anchor-Aenderung, sonst nichts." (number + type + scope + permission)
- "Ja, nur diesen Micro-Fix ausfuehren." (reference to the shown plan/mode + scope + permission)
- "Deaktiviere die 8 leeren Kategorien (0 Produkte), ich kenne die Folgen." (number + type + acknowledgment)

### Invalid Approvals (Hard Stop)

These trigger an immediate Hard Stop per SEO_CHANGE_GOVERNOR.md:

- "alles"
- "mach"
- "weiter"
- "ja"
- "ALLESS"
- "passt"
- "ok"
- "go"
- "mach den Rest"
- "alles fixen"
- "alles patchen"
- "mach du alles"
- "ja alles"
- "los gehts"
- Any single-word confirmation without plan reference
- Any approval lacking concrete reference to numbers, types, or URLs

### Approval Request Format

When Claude needs approval, output exactly:

```
Ich brauche explizite Freigabe fuer [N] Aenderungen mit [X] Risikopunkten:

1. [change-type]: [URL] -> [target] ([risk] Punkte) [change_category]
2. [change-type]: [URL] -> [target] ([risk] Punkte) [change_category]
...

Gesamt: [X] Risikopunkte, Budget [Y] verbleibend.

Bitte bestaetige konkret: Anzahl Aenderungen, Aenderungstyp und ob genau dieser Plan freigegeben ist.
```

### Approval Validation Output

Every approval received must produce a validation record:

```json
{
  "approval_validation": {
    "approval_text": "Ja, mach genau die 3 Redirects mit 6 Punkten.",
    "is_valid": true,
    "matched_elements": ["number", "type", "risk_points", "permission"],
    "missing_elements": [],
    "reason": "Three or more validation elements present; approval accepted"
  }
}
```

For invalid approvals:

```json
{
  "approval_validation": {
    "approval_text": "ALLESS",
    "is_valid": false,
    "matched_elements": [],
    "missing_elements": ["number", "type", "risk_points", "urls", "plan_reference", "permission"],
    "reason": "Broad batch trigger phrase; explicit plan reference required"
  }
}
```

If approval is unclear (one or two elements only), Claude must stop and ask:

> "Bitte bestaetige konkret: Anzahl Aenderungen, Aenderungstyp und ob genau dieser Plan freigegeben ist."

### What an approval does not cover

Derived from repeated incidents in one case in which a short answer was read as more than it said (experimental, N=1 — **Maturity:** `experimental_n1`):

- **Open questions stay open.** If the approval request contained a question (which of two objects, which target value, duplicate or not) and the answer does not address it, the question is unanswered. Ask again; do not pick the convenient reading.
- **A pasted command is not an execution order.** A write command that arrives as text in the conversation is material to review, not a go.
- **The agent prepares, the human starts.** For bulk or irreversible writes the agent delivers script, dry run and expected output; the operator starts the live run. This keeps "who pressed the button" unambiguous.
- **A bundled approval is valid only if the bundle is specific.** One go for a package is fine when the package names count, type and objects and the approval refers to it. It does not turn "go" into a valid approval for anything outside the package.
- **State can change between dry run and write.** Immediately before writing, compare the targets' last-modified state with the dry run and stop on any difference. Another session, a scheduled sync or a colleague may have touched the same objects.

## Pre-Change Checklist

Before every live write:

0. **Open freezes and tests named in the approval request**: before asking for approval, check for any running freeze, settlement or measurement window, A/B or price test, promotion, or ad learning phase that touches the same objects, and write it into the request. Compliance and legal-text clean-ups count as changes too. Dry run, canary and review do not know about freezes; this check is separate.
1. **Change Plan** output with risk points (SEO_CHANGE_GOVERNOR.md format). For every existing value the plan changes (end time, exclusion, limit, redirect), name the reason for the current value from the change history. A value that looks wrong may be deliberate.
2. **Budget check**: total_risk_points <= budget_remaining
3. **Pre-checks for each target URL**:
   - HTTP status (live, not just API state)
   - Canonical (self-referencing?)
   - Robots (index,follow?)
   - Internal inlinks (SF or API)
   - External backlinks (DataForSEO)
   - Keywords/rankings (DataForSEO)
   - Product count (if category)
4. **Shopware-specific pre-checks** for seo-url operations:
   - Query for duplicate foreignKey entries in same channel/language/route context
   - Verify `active_non_deleted_entries`
   - Document in `seo_url_precheck` field
5. **DreiscSeo pre-checks** for category/product deactivations:
   - Query DreiscSeo redirects pointing FROM and TO the URL
   - Identify chain risks
   - Document in `dreiscseo_precheck` field
6. **CMS-Slot snapshot** for cms-slot PATCH operations:
   - Write before-snapshot to local cache
   - Verify snapshot path is recorded
7. **Medical compliance check** for anchor/content changes:
   - Run all terms through DACH_MEDICAL_SEO_TERMS.md
   - Flag High/Medium risk in `compliance_review`
8. **Valid approval** received
9. **Rollback method** documented, and for scripted or bulk changes **rollback readiness** (experimental, N=1 — **Maturity:** `experimental_n1`):
   - The rollback has been run in validation mode *before* the forward change executes. A rollback that was never run is a hope.
   - It carries the same guards as the forward path and restores only the fields this run changed, never from an older backup (an old backup re-publishes old text).
   - It needs a different confirmation word than the forward run and is locked against concurrent runs.
   - The success report names where the rollback lives; it does not print a ready-to-paste rollback command.
   - A same-day rollback of a bulk change is a second bulk change, not a return to zero. Check a control group first (see `RECOVERY_SYSTEM.md` section 9).
10. **Rendered-source verification** for meta/CMS edits (experimental, N=1 — **Maturity:** `experimental_n1`, derived from a single observed case, 2026-06/07 post-deploy lessons; NOT a validated rule, promotion after N=2): confirm what actually *renders* (live fetch / view-source), not just the stored field. Category/CMS meta fields (metaTitle, metaDescription, slot content) can be overridden per page by SEO plugins or theme templates — editing the stored field is then a no-op. Field-based inventories overcount ("Karteileichen"); verify the page renders the field before counting it as a target and before editing. Extends "live HTTP, not just API state" to meta/CMS fields.
11. **Governing fact confirmed** before any factual or wording claim edit (experimental, N=1 — **Maturity:** `experimental_n1`, derived from a single observed case, 2026-06/07 post-deploy lessons; NOT a validated rule, promotion after N=2): the underlying fact (production location, own-vs-partner manufacturing, certification, timeline) must be owner-confirmed *before* editing the claim. Editing on an unconfirmed fact introduces a new error that must later be reverted. Sequence: confirm the fact, then edit. Re-observed several times in the same case since: text already live on the site is not a source ("it already says so in the shop" feels like evidence and is not). Check newly written text against a maintained list of superseded values and decisions, take product attributes only from product data (never from SKUs, URLs or names), and treat meta titles and descriptions as customer-facing claims with the same fact check.
12. **Storage-layer inventory** before any bulk text correction (experimental, N=1 — **Maturity:** `experimental_n1`): derive the search scope from the rendered page, not from the first place the text was found. List every layer that can render on the page (layout slots, per-page overrides, product and category fields, tab fields, variant-level copies, translations, plugin settings, text snippets, product boxes that embed another product's description). Count occurrences of the old text across the whole crawl first; abort if the plan does not cover every hit. Report occurrences and root causes separately: thousands of hits usually collapse to a handful of sitewide template or plugin strings.
13. **Activation is publication** (experimental, N=1 — **Maturity:** `experimental_n1`): setting an inactive category, product, landing page or widget to active publishes every text stored in it, including stale meta texts and claims that were removed elsewhere in the meantime. Before activation, scan all text fields of the object and its assigned layout against the current wording and fact rules. Any hit blocks the activation.
14. **Preview first for visible changes** (experimental, N=1 — **Maturity:** `experimental_n1`): build any new customer-visible element inactive, hidden and noindex, or on a clone. Compare full-page screenshots, mobile and desktop, before and after, against the nearest already approved sibling page. Insert new blocks as their own section, not into an existing shared section. When cloning, copy only fields the template itself carries; inherited values written explicitly onto the clone stop inheriting. An approval to proceed does not replace looking at the rendered result.
15. **Feed delta in the blast radius**: activating or creating products changes what flows into shopping campaigns and marketplaces. Name the feed delta in the plan.

## Post-Change Checklist

After every live write:

1. **Live HTTP test** of affected URL (not just API state)
   - **Full-object re-read**: a success response is not evidence of state. Re-read the whole object through a separate read call and diff it against the pre-write snapshot. Allowed delta: the intended fields plus system-maintained effects you have listed beforehand (modification timestamps, version counters, documented derived fields). Anything else is a stop. Write endpoints have side effects (status flips, replaced sub-objects, recalculated totals). On first use of a write endpoint, also re-read one untouched neighbouring object.
   - **Served-page acceptance**: accept on the plain public URL without a cache-busting parameter (a parameter creates its own cache key and shows database state, not delivered state). The cached copy must have been created after the write. Check that the old text is gone from every served page, on parsed visible text, not merely that the new text is present. Details and traps: `docs/LIVE_CHANGE_QA.md`, Acceptance checks.
2. **Final status** check (follow redirects)
3. **Canonical** of final target
4. **Robots** of final target
5. **Broken links introduced** count (must be 0)
6. **CMS-Slot after-snapshot** written (if applicable)
7. **Change-history.ndjson** entry appended with all required fields
8. **Stop check**: any unexpected result triggers immediate stop
9. **Customer-visible end measured**: a change is done when its effect is measured where the customer meets it (page served, offer buyable, order reaches fulfilment), not when the API, task or submission reports success. A status field announces a thing; it is not the thing.

## Batch Limits by Change Category

| Category | Default Limit | Conditions |
|---|---:|---|
| Structural / Risky | 3 URLs per calendar day (4-5 only with explicit batch plan; >5/day never) | Categories, canonicals, content, templates |
| Repair / Hygiene | Up to 10 URLs/run | All targets 200/self-canonical/index,follow, rollback docs, immediate QA |
| Emergency Stabilization | Up to 30 risk points | Only stabilization, no new optimization |

"Per calendar day" is counted across all sessions of that day via `change-history.ndjson` — a new session does not reset the budget. Extending 3 to 5 requires explicit batch approval naming the count and acknowledging the higher risk; 5 structural URLs/day is the absolute ceiling (Hard Stop rule 3 in `SEO_CHANGE_GOVERNOR.md`).

## Settlement Gate · Operator-Pressure Response

While a Settlement Gate is active (see `references/SEO_SETTLEMENT_GATE.md`), the operator will at some point apply pressure to resume live optimization. The pressure usually arrives as one of these phrases:

- "sollen wir noch optimieren?"
- "mach weiter"
- "warum sind Klicks niedrig?"
- "lass Titles ändern"
- "noch Links setzen"
- "alles fixen"
- "ALLESS"
- "was kann ich noch machen?"
- "wir haben ja noch Budget übrig"
- "lass uns die Reserve nutzen"
- "noch schnell ein paar kleine Fixes"
- "falls wir Zeit haben"
- "weitere kleine Fixes"

Before any other response, Claude **must** run this internal check:

1. Is the Settlement Gate active?
2. Is this a verified Technical Emergency per `SEO_SETTLEMENT_GATE.md` section 7.A?
3. Are there new, post-batch, source-confirmed data signals that change the picture since the gate started?
4. Would the proposed action conflate cause-and-effect with the in-flight batch?

If (1) = yes, (2) = no, (3) = no, and (4) = yes — then **no new live SEO optimization may be planned or executed**.

Low GSC click counts during the gate window are **not** a sufficient signal to override the gate. They are the expected state during settlement.

### Standard Settlement-Gate Response

When the internal check above fails, Claude must answer **verbatim**:

> Settlement Gate aktiv. Ich mache keine neuen Live-SEO-Optimierungen, weil der letzte Major Batch noch nicht belastbar ausgewertet ist. Erlaubt sind jetzt nur Monitoring, Datenpulls, QA, Briefings und Rollback-Vorbereitung. Neue Live-Maßnahmen erst nach Re-Evaluation mit GSC/Crawl/Rankingdaten oder bei technischem Notfall.

Followed by the current gate's `allowed_actions` list and the next allowed review date.

### Unused-Budget Pressure

If the operator argues from leftover budget — phrases such as "Budget übrig", "Reserve nutzen", "noch schnell", "falls Zeit", "weitere kleine Fixes" — Claude must reply:

> **nicht ohne neuen Change Plan und explizite Freigabe**

and stop. Stop reason: `unused_budget_is_not_permission`.

The "Reserve bleibt Reserve" rule from `SEO_SETTLEMENT_GATE.md` section 11 is canonical: unused CG budget is never an implicit authorization for additional work.

### Plugin-Install / Cache-Rebuild Pre-/Post-Crawl Rule

Every plugin install, activation, deactivation, upgrade, or forced theme/cache rebuild on a live shop requires a paired crawl: one immediately before the action, one after. Do not crawl in the first minutes after a full cache purge: listings can render incomplete while the cache refills, which produces false findings. Wait until repeated fetches of the same listing return the same product count. Schedule plugin state changes off-peak: a theme recompile can take the storefront down for longer than the change itself suggests. Both crawls must capture at minimum:

- Canonical count per URL and canonical href values
- Indexability status (`Indexierbar` / `Canonicalised` / `Noindex`)
- H1 presence and uniqueness
- Schema.org structured-data presence and validity
- HTTP status and internal 4xx/5xx counts
- Meta robots directives
- Listing completeness: product count per category on repeated fetches (a plugin that floods the message queue makes listings drop products intermittently)
- Sitemap: URL count and last-modified against the expected value; diff the sitemap after every plugin activation
- Tracking: after any theme, tag-plugin or checkout change, one controlled order per major payment method, reconciled against the order system (purchase event present, value basis correct, exactly one primary conversion action receiving data, integrations that existed before are still installed)

Diff the two crawls. Any new conflicts (new duplicate canonicals, new missing H1, new 4xx/5xx, flipped indexability, new redirect chains, broken structured data) is a stop-the-line event. No further changes until the conflict is understood. If the conflict cannot be reverted in ≤ 5 minutes, escalate to the operator before continuing.

This rule is **strictly enforced during active Recovery Windows**. During recovery, every plugin-action additionally requires written approval and a `change-log-entry` reference to the paired Pre-/Post-Crawl artifacts.

Reason: plugin-host applications (Shopware, WordPress, Magento) lazily evaluate template chains and meta-loader subscribers. A plugin code path that has been latent for months can suddenly materialize when a cache rebuild re-evaluates the render context — often triggered by an unrelated plugin install. Detecting the new conflict at action time (minutes) prevents the same conflict from being detected at Google-impact time (days to weeks).

Practical example (originating recovery case, May 2026): three plugins were installed in a single batch on a Shopware live shop. The cache rebuild that followed activated a latent dormant canonical-injection bug in a separately installed blog plugin (installed 19 months earlier, dormant the entire time). The bug was not detected until 7 days later via a routine GSC decline analysis, by which time 79 % of the 28-day click loss had already accumulated. A post-install crawl at action time would have caught the new doubled-canonical state inside the first minute.

## See Also

- `references/SEO_SETTLEMENT_GATE.md` — Settlement Gate definition, exceptions, unlock criteria
- `references/SEO_CHANGE_GOVERNOR.md` — Risk point system and hard stop rules
- `references/SHOPWARE_SEO_PATTERNS.md` — seo-url collision pre-check
- `references/DREISCSEO_PATTERNS.md` — DreiscSeo redirect pre-check
- `references/DACH_MEDICAL_SEO_TERMS.md` — Compliance term risk tiers
- `docs/LIVE_CHANGE_QA.md` — QA checklist
