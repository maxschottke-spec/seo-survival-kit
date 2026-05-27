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
