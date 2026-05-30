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

### Valid Informal German Examples

- "Ja, mach genau die 3 Redirects mit 6 Punkten." (number + type + risk + permission)
- "Okay, fuehre diesen Change Plan mit 2 Anchor-Fixes aus." (plan reference + number + type + permission)
- "Freigegeben: die 3 DreiscSeo-Ketten deaktivieren, keine weiteren Aenderungen." (number + type + cluster + permission + scope)
- "Mach die eine Anchor-Aenderung, sonst nichts." (number + type + scope + permission)
- "Ja, nur diesen Micro-Fix ausfuehren." (mode reference + scope + permission)
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

## Pre-Change Checklist

Before every live write:

1. **Change Plan** output with risk points (SEO_CHANGE_GOVERNOR.md format)
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
9. **Rollback method** documented

## Post-Change Checklist

After every live write:

1. **Live HTTP test** of affected URL (not just API state)
2. **Final status** check (follow redirects)
3. **Canonical** of final target
4. **Robots** of final target
5. **Broken links introduced** count (must be 0)
6. **CMS-Slot after-snapshot** written (if applicable)
7. **Change-history.ndjson** entry appended with all required fields
8. **Stop check**: any unexpected result triggers immediate stop

## Batch Limits by Change Category

| Category | Default Limit | Conditions |
|---|---:|---|
| Structural / Risky | 3-5 URLs/day | Categories, canonicals, content, templates |
| Repair / Hygiene | Up to 10 URLs/run | All targets 200/self-canonical/index,follow, rollback docs, immediate QA |
| Emergency Stabilization | Up to 30 risk points | Only stabilization, no new optimization |

Exceeding these limits requires explicit batch approval naming the count and acknowledging the higher risk.

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

Every plugin install, activation, deactivation, upgrade, or forced theme/cache rebuild on a live shop requires a paired crawl: one immediately before the action, one immediately after (allowing ≥ 60 seconds for cache propagation). Both crawls must capture at minimum:

- Canonical count per URL and canonical href values
- Indexability status (`Indexierbar` / `Canonicalised` / `Noindex`)
- H1 presence and uniqueness
- Schema.org structured-data presence and validity
- HTTP status and internal 4xx/5xx counts
- Meta robots directives

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
