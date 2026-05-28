# SEO Settlement Gate

A Settlement Gate is a **hard block** on new live SEO optimizations after a Major Batch. It enforces a waiting period during which only monitoring, data pulls, QA, briefings, rollback preparation, and verified technical emergencies are allowed.

The gate exists because **the most dangerous moment in recovery is not the first mistake — it is the impulse to keep optimizing immediately afterwards**. A second wave of changes before the first wave has been measured destroys cause-effect attribution and forces the operator to fly blind through a critical recovery window.

This document is the canonical definition. It is referenced by:

- `references/SEO_CHANGE_GOVERNOR.md` (budget behavior during a gate)
- `references/SAFE_LIVE_CHANGE_RULES.md` (user-pressure responses during a gate)
- `commands/recovery-plan.md`, `commands/recovery-full.md`, `commands/recovery-audit.md`
- `schemas/recovery-gate.schema.json`
- `docs/LIVE_CHANGE_QA.md`, `docs/TROUBLESHOOTING.md`

---

## 1. Why a Settlement Gate exists

After a Major Batch the operator is data-blind in three concurrent ways:

1. **GSC has a 2-3 day lag** before changes appear in click/impression data, and a meaningful click-delta window needs at least 7-10 days of data on each side.
2. **Sistrix VI updates weekly** at best (Mondays), with API tier limits often constraining live re-fetches.
3. **Google crawl and re-index cycles** for deactivated categories, redirect changes, and CMS-slot edits take 5-14 days to stabilize in the index.

During those 5-14 days, **low click counts do not mean the changes failed**. They mean Google has not yet re-evaluated. A second wave of changes started during this window:

- Mixes cause and effect across two batches that cannot be separated later
- Often triggers a compounding penalty signal ("revert and re-add" pattern)
- Burns operator energy on premature optimization that the data will later contradict
- Erodes operator confidence when the next monitoring snapshot looks worse, not better

The Settlement Gate codifies the operator discipline of waiting through this blind window.

---

## 2. Definition

A Settlement Gate is active when `settlement_gate_active = true`. While the gate is active:

- **No new live SEO optimizations** are permitted
- **Only audit_only mode and emergency_rollback mode** are allowed
- **Unused change budget does not roll forward** as permission for additional work
- **User-pressure phrases do not lift the gate** — only verified technical emergencies, explicit emergency approvals, or unlock criteria being met

The gate has an explicit start, a minimum duration, a recommended duration, and a defined set of unlock criteria. Until criteria are met, the gate remains active.

---

## 3. Major Batch trigger

A Major Batch automatically activates `settlement_gate_active = true`. A Major Batch is any session in which **at least one** of the following is true:

| Trigger | Threshold |
|---|---|
| SEO-relevant live changes in one session | > 10 |
| URL / redirect / category operations | > 5 |
| Internal links added or removed | > 10 |
| Categories deactivated | ≥ 2 |
| Plugin config with sitewide effect | ≥ 1 |
| CMS-slot batch across multiple blog posts | ≥ 1 (when on ≥ 2 posts) |
| Template / canonical / H1 fix affecting multiple pages | ≥ 1 |
| Any change that produced a 404, 301 → 404, API 500, or required reactivation | ≥ 1 |
| Anchor text change involving DACH medical / legal risk terms | ≥ 1 |

If any single trigger fires, the gate activates with the timestamp of the **first** write operation in that session.

A `change-history.ndjson` entry must be appended with `triggered_settlement_gate: true` on the change that crossed the threshold.

---

## 4. Duration

| Window | Minimum | Recommended (Recovery) | For full click-delta evaluation |
|---|---:|---:|---:|
| Hours / days | 120 h (5 full days) | 168 h (7 days) | 240-336 h (10-14 days) |

- **Minimum 5 days** before any non-emergency live operation may be planned
- **7 days** is the default during active recovery (any phase R1-R4)
- **10-14 days** is required before evaluating whether the batch produced expected click-level or ranking-level effects

The minimum is not a target. It is the floor below which Claude must refuse non-emergency live operations regardless of operator pressure.

---

## 5. What is allowed during a Settlement Gate

All read-only, planning, and rollback-preparation work continues:

