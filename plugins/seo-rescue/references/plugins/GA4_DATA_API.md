# GA4 Data API · Gotchas Reference

Operational reference for the Google Analytics Data API v1beta. Things that bite during recovery operations and have no obvious documentation pointer.

## 1. ISO week dimension name

The dimension is **`isoYearIsoWeek`**, not `isoYearWeek`.

Google's API returns a helpful error if you use the wrong name:

```
"Did you mean isoYearIsoWeek? Field isoYearWeek is not a valid dimension."
```

The correct name is non-obvious because:
- `year`, `isoYear`, `week`, `isoWeek` all exist as separate dimensions
- The compound is `isoYearIsoWeek` (year+week both prefixed with `iso`), not `isoYearWeek` (only year prefixed)
- Output format: `YYYYWW` (e.g., `202621` for ISO week 21 of 2026), no separator

Same gotcha exists for `yearMonth` (correct, no `iso` prefix because Gregorian months are unambiguous).

## 2. OAuth refresh-token rotation

Google OAuth refresh tokens **silently rotate** under several conditions:

- The OAuth client is in "Testing" status in Google Cloud Console — tokens expire after 7 days of disuse
- The user revokes access to the app at https://myaccount.google.com/permissions
- Six months without use (production-status clients)
- The user changes their Google password (some scenarios)
- Multiple refresh-token requests racing in parallel (Google can invalidate the loser)

Symptom: every call returns `HTTP 400 Bad Request for POST https://oauth2.googleapis.com/token` with `{"error": "invalid_grant"}`. The API key is fine, the client is fine — only the refresh token is dead.

### Recovery procedure

Use the OAuth Playground for a no-code recovery:

1. Build a consent URL with the existing OAuth client and force `prompt=consent`:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=<CLIENT_ID>
     &redirect_uri=https://developers.google.com/oauthplayground
     &response_type=code
     &scope=https://www.googleapis.com/auth/analytics.readonly
     &access_type=offline
     &prompt=consent
   ```
   `access_type=offline` + `prompt=consent` is the combination that **forces a refresh token to be issued**. Without `prompt=consent` Google may return only an access_token if it remembers the prior consent.

2. The user clicks the URL, signs in with the account that has GA4 property access, accepts the consent screen, and lands on `https://developers.google.com/oauthplayground/?code=4/0...&scope=...`

3. The `code` parameter is short-lived (~5 minutes) and exchangeable exactly once via POST to `https://oauth2.googleapis.com/token`:
   ```
   grant_type=authorization_code
   code=<CODE>
   client_id=<CLIENT_ID>
   client_secret=<CLIENT_SECRET>
   redirect_uri=https://developers.google.com/oauthplayground
   ```

4. The response contains `refresh_token`, `access_token`, `expires_in`. Save the `refresh_token` (long-lived, do not log) to `.env` or secret store.

5. Validate by calling `runReport` for a minimal range (e.g., `7daysAgo` to `today`, single metric `sessions`).

The redirect URI `https://developers.google.com/oauthplayground` must already be registered in the OAuth client's allowed redirect URIs. If it is not, configure it once in Google Cloud Console under "OAuth 2.0 Client IDs → Edit → Authorized redirect URIs". Once registered, it can be re-used for future token recoveries without code changes.

## 3. Service-account vs OAuth-refresh selection

A client that has both `GOOGLE_SERVICE_ACCOUNT_BASE64` and `GOOGLE_*_REFRESH_TOKEN` configured should explicitly pick one authentication mode. Mixed modes lead to confusing "auth works for one call but not another" symptoms.

Service-account auth requires the service-account email to be **added as a User** to the target GA4 Property in the GA4 admin (Property Settings → Property Access Management). A service account that authenticates successfully but returns empty data sets almost always means the property access was never granted.

## 4. Token race during parallel fetchers

When multiple parallel calls trigger an OAuth refresh, Google rotates the first refresh response and invalidates subsequent racing calls. The Verapur recovery pipeline solves this by maintaining a module-global token cache with an in-flight refresh promise that subsequent callers await rather than triggering their own refresh.

Pattern (pseudo-code):

```javascript
async function authorize() {
  const cached = tokenCache.get(cacheKey);
  if (cached?.token && Date.now() < cached.expiresAt - 30_000) return cached.token;
  if (cached?.inflight) return cached.inflight; // share the racing request
  const inflight = doRefresh();
  tokenCache.set(cacheKey, { token: null, expiresAt: 0, inflight });
  try { return await inflight; } catch (e) { tokenCache.delete(cacheKey); throw e; }
}
```

Without this guard, parallel `fetchGa4*` calls in a dashboard build can each issue their own refresh, with all but one failing.

## 5. Dimension/metric name quirks worth memorizing

| Wanted | Correct name | Common wrong guess |
|---|---|---|
| ISO calendar week (year+week) | `isoYearIsoWeek` | `isoYearWeek` |
| Calendar month bucket | `yearMonth` | `yearAndMonth` |
| Channel grouping (default) | `sessionDefaultChannelGroup` | `defaultChannelGroup`, `channel` |
| Landing page | `landingPage` | `landingPagePath` (this is the *path* dimension, not the page itself) |
| First user channel | `firstUserDefaultChannelGroup` | `firstUserChannel` |
| Conversion count per event | metric `conversions` with dimension `eventName` | `conversionEventCount` |

When in doubt, the schema reference at https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema is authoritative.

## 6. eventCount vs sessions in funnel reports

Querying `eventName` as a dimension and `eventCount` + `sessions` as metrics produces one row per (week, event) tuple. The `sessions` metric in each row is **the count of sessions that had at least one of that event**, not the total sessions in the week. To get the unique session count per week, query it separately without the `eventName` dimension and join client-side.

This matters for funnel ratios: `eventCount(view_item) / sessions(from-event-row)` is **not** a true conversion rate.

## 7. Default lookback window for the API

The Data API serves data with **~2 hours of latency** for the current day and ~48 hours for full daily-stable data. For reports that compare to GSC (which has ~48-72 hour latency), align by ending both windows at `today - 2 days`.

## 8. Where to put credentials

The GA4 client supports:

- Application Default Credentials (ADC) via gcloud auth — typical for the official `google-analytics-mcp` server
- A service-account JSON file path in `GOOGLE_APPLICATION_CREDENTIALS`
- A base64-encoded service-account JSON in `GOOGLE_SERVICE_ACCOUNT_BASE64` (custom; requires the integration to decode it before use)
- An OAuth refresh token + client ID/secret (for personal-account access without a service account)

For the official MCP server, ADC or `GOOGLE_APPLICATION_CREDENTIALS` is the cleanest. For Node integrations inside a shop's own infrastructure, the OAuth refresh-token pattern is common because no separate service-account user has to be provisioned in the GA4 property.

## See also

- `references/FUNNEL_DIAGNOSIS.md` — Read-only funnel methodology that uses GA4
- `references/PROVIDER_CAPABILITIES.md` — Which data sources we trust for which questions
