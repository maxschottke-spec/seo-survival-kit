---
name: seo-outreach-report
description: Use when generating a polished single-PDF outreach pitch or cold-acquisition document for a third-party domain owner — NOT a technical site audit, but a sales-ready, decision-maker-friendly snapshot in plain language for non-SEO-experts (shop owners, founders, executives). Triggers include "send the owner of X.de an SEO snapshot", "outreach pitch", "cold email PDF for prospect", "generate a report for the inhaber/owner", "show X.de their SEO status", "make a PDF for non-technical decision maker about their SEO". USE THIS instead of `claude-seo:seo-audit` when the audience is a non-technical decision-maker and the goal is communication, not technical depth. USE THIS instead of `make-pdf` when the input is a domain (not a markdown file) and you need editorial narrative + Sistrix/DataForSEO/PSI data integrated.
---

# SEO-Outreach-Report

## Overview

Generiert pro Domain einen 10-Kapitel-PDF-Bericht für nicht-technische Entscheider. Datenquellen: Sistrix-VI, DataForSEO Labs (Rankings + Competitors + Backlinks), Google PSI v5 (Lab + CrUX). Rendert via Chrome-Headless ohne Puppeteer.

**Output:** `~/Downloads/SEO-Auswertung-<domain>-<YYYY-MM-DD>.pdf` (ca. 1 MB pro Bericht)

## Wann anwenden

- Inhaber/Geschäftsführer einer Domain braucht SEO-Klarheit
- Cold-Outreach an potenzielle Kunden mit datenbasiertem Hook
- Multi-Domain-Audit für Wettbewerbsanalyse oder Portfolio-Review
- Du brauchst einen ausdruckbaren, versandbaren Snapshot

**Nicht anwenden für:**
- Tiefer Technical-SEO-Audit (zu viel Detail, falscher Adressat)
- Eigene Domain-Optimierung — dann arbeite direkt mit den Daten, kein PDF nötig
- Reine Keyword-Recherche

## Pipeline (4 Schritte)

```
seo-audit-fetch-v2.js  →  /tmp/seo-<slug>-raw.json   (Sistrix + DataForSEO + PSI)
seo-extract-v2.js      →  /tmp/seo-<slug>-summary.json  (KPIs, Top-Keywords, Quick-Wins)
seo-onpage.js          →  /tmp/seo-onpage.json       (Title, H1, Schema aus lokalem HTML)
seo-report-gen.js      →  ~/Downloads/SEO-Auswertung-<domain>-<date>.pdf
```

Scripts in diesem Skill-Verzeichnis sind self-contained. Voraussetzung: eine `.env`-Datei (beliebiger Pfad) mit:

```
SISTRIX_API_KEY=...       # https://www.sistrix.de/ (API-Tier braucht mindestens VI-Endpoint)
DATAFORSEO_LOGIN=...      # https://dataforseo.com/ — Pay-per-call
DATAFORSEO_PASSWORD=...
GOOGLE_API_KEY=...        # https://console.cloud.google.com/ → PageSpeed Insights API enablen
```

Empfohlener Pfad-Konvention: `~/.config/seo-outreach-report/.env` oder `./.env` im Arbeitsverzeichnis. Siehe `.env.example` in diesem Skill-Folder.

## Schnellanleitung (neue Domain hinzufügen)

1. In `seo-audit-fetch-v2.js` neuen Target-Eintrag im `TARGETS`-Map-Lookup:
   ```js
   newslug: { domain: 'beispiel.de', host: 'https://beispiel.de/', slug: 'newslug' }
   ```
2. Homepage lokal cachen für On-Page-Analyse: `curl -s -A "Mozilla/5.0..." "https://beispiel.de/" > /tmp/<slug>-home.html`
3. In `seo-onpage.js` `TARGETS`-Array erweitern, in `seo-report-gen.js` ebenfalls + im `NARRATIVE`-Objekt einen domain-spezifischen Editorial-Block (headline, business_one_liner, diagnose) ergänzen.
4. In `seo-report-gen.js` → `buildActionPlan` einen `if (slug === 'newslug')`-Branch mit 5–8 Action-Items (sofort/30/60/90) anlegen.
5. Pipeline laufen lassen:
   ```bash
   ENV_PATH=/path/to/your/.env  # oder ~/.config/seo-outreach-report/.env
   node --env-file="$ENV_PATH" ~/.claude/skills/seo-outreach-report/seo-audit-fetch-v2.js newslug
   node ~/.claude/skills/seo-outreach-report/seo-extract-v2.js
   node ~/.claude/skills/seo-outreach-report/seo-onpage.js
   node ~/.claude/skills/seo-outreach-report/seo-report-gen.js
   ```

