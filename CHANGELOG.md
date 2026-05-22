# Changelog

All notable changes to seo-survival-kit are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.3.2] — 2026-05-22

### Added (security hardening from external audit Round 1 — see SECURITY.md → External security reviews)

- **`lib/safe.js` new helpers** — `safeHostname` (strict RFC1123 hostname charset), `safeUrl` (URL.parse + http(s)-only + SSRF guard against loopback / RFC1918 / link-local incl. **169.254.169.254 cloud-metadata** / .local / IPv6 ::1), `safeLabel` (string + 200-char length cap). All three smoke-tested across 16 cases.
- **`validateConfigTargets` now covers `domain` + `host` + `label`** (previously only validated `slug`). Hostile audit-config can no longer flow unvalidated hostnames / URLs / labels into URL paths, HTML/PDF output, and filenames.
- **`sanitize()` helper in `seo-onpage.js`** — defense against indirect prompt injection via scraped third-party HTML. Type-coerces non-strings, length-caps every field (title 300, meta 500, headings 200, schema 64), pattern-matches 12 imperative-injection forms and redacts matches. Tested adversarially against 10 attack strings + 7 legitimate marketing phrases — 17/17 pass (negative-lookahead on `system prompt(?![a-z])` avoids redacting "system prompts you to…").
- **`allowed-tools` declared on every SKILL.md** — bounds the blast radius of any prompt-injection chain. Pure-Markdown framework skills get `[Read, Grep, Glob]`; script-runners get `[Read, Write, Bash(node:*), Bash(curl:*)]`; psi-weekly-cron extends with `Bash(launchctl:*), Bash(crontab:*)`; seo-audit-free extends with `Bash(npx lighthouse:*)`.
- **Routing-safety section in `rescue/SKILL.md`** — codifies that sub-skill routing decisions must come from the *initial user message*, never from tool-output content (scraped HTML, API responses, file contents). Closes the orchestrator-injection vector.
- **Untrusted-input section in `seo-outreach-report/SKILL.md`** — explicit threat-model documentation for installers and reviewers.
- **For-external-reviewers section in `SECURITY.md`** — anti-hallucination guardrails (`[VERIFIED]` / `[PROBABLE]` / `[UNVERIFIED]` labels, mandatory `file:line` citations, false-positive guidance for the bundled skill-security-auditor, copy-paste system prompt for free-tier/sandboxed LLM assistants).
- **External security reviews table in `SECURITY.md`** — Round 1 (external reviewer) and Round 2 (maintainer-driven senior-engineering + marketplace audit) both documented with scope and verdict.
- **Cross-platform env-var reference in `ONBOARDING.md`** — explicit table covering `CHROME_PATH`, `SEO_CACHE_DIR`, `SEO_PDF_OUTPUT_DIR`, `SEO_AUDIT_CONFIG`, `PSI_CONFIG` per-OS defaults + recommended overrides. Step 4w added with the PowerShell equivalent of `mkdir + cp + chmod 600` (including the NTFS ACL incantation for owner-only access).
- **Contributors section in `README.md`** crediting the external security reviewer.
- **`.github/dependabot.yml`** — weekly updates for the `github-actions` ecosystem.
- **`.github/CODEOWNERS`** — owner `@maxschottke-spec` on every path, explicit ownership of `/.github/`, both `.claude-plugin/` folders, `/lib/`, and `/SECURITY.md`.
- **Branch protection on `main`** — required status check (`validate`), required PR review (1 approval, code-owner-required), conversation-resolution required, no force-push, no deletion.
- **GitHub repo features** — `dependabot_security_updates` enabled, vulnerability alerts enabled (secret scanning and push-protection were already on).

### Changed (functional)

