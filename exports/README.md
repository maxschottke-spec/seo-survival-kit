# Cross-Platform Exports

This directory contains the **framework-only** skills of seo-survival-kit in a platform-agnostic Markdown format, so they can be used outside Claude Code.

## What's in here

- [`skills/seo-rescue-overview.md`](./skills/seo-rescue-overview.md) — top-level routing + framework index
- [`skills/post-core-update-recovery.md`](./skills/post-core-update-recovery.md) — diagnose + 4-phase recovery plan for sites hit by a Google Core Update
- [`skills/ai-search-rescue.md`](./skills/ai-search-rescue.md) — 7 tactics + 3-layer measurement for AI search citation visibility

These three files contain the same framework knowledge as the canonical Claude Code versions in `plugins/seo-rescue/skills/`, with the Claude-specific frontmatter (`allowed-tools`, `user-invocable`, `argument-hint`, plus `[[skill-name]]` cross-skill links) stripped.

The **script-backed and command-style skills** (`seo-outreach-report`, `competitor-deep-audit`, `psi-weekly-cron-baseline`, `channel-economics-analyzer`, `ai-citations-tracker`, `gsc-deep-dive`, `seo-audit-free`, `sistrix-monday-recovery-check`, `subscription-monetization-audit`, and the six `recovery-*` workflow commands) remain Claude-Code-specific because their SKILL.md files describe slash-command invocations and `allowed-tools` permission scopes that have no equivalent outside Claude Code. The underlying Node scripts are platform-agnostic and can be run directly with `node` on any system — see each skill's `*.example.js` for inline documentation.

## Platform-specific install

### Cursor

Cursor 0.40+ supports per-project rules in `.cursor/rules/*.mdc`. Drop the framework files into your project as separate rules:

```bash
mkdir -p .cursor/rules
curl -fsSL https://raw.githubusercontent.com/maxschottke-spec/seo-survival-kit/main/exports/skills/post-core-update-recovery.md \
  -o .cursor/rules/seo-post-core-update-recovery.mdc
curl -fsSL https://raw.githubusercontent.com/maxschottke-spec/seo-survival-kit/main/exports/skills/ai-search-rescue.md \
  -o .cursor/rules/seo-ai-search-rescue.mdc
curl -fsSL https://raw.githubusercontent.com/maxschottke-spec/seo-survival-kit/main/exports/skills/seo-rescue-overview.md \
  -o .cursor/rules/seo-rescue-overview.mdc
```

Or paste the content directly into your project's `.cursorrules` file. Cursor will load it as system context for every chat in that project.

**Older Cursor versions** (pre-0.40): single `.cursorrules` file at project root. Concatenate the three exports.

### OpenAI Custom GPT (ChatGPT)

Custom GPTs have an Instructions field (8000-char limit) and a Knowledge file attachment.

For the **Instructions field**: paste a condensed version like:

```
You apply two SEO frameworks from seo-survival-kit:
1. post-core-update-recovery: Authority-first 4-phase plan for sites hit by Google Core Updates
2. ai-search-rescue: 7 tactics for AI Overview / ChatGPT / Perplexity citation recovery

When a user describes a Sistrix VI drop correlated with a Google update, apply post-core-update-recovery.
When a user complains AI surfaces don't cite their site, apply ai-search-rescue.
Full frameworks are in the attached knowledge files.
Never claim faster recovery than 6 months. Never recommend buying backlinks. Always treat percentages as observations from a small case-base, not predictions.
```

For the **Knowledge files**: upload the three `.md` files from `skills/` as Custom GPT knowledge. The model will quote from them when relevant.

### Gemini CLI (Google AI Studio + gemini-cli)

`gemini-cli` reads `GEMINI.md` files. To use these frameworks:

```bash
# In your project root
cat exports/skills/seo-rescue-overview.md > GEMINI.md
echo "" >> GEMINI.md
cat exports/skills/post-core-update-recovery.md >> GEMINI.md
echo "" >> GEMINI.md
cat exports/skills/ai-search-rescue.md >> GEMINI.md
```