## Report-Aufbau (10 Kapitel)

1. **Cover** mit Headline (datengetrieben)
2. **Zusammenfassung für Entscheider** — 4 KPI-Tachos + 5 Top-Maßnahmen (priorisiert)
3. **Bestandsaufnahme** — neutrale Status-Erfassung (kein Bewerten)
4. **Sichtbarkeit bei Google** — 18-Monats-VI-Chart + Klartext
5. **Wo Sie heute ranken** — Top-15-KW-Tabelle + Quick-Wins Pos 4–20
6. **Wettbewerb** — DataForSEO-Competitors mit Klick-Schätzung
7. **Tempo der Website** — PSI Mobile + Desktop mit Ampel-Tachos
8. **Was Google von Ihrer Seite versteht** — Schlüsselsignale (Title, Meta, H1, Schema, Bilder)
9. **Vertrauen + Verlinkungen** — Backlinks-KPIs + Top-RDs
10. **Fazit** + **Aktionsplan 30/60/90** — pro Item: Was/Warum/Vorgehen/Wer/Kosten/Erwartung

## Sprache-Regel

Für Entscheider ohne SEO-Vorwissen. Keine Abkürzungen unerklärt (LCP/CLS/INP/TBT/CWV → einmal Klartext einleiten). Beispiele für gute Sätze siehe `seo-report-gen.js` → Funktion `lightLCP`, `lightCLS` und die Schlussworte je Domain.

## Häufige Fallstricke

| Problem | Lösung |
|---------|--------|
| WebFetch liefert 403 (Cloudflare) | Direkt mit `curl -A "Mozilla/5.0 (Macintosh; ...) Chrome/120.0"` arbeiten |
| Sistrix-History leer | History-Workaround via 18× Monats-Calls — siehe sistrix-deep-fetch |
| PSI-Quota erschöpft | `GOOGLE_API_KEY` setzen (PageSpeed Insights API in GCP enablen), nicht ohne Key calls |
| PDF wirkt zerschnitten | `page-break-before: always` zwischen Kapiteln nicht vergessen + `@page { size: A4 }` |
| Quick-Wins-Liste leer | Eventuell rankt Domain nicht hoch genug — Filter auf `position > 3 && <= 20 && sv >= 100` lockern |

## Audit-Verlauf

Erstanwendung 2026-05-21 für vier reale Domains (DE-Matratzen-Shop, Schaumstoff-Hersteller, News-Publisher, Camper-Matratzen-Hersteller). PDFs liefen in unter 5 Minuten Gesamt-Pipeline pro Domain.

## Alternative Tools (Ahrefs, SEMrush, XOVI, Moz, Majestic, Searchmetrics)

Wenn du **bereits ein anderes SEO-Tool** abonniert hast und nicht extra Sistrix/DataForSEO kaufen willst — siehe [TOOLS.md](./TOOLS.md). Adapter-Pattern für 8+ alternative Tools inkl. Migrations-Beispielen (Sistrix→XOVI, DataForSEO→Ahrefs etc.) und Tool-Vergleichs-Matrix nach Budget-Stufe.

Kurzfassung:
- **Backlinks:** DataForSEO → Ahrefs/SEMrush/Majestic (Drop-In)
- **Keywords:** DataForSEO Labs → Ahrefs/SEMrush (Drop-In) oder Sistrix Pro Tier
- **Visibility:** Sistrix → XOVI (DE) oder Searchmetrics (global)
- **Crawl:** Standard-Regex → Screaming Frog (MCP verfügbar)
- **Performance:** PSI v5 (kostenfrei) → Lighthouse CLI als Fallback

## Shop-System-spezifische Hinweise

Siehe [SHOP-SYSTEMS.md](./SHOP-SYSTEMS.md) für Plattform-spezifische Anbindung — Shopware, Shopify, WooCommerce, Magento, Gambio, JTL, OXID, Webflow, Wix, Squarespace, Custom/Headless. Wo Title/Meta/Schema/Canonicals/Redirects pro System gepflegt werden + bekannte Gotchas.
