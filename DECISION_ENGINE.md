# Decision Engine

> **Canonical location:** [plugins/seo-rescue/references/DECISION_ENGINE.md](./plugins/seo-rescue/references/DECISION_ENGINE.md)
>
> This root file is a pointer stub. The full, maintained specification — including the newer decision rules `r-batch-change-velocity-cap`, `r-shared-cms-layout-content-block`, `r-blog-authority-carries-recovery`, and `r-high-impressions-low-ctr-page2` — lives at the canonical location above, which is what the plugin skills and recovery commands read at runtime. Section numbering is preserved there, so existing `DECISION_ENGINE.md §N` cross-references resolve in the canonical file.
>
> Note: [Issue #28](https://github.com/maxschottke-spec/seo-survival-kit/issues/28) tracks whether this doc gets consolidated into RECOVERY_SYSTEM/ARCHITECTURE sections in v0.6, when the Decision Engine becomes a runtime concept.

**Abstract (5 lines):**

1. Decision-first layer of the Recovery Operating System: turns audit evidence into prioritized, sequenced, risk-gated recommendations — the manifesto is "what should I do next, what should I leave alone, what should wait".
2. Named, source-cited decision rules catalog (§2): each rule has condition, blocks/sequences, reason, and calibrated confidence — from `r-sistrix-vi-flat-money-keywords-recovered` to the batch-velocity and shared-CMS-layout traps.
3. Evidence weighting on a four-level A/B/C/D source scale (§3) and a data-quality layer (§4): weak or contradictory data yields `partial + low confidence`, never false certainty.
4. Profitability signals, five prioritization classes, sequencing constraints across recovery phases, and cross-channel signal/conflict resolution (§5–§9).
5. §10–§12 state what the engine does NOT do, the planned v0.6+ structured output contract, and the engine roadmap (specification today, runtime concept in v0.6+).
