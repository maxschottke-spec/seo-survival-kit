# Security Considerations

This document explains what the skills in this plugin do at runtime, what they access, and what trust decisions you make when installing them. It is intentionally explicit about what the code does today (post-`security-hardening` PR) and what is left to the user.

## What the skills do at runtime

### Pure-framework skills (no code execution)

- `post-core-update-recovery`, `seo-audit-free`, `channel-economics-analyzer` (the SKILL.md is markdown only; the optional starter scripts ship with the skill but the SKILL.md itself doesn't auto-execute them), `competitor-deep-audit`, `psi-weekly-cron-baseline` — these skills are mostly documentation/framework. Their optional starter scripts only run when **you** invoke them with `node`.

### `seo-outreach-report` — the script-heavy skill

Contains four Node.js scripts plus a shared `lib/safe.js`. They only run when you (or Claude on your behalf) invoke them with `node`. Nothing runs automatically at install time.

| Script | What it does | What it accesses |
|--------|--------------|-------------------|
| `seo-audit-fetch-v2.js` | HTTPS calls to Sistrix, DataForSEO, Google PSI | Network (outbound only), reads `.env` via `node --env-file`, writes `~/.cache/seo-rescue/<slug>-raw.json` |
| `seo-extract-v2.js` | Pure JSON parsing | Reads `~/.cache/seo-rescue/<slug>-raw.json`, writes `~/.cache/seo-rescue/<slug>-summary.json` |
| `seo-onpage.js` | Regex parsing of locally cached homepage HTML | Reads `~/.cache/seo-rescue/<slug>-home.html`, writes `~/.cache/seo-rescue/seo-onpage.json` |
| `seo-report-gen.js` | Builds an HTML report, then launches Chrome headless to render it to PDF | Reads `~/.cache/seo-rescue/*.json`, writes HTML into a per-run `mkdtemp` directory under `$TMPDIR`, launches Chrome subprocess with an isolated `--user-data-dir`, writes PDF to `$SEO_PDF_OUTPUT_DIR` (default `~/Downloads/`) |

## Threats and mitigations

### Credential handling
- API keys are loaded from a `.env` file. The `.env` file is in `.gitignore` and **must never** be committed.
- Scripts use `process.env.*` access — keys are not logged and not written to disk by the scripts themselves.
- **Your responsibility:** keep the `.env` file in a private location (e.g. `~/.config/seo-rescue/.env`) with restrictive permissions: `chmod 600 ~/.config/seo-rescue/.env`.

### Input validation

All scripts share `plugins/seo-rescue/lib/safe.js`. At config-load time every `target.slug` is validated with `safeSlug()` (`^[a-z0-9][a-z0-9_-]{0,63}$`). Slugs that fail validation cause the script to throw immediately — before any file I/O or subprocess. This blocks path-traversal attempts in `audit-config.json` (e.g. `slug: "../../etc/foo"`).

The validation applies in every script, not just one — see commit history for the `security-hardening` work. Earlier versions only validated slugs in `seo-report-gen.js`; this is now fixed.

### File system layout

Inter-script state lives under `~/.cache/seo-rescue/` (created mode `0700`, refused if the path is a symlink). It is per-user and not in world-writable `/tmp/`. This defeats local symlink-clobber attacks where another user (or a malicious background process) could pre-create `/tmp/seo-foo-raw.json` as a symlink to `~/.ssh/authorized_keys`.

You can override the cache directory with `SEO_CACHE_DIR=/some/private/path`. The script will refuse to use the path if it is a symlink.

Intermediate HTML for the PDF render lives in a per-run directory created via `fs.mkdtempSync(os.tmpdir() + '/seo-rescue-render-XXXXXX')` and is removed when the run completes. Set `SEO_KEEP_RUN_DIR=1` if you want to inspect the HTML between runs.

Final PDFs are written to `$SEO_PDF_OUTPUT_DIR` (default `~/Downloads/`).

### Size caps on external input

All `readFileSync` calls on files that originate outside the script (audit-config.json, raw API dumps, cached homepage HTML) go through `safeReadFile()`, which refuses to read files larger than 10 MB (50 MB for raw homepage HTML). This blocks trivial OOM-via-huge-file DoS.

### HTML escaping + Content-Security-Policy

The PDF report HTML interpolates strings from two semi-trusted sources:
- `audit-config.json` → `narrative` block (you write this, so under your control)
- API responses from Sistrix / DataForSEO (third-party API; could theoretically be poisoned by a hostile competitor seeding their domain's `@type` JSON-LD or `referring_domains.first_seen` with HTML)

Two layers of defense:

1. **`esc()` escaping** — every dynamic string runs through `esc()`, which escapes `& < > " ' \``. Numeric fields go through `num()`, which coerces to `Number` (returns `0` on non-numeric input).

2. **Strict Content-Security-Policy meta tag** — the rendered HTML carries:
   ```
   default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;
   base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'
   ```
   Even if a malicious string slipped past `esc()` and emitted e.g. `<iframe src="file:///etc/passwd">`, Chrome's CSP enforcement would refuse to load the frame. No data exfiltration via the PDF render is possible without bypassing **both** layers.

### Subprocess execution (Chrome)

- The PDF render launches Chrome via `child_process.spawnSync(CHROME_PATH, [...args], { shell: false })`. **No shell** is involved, so quoting, `$VAR` expansion, semicolons, backticks etc. in any argument are impossible — `spawnSync` passes the array verbatim as argv.
- Chrome is launched with `--user-data-dir=<runDir>/chrome-profile`, so the headless render uses a fresh profile and does **not** touch your real Chrome cookies, extensions, sessions, or saved passwords.
- `--no-default-browser-check`, `--no-first-run`, `--headless=new`, `--disable-gpu` are set. The Chrome sandbox is **not disabled** (we never set `--no-sandbox`).
- `CHROME_PATH` is read from `process.env.CHROME_PATH` (default `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`). Validated via `fs.existsSync()` before launch. Because we use `spawnSync` with argv-array form, even a malicious `CHROME_PATH` value containing shell metacharacters is treated as a literal filesystem path; it would simply fail to execute.

### Network access

Scripts make HTTPS calls only to these hosts:
- `api.sistrix.com` — VI data
- `api.dataforseo.com` — SERP/backlinks data
- `www.googleapis.com` — PageSpeed Insights
- The target domain (via `curl` you run manually) — to cache the homepage HTML for on-page analysis

No data is sent to the plugin author or any third party beyond these named APIs.

### What the plugin does NOT do
- Does not collect telemetry
- Does not phone home to any server controlled by the author
- Does not modify your Claude Code config / settings
- Does not modify any project files
- Does not execute code from the audited target domain (HTML is parsed via regex, not executed by Chrome — Chrome only renders the locally generated report)
- Does not require sudo/root

## Trust model

When you install **any** Claude Code plugin from a third-party marketplace, you are granting it the ability to:
- Run code in your shell with your user privileges
- Read files Claude has access to
- Access the network

This applies to all plugins, not just this one. Anthropic's docs are explicit about this — see the [Plugin security warning](https://code.claude.com/docs/en/discover-plugins#security).

### Recommended install: pinned to a tag or commit

**Default install** (always-latest, less safe):
```
/plugin marketplace add maxschottke-spec/seo-survival-kit
```

**Pinned install** (reproducible, recommended for production use):
```
/plugin marketplace add maxschottke-spec/seo-survival-kit#v0.2.0
```
or
```
/plugin marketplace add maxschottke-spec/seo-survival-kit#<commit-sha>
```

Pinning means a future compromise of the maintainer's GitHub account (or an unintended breaking change) won't silently propagate to your installation on the next reload.

### How to verify before trusting

1. Read the source. This repo is intentionally small (~2,000 lines including docs).
2. Verify the commit SHA you're installing matches the one you reviewed: `gh api repos/maxschottke-spec/seo-survival-kit/commits/<sha>` returns the same content.
3. Run the smoke test in a sandbox first — use a fresh user account or `SEO_CACHE_DIR=/tmp/sandbox-cache SEO_PDF_OUTPUT_DIR=/tmp/sandbox-out`.
4. Run with reduced env exposure: pass only the env vars the script needs (`SISTRIX_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `GOOGLE_API_KEY`), nothing else.

## For external reviewers

If you're reviewing this plugin (independently, as a collaborator, or with LLM assistance in any tier), please follow these reporting rules. They exist because pattern-matching tools (including the bundled `skill-security-auditor`) produce false positives, and because LLM assistants without verified access to this repo will sometimes fabricate file paths, function names, or CVE numbers that sound plausible but don't exist.

### Reporting protocol

1. **Every finding cites `file:line`.** No `file:line`, no finding. If you can't point to the exact location, downgrade to a question in the PR thread instead of a security issue.
2. **Three confidence labels — pick one explicitly:**
   - `[VERIFIED]` — code read AND reproduced (PoC, or concrete input that triggers the behavior)
   - `[PROBABLE]` — code read, pattern matched, but not reproduced
   - `[UNVERIFIED]` — pattern match or intuition only, no code read
3. **If you couldn't `grep` it, it doesn't exist.** No invented helper functions, no invented APIs, no invented config keys. "I don't know" beats "I think".
4. **The bundled auditor has false positives.** For example, `regex.exec(html)` matches the auditor's `[CODE-EXEC]` pattern but is a RegExp method, not `eval()`. `spawnSync` with `shell: false` + array argv matches `[CMD-INJECT]` but is the recommended safe form. Verify by reading the actual code before filing.
5. **No generic best-practice advice.** This repo has no `package.json`, no runtime dependencies, no postinstall, no telemetry — so suggestions like "run npm audit" or "add a Content-Security-Policy header" don't apply. File issues only for fixes specific to code that exists in this repo.

### LLM-assistant system prompt (copy-paste)

If you use a free-tier or sandboxed LLM (no repo access, no shell, no internet) to help with the review, prepend this to your prompt so the assistant defaults to the same protocol:

```
You are helping me review an open-source plugin (~2,000 LOC, MIT, zero runtime deps).
You do NOT have access to the repo, the shell, or the internet — only what I paste.

Rules (hard):
1. Every finding must cite file:line from the code I paste. No file:line, no finding.
2. Use exactly three labels: [VERIFIED] (you read the code and reproduced it),
   [PROBABLE] (you read the code, pattern matched, did not reproduce),
   [UNVERIFIED] (pattern match only).
3. If a function, API, file path, or config key is not in the code I pasted,
   it does not exist. Do not invent it. "I don't know" beats "I think".
4. Pattern-matching auditors have false positives (e.g. regex.exec() vs eval(),
   spawnSync with shell:false vs CMD-INJECT). Verify by reading the actual code
   I pasted before flagging.
5. No generic best-practice advice. Only fixes for code I have shown you.
```

## Reporting security issues

If you find a vulnerability:
- For non-sensitive items: open a GitHub issue at https://github.com/maxschottke-spec/seo-survival-kit/issues
- For items that could affect users with the plugin already installed: email the maintainer directly. See the GitHub profile.

## Audit trail

This plugin is open-source under MIT. Every change is visible in git history. There are no minified scripts, no obfuscated code, no compiled binaries, no `postinstall` hooks, no `npm install` (the plugin has zero runtime dependencies).

### External security reviews

| Date | Reviewer | Scope | Findings |
|------|----------|-------|----------|
| 2026-05-22 | [Jeronzo](https://github.com/kamehamea-art) | Full repo audit: gitleaks + trivy + semgrep tool-pass plus 4 parallel domain-subagent analysis (Injection, Secrets, Deps, Config) | 1 CRITICAL chain, 4 HIGH, 6 MEDIUM, 11 LOW. Drove the v0.3.x security sprint that closed the gitignore-leak surface, the indirect-prompt-injection vector via scraped HTML, the unrestricted skill tool surface, and the CI floating-range supply-chain risk. |
