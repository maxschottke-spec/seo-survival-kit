# Live Change QA Protocol

## Before Every Live Change

1. **Goal**: What specific SEO problem does this fix?
2. **Data basis**: Which tools confirmed the problem? (SF, DataForSEO, Live HTTP, GSC, Sistrix)
3. **Expected effect**: What should improve? By how much? In what timeframe?
4. **Affected URLs**: List every URL that will be changed or affected
5. **Risk points**: Calculate per SEO_CHANGE_GOVERNOR.md
6. **Rollback method**: How to undo this change, how long it takes
7. **Approval**: Has the user explicitly approved this specific change?
8. **Pre-checks for each target URL**:
   - HTTP status
   - Canonical (self-referencing?)
   - Robots (index,follow?)
   - Internal inlinks (count)
   - External backlinks (count, dofollow?)
   - Keywords/rankings (position, volume)
   - Product count (if category page)

## After Every Live Change

1. **HTTP status** of changed URL (curl, no redirect follow)
2. **Redirect final status** (curl, follow redirects)
3. **Canonical** of final target (must be self-referencing)
4. **Robots** of final target (must be index,follow unless intentionally not)
5. **Broken links introduced** (must be 0)
6. **Indexability** confirmed
7. **Shopware channel** correct (live storefront, not headless API)
8. **Change-history entry** appended to ndjson
9. **Monitoring date** set for +7d / +14d check

## Red Flags (immediate stop)

- Live test returns 404 after change
- 301 -> 404 chain created
- Redirect target is not 200
- Redirect target has different canonical than itself
- Redirect target has noindex
- Shopware API returns 500
- seo-url state says redirect exists but live HTTP shows 404
- DreiscSeo and seo-url produce contradictory redirects
- More broken links after change than before
- Settlement Gate is active and the proposed change is not a Technical Emergency, Rollback/Stabilization, or Explicit Emergency Approval per `references/SEO_SETTLEMENT_GATE.md`

## Settlement Gate

A Settlement Gate is a hard block on new live SEO optimizations after a Major Batch. See `references/SEO_SETTLEMENT_GATE.md` for the canonical definition.

### Why waiting matters

After a Major Batch the operator is data-blind in three concurrent ways:

- GSC has a 2-3 day lag before changes appear in click/impression data; meaningful evaluation needs 7-10 days
- Sistrix VI updates weekly at best, and API tier limits often constrain live re-fetches
- Google crawl / re-index cycles for redirects, deactivations, and CMS-slot edits take 5-14 days to stabilize

During those 5-14 days, **low click counts do not mean the changes failed**. They mean Google has not yet re-evaluated. A second wave of changes started during this window mixes cause and effect, often triggers a "revert and re-add" penalty signal, burns operator energy on premature optimization, and erodes confidence when the next snapshot looks worse instead of better.

### Which signals need time

| Signal | Reliable evaluation window |
|---|---|
| GSC clicks (post-redirect) | 7-10 days |
| GSC impressions (post-content) | 7-14 days |
| GSC coverage updates | 5-10 days |
| Sistrix VI shift | 1-2 weekly snapshots (next Monday + 1) |
| DataForSEO position delta | 5-14 days |
| Live HTTP status (after redirect) | minutes to hours (always read-only) |
| Backlink discovery after content change | 4-12 weeks |
| CTR effect from title rewrite | 1-7 days (rapid) + 2-8 weeks (ranking depth) |

### Allowed during the gate

- Read-only crawls, GSC/Sistrix/DataForSEO pulls
- Live HTTP / canonical / robots checks
- Schema validation drafts (local, not pushed)
- Rico / developer briefings
- Monitoring dashboards
- QA reports
- Rollback plan drafts
- Ticket creation
- Repo file changes
- Backlink audits

### Blocked during the gate