- **`.gitignore` expanded** to cover user-supplied runtime configs (`audit-config.json`, `psi-config.json`, `channels.json`) plus runtime working dirs (`data/`, `psi-history/`, `*.ndjson`). Previously, an installer following the example files' instruction to "copy to audit-config.json (gitignored)" would silently commit client domains, slugs, and editorial narrative to their fork's git history.
- **PSI `api_key` is now env-only.** `psi-fetch.example.js` previously fell back to `CFG.api_key` from `psi-config.json` if no env var was set. Combined with the gitignore gap this was a trivial path to commit a Google API key. Script now hard-fails if `api_key` is present in the config.
- **`psi-fetch.example.js` SSRF + config-input allowlist.** URLs go through `safeUrl` (loopback / RFC1918 / cloud-metadata blocked), `categories[]` allowlisted to the 5 PSI categories, `strategies[]` allowlisted to `mobile / desktop`, `output_dir` must be a relative path without `..` traversal. PSI can no longer be used as an SSRF proxy or pivot to cloud-metadata endpoints.
- **`channel-economics.example.js` path-traversal fix.** `./data/${ch.name}-period.csv` interpolation now safe-by-construction: `ch.name` passes through `safeSlug` at config-load.
- **`competitor-deep-audit.example.js` TARGET validation.** `process.argv[2]` is now `safeHostname`-validated before any network call or `writeFileSync`. `node competitor-deep-audit.example.js /tmp/poc` no longer writes outside CWD.
- **CI workflow hardening (`.github/workflows/validate.yml`).** SHA-pinned `actions/checkout` and `actions/setup-node`, top-level `permissions: contents: read`, `persist-credentials: false` on checkout, `find -print0 | while IFS= read -r -d ''` instead of `for f in $(find …)` (closes a CI-bypass vector where a malicious PR could supply a filename like `'); process.exit(99); //.example.json`). Filenames now pass through `FILE` env var, not shell interpolation.
- **`js-yaml@4` dependency removed from CI.** Replaced with an inline regex frontmatter validator. CI runtime supply chain is now bounded to the two SHA-pinned actions. `allowed-tools` is now a *required* frontmatter field so the per-skill hardening cannot regress silently.

### Changed (marketplace-readiness pass — non-functional)

- **README rewritten** for marketplace-submission tone. Lead-generation framing removed from the "What this is" section and from the previous "Who uses this" emoji-list. The audience-targeting table ("Freelance SEO consultant: outreach-report = lead-gen tool") was replaced with sachliche "When to use" and "When *not* to use" sections plus an explicit YMYL notice.
- **Public-Beta status prominent**. New status box at the top of the README plus a "Public Beta" badge. Status & Maintenance section at the bottom states the single-maintainer model explicitly (no SLA, no enterprise support, best-effort issue response).
- **Naming clarification table** added at the top of the README (repository vs. plugin vs. slash-command-prefix) because new users frequently asked "is it `seo-survival-kit` or `seo-rescue`?"
- **YMYL disclaimer** added to the `seo-outreach-report` SKILL.md and to the rendered PDF disclaimer block. Specifically calls out medical, legal, financial, and regulated-industry domains where action plans should be validated by a domain expert before publication or client delivery.
- **claude-seo trigger phrase softened.** `seo-outreach-report` SKILL.md description previously said "USE THIS instead of `claude-seo:seo-audit`" — now reads "Complements `claude-seo:seo-audit` when the goal is communication for a non-technical audience rather than technical depth." Same softening for `make-pdf`.
- **Recovery / AI-citation predictions reframed as observations** rather than predictions. `post-core-update-recovery` "Common outcome: 60-80%" now reads "Recovery outcome in observed cases is in the 50-80% range... observations from a small case-base, not population statistics — treat them as input hypotheses, not predictions." Same softening for `ai-search-rescue` "AI citations lead by 2-6 weeks" claim and `seo-audit-free` "ROI typisch 1-2 gewonnene Mandate" line.
- **channel-economics-analyzer fee-table disclaimer expanded.** The table now explicitly states the fees are starting estimates from public marketplace documentation and seller-community reports as of Q1 2026, that they vary by category / tier / region / fulfillment setup, and that the user must verify against current seller agreements before drawing business conclusions.
- **SECURITY.md** updated: pin example uses v0.3.2, explicit single-maintainer / bus-factor-1 section added before "Reporting Security Issues", and the contact path now mentions GitHub's private security advisory feature.
- **API cost expectation** documented in the `seo-outreach-report` SKILL.md per-run section so users know what they're about to spend before invoking the pipeline.
- Install commands in README, ONBOARDING, CLAUDE.md updated to `#v0.3.2`.

