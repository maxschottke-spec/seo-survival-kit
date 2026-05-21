# Onboarding — From Zero to First PDF in 15 Minutes

This guide gets you from installing the plugin to generating your first decision-maker SEO PDF report.

## Step 1 — Install the plugin (1 min)

In Claude Code:
```
/plugin marketplace add maxschottke-spec/seo-rescue-skills
/plugin install seo-rescue@seo-rescue-skills
/reload-plugins
```

Verify:
```
/plugin
```
You should see `seo-rescue` in the Installed tab with two skills:
- `post-core-update-recovery`
- `seo-outreach-report`

## Step 2 — Decide if you need the API setup (2 min)

You only need API credentials for `seo-outreach-report`. The `post-core-update-recovery` skill is a pure framework — invoke it any time, no setup needed.

If you only want the recovery framework: **skip to Step 5**.

## Step 3 — Get your API credentials (10 min) ⚠️ COSTS MONEY

### Read [COSTS.md](./COSTS.md) first.

Realistic spend: **€0.05 – €0.50 per domain audit** plus your Sistrix subscription.

### 3a — Sistrix
1. Account at [sistrix.de](https://www.sistrix.de/) — you need API access (separate from the regular Toolbox subscription, ask their sales if unclear)
2. Get your API key from the account settings
3. Confirm it works by visiting:
   ```
   https://api.sistrix.com/domain.sichtbarkeitsindex?api_key=YOUR_KEY&domain=example.com&format=json
   ```
   You should see a JSON response with a `sichtbarkeitsindex` value.

### 3b — DataForSEO
1. Sign up at [dataforseo.com](https://dataforseo.com/) — pay-per-call, ~$0.001-$0.05 per call typical
2. First deposit: $25 minimum (they currently offer a $1 trial credit)
3. Get `login` (your email) and `password` (your API password — NOT your dashboard password) from the account settings
4. Test:
   ```bash
   curl -u "EMAIL:API_PASSWORD" https://api.dataforseo.com/v3/dataforseo_labs/locations_and_languages
   ```
   Should return a list of supported locations.

### 3c — Google PageSpeed Insights (free)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Library → enable "PageSpeed Insights API"
4. Credentials → Create credentials → API key
5. (Recommended) Restrict the key to "PageSpeed Insights API" only
6. Free quota: 25,000 queries per day — generous

## Step 4 — Set up your `.env` file (2 min)

Copy the template:
```bash
mkdir -p ~/.config/seo-rescue
cp ~/.claude/plugins/cache/maxschottke-spec-seo-rescue-skills/plugins/seo-rescue/skills/seo-outreach-report/.env.example ~/.config/seo-rescue/.env
chmod 600 ~/.config/seo-rescue/.env   # owner-only read/write
```

Edit `~/.config/seo-rescue/.env` and fill in your real values:
```
SISTRIX_API_KEY=<your-real-key>
DATAFORSEO_LOGIN=<your-email>
DATAFORSEO_PASSWORD=<your-api-password>
GOOGLE_API_KEY=<your-psi-key>
```

**Do NOT commit this file to git.** The plugin's `.gitignore` covers it within the repo, but make sure your own working directory's `.gitignore` also ignores `.env`.

## Step 5 — Verify the framework skill works

In Claude Code, say something like:

> "A site I'm consulting lost 45% of its visibility on Sistrix in the last 6 weeks. Brand keywords still rank, no migration was done. What do we do?"

Claude should now automatically pick up `post-core-update-recovery` (you'll see it in the skill invocation). The skill will:
- Apply the diagnose decision-tree
- Confirm Core-Update pattern (matching keywords + brand intact + timing)
- Lay out the 4-phase recovery plan (Authority → Topical → Off-page → Tech)
- Set realistic 6-12 month expectations

If the skill doesn't trigger, you can manually invoke it:
```
/skill post-core-update-recovery
```

## Step 6 — Generate your first outreach PDF

Open a working directory and source the env file:
```bash
cd ~/Projekte/some-test-folder
export ENV_PATH=~/.config/seo-rescue/.env
```

In Claude Code:

> "Generate an SEO outreach PDF for example.com. Their inhaber doesn't know SEO. Save it to ~/Downloads/."

Claude will:
1. Look up the skill `seo-outreach-report`
2. Read its SKILL.md
3. Customize the `NARRATIVE` (cover headline, business one-liner, diagnose paragraphs, action plan) — for which Claude needs to know what the business is, so make sure to give context or let Claude fetch the homepage
4. Run the 4-step pipeline
5. PDF lands in `~/Downloads/SEO-Auswertung-example-com-<YYYY-MM-DD>.pdf`

**First-run gotchas:**
- WebFetch may return 403 for Cloudflare-protected sites. Workaround already in the SKILL.md (use `curl` with full Mozilla user-agent).
- If PSI returns "quota exceeded" → check that your `GOOGLE_API_KEY` is set and the PageSpeed Insights API is enabled in your GCP project.
- If Sistrix returns `error_code: 5001` → your API tier doesn't include that endpoint. The skill works around this by using only `domain.sichtbarkeitsindex` per-month-call. If even that fails, your tier doesn't include API access — contact Sistrix.

## Step 7 — Read the PDF as if you were the recipient

Open the generated PDF. Read it from the perspective of a non-technical shop owner. Does it:
- Make sense without SEO knowledge?
- Have a clear conclusion (Kapitel 9 — Fazit)?
- Tell them concretely what to do (Kapitel 10 — Aktionsplan)?

If any chapter feels too technical, the `NARRATIVE` map in `seo-report-gen.js` is editable. Update it for that domain or for your default style.

## Step 8 — Use LESSONS.md

After running the pipeline a few times, you'll notice patterns: certain types of shops always show the same gaps. Or you'll find new workarounds (Cloudflare quirks, region-specific Sistrix issues, etc).

Add dated entries to `LESSONS.md` in either skill folder. Format:

```markdown
## YYYY-MM-DD — Domain or theme — Short title

**Context:** What was the situation?

**Finding:** What surprised you / what was new?

**Consequence:** How does this change how you use the skill?

**Source:** Link to evidence (PDF, commit, ticket).
```

After 3+ entries confirming a pattern, consolidate it into the main SKILL.md. This keeps both files current and the skill self-improving.

## Cost-conscious workflow tips

1. **Batch domain audits** — fetch raw data once, render PDF multiple times (re-render is free)
2. **Cache `/tmp/seo-*-raw.json`** between runs — pipeline reuses if files exist (currently always overwrites; you can manually back up)
3. **Skip Sistrix history if budget tight** — comment out the 18 monthly calls in `seo-audit-fetch-v2.js` to save ~17 Sistrix credits per domain
4. **Test on your own domain first** before running on prospects, so you don't accidentally spend $5 because of a config typo

## Where to get help

- **Plugin docs:** [README.md](./README.md)
- **Cost details:** [COSTS.md](./COSTS.md)
- **Security questions:** [SECURITY.md](./SECURITY.md)
- **Maturity reality check:** [MATURITY.md](./MATURITY.md)
- **Bugs / feature requests:** [Open an issue](https://github.com/maxschottke-spec/seo-rescue-skills/issues)

## What you should expect

After 15 minutes:
- One PDF in `~/Downloads/` for a test domain
- Working API credentials
- Understanding of what each skill does and when it triggers
- Realistic expectation of cost per audit

After 1 week of use:
- 5–10 prospect PDFs sent
- First entries in `LESSONS.md`
- Customized `NARRATIVE` map matching your communication style

After 1 month:
- Workflow integrated into your outreach / consulting routine
- Pattern recognition (which domains are textbook cases vs edge cases)
- PR-worthy improvements you can contribute back
