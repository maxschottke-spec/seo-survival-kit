# Post-Core-Update Recovery — Framework

> **Source:** `plugins/seo-rescue/skills/post-core-update-recovery/SKILL.md` (canonical Claude Code version).
> **Use case:** Diagnose and recover from a Google Core Update visibility drop. Authority-first, 6–12 month timeline, not a quick technical fix.
> **Use this exported version when:** you're running Cursor, an OpenAI Custom GPT, Gemini CLI, Aider, or any LLM tool that isn't Claude Code. The framework content is identical — only the Claude-specific frontmatter (`allowed-tools`, `user-invocable`, `argument-hint`) has been stripped.

## When this framework applies

- VI / organic-traffic drop correlates timely with a published Google Core Update (Search Status Dashboard)
- Drop is **broad** (many keywords simultaneously, not pinpoint)
- Pages keep indexing normally, no technical break
- Google Search Console shows no manual action
- Pattern: 1–6 weeks of decline, then bottoming out

**Don't apply for:**
- Point keyword losses → usually on-page issue
- Drop coincides with migration / theme change / robots change → that's technical, not core
- Drop is < 20 % from peak → can be normal market noise

## Diagnosis decision tree

```
Visibility dropped?
  └── Correlates with Core Update date?
        ├── No  → Market noise, observe
        └── Yes → Manual action in GSC?
                    ├── Yes → Penalty workflow, not this framework
                    └── No  → Brand keywords also dropped?
                                ├── Yes → Technical problem first
                                └── No  → CWV suddenly red?
                                            ├── Yes → Performance-first workflow
                                            └── No  → APPLY THIS FRAMEWORK
```

If brand keywords are intact and CWV is stable but generic keywords are broadly lost → core signature of a Core Update hit.

## Required diagnostic steps (day 1)

1. Document the Core Update date — see `https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history`. Match Sistrix / GSC drop date exactly.
2. Measure the Sistrix drop diff — monthly values 12 months before vs 1–3 months after the update.
3. DataForSEO ranked-keywords diff — compare top positions pre vs post update. Specific URL clusters affected or distributed uniformly?
4. GSC click diff — which URLs lost most traffic? Pattern visible (all blog posts? all product pages? all YMYL topics?)
5. EEAT audit of lost top URLs — author visible? Sources cited? Last-updated stamp? Trust layer (About, Imprint, Reviews)?
6. Self-canonical audit — check whether competing pages all carry self-referencing canonical tags. CMS platforms with SEO plugins (Shopware/DreiscSeo, WordPress/Yoast, Magento) commonly set `isCanonical=true` on ALL pages by default. When keyword overlap exists between pages, self-canonicals cause invisible cannibalization: Google sees competing versions without a consolidation signal. Identify clusters with 2+ URLs targeting overlapping keywords, verify each page's `<link rel="canonical">`, and flag cases where ALL competing pages point to themselves.
7. Structural quality baseline — crawl all indexable pages and classify as healthy/broken/thin/duplicate. If > 40 % of pages are broken (rendering failures, empty content divs, soft-404s, Lorem-ipsum), the drop is not pure authority — it is authority multiplied by structural decay. Fixing the structural baseline is then a recovery accelerator, not just hygiene.

## Recovery plan (3 phases × 6–12 months)

### Phase A — Authority foundation (months 1–2)

**What Google especially scrutinizes in Core Updates:**
- Author authority — Person behind the content, qualifications visible
- Topical authority — Site covers the topic in depth AND breadth, not just isolated pages
- Trust signals — About, Imprint, Reviews, Sources, Date stamps
- Original insight — Own data, own perspective rather than "I read elsewhere"

**Concrete steps:**
1. Rebuild every author page: photo, bio with qualifications, list of articles, social profiles (LinkedIn / X), `Person` schema
2. Edit each affected top URL: author visible (+schema), `dateModified`, sources with outbound links, update notes
3. Strengthen About / Imprint pages: team intro, company history, location, contact — mandatory trust signals
4. Sitewide: reviews / testimonials visible above the fold (manage on original platforms, NOT mirror sites)

### Phase B — Topical authority hubs (months 2–4)

**Goal:** transform a collection of scattered pages into coherent topic hubs.

1. Identify main topics (3–7 for e-commerce, 5–15 for news / publishers)
2. Per topic: 1 pillar page (1500–3000 words, comprehensive) + 5–15 sub-pages (600–1500 words each, specific)
3. Internal linking: sub-pages link to pillar, pillar links to all subs ("hub-and-spoke")

### Phase C — Off-page authority (months 4–8)

