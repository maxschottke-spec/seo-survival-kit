# Known Google Core Updates

Reference data for Core Update correlation checks in `recovery-diagnose`.

| Update | Type | Rollout-Start | Rollout-Ende | Verified |
|--------|------|--------------|-------------|----------|
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

Entries marked `Verified: yes` were cross-checked on 2026-06-03 against the Google Search Status Dashboard and Search Engine Land coverage (16-month historical scan). Entries marked `no` are pre-existing seed data — re-verify before claiming `high` correlation against them (cap at `medium` until verified).

## Update types and correlation

- `core` — broad ranking recalibration; primary subject of this plugin's recovery framework
- `spam` — link/spam systems; drops here are NOT core-update damage and need a different diagnosis (disavow-adjacent, link profile)
- `discover` — affects Google Discover traffic, often invisible in classic VI tools but visible in GSC Discover reports

Multi-update sequences (several updates within months) erode baselines silently — when correlating, always check ALL updates in the look-back window, not just the closest one. See `post-core-update-recovery/LESSONS.md` (2026-06-03 entry).

## Correlation Logic

- VI-Drop within 4 weeks after rollout start → `high` (only against `Verified: yes` entries)
- VI-Drop 4–8 weeks after rollout start → `medium`
- VI-Drop >8 weeks after or before rollout → `low`
- No temporal relationship → `none`

## Maintenance

Add new Core Updates as Google announces them. Check the Google Search Status Dashboard:
https://status.search.google.com/products/rGHU1u7kqx6rbY6IYDM6/

## Freshness Policy

- This list must be updated at least monthly.
- If the file's last modification date is older than 90 days, no `high` Core Update correlation may be claimed.
- In that case, `core_update_correlation` must be set to `unknown` or at most `low`.
- If no trustworthy data is available, no Core Update diagnosis may be asserted.
- Commands that reference this file must check its modification date before using it for correlation.
