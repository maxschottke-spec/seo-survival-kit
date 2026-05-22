# seo-survival-kit: project instructions for Claude Code

## What this repository is

seo-survival-kit is a Claude Code plugin (marketplace name `seo-survival-kit`, plugin name `seo-rescue`) that bundles seven SEO skills built from real e-commerce recovery work after Google Core Updates. It is MIT-licensed, has zero npm runtime dependencies, and is published at https://github.com/maxschottke-spec/seo-survival-kit.

## Architecture

```
seo-survival-kit/
├── .claude-plugin/
│   └── marketplace.json              # Marketplace catalog
├── .github/
│   └── workflows/
│       └── validate.yml              # claude plugin validate on every push/PR
├── plugins/
│   └── seo-rescue/
│       ├── .claude-plugin/
│       │   └── plugin.json           # Plugin manifest (the path matters — see CHANGELOG v0.2.2)
│       ├── lib/
│       │   └── safe.js               # Shared safety primitives (safeSlug, safeReadFile, cachePath)
│       └── skills/
│           ├── rescue/SKILL.md       # Orchestrator + routing table
│           ├── seo-audit-free/SKILL.md
│           ├── post-core-update-recovery/SKILL.md
│           ├── seo-outreach-report/  # Skill + 4 Node.js scripts + .env.example
│           ├── channel-economics-analyzer/
│           ├── competitor-deep-audit/
│           ├── psi-weekly-cron-baseline/
│           └── ai-search-rescue/SKILL.md
├── CHANGELOG.md                      # Per-release notes (KeepAChangelog format)
├── SECURITY.md                       # Threat model + verification steps for installers
├── COSTS.md                          # Per-audit API cost breakdown
├── MATURITY.md                       # Honest comparison with mature alternatives
├── ONBOARDING.md                     # 15-minute first-PDF walkthrough
├── ROADMAP-2026.md                   # Strategic positioning for 2026 search shift
└── README.md                         # Entry point with Quick Reference table
```

The plugin has two layers:

1. **Pure-Markdown framework skills** — `post-core-update-recovery`, `ai-search-rescue`, and parts of `seo-audit-free`. No scripts. They encode SEO decision frameworks that Claude applies to user-specific situations. Work as standalone documentation even without the rest of the plugin.

2. **Script-backed skills** — `seo-outreach-report`, `competitor-deep-audit`, `psi-weekly-cron-baseline`, and parts of `seo-audit-free`. Plain Node.js scripts that the user (or Claude on their behalf) invokes with `node script.js`. No `package.json`, so no install step, so no npm supply-chain attack surface.

## Routing

The `rescue` skill is the orchestrator. Users can either:

- Type `/seo-rescue:rescue` to see the routing table and let Claude choose the right sub-skill, or
- Call any sub-skill directly via `/seo-rescue:<skill-name>` (e.g. `/seo-rescue:seo-audit-free example.com`)

Each sub-skill has `user-invokable: true` and an `argument-hint` in its YAML frontmatter so Claude Code's autocomplete shows it.

## Skill-naming convention

We use descriptive multi-word skill names (`post-core-update-recovery`, `channel-economics-analyzer`) over short verbs (`recovery`, `channels`). This is a deliberate trade-off: longer names are less autocomplete-friendly but clearer in search and discovery, and renaming would invalidate existing external references (Anthropic submission, dev.to article, awesome-list PR, MEMORY.md).

If a future plugin in the same marketplace needs shorter aliases, the `rescue` orchestrator can route them as subcommands (e.g. `/seo-rescue:rescue audit <url>` already aliases `/seo-rescue:seo-audit-free`).

## Release process

Releases follow [Semantic Versioning](https://semver.org/). The current installable version is in `plugins/seo-rescue/.claude-plugin/plugin.json`.

**Before tagging:**

```bash
claude plugin validate plugins/seo-rescue   # plugin
claude plugin validate .                     # marketplace
```

Both must show `✔ Validation passed`. Tags pushed without validation cost a release cycle (see CHANGELOG.md for v0.2.0 and v0.2.1, both un-installable due to missing manifest-path and YAML-frontmatter checks). The GitHub Actions workflow at `.github/workflows/validate.yml` runs the same checks on every push and PR, but local validation before `git tag` is the canonical gate.

After validation passes:

```bash
git tag -a v<X.Y.Z> -m "v<X.Y.Z> — short summary"
git push origin v<X.Y.Z>
gh release create v<X.Y.Z> --notes-file CHANGELOG-extract.md
```

## Security model

See [SECURITY.md](./SECURITY.md). Highlights:

- All slugs validated via shared `safeSlug()` in `plugins/seo-rescue/lib/safe.js`
- Cache moved from world-writable `/tmp/` to per-user `~/.cache/seo-rescue/` (mode 0700, refused on symlink)
- Strict CSP meta tag on rendered PDF HTML (`frame-src 'none'; object-src 'none'`)
- Chrome subprocess via `spawnSync` with argv-array (no shell), isolated `--user-data-dir`
- Size caps via `safeReadFile()` on all external-input file reads
- No telemetry, no phone-home, no postinstall hooks, no `npm install`

## Working with this codebase

When adding a new skill:

1. Create `plugins/seo-rescue/skills/<name>/SKILL.md` with frontmatter containing `name`, `description`, `user-invokable: true`, `argument-hint`, `license: MIT`, `metadata: { author, version, category }`.
2. Wrap any `description:` containing double-quotes in single quotes (`description: '...'`) — YAML 1.2 strict parsers reject unquoted scalars with internal double-quotes.
3. If the skill has a script, place it in the skill folder (not at plugin root). Read shared safety primitives from `../../lib/safe.js`.
4. Add a row to the `rescue` skill's Quick Reference table.
5. Update README Quick Reference table and CHANGELOG.md.
6. Run `claude plugin validate plugins/seo-rescue` and `claude plugin validate .` before commit.

When working with the existing 4 scripts in `seo-outreach-report`:

- All slugs pass through `safeSlug()` at config-load
- All `readFileSync` of external input goes through `safeReadFile()` (size-capped)
- All `writeFileSync` of cache files goes through `writeFileExclusive()` (O_EXCL, drops symlink targets)
- All subprocess calls use `spawnSync(cmd, [args], { shell: false })` — never `execSync` with a string

## Related resources

- Repository: https://github.com/maxschottke-spec/seo-survival-kit
- Anthropic community marketplace: pending review at claude-plugins-community
- Install: `/plugin marketplace add maxschottke-spec/seo-survival-kit#v0.3.0`
- Verapur recovery case (anonymized in skills, source for the framework): see `post-core-update-recovery/LESSONS.md`
