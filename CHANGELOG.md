# Changelog

All notable changes to seo-survival-kit are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.3.2] — 2026-05-22

### Changed (marketplace-readiness pass — documentation only, no functional changes)

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