- Read-only crawls (Screaming Frog, internal HTTP checks)
- GSC pulls (clicks, impressions, queries, page-level, coverage)
- Sistrix pulls (VI, keyword movements, competitor data) — subject to tier limits
- DataForSEO pulls (keywords, backlinks, SERP snapshots)
- Backlink audits and delta analyses
- Live HTTP status checks (curl, no follow)
- Schema validation drafts (output to local cache, not pushed live)
- Rico / developer briefing documents
- Monitoring dashboards and re-renders
- QA reports against existing live state
- Rollback plan drafts (executed only under emergency_rollback)
- Ticket creation in Jira / Linear / GitHub
- Test fixtures, schema work, repo file changes
- Internal documentation updates

These are explicitly safe because they do not affect the live site.

---

## 6. What is blocked during a Settlement Gate

All forward-direction live SEO optimizations are blocked:

- New title rewrites (any URL)
- New meta description rewrites
- New internal links added (any blog, category, footer, nav)
- Internal link reduction or pruning (the "revert" half of the revert-and-re-add pattern)
- Linkblock reduction on already-modified CMS slots
- Content additions or rewrites on category, product, or blog pages
- New category or product deactivations
- New redirect experiments or 301 setups (non-repair)
- New canonical consolidations across URLs
- New plugin config changes with sitewide effect
- Template / H1 / breadcrumb fixes (non-emergency)
- AI Overview / passage-level on-page optimization deployed live
- "Noch schnell" fixes ("while we're here" optimizations)
- Schema deployments to live (drafts only, push deferred)

This list is non-exhaustive. **The default during a Settlement Gate is: no live SEO write.** The burden is on the operator to demonstrate that a proposed action falls under section 7 (Exceptions), not on Claude to find a reason to allow it.

---

## 7. Exceptions

Three categories of work may proceed during a Settlement Gate, and only these three.

### 7.A Technical Emergency

A change that addresses a verifiable, live, urgent technical defect:

- Live 404 on a primary URL (homepage, top category, top product) verified by live HTTP check
- 301 → 404 chain on a URL with backlinks, traffic, or rankings
- `noindex` accidentally set on a primary URL
- `canonical` clearly points to an unrelated or irrelevant URL
- `robots.txt` or robots meta blocks a URL that must be crawlable
- Rich-result markup is verifiably wrong in a way that creates trust or quality risk (e.g., `AggregateRating` showing a value that diverges from a verified live source)
- Shopware / DreiscSeo / CDN created a live state contradiction (API says one thing, live HTTP says another) that needs reconciliation

Each emergency must be supported by a live HTTP verification, not by an assumption or by API state alone.

### 7.B Rollback / Stabilization

Reversal or stabilization of a problematic change from the triggering batch:

- Re-activate a URL accidentally set to 404 or `isDeleted: true`
- Disable a redirect that creates a 301 → 404 chain
- Revert an anchor text containing a high-risk medical / legal term (DACH HWG, EU MDR)
- Restore a plugin config that broke a sitewide feature
- Restore a CMS-slot snapshot that introduced a broken link or wrong target

Rollback is governed by `emergency_rollback` mode (budget up to 30 points, stabilization only — no new optimization in the same run).

### 7.C Explicit Emergency Approval

A live change that does not fit 7.A or 7.B may still proceed only when **all** of the following are present:

- A concrete Change Plan output per `schemas/change-budget.schema.json`
- Calculated risk points per `references/SEO_CHANGE_GOVERNOR.md`
- A documented data basis (at least one source with confidence: medium or higher)
- A documented rollback method per change
- A pre-change live HTTP / API state check
- A post-change Live QA per `docs/LIVE_CHANGE_QA.md`
- An explicit per-change approval per `references/SAFE_LIVE_CHANGE_RULES.md`
- An explicit acknowledgement from the operator that the Settlement Gate is being overridden, with the override reason recorded

Override is recorded in `change-history.ndjson` with `settlement_gate_override: true` and the operator's stated reason.

Override is never granted by phrases like "los", "mach", "passt", "alles" — those remain Hard Stop triggers per `SAFE_LIVE_CHANGE_RULES.md`.

---

## 8. Recovery Gate Status object

Every command that touches `recovery_gate` state must emit or read the following object:

