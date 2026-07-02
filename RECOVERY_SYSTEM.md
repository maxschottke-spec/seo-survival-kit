# Recovery System

> **Canonical location:** [plugins/seo-rescue/references/RECOVERY_SYSTEM.md](./plugins/seo-rescue/references/RECOVERY_SYSTEM.md)
>
> This root file is a pointer stub. The full, maintained specification — including the newer sections 4b (Pre-Hit Baseline Selection), 4c (Stage State Machine), Step 7a (Hypothesis Verification Gate), the batch-change velocity rule, the shared-CMS-layout trap, and 12a (Settlement Gate) — lives at the canonical location above, which is what the recovery commands read at runtime. Section numbering is preserved there, so existing `RECOVERY_SYSTEM.md §N` cross-references resolve in the canonical file.

**Abstract (5 lines):**

1. Operational methodology for SEO recovery: a ten-step decision flow (detect → validate → protect → analyze → sequence → verify hypothesis → implement → monitor → re-validate) run on a weekly Monday rhythm.
2. Do-Not-Touch doctrine and Money Keyword Protection: winning URLs are left alone during active recovery; panic-edits on recovered URLs are the highest-cost operator mistake.
3. Six recovery stages (Stage 0–5, keyword milestones), five work phases (R1–R5, protect → stabilize → internal links → intent conflicts → consolidation), and a Risk Matrix (Green/Yellow/Red/Black-flag) that gates every proposed action.
4. Winner/Loser Neutralization and URL Recovery Analysis explain flat visibility indices during real recovery; the Recovery Signal Score (shipped v0.5.2 in `sistrix-monday-recovery-check`) summarizes signal strength 0–100.
5. Time-based recovery logic and the Settlement Gate (§12a): the methodology does not block edits by default, except when a Settlement Gate is active after a Major Batch — then live optimization is hard-blocked until the unlock criteria are met.
