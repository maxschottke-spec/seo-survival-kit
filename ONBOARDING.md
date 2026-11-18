# Onboarding — a first result without keys, then a first PDF with paid keys

Two paths. The free path gets you a first result in about 15 minutes and needs no account anywhere. The PDF path (Steps 3 to 7) produces the decision-maker SEO report and needs **paid access to Sistrix and DataForSEO**; getting those accounts approved and funded can take longer than the 15 minutes the steps themselves take.

## What you need

| For | You need |
|---|---|
| Everything | [Claude Code](https://code.claude.com/) |
| Any script in this kit | Node.js 20.6 or newer (`node --version`). The scripts load keys with `node --env-file=…`, which older versions do not have. |
| The PDF step (Steps 6 and 7) only | Google Chrome, or Chromium with `CHROME_PATH` set. The report is rendered by headless Chrome. |
| Steps 3a, 3b, 6 and 7 | A Sistrix account with API access and a funded DataForSEO account. Both cost money, see [COSTS.md](./COSTS.md). |
| Step 3c | A Google Cloud project for the PageSpeed Insights key (free). |

No `npm install` anywhere: the kit has no dependencies.

## No keys? Start with one of the three free entry points

Install the plugin (Step 1), then pick one. None of them needs an API key or a paid tool.

**1. Traffic dropped after a Google update**
`/seo-rescue:post-core-update-recovery example.com`
You bring: the date the drop started, ideally a Search Console export (Performance → Export, 16 months).
You get: a diagnosis tree (core update or something else) and a four-phase recovery plan.

**2. Free technical health check**
`/seo-rescue:seo-audit-free example.com`
You bring: only the domain. The skill uses curl, PageSpeed Insights and, if installed, local Lighthouse.
You get: a one-page report with what works, what to improve, what is critical. The skill text is German; ask Claude to answer in English if you prefer.

**3. Weekly recovery review from two keyword CSVs**
`/seo-rescue:sistrix-monday-recovery-check <current.csv> <previous.csv> example.com`
You bring: two keyword exports a week apart. No own data yet? The plugin ships a synthetic pair, see the skill's "Synthetic example" section.
You get: a 17-section Monday report (stage, winners, losers, what not to touch).

To check that the scripts work on your machine without touching any API, see "Verify your install" in the [README](./README.md#verify-your-install).

## Step 1 — Install the plugin (1 min)

In Claude Code, **pinned to a tag** (recommended — see [SECURITY.md](./SECURITY.md#recommended-install-pinned-to-a-tag-or-commit)):
```
/plugin marketplace add maxschottke-spec/seo-survival-kit#v0.5.6
/plugin install seo-rescue@seo-survival-kit
/reload-plugins
```

Or always-latest (less safe — a maintainer-account compromise propagates on next reload):
```
/plugin marketplace add maxschottke-spec/seo-survival-kit
/plugin install seo-rescue@seo-survival-kit
/reload-plugins
```

Verify:
```
/plugin
```
You should see `seo-rescue` in the Installed tab with all 19 skills:
- `rescue` (orchestrator — entry point, type `/seo-rescue:rescue` to see the routing table)
- Free, no keys: `seo-audit-free`, `post-core-update-recovery`, `ai-search-rescue`, `sistrix-monday-recovery-check`, `channel-economics-analyzer`, `subscription-monetization-audit`
- Free, with a free Google key or service account: `psi-weekly-cron-baseline`, `gsc-deep-dive`
- Paid API calls: `seo-outreach-report`, `competitor-deep-audit`, `target-keyword-set`, `ai-citations-tracker`
- Recovery workflow (uses the MCP servers you have configured, with CSV fallbacks): `recovery-diagnose`, `recovery-crawl`, `recovery-audit`, `recovery-plan`, `recovery-monitor`, `recovery-full`

Which key belongs to which skill, and what each run costs: the table at the top of [COSTS.md](./COSTS.md).

## Step 2 — Decide if you need the API setup (2 min)

Steps 3 to 7 set up `seo-outreach-report`, the PDF pipeline. It needs paid Sistrix and DataForSEO access plus a free Google key. The three free entry points above need none of this.

If you only want the recovery framework: **skip to Step 5**.

## Step 3 — Get your API credentials (10 min) ⚠️ COSTS MONEY

### Read [COSTS.md](./COSTS.md) first.

Realistic spend: **about 0.15 – 0.75 per domain audit** (Sistrix credits plus DataForSEO calls, see COSTS.md) plus your Sistrix subscription.

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

The instructions below assume macOS or Linux. Windows users: see [Step 4w](#step-4w--windows-equivalent) below.

Copy the template. After an install the plugin lives under `~/.claude/plugins/cache/seo-survival-kit/seo-rescue/<version>/` (marketplace name, plugin name, version):
```bash
# newest installed version of the plugin
PLUGIN_DIR=$(ls -d ~/.claude/plugins/cache/seo-survival-kit/seo-rescue/*/ | sort -V | tail -1)
echo "$PLUGIN_DIR"            # e.g. …/seo-survival-kit/seo-rescue/0.5.6/

mkdir -p ~/.config/seo-rescue
cp "${PLUGIN_DIR}skills/seo-outreach-report/.env.example" ~/.config/seo-rescue/.env
chmod 600 ~/.config/seo-rescue/.env   # owner-only read/write
```

Working from a clone of the repository instead? Then `PLUGIN_DIR=plugins/seo-rescue/` (with the trailing slash), relative to the repository root.

Edit `~/.config/seo-rescue/.env` and fill in your real values:
```
SISTRIX_API_KEY=<your-real-key>
DATAFORSEO_LOGIN=<your-email>
DATAFORSEO_PASSWORD=<your-api-password>
GOOGLE_API_KEY=<your-psi-key>
```

**Do NOT commit this file to git.** The plugin's `.gitignore` covers it within the repo, but make sure your own working directory's `.gitignore` also ignores `.env`.

### Step 4w — Windows equivalent

PowerShell (run as your normal user, not Administrator):

```powershell
$env:USERPROFILE | % { New-Item -ItemType Directory -Path "$_\.config\seo-rescue" -Force | Out-Null }
# newest installed version of the plugin
$plugin = Get-ChildItem "$env:USERPROFILE\.claude\plugins\cache\seo-survival-kit\seo-rescue" -Directory | Sort-Object { [version]$_.Name } | Select-Object -Last 1
$src = Join-Path $plugin.FullName "skills\seo-outreach-report\.env.example"
$dst = "$env:USERPROFILE\.config\seo-rescue\.env"
Copy-Item $src $dst

# ACL: owner-only read/write (Windows equivalent of chmod 600)
$acl = Get-Acl $dst
$acl.SetAccessRuleProtection($true, $false)   # disable inheritance, do not copy parent rules
$me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$rule = New-Object Security.AccessControl.FileSystemAccessRule($me, 'FullControl', 'Allow')
$acl.SetAccessRule($rule)
Set-Acl $dst $acl
```

Then edit `%USERPROFILE%\.config\seo-rescue\.env` with the same key=value lines as the macOS/Linux version above.

### Cross-platform env vars for the pipeline scripts

The pipeline scripts read these env vars and fall back to the defaults below when one is not set. The Chrome path has a default only for macOS, so set `CHROME_PATH` on Linux and Windows:

| Env var | macOS default | Linux default | Windows recommendation |
|---|---|---|---|
| `CHROME_PATH` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (built-in default) | no built-in default, set it: `/usr/bin/google-chrome` (or `/usr/bin/chromium`) | no built-in default, set it: `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| `SEO_CACHE_DIR` | `~/.cache/seo-rescue/` | `~/.cache/seo-rescue/` | `$env:LOCALAPPDATA\seo-rescue\cache` |
| `SEO_PDF_OUTPUT_DIR` | `~/Downloads/` | `~/Downloads/` | `$env:USERPROFILE\Downloads` |
| `SEO_AUDIT_CONFIG` | `./audit-config.json` | `./audit-config.json` | `.\audit-config.json` |
| `PSI_CONFIG` | `./psi-config.json` | `./psi-config.json` | `.\psi-config.json` |

PowerShell export (per-session):
```powershell
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:SEO_CACHE_DIR = "$env:LOCALAPPDATA\seo-rescue\cache"
$env:SEO_PDF_OUTPUT_DIR = "$env:USERPROFILE\Downloads"
```

PowerShell persistent (per-user):
```powershell
[Environment]::SetEnvironmentVariable("CHROME_PATH", "C:\Program Files\Google\Chrome\Application\chrome.exe", "User")
```

Bash export (`.zshrc` / `.bashrc`):
```bash
export CHROME_PATH="/usr/bin/google-chrome"   # Linux
# macOS uses the default, no export needed
```

**Cross-platform caveats (verified known limitations):**

- `lib/safe.js` calls `fs.chmodSync(dir, 0o700)` on the cache dir. On Windows this is a no-op — the directory inherits its parent ACL. If you're on a shared Windows box, set ACLs manually on `$env:LOCALAPPDATA\seo-rescue` to your user only (same pattern as the `.env` example above).
- The PDF output uses `path.join` so separator handling is correct on Windows. The PDF filename never contains backslashes.
- `psi-weekly-cron-baseline` documents launchd (macOS) and crontab (Linux). On Windows use Task Scheduler — see Microsoft's `schtasks /create` docs.

## Step 5 — Verify the framework skill works

In Claude Code, say something like:

> "A site I'm consulting lost 45% of its visibility on Sistrix in the last 6 weeks. Brand keywords still rank, no migration was done. What do we do?"

Claude should now automatically pick up `post-core-update-recovery` (you'll see it in the skill invocation). The skill will:
- Apply the diagnose decision-tree
- Confirm Core-Update pattern (matching keywords + brand intact + timing)
- Lay out the 4-phase recovery plan (Authority → Topical → Off-page → Tech)
- Set realistic expectations (first movement after 3–4 months, full recovery usually 9–18 months)

If the skill doesn't trigger, you can manually invoke it:
```
/seo-rescue:post-core-update-recovery example.com
```

## Step 6 — Generate your first outreach PDF (needs the paid keys from Step 3)

Open an empty working directory. The pipeline reads `./audit-config.json` from the directory you start it in and writes the PDF to `~/Downloads/`:
```bash
mkdir -p ~/seo-test && cd ~/seo-test
PLUGIN_DIR=$(ls -d ~/.claude/plugins/cache/seo-survival-kit/seo-rescue/*/ | sort -V | tail -1)
cp "${PLUGIN_DIR}skills/seo-outreach-report/audit-config.example.json" ./audit-config.json
```

In Claude Code, started in that directory:

> "Generate an SEO outreach PDF for example.com. The owner doesn't know SEO. Save it to ~/Downloads/. My keys are in ~/.config/seo-rescue/.env."

Claude will:
1. Look up the skill `seo-outreach-report`
2. Read its SKILL.md
3. Fill `audit-config.json`: the `targets` entry for the domain and its `narrative` block (cover headline, business one-liner, diagnose paragraphs, conclusion, action plan) — for which Claude needs to know what the business is, so give context or let Claude fetch the homepage
4. Run the 4-step pipeline
5. PDF lands in `~/Downloads/SEO-Auswertung-example-com-<YYYY-MM-DD>.pdf`

The same pipeline by hand, once `audit-config.json` has your target (slug `example` here):
```bash
ENV_FILE=~/.config/seo-rescue/.env
SKILL="${PLUGIN_DIR}skills/seo-outreach-report"

# homepage HTML for the on-page chapter
CACHE_DIR="${SEO_CACHE_DIR:-$HOME/.cache/seo-rescue}"; mkdir -p "$CACHE_DIR" && chmod 700 "$CACHE_DIR"
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "https://example.com/" > "$CACHE_DIR/example-home.html"

node --env-file="$ENV_FILE" "$SKILL/seo-audit-fetch-v2.js" example   # the only step that calls paid APIs
node "$SKILL/seo-extract-v2.js"
node "$SKILL/seo-onpage.js"
node "$SKILL/seo-report-gen.js"                                      # needs Chrome
```

The keys reach the fetch script only through `node --env-file=…`. Setting a shell variable that holds the path of the file (`export ENV_PATH=…`) does nothing by itself.

**First-run gotchas:**
- WebFetch may return 403 for Cloudflare-protected sites. Workaround already in the SKILL.md (use `curl` with full Mozilla user-agent).
- If PSI returns "quota exceeded" → check that your `GOOGLE_API_KEY` is set and the PageSpeed Insights API is enabled in your GCP project.
- If Sistrix returns `error_code: 5001` → your API tier doesn't include that endpoint. The skill works around this by using only `domain.sichtbarkeitsindex` per-month-call. If even that fails, your tier doesn't include API access — contact Sistrix.

## Step 7 — Read the PDF as if you were the recipient

Open the generated PDF. Read it from the perspective of a non-technical shop owner. Does it:
- Make sense without SEO knowledge?
- Have a clear conclusion (Kapitel 9 — Fazit)?
- Tell them concretely what to do (Kapitel 10 — Aktionsplan)?

If any chapter feels too technical: the editorial text is not in the script, it is the `narrative` block for that slug in your `audit-config.json` (`headline`, `business_one_liner`, `diagnose`, `fazit`, `action_plan`). Edit it and run `seo-report-gen.js` again; re-rendering calls no API.

## Step 8 — Use LESSONS.md

After running the pipeline a few times, you'll notice patterns: certain types of shops always show the same gaps. Or you'll find new workarounds (Cloudflare quirks, region-specific Sistrix issues, etc).

Add dated entries to a `LESSONS.md` of your own, next to your `audit-config.json`. The two shipped files (`post-core-update-recovery/LESSONS.md`, `seo-outreach-report/LESSONS.md`) show the format, but they sit in the plugin cache and are replaced on every update, so do not write into them. Format:

```markdown
## YYYY-MM-DD — Domain or theme — Short title

**Context:** What was the situation?

**Finding:** What surprised you / what was new?

**Consequence:** How does this change how you use the skill?

**Source:** Link to evidence (PDF, commit, ticket).
```

After 3+ entries confirming a pattern, consider contributing it back as an issue or pull request.

## Cost-conscious workflow tips

1. **Batch domain audits** — fetch raw data once, render PDF multiple times (re-render is free)
2. **Cache `~/.cache/seo-rescue/<slug>-raw.json`** between runs — pipeline reuses if files exist (currently always overwrites; you can manually back up). Override path with `SEO_CACHE_DIR=...`
3. **Skip Sistrix history if budget tight** — comment out the 18 monthly calls in `seo-audit-fetch-v2.js` to save ~17 Sistrix credits per domain
4. **Test on your own domain first** before running on prospects, so you don't accidentally spend $5 because of a config typo

## Where to get help

- **Plugin docs:** [README.md](./README.md)
- **Cost details:** [COSTS.md](./COSTS.md)
- **Security questions:** [SECURITY.md](./SECURITY.md)
- **Maturity reality check:** [MATURITY.md](./MATURITY.md)
- **Bugs / feature requests:** [Open an issue](https://github.com/maxschottke-spec/seo-survival-kit/issues)

## What you should expect

After 15 minutes on the free path:
- One result from a free entry point (a diagnosis, a health check, or a Monday report from the synthetic CSVs)
- Understanding of what each skill does and when it triggers

After the PDF path (15 minutes of steps, plus however long the Sistrix and DataForSEO accounts take):
- One PDF in `~/Downloads/` for a test domain
- Working API credentials
- Understanding of what each skill does and when it triggers
- Realistic expectation of cost per audit

After 1 week of use:
- 5–10 prospect PDFs sent
- First entries in `LESSONS.md`
- A `narrative` wording in your `audit-config.json` that matches your communication style

After 1 month:
- Workflow integrated into your outreach / consulting routine
- Pattern recognition (which domains are textbook cases vs edge cases)
- PR-worthy improvements you can contribute back
