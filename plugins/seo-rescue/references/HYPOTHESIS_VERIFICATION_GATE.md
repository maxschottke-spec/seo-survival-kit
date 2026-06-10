# Hypothesis Verification Gate

A live-fix safeguard for SEO recovery operations. Blocks any technical repair action until the suspected root cause has been verified against a real source of truth, not just an AI-generated or LLM-derived hypothesis.

## Why this exists

AI diagnosis accelerates SEO recovery dramatically. A diagnosis that would take a human operator hours of forensic work can collapse to minutes when an LLM-driven assistant reads live HTML, parses crawl exports, traces ranking history, and reasons about cause chains. That speed-up is real and worth capturing.

But it has a failure mode: an AI hypothesis can be internally consistent, well-structured, supported by external evidence (open-source repository code, documentation, public behavior of similar systems), and still wrong about the active cause in the operator's specific stack. The hypothesis correctly describes a real bug pattern that exists somewhere in the world; it does not necessarily describe the bug that is firing right now on this site.

The originating recovery case for this gate was a Shopware D2C shop in May 2026. An AI-generated hypothesis named one open-source plugin as the cause, supported by direct source-code reading of that plugin's template overrides on GitHub. The hypothesis was internally consistent and was about to be turned into a live theme deploy. The operator's developer pulled the actually installed plugin files from the production server, inspected a different commercial closed-source plugin in the same template inheritance chain, and identified that as the actual cause. The first hypothesis was wrong in attribution but right in mechanism. Without that operator-level verification, the deploy would have been a fix in the wrong component, and the underlying vendor bug would have remained untouched and continued to affect other sites with the same plugin.

The Hypothesis Verification Gate is the structural answer to that failure mode.

## Definition

The Hypothesis Verification Gate is a hard-stop placed between diagnosis and live-fix in the recovery workflow. Live-fix actions are only permitted when the diagnosis carries the status `verified` (verified against a real source of truth) or `fixed` (already addressed and being monitored). At `suspected` or `likely`, only read-only checks, briefings, fix-planning, and stakeholder communication are permitted.

The gate is independent of and additional to:

- The `SEO_SETTLEMENT_GATE` (which blocks live changes during Recovery Windows for batch-related reasons)
- The `SEO_CHANGE_GOVERNOR` (which scores changes for risk-budget purposes)

A live action requires passing all three gates simultaneously. A hypothesis at `verified` does not bypass Settlement Gate or Change Governor; it only unlocks the diagnosis-to-fix transition.

## Status values

The five status values form a one-directional progression. A hypothesis only moves forward when its evidence stack supports the next level. It may be reset to `suspected` or `likely` if contradicting evidence emerges.

### suspected

A possible cause has been formulated based on observed effect plus general domain knowledge or AI pattern-matching. No verification against the actual stack has occurred. The hypothesis may be correct or incorrect.

Examples that count as `suspected`:

- "Click loss looks like AI Overviews zero-click effect" (pattern match, no live SERP inspection yet)
- "Decline matches helpful-content update timing" (correlation, no content analysis yet)
- "Theme is probably injecting a duplicate canonical" (plausible mechanism, no template inspection yet)

Permitted actions: read-only data pulls, internal briefings, fix-planning drafts, monitoring setup. Not permitted: any live change, any plugin toggle, any theme deploy, any configuration write.

### likely

The hypothesis has indirect supporting evidence beyond pattern-matching: live HTML signatures, crawl-export markers, SERP feature data, or third-party tool outputs. The cause has not been verified against the actual code, configuration, or stack that produces the behavior.

Examples that count as `likely`:

- Live HTML shows the symptom that the hypothesis predicts (e.g., two canonical tags observed)
- The page-type pattern matches the hypothesis (e.g., only blog-detail routes affected, not categories)
- Source code of an open-source component contains a code path that could produce the observed behavior

Permitted actions: same as `suspected`. Not permitted: live changes. The likely-status is a fix-planning state, not a fix-execution state.