This is a documentation-only release. No functional code changes, no version-incompatible changes. Existing v0.3.1 installs continue to work; v0.3.2 makes the same plugin's positioning and disclaimers cleaner for marketplace submission and public-beta audience expectations.

## [0.3.1] — 2026-05-22

### Changed
- Plugin and marketplace descriptions now embed the namespaced slash commands inline. Catalog browsers see the full command surface (`/seo-rescue:rescue`, `/seo-rescue:seo-audit-free [domain]`, `/seo-rescue:post-core-update-recovery [domain]`, `/seo-rescue:seo-outreach-report [domain]`, `/seo-rescue:channel-economics-analyzer`, `/seo-rescue:competitor-deep-audit [domain]`, `/seo-rescue:psi-weekly-cron-baseline`, `/seo-rescue:ai-search-rescue [domain]`) directly in the listing without having to click through. README, ONBOARDING, and LAUNCH pack install commands updated to `#v0.3.1`.

## [0.3.0] — 2026-05-22

### Added
- New skill `ai-search-rescue` for AI-search visibility recovery (Google AI Overviews, AI Mode, ChatGPT, Perplexity, Bing Copilot, Claude.ai search). Framework includes a measurement layer across the six AI surfaces, seven optimization tactics (extractable passages, question-shaped headings, source-cited statements, author trust, schema for AI, llms.txt, Wikipedia), and a realistic 6-12 week recovery workflow.
- New orchestrator skill `rescue` at `plugins/seo-rescue/skills/rescue/SKILL.md`. Acts as the entry point for the plugin — type `/seo-rescue:rescue` to see the routing table covering all seven content skills, or use sub-aliases like `/seo-rescue:rescue audit <domain>` to route to a specific sub-skill. Modeled after the pro-grade orchestrator pattern in `claude-seo:seo`.
- GitHub Actions CI workflow at `.github/workflows/validate.yml` running `claude plugin validate` on the marketplace and plugin on every push and PR, plus syntax-check on all `.js` files and JSON parse-check on config examples. Prevents repeat of the v0.2.0/v0.2.1 un-installable releases.
- `CLAUDE.md` at repo root with project overview, architecture diagram, release process, security model, and contribution guidelines for working with the codebase.
- `CHANGELOG.md` (this file) for installer transparency.
- Quick Reference table at the top of README.md showing every namespaced slash command with one-line description and cost-per-audit.

### Changed
- All seven content SKILL.md frontmatters now declare `user-invokable: true`, `argument-hint`, `license: MIT`, and a `metadata` block (`author`, `version`, `category`). Discoverability via Claude Code's autocomplete and downstream catalog tooling improved to match the conventions used by claude-seo.
- Marketplace metadata updated to reflect seven skills instead of six.
- Marketplace keywords expanded with `ai-search`, `ai-overviews`, `geo`, `generative-engine-optimization`, `chatgpt`, `perplexity`, `llms-txt`.
- README skill count updated.

## [0.2.2] — 2026-05-22

First actually-installable release.

### Fixed
- **Plugin manifest path.** `plugin.json` was at `plugins/seo-rescue/plugin.json` instead of the required `plugins/seo-rescue/.claude-plugin/plugin.json`. Without this fix, `/plugin marketplace add` silently skipped the plugin — v0.2.0 and v0.2.1 were never actually installable from their published `marketplace.json`.
- **YAML frontmatter in all six SKILL.md files.** Unquoted double-quotes inside `description:` fields (`"kostenloser SEO-Check"`, `we don't`) broke YAML 1.2 parsing. All skills loaded with empty metadata at runtime, so trigger phrases didn't activate the skills. Fixed by single-quote-wrapping each `description` and escaping internal single quotes as `''`.