```json
{
  "recovery_gate": {
    "settlement_gate_active": true,
    "reason": "major_batch_on_2026-05-27",
    "started_at": "2026-05-27T19:43:00Z",
    "minimum_until": "2026-06-02T00:00:00Z",
    "recommended_until": "2026-06-06T00:00:00Z",
    "hard_block_live_optimizations": true,
    "allowed_modes": ["audit_only", "emergency_rollback"],
    "blocked_modes": [
      "micro_fix",
      "low_risk_fix",
      "controlled_recovery",
      "structural_change",
      "high_risk_requires_approval"
    ],
    "allowed_actions": [
      "read_only_analysis",
      "crawl",
      "gsc_pull",
      "sistrix_pull",
      "dataforseo_pull",
      "live_http_check",
      "ticket_creation",
      "schema_draft",
      "rollback_plan",
      "briefing",
      "monitoring_render"
    ],
    "blocked_actions": [
      "title_rewrite",
      "meta_rewrite",
      "new_internal_links",
      "linkblock_reduction",
      "cms_slot_patch",
      "category_deactivation",
      "redirect_experiment",
      "canonical_consolidation",
      "content_change",
      "h1_template_change",
      "plugin_config_change",
      "aio_passage_deployment"
    ],
    "unlock_criteria": [],
    "unlock_status": "blocked",
    "missing_unlock_criteria": [
      "time_minimum_until_passed",
      "gsc_post_batch_pull",
      "stability_check"
    ],
    "emergency_exceptions": [],
    "next_allowed_review_date": "2026-06-06"
  }
}
```

The object is persisted at `~/.cache/seo-rescue/{slug}/recovery-gate.json` per the schema in `schemas/recovery-gate.schema.json`. It is the source of truth queried by every recovery command.

---

## 9. Unlock criteria

The gate moves from `blocked` to `partial` or `open` only when concrete criteria are met. Time alone is not sufficient.

### 9.1 Time

- `time_minimum_until_passed`: current time ≥ `minimum_until` (5 full days)
- `time_recommended_until_passed`: current time ≥ `recommended_until` (7 days, default during recovery)
- `time_click_evaluation_window_reached`: current time ≥ `started_at + 10 days` (for any CTR / title / content evaluation)

For CTR, title, content, or internal-link optimization the click evaluation window is mandatory. Time-minimum alone unlocks only emergency-rollback and verified technical emergency work.

### 9.2 Data

At least **two** of the following must be refreshed since `started_at`:

- GSC clicks / impressions snapshot covering the post-batch window
- Screaming Frog control crawl after the batch
- Live HTTP status / redirect / canonical checks across affected URLs
- DataForSEO keyword snapshot post-batch
- Sistrix VI or equivalent visibility signal updated after `started_at`
- Backlink audit (only required if backlinks were a topic in the batch)

### 9.3 Stability

All of the following must be verified:

- No new 301 → 404 chains introduced by the batch
- No new internal 404s caused by the batch
- No new `noindex` or `canonical` errors caused by the batch
- No new critical GSC coverage issues (e.g., spike in "Discovered – currently not indexed" > 20%)
- No open Shopware / API state / live HTTP contradictions

### 9.4 Decision

Before any unlock-driven planning continues:

- A Re-Evaluation report has been written for the batch
- The Change Governor budget for the upcoming week has been re-calculated
- Each newly proposed measure has its own Change Plan, risk points, data basis, rollback method
- Explicit approval per `SAFE_LIVE_CHANGE_RULES.md` is present for each measure

### 9.5 Failure handling

If any criterion is missing:

- `unlock_status` = `"blocked"`
- `missing_unlock_criteria` lists the specific criteria not yet satisfied
- No live optimization may be planned or executed
- Only read-only and briefing work is permitted

Partial unlock (`unlock_status: "partial"`) is allowed for **emergency-rollback or 7.A technical emergency** even when not all criteria are met, but the operator must approve each action individually.

---

## 10. Default operator response under pressure

When the operator (during an active Settlement Gate) sends pressure phrases such as:

- "sollen wir noch optimieren?"
- "mach weiter"
- "warum sind die Klicks niedrig?"
- "lass Titles ändern"
- "noch Links setzen"
- "alles fixen"
- "ALLESS"
- "was kann ich noch machen?"

Claude **must** run this internal check before any other response:

1. Is the Settlement Gate active?
2. Is this a verified technical emergency under 7.A?
3. Are there new, post-batch, source-confirmed data signals that change the picture?
4. Would the proposed action conflate cause and effect with the batch under settlement?

