# SISTRIX Monday Recovery Check

> **Canonical location:** [plugins/seo-rescue/references/SISTRIX_MONDAY_RECOVERY_CHECK.md](./plugins/seo-rescue/references/SISTRIX_MONDAY_RECOVERY_CHECK.md)
>
> This root file is a pointer stub. The full, maintained workflow specification — the 17-section Monday report contract, the VI interpretation classes, the money-keyword protection table, the per-cluster Stage 0–5 classification, the Recovery Signal Score, and the GSC/CR validation layers — lives at the canonical location above, which is what the `sistrix-monday-recovery-check` skill reads at runtime. Section numbering is preserved there, so existing `SISTRIX_MONDAY_RECOVERY_CHECK.md §N` cross-references resolve in the canonical file.

**Abstract (5 lines):**

1. CSV-first weekly workflow for the recurring Monday-morning recovery review during an active SEO recovery — no SISTRIX API key required; shipped as the `sistrix-monday-recovery-check` skill in v0.5.2.
2. Compares the current and previous SISTRIX keyword exports and answers the same questions every week: did rankings recover, are money keywords holding, are winners and losers offsetting each other, is the visibility index lagging the ranking gains.
3. Produces a fixed 17-section report: VI interpretation (Rising/Falling/Flat/Lagging/Neutralized), Top-100→Top-3 recovery distribution, winner/loser neutralization, money-keyword protection, URL-level recovery, per-cluster recovery stage (0–5), Recovery Signal Score (0–100).
4. Ends in one of six recommended actions (Observe / Protect / Strengthen / Investigate / Correct / Escalate) plus an explicit What-Not-To-Touch guard for winning URLs and a next-7-day monitoring plan.
5. Optional validation layers: GSC cross-check (impressions/clicks vs. SISTRIX movement) and conversion-rate validation (VI-trend × CR-trend matrix, honoring `r-stockout-mutes-recovery`).