### Added
- `channel-economics-analyzer` expanded from 5 to ~30 channels across DACH marketplaces (Amazon, OTTO, Kaufland.de, eBay, Zalando, About You, Galeria, Avocadostore, manomano, Limango, Bonprix, MyToys), EU marketplaces (Bol.com, CDiscount, Allegro, ManoMano, Spartoo), US marketplaces (Amazon US, Walmart, Etsy, Wayfair, Target Plus), social commerce (TikTok Shop, Instagram, Pinterest, YouTube, Live-Commerce), B2B/Wholesale (Alibaba, Faire, Ankorstore), direct-shop PSPs (Shopify, Shopware, WooCommerce, Klarna, PayPal, Stripe), and affiliate channels (Awin, TradeDoubler, Influencer codes, Google Shopping, Idealo). Per-channel gotchas and channel-portfolio templates per business category included.
- `channels.example.json` expanded from 4 to 19 example entries.

## [0.2.1] — 2026-05-22 [DEPRECATED]

Released but never actually installable due to the plugin manifest path issue fixed in v0.2.2. Skip this version.

### Fixed (in spirit — these landed in installable form in v0.2.2)
- Realistic keyword position distribution. `ranked_keywords` API call was using `limit: 100` + `order_by: rank_group asc`, returning only the best-ranking 100 keywords. The PDF's position distribution chart was always near-100% Top 3 regardless of the real spread. Now `limit: 1000` + `order_by: search_volume desc`, with local re-sort for the Top-Keywords table.
- Competitor self-filter. DataForSEO's `competitors_domain` endpoint returns the target as competitor #1 with 100% overlap. Now filtered out by normalized domain (lowercase, strip www).

## [0.2.0] — 2026-05-22 [DEPRECATED]

Released but never actually installable due to the plugin manifest path issue fixed in v0.2.2. Skip this version.

### Security (in spirit — these landed in installable form in v0.2.2)
- Centralized input validation in shared `lib/safe.js` with `safeSlug`, `safeReadFile`, `cachePath`, `mkRunDir`, `writeFileExclusive`, `getCacheDir`.
- `safeSlug()` enforced at config-load in all scripts (previously only in `seo-report-gen.js`; `seo-extract-v2.js` and `seo-onpage.js` allowed path traversal).
- Cache moved from world-writable `/tmp/seo-*.json` to per-user `~/.cache/seo-rescue/` (mode 0700, refused on symlink). Defeats local symlink-clobber attacks.
- `esc()` HTML-escape extended to cover `'` and backtick in addition to `& < > "`. Previously-unescaped interpolations (`schema_types`, `first_seen`, numeric on-page fields) now wrapped.
- Strict Content-Security-Policy meta tag on rendered HTML — `default-src 'none'; frame-src 'none'; object-src 'none'; img-src data:`. Even if a string slips past `esc()`, Chrome refuses to load iframes or external resources during PDF render.
- `execSync` replaced with `spawnSync(CHROME_PATH, argv, { shell: false })`. Shell metacharacter injection via `CHROME_PATH` env var no longer possible. Chrome launched with isolated `--user-data-dir`.
- Size caps on every external-input `readFileSync` (10 MB default, 50 MB for raw homepage HTML).

## [0.1.0] — 2026-05-21

Initial public release. Three skills: `seo-audit-free`, `post-core-update-recovery`, `seo-outreach-report`. Repository was previously named `seo-rescue-skills` and was renamed to `seo-survival-kit` on 2026-05-22.

---

[0.3.0]: https://github.com/maxschottke-spec/seo-survival-kit/releases/tag/v0.3.0
[0.2.2]: https://github.com/maxschottke-spec/seo-survival-kit/releases/tag/v0.2.2
[0.2.1]: https://github.com/maxschottke-spec/seo-survival-kit/releases/tag/v0.2.1
[0.2.0]: https://github.com/maxschottke-spec/seo-survival-kit/releases/tag/v0.2.0