Or reference them as `@<path>` mentions in interactive prompts:
```
gemini
> @exports/skills/post-core-update-recovery.md diagnose example.com which dropped 50 % after the March 2026 Core Update
```

### Aider

Aider uses `CONVENTIONS.md` for project conventions and `.aider.conf.yml` for config. For framework knowledge:

```bash
cat exports/skills/seo-rescue-overview.md >> CONVENTIONS.md
cat exports/skills/post-core-update-recovery.md >> CONVENTIONS.md
cat exports/skills/ai-search-rescue.md >> CONVENTIONS.md
```

Aider will load `CONVENTIONS.md` automatically when invoked in that directory.

Alternatively, add the files via `--read` on the command line:

```bash
aider --read exports/skills/post-core-update-recovery.md --read exports/skills/ai-search-rescue.md
```

### Continue.dev

Continue.dev `~/.continue/config.json` supports adding markdown files as context providers. Reference them via `@docs`:

```json
{
  "docs": [
    {
      "title": "seo-rescue-frameworks",
      "startUrl": "https://github.com/maxschottke-spec/seo-survival-kit/tree/main/exports/skills"
    }
  ]
}
```

Then `@seo-rescue-frameworks` in any chat.

### Codex (OpenAI's developer CLI)

Codex uses `AGENTS.md` for project-specific agent instructions:

```bash
cat exports/skills/seo-rescue-overview.md >> AGENTS.md
cat exports/skills/post-core-update-recovery.md >> AGENTS.md
cat exports/skills/ai-search-rescue.md >> AGENTS.md
```

### Any other LLM tool (generic markdown)

Paste any of the three `.md` files into the system prompt / instructions field. They are plain CommonMark — no platform-specific syntax. The "Where to apply this on each platform" footer in each file links back to this README.

## What's NOT exported

| Skill | Why Claude-only |
|---|---|
| `seo-audit-free` | SKILL.md instructs Claude to run `curl` + `node -e` + `npx lighthouse` commands via Bash. Other LLMs don't have unified tool-execution conventions. |
| `seo-outreach-report` | 4-script Node pipeline + Chrome-headless PDF rendering. The SKILL.md routing is platform-specific. |
| `competitor-deep-audit` | Same — Node pipeline with DataForSEO calls. |
| `channel-economics-analyzer` | Same — Node script reading CSV / channels.json. |
| `psi-weekly-cron-baseline` | Same — Node script + launchd / cron setup. |
| `ai-citations-tracker` | Same — Node script with OpenAI + Perplexity API calls. |
| `gsc-deep-dive` | Same — Node script with Google Search Console JWT auth. |

The **Node scripts themselves** in each skill folder are platform-agnostic. If you want to run them from a non-Claude-Code environment:

1. Clone the repo: `git clone https://github.com/maxschottke-spec/seo-survival-kit.git`
2. Navigate to the skill's directory: `cd seo-survival-kit/plugins/seo-rescue/skills/<skill-name>`
3. Read the inline header comments in `*.example.js` for config + env-var requirements
4. Copy the example config: `cp <name>-config.example.json <name>-config.json`
5. Fill in real values (with API keys via env vars, never in the config — see SECURITY.md)
6. Run: `node <script-name>.example.js`

The scripts are MIT-licensed Node.js with zero npm runtime dependencies — they use only Node's built-in `fs`, `path`, `crypto`, `fetch`, and `child_process` modules.

## Planned: full multi-LLM support via MCP

The "real" cross-LLM solution is a Model Context Protocol (MCP) server exposing each script-backed skill as an MCP tool. This is planned for **v1.0+**. With an MCP server, every MCP-aware client (Cursor, Codex, Continue, Aider, Claude Desktop, n8n, Goose) would get the full skill surface as tool calls — not just the framework markdown.

If you want to be notified when the MCP server lands: watch this repo on GitHub.

## License

All files in this directory are MIT, same as the rest of the repo. Forking, adapting for other platforms, and redistributing under the same license are all explicitly allowed.

## Contributing platform-specific install snippets

If you use a platform not covered above (Replit Ghostwriter, Tabnine, Codeium, etc.) and have a working install pattern, please open a PR adding a section here. Keep snippets to a few lines plus one paragraph of context.