If 1 = yes, 2 = no, 3 = no, and 4 = yes, Claude **must not** plan or execute new live optimization. Claude must respond with the standard answer in `SAFE_LIVE_CHANGE_RULES.md` section "Standard Settlement-Gate Response" and offer the allowed-actions list instead.

Low GSC click counts during the gate window are **not** sufficient evidence to lift the gate. They are the expected state during settlement.

---

## 11. Interaction with the Change Governor

While `settlement_gate_active = true`:

| Mode | Status during gate |
|---|---|
| `audit_only` | Allowed, 0 budget points |
| `emergency_rollback` | Allowed, up to 30 points, stabilization only |
| `micro_fix` | **Blocked**, unless 7.A technical emergency |
| `low_risk_fix` | **Blocked** |
| `controlled_recovery` | **Blocked** |
| `structural_change` | **Blocked** |
| `high_risk_requires_approval` | **Blocked** (plan-only still allowed in audit_only) |

**Unused budget does not roll forward as permission.** A week with 1 / 7 points spent does not authorize 6 additional points in the next week. The rule is: **Reserve bleibt Reserve.**

Formal statement (mirrored verbatim in `SEO_CHANGE_GOVERNOR.md`):

> Ungenutztes CG-Budget ist kein Umsetzungsauftrag. Es darf nicht spontan für weitere SEO-Änderungen verwendet werden. Jede zusätzliche Maßnahme braucht nach Gate-Ende einen neuen Change Plan, eigene Risikopunkte, Datenbasis, Rollback-Plan und explizite Freigabe.

---

## 12. Interaction with the recovery commands

| Command | Gate-aware behavior |
|---|---|
| `recovery-diagnose` | Reads gate state at start; reports `recovery_gate` block in output |
| `recovery-crawl` | Always allowed (read-only) |
| `recovery-plan` | If gate active: emits read-only roadmap with `live_changes_allowed: false`; segregates actions into `allowed_during_gate`, `blocked_until_re_eval`, `emergency_only`, `prepare_now_execute_later` |
| `recovery-monitor` | Always allowed (read-only) |
| `recovery-audit` | Detects last Major Batch from `change-history.ndjson`, computes gate state, reports `settlement_gate` block in audit output |
| `recovery-full` | If gate active: skips any step that would propose live changes; ends with a Plan-After-Gate document instead |

---

## 13. How a Settlement Gate ends

A gate ends when **either** of the following is true:

1. `unlock_status: "open"` — all unlock criteria in section 9 are satisfied
2. Explicit Emergency Approval per 7.C — a single override with a recorded reason; the override applies only to the specific change(s) approved, not to the gate as a whole

In both cases the operator is responsible for documenting the unlock decision in `change-history.ndjson` with `recovery_gate_unlock` and the basis for the unlock.

A gate that ends naturally (case 1) should be followed by a Re-Evaluation report capturing:

- What the batch attempted
- What the data shows happened (click delta, impression delta, position delta, coverage delta)
- Which hypotheses were supported and which were not
- What the next Change Plan window looks like, with fresh budget allocation

---

## 14. Anti-pattern: "unused budget as permission"

The most common way operators (or LLM assistants under operator pressure) defeat the Settlement Gate is by reading the remaining CG budget as an invitation to keep working.

This is invalid. The CG budget is a **per-cycle cap**, not a **per-cycle quota**. The week's allowed maximum is not the week's required minimum.

If the operator says any of:

- "wir haben ja noch Budget übrig"
- "lass uns die Reserve nutzen"
- "noch schnell ein paar kleine Fixes"
- "falls wir Zeit haben"
- "weitere kleine Fixes"

Claude must respond with: **"nicht ohne neuen Change Plan und explizite Freigabe"** and stop.

---

## See Also

- `references/SEO_CHANGE_GOVERNOR.md` — Risk points, modes, hard stops
- `references/SAFE_LIVE_CHANGE_RULES.md` — Approval validation, standard gate response
- `references/RECOVERY_SYSTEM.md` — Recovery phases, Do-Not-Touch principle
- `commands/recovery-plan.md` — Gate-aware planning
- `commands/recovery-audit.md` — Gate state detection
- `schemas/recovery-gate.schema.json` — JSON Schema for gate state
- `schemas/change-budget.schema.json` — Budget schema with gate fields
- `docs/LIVE_CHANGE_QA.md` — Why waiting matters
- `docs/TROUBLESHOOTING.md` — Why Claude refuses new SEO changes
