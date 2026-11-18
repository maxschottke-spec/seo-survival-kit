# Known Google Core Updates

Reference data for Core Update correlation checks in `recovery-diagnose`.

Last verified: 2026-11-18

(`Last verified` is the day the whole table was last compared with the Google Search Status Dashboard. The freshness policy below is measured against this line, not against the file's modification date.)

| Update | Type | Rollout-Start | Rollout-Ende | Verified |
|--------|------|--------------|-------------|----------|
| November 2026 Core Update | core | 2026-11-10 | laufend | yes (2026-11-18, rollout not finished) |
| September 2026 Spam Update | spam | 2026-09-24 | 2026-10-08 | yes (2026-11-18) |
| August 2026 Spam Update | spam | 2026-08-18 | 2026-08-21 | yes (2026-11-18) |
| June 2026 Spam Update | spam | 2026-06-24 | 2026-06-26 | yes (2026-11-18) |
| May 2026 Core Update | core | 2026-05-21 | 2026-06-02 | yes (2026-06-03) |
| March 2026 Core Update | core | 2026-03-27 | 2026-04-08 | yes (2026-06-03) |
| March 2026 Spam Update | spam | 2026-03-24 | 2026-03-25 | yes (2026-06-03, 20h rollout) |
| February 2026 Discover Update | discover | 2026-02-05 | 2026-02-19 | yes (2026-06-03) |
| December 2025 Core Update | core | 2025-12-11 | 2025-12-29 | yes (2026-06-03) |
| November 2025 Core Update | core | 2025-11-11 | 2025-11-28 | no (pre-v0.5.2 seed) |
| August 2025 Spam Update | spam | 2025-08-26 | 2025-09-22 | yes (2026-06-03) |
| August 2025 Core Update | core | 2025-08-15 | 2025-08-30 | no (pre-v0.5.2 seed) |
| June 2025 Core Update | core | 2025-06-30 | 2025-07-17 | yes (2026-06-03) |
| March 2025 Core Update | core | 2025-03-13 | 2025-03-27 | no (pre-v0.5.2 seed) |

Entries marked `Verified: yes` carry the date of their cross-check in brackets: the entries dated 2026-06-03 were checked against the Google Search Status Dashboard and Search Engine Land coverage (16-month historical scan), the four entries dated 2026-11-18 were checked on that day. Entries marked `no` are pre-existing seed data — re-verify before claiming `high` correlation against them (cap at `medium` until verified).

## Update types and correlation

- `core` — broad ranking recalibration; primary subject of this plugin's recovery framework
- `spam` — link/spam systems; drops here are NOT core-update damage and need a different diagnosis (disavow-adjacent, link profile)
- `discover` — affects Google Discover traffic, often invisible in classic VI tools but visible in GSC Discover reports

Only `core` entries are correlated. A drop that falls into the window of a `spam` or `discover` entry (rollout start to rollout end plus 14 days) produces a warning and caps the correlation at `low`, even if a `core` entry also fits in time.

"Correlation" here means temporal proximity between the date of the largest visibility drop and the rollout start of an update. It is an indication, not proof of cause.

Multi-update sequences (several updates within months) erode baselines silently — when correlating, always check ALL updates in the look-back window, not just the closest one. See `post-core-update-recovery/LESSONS.md` (2026-06-03 entry).

## Correlation Logic

- VI-Drop within 4 weeks after rollout start → `high` (only against `Verified: yes` entries; against a `Verified: no` entry the result is capped at `medium`)
- VI-Drop 4–8 weeks after rollout start → `medium`
- VI-Drop >8 weeks after or before rollout → `low`
- No temporal relationship → `none`
- Rollout-Ende `laufend` (rollout not finished): the entry is correlated by its rollout start like any other. For the stage state machine it counts as an active update window with no end date: `days_since_rollout_end` stays `null`, and the re-entry window stays open until an end date is entered. Replace `laufend` with the end date as soon as Google reports the rollout complete.

## Maintenance

Add new Core Updates as Google announces them. Check the Google Search Status Dashboard:
https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history

## Freshness Policy

- This list must be updated at least monthly.
- If the `Last verified` date at the top of this file is older than 90 days (or the line is missing), no `high` Core Update correlation may be claimed. The file's modification date is not used: installing or cloning the plugin resets it.
- In that case, `core_update_correlation` must be set to `unknown` or at most `low`.
- If no trustworthy data is available, no Core Update diagnosis may be asserted.
- Commands that reference this file must check the `Last verified` line before using it for correlation.
- When you update the table, update `Last verified` in the same edit.