**Backlinks deliberately, not at scale:**
1. Manufacturer / supplier partnerships for links
2. Industry communities (e-commerce: forums; news: investigations, exclusive stories)
3. Local press (regional anchor, PR opportunities)
4. Original studies / data — generates organic links better than anything else

**What NOT to do:**
- Link-building services with "100 links for €500" → leads to spam score, recovery even harder
- Reciprocal links at scale
- PBN backlinks
- Forum spam

### Phase D — Technical hygiene (in parallel, lowest priority)

Only after A–C are running:
- PSI optimization (LCP, INP, CLS)
- Schema markup completeness
- Image alt texts, sitemap hygiene

These are **NOT** the recovery lever — Core Updates don't penalize tech, they penalize trust / authority. But technical hygiene supports the other levers.

## Realistic expectations

- **Baseline expectation: visible movement starts after 3–4 months.** Google needs time to re-evaluate authority signals. Full recovery usually takes 9–18 months.
- **Accelerated recovery is possible** when multiple acceleration factors are present simultaneously (see next section). The 3–4 month baseline assumes authority-only work without structural cleanup.
- **Recovery outcome in observed cases is in the 50–80 % range** of pre-drop visibility. Full recovery to 100 % seems to require structural changes (new content lines, new authority sources), not just optimization of what existed before. These percentages are observations from a small case-base, not population statistics — treat them as input hypotheses, not predictions.
- **Pattern: recovery comes in jumps**, often timed with the next Core Update rather than gradually. A single week can deliver +30–50 % VI gain after weeks of flat movement.

## Recovery acceleration factors

Recovery CAN be significantly faster than the 3–4 month baseline when these conditions are present:

1. **Pre-existing authority clusters.** If the site already has pages ranking Pos 1–5 for informational authority queries (blog, guides, "best X" content), these serve as trust anchors. Google does not need to build authority from scratch — it needs to re-recognize existing authority after the scoring change.

2. **Structural quality cleanup executed in parallel.** If > 40 % of pages are broken/thin/duplicate (see diagnostic step 7 above), fixing them removes a compounding penalty. The Core Update hit is authority × structural quality — improving either factor independently lifts the product.

3. **Do-Not-Touch discipline maintained.** Sites that panic-edit recovering URLs reset their recovery timeline. Strict protection of winners lets the positive signal accumulate undisturbed.

4. **AI Citations as a possible early signal (hypothesis, N=1, currently unproven).** Rising AI Overview / ChatGPT / Perplexity mentions while classical VI is still flat MAY indicate that authority work is being recognized. ⚠ This hypothesis suffered a setback on 2026-06-03: in the pilot case, the AI-citation rise coincided with a pre-update plateau that a subsequent Core Update erased (see the canonical `LESSONS.md`, 2026-06-03 correction). Treat rising AI citations as worth logging, not as confirmation — do not change course or report recovery based on this signal alone.

5. **Conversion rate improvement validates traffic quality.** If CR rises alongside or shortly after traffic increases, the recovery is bringing the RIGHT users. This rules out the "vanity recovery" scenario where positions improve on irrelevant queries.

When 3+ of these factors are present, recovery has been observed to proceed materially faster than the baseline. Specific outcomes are case-dependent.

## Owner communication

**Don't say:**
- "It'll be back to normal in 6 weeks"
- "We know the trick to fix this"
- "Sistrix score will double in 4 weeks"

**Do say:**
- "We measure monthly. First positive movement expected in 3–4 months."
- "This is an authority problem, not a technical problem. Fixing it takes time."
- "We're building the substance Google looks for — not the trick."

## Common rationalization traps

| Statement | Reality |
|-----------|---------|
| "Let's buy 200 backlinks" | Raises spam score, makes recovery harder |
| "Let's do a relaunch" | More risk than upside — substance first, then form |
| "Better PSI will bring us back" | PSI is hygiene, not the core update lever |
| "More pages = more traffic" | False — thin content weakens authority further |
| "We did everything right" | In a Core Update Google changes the scoring. Being "right" doesn't help. |

## Real anchor data (anonymized 2026 cases)

- March / April 2026 update: mid-size DE shop lost 50 % VI in 4 weeks
- Diagnosis pattern confirmed: brand keywords stable, generic keywords broadly lost, CWV unchanged
- Recovery plan: 6–12 months, Authority-First. Tech (PSI / Schema) in parallel but not the primary lever
- Lesson (Sistrix wording on March update): "Authority beats interchangeability"

A second real case (DE news site) showed the same pattern in April / May 2026: −60 % VI in 6 weeks, brand stability intact — news / YMYL variant of the same algo recalibration.

---

**Where to apply this on each platform:** see `exports/README.md` in this repo.
