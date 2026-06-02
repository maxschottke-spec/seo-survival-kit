# Known Google Core Updates

Reference data for Core Update correlation checks in `recovery-diagnose`.

| Update | Rollout-Start | Rollout-Ende |
|--------|--------------|-------------|
| March 2026 Core Update | 2026-03-27 | 2026-04-08 |
| November 2025 Core Update | 2025-11-11 | 2025-11-28 |
| August 2025 Core Update | 2025-08-15 | 2025-08-30 |
| March 2025 Core Update | 2025-03-13 | 2025-03-27 |

## Correlation Logic

- VI-Drop within 4 weeks after rollout start → `high`
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