### verified

The cause has been confirmed against a real source of truth specific to the operator's stack. The verification answers: which file, setting, route, template, plugin, or API on this specific instance produces the observed effect. The verification was performed by someone or something with direct access to that instance.

Acceptable verification sources, in increasing order of strength:

1. Live HTML inspection cross-checked across multiple page types to rule out alternative causes
2. Screaming Frog crawl with specific indexability or canonical signals that match the hypothesis
3. GSC URL Inspection showing Google's selected canonical or indexed state matching the hypothesis
4. Direct API state read from the live system (Shopware Admin API, WordPress REST, etc.)
5. Direct file inspection of the installed component on the production server (theme files, plugin files, CMS configuration files)
6. Operator or developer review at the real stack with explicit confirmation of the cause

For commercial closed-source components, sources 5 and 6 are typically the only valid verification paths. Open-source source-code reading on the upstream repository is not sufficient verification — it produces `likely`, not `verified`.

Permitted actions: live fix, subject to Settlement Gate and Change Governor. Live fix scope must match the verified cause exactly; expanding the fix scope beyond what was verified resets the hypothesis to `likely` for the expanded portion.

### fixed

The fix has been deployed live. Post-deploy QA has passed all blocking checks. Monitoring is scheduled. The hypothesis is no longer a hypothesis; it is a documented cause-and-fix entry in the change history.

Permitted actions: monitoring, follow-up communication, vendor outreach if the cause sits in a third-party component. Not permitted: silent expansion of the fix scope, additional batched changes coupled to this fix without separate approval.

### monitored

The fix has been live long enough to produce observable recovery signals (typically T+7 to T+14 days post-deploy). Monitoring is comparing actual recovery against expected recovery from the cause model.

Three terminal states from monitored:

- Recovery matches expectation → hypothesis is closed as confirmed root cause
- Partial recovery → hypothesis was correct but not sole cause; new hypotheses may need to be opened for the remainder
- No recovery → the verified cause was real but not the cause of the observed effect; re-open diagnosis at `suspected` for an alternative

Permitted actions: monitoring continues, fix may be modified or extended within scope, vendor follow-up.

## Verification source hierarchy

When deciding whether a verification action moves a hypothesis to `verified`, apply the hierarchy below. Higher-strength verification can substitute lower-strength; lower-strength cannot substitute higher-strength.

Strongest:

- Direct developer inspection of installed component files on the production server with explicit cause identification
- Direct operator inspection of installed component files with explicit cause identification

Strong:

- Live API read of the actual configuration state of the suspected component
- GSC URL Inspection showing Google's view of the affected URL matching the hypothesis
- Reproduction in staging environment that mirrors production state

Medium:

- Live HTML inspection cross-checked across at least three page types to isolate the affected scope
- Screaming Frog crawl with specific signals matching the hypothesis
- Third-party SEO tool output specific to the suspected URL or component

Weak (insufficient alone):

- Open-source source-code reading without confirmation that the code path is active in production
- Pattern match against documented bugs in similar systems
- Correlation between event timing and effect timing
- AI/LLM reasoning chain that connects observation to hypothesis

A hypothesis verified by weak-tier sources only is at most `likely`, never `verified`. Multiple weak-tier sources do not aggregate into verified; only a strong-tier or strongest-tier source produces verified.

## Required structure per hypothesis

Every recovery diagnosis must produce a JSON structure conforming to `schemas/hypothesis-verification.schema.json`. Minimum required fields:

```json
{
  "hypothesis_status": "suspected|likely|verified|fixed|monitored",
  "hypothesis": "concise statement of the suspected cause and mechanism",
  "supporting_evidence": [],
  "contradicting_evidence": [],
  "source_of_truth_checked": [],
  "excluded_alternatives": [],
  "verified_by": "operator|developer|live_html|crawl|api|server_file|gsc|mixed",
  "live_fix_allowed": false
}
```