- New title rewrites
- New meta rewrites
- New internal links added
- Linkblock reductions (the "revert" half of revert-and-re-add)
- Content changes on category, product, or blog pages
- New category or product deactivations
- New redirect experiments (non-repair)
- New canonical consolidations
- New plugin config changes with sitewide effect
- Template / H1 fixes (non-emergency)
- AI Overview / passage-level on-page optimization deployed live
- "Noch schnell" fixes ("while we're here")
- Schema deployments to live (drafts only)

### When the gate ends

Time alone is **never** sufficient. The gate ends only when:

1. The time minimum (5 days) has passed, plus
2. At least **2** data sources have been refreshed since `started_at`, plus
3. **All** stability criteria are clean (no new 301→404 chains, no new internal 404s, no new noindex/canonical errors, no new GSC coverage spikes, no open API/state contradictions), plus
4. A Re-Evaluation report has been written and a new Change Plan with explicit approval is in place

For CTR / title / content / internal-link work, the **10-day click evaluation window** must also be reached before the post-batch data can be considered reliable.

### Why low clicks alone are not a live-fix trigger

When GSC clicks drop after a Major Batch, the default operator instinct is to act. The Settlement Gate codifies the discipline of not acting: low clicks during the gate window are the expected state, not a signal. Acting on them risks treating noise as signal and conflating the batch's effect with the new action's effect, leaving the operator unable to attribute either.

See `references/SEO_SETTLEMENT_GATE.md` sections 7 (Exceptions), 9 (Unlock Criteria), and 10 (Operator-Pressure Response) for the full handling.

## Pre-Fix Verification Checklist

Before any planned change moves from approved plan to live deploy, this checklist must be true. Cite the corresponding hypothesis entry from `schemas/hypothesis-verification.schema.json` in your run output.

- [ ] Observed effect is measurable and grounded in real data (not just a feeling or a single screenshot)
- [ ] At least one alternative hypothesis was explicitly considered and ruled out, with the verification source that ruled it out
- [ ] At least one strong-tier verification source has confirmed the cause on the operator's specific stack (direct API state read, server file inspection, GSC URL Inspection, staging reproduction, operator/developer review)
- [ ] Open-source code reading alone is not the only verification source for a hypothesis affecting commercial / closed-source components
- [ ] The fix scope (`fix_scope.affected_urls`, `fix_scope.affected_components`) is strictly bounded by what was verified, not generalized
- [ ] Smallest reversible change that addresses the verified cause has been identified
- [ ] Rollback method is defined and has been verified locally or on staging
- [ ] Monitoring plan covers stage 1 (T+0..24h), stage 2 (T+3d), stage 3 (T+7d), stage 4 (T+14d)
- [ ] If Settlement Gate is active, override justification is documented per `SEO_SETTLEMENT_GATE.md` section 7 and `hypothesis-verification.schema.json#settlement_gate_override`
- [ ] Operator approval per `SAFE_LIVE_CHANGE_RULES.md` cites the verified hypothesis ID, the fix scope, and the rollback method explicitly

A checklist item that is not true is a blocker. The default operator response under blocker conditions is: do not deploy, return to fix-planning, document what verification step is missing.

## Post-Fix QA additions for verified-hypothesis fixes

In addition to the standard post-deploy QA from sections above, fixes deployed against a `verified` hypothesis must:

- Re-snapshot the source of truth that produced the `verified` status. If a server file inspection produced verification, re-check the same file after deploy to confirm the change is in place. If GSC URL Inspection produced verification, re-run the inspection for the affected URL.
- Cross-check the bounded `fix_scope` on a sample of the affected URLs (canonical count, indexability, schema presence, robots) and on a sample of explicitly out-of-scope URLs to confirm the fix did not cascade.
- Run the functional checks for any third-party components in the same template inheritance chain or override chain as the fixed component. The fix targets a specific cause; it must not silently degrade unrelated functions of the same plugin or theme.
- Append a status transition to `status_history` in the hypothesis entry: `verified → fixed`, with timestamp and the post-deploy QA artifact reference.