The `live_fix_allowed` field is computed, not declared. It is `true` only if `hypothesis_status` is `verified` or `fixed`. Any other status forces it to `false` regardless of stakeholder preference.

The `excluded_alternatives` array is not optional. At `verified`, the diagnosis must explicitly document which alternative hypotheses were considered and ruled out, with the verification source that ruled them out. A diagnosis that has only confirmed one hypothesis without ruling out alternatives is at most `likely`.

## When the gate is most likely to bite

In practice, three scenarios trigger the gate to block what would otherwise feel like an obvious fix:

### Scenario A: AI-generated hypothesis from open-source code reading

An LLM-driven diagnosis identifies a plausible bug in an open-source component, reads the relevant repository, finds a code path that matches the observed behavior, and proposes a fix targeting that component. The fix plan is detailed and internally consistent.

The gate blocks the fix at `likely`. To move to `verified`, someone with stack access must confirm that the open-source code path is the active path on the operator's installed version. If a different (possibly closed-source) component sits in the same chain and is the actual producer of the behavior, the open-source hypothesis is wrong in attribution.

### Scenario B: Single-data-source correlation

A diagnosis bases its hypothesis on one data source (e.g., GSC click trend correlating with a deploy date, or a Sistrix visibility drop correlating with a Core Update). The correlation is strong and the time-window matches.

The gate blocks the fix at `likely` until a second-source cross-check is performed. Correlation in one source is suspicious; correlation that holds in two independent sources (GSC plus Crawl, or Sistrix plus DataForSEO live SERP) is medium-strength verification.

### Scenario C: Fix scope creep beyond what was verified

A hypothesis is verified for a specific URL or route pattern. The operator wants to apply the fix broadly ("all blog posts have the same bug, just patch all of them"). The verified scope is one URL; the proposed fix scope is fifty URLs.

The gate resets the expanded scope to `likely`. Verification of one URL is not verification of fifty. Either verify each URL (often infeasible), or run a small-batch live-fix on the verified URL with Stufe-1-Monitoring, then expand only after Stufe-3-Monitoring confirms recovery.

**Enforcement (v1.3.0):** this reset is machine-checked, not just procedural. `lib/safe.js checkHypothesisScopeMatch()` compares every `planned_changes[].target` against the verified hypothesis' `fix_scope.affected_urls` and segregates out-of-scope targets to `prepare_now_execute_later` with stop reason `fix_scope_expansion`. recovery-plan Step 8a calls this check before emitting the plan.

## What this gate does not solve

The Hypothesis Verification Gate is a procedural safeguard, not a magical correctness oracle. It cannot:

- Detect a hypothesis that is verified against the wrong source of truth (e.g., GSC URL Inspection shows what Google thinks, which may itself be stale)
- Prevent a verified-and-fixed cause from being only a partial explanation of the observed effect
- Replace the operator's domain judgment about whether the verified cause is worth fixing right now versus deferred

It does ensure that the explicit verification step happens before any live change, and that the verification source is documented and challengeable.

## Cross-references

- `references/SEO_CHANGE_GOVERNOR.md` — risk-point scoring for changes; HVG is a precondition for any positive-point change to be permitted
- `references/SEO_SETTLEMENT_GATE.md` — Recovery Window batch-limit gate; HVG operates orthogonally
- `references/SAFE_LIVE_CHANGE_RULES.md` — approval validation and informal-German approval handling; HVG status must be cited in any approval request
- `references/RECOVERY_SYSTEM.md` — six-stage recovery framework; HVG fits between Diagnose and Plan
- `docs/LIVE_CHANGE_QA.md` — post-deploy QA checklist; HVG status drives which QA checks are required
- `docs/TROUBLESHOOTING.md` — pattern catalog including "internally consistent but externally wrong" failure modes
- `commands/recovery-audit.md` — must emit `hypothesis_status` in output JSON
- `commands/recovery-plan.md` — must refuse to generate plan content for hypotheses below `verified`
- `schemas/hypothesis-verification.schema.json` — JSON schema for the hypothesis object
