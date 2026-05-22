---
name: seo-audit-free
description: 'Use when the user wants a basic SEO health check on a domain WITHOUT paying for any SEO tools — e.g. "kostenloser SEO-Check", "SEO ohne Sistrix", "ich habe nur Google Search Console und nichts anderes", "Anfänger-Audit", "wo fange ich beim SEO an", "billiges SEO" oder als Vorstufe vor dem entscheidet ob die kostenpflichtigen Tools (Sistrix, DataForSEO) sinnvoll sind. Anti-Use: NICHT für tiefere Wettbewerbsanalyse, Sichtbarkeitsverlauf, oder professionelle Outreach-Reports — dafür existiert `seo-outreach-report` mit den paid APIs.'
user-invokable: true
argument-hint: '[domain]'
allowed-tools: [Read, Bash(curl:*), Bash(node:*), Bash(npx lighthouse:*)]
license: MIT
metadata:
  author: Max Schottke
  version: '0.3.3'
  category: marketing
---

# Beginner SEO Audit — nur kostenlose Tools

## Overview

Ein gewollt minimaler SEO-Check, der **ohne kostenpflichtige APIs** (Sistrix, DataForSEO, Ahrefs, SEMrush) auskommt. Nutzt nur:
- Google Search Console (eigene Property)
- Google PageSpeed Insights v5 (öffentlich, 25k Calls/Tag frei)
- Lighthouse CLI (lokal, Open Source)
- Schema.org Validator (Web-Tool, kostenfrei)
- Curl + manuelle Inspektion von robots.txt / sitemap.xml / headers

**Zweck:** Du willst eine Website grob bewerten ohne Budget. Oder du willst wissen ob ein größeres Audit (Sistrix + DataForSEO) sich überhaupt lohnt.

## Wann anwenden

- "Wie steht meine Website bei Google?" ohne Budget
- Vor dem Kauf von Sistrix/DataForSEO/Ahrefs — erste Einschätzung
- Schüler/Studenten/Sidehustle-Founder die keine €100/Monat-Tools wollen
- Schneller Check bei Bekannten / Familienmitgliedern
- Als Vorstufe vor [seo-outreach-report](../seo-outreach-report/SKILL.md) — Daten-Hunger entstand erst durch Erkenntnisse aus dem Free-Check

**Nicht anwenden für:**
- Wettbewerbs-Sichtbarkeit (das geht ohne Sistrix-VI nicht)
- Backlink-Profil-Analyse (DataForSEO Backlinks nötig)
- Historische Sichtbarkeit (Sistrix-History nötig)
- Konkrete Keyword-Ranking-Positionen (DataForSEO Labs)

## Workflow (in dieser Reihenfolge)

### Schritt 1 — Indexierungs-Check via Google direkt

Frage: ist die Website überhaupt indexiert?

```
site:example.com
```

Im Google-Sucheingabe-Feld. Liefert eine grobe Indexgröße. Wenn 0 Treffer → indexing-Problem (robots.txt? noindex?).

### Schritt 2 — robots.txt + sitemap.xml manuell prüfen

```bash
curl -s https://example.com/robots.txt | head -100
curl -s https://example.com/sitemap.xml | head -50
```

Pflicht-Checks:
- Wird der Hauptbereich nicht blockiert (`Disallow: /`)?
- Ist mindestens eine Sitemap referenziert (`Sitemap:` im robots.txt)?
- Liefert die sitemap.xml gültiges XML mit URLs?

### Schritt 3 — HTTP-Headers + Status

```bash
curl -sI https://example.com/ | head -25
```

Pflicht-Checks:
- HTTP/2 oder HTTP/3 (nicht HTTP/1.x für Performance)
- `strict-transport-security` (HSTS) für Sicherheit
- `cache-control` Header sinnvoll gesetzt
- `x-content-type-options: nosniff`
- Keine `5xx` Antworten

### Schritt 4 — On-Page-Signale aus dem HTML

> **Sicherheits-Hinweis:** Die Beispiele unten schreiben nach `/tmp/`, was auf Shared-Hosts world-writable ist und Symlink-Race-Attacks zulässt. Für Solo-Workstations (typischer Use-Case) ist das unbedenklich. Für Shared-/Server-Umgebungen ersetze `/tmp/` durch `$(mktemp -d)/` oder einen Pfad in deinem eigenen Home: `WORK=$(mktemp -d -t seo-audit-XXXXXX) && trap "rm -rf $WORK" EXIT` am Anfang des Blocks setzen, dann `$WORK/home.html` statt `/tmp/home.html`.

```bash
curl -s -A "Mozilla/5.0" https://example.com/ > /tmp/home.html
echo "=== Title ===" && grep -ioE '<title[^>]*>[^<]+' /tmp/home.html | head -1
echo "=== Meta Description ===" && grep -ioE '<meta[^>]+name=["'"'"']description["'"'"'][^>]+content=["'"'"'][^"'"'"']+' /tmp/home.html | head -1
echo "=== H1s ===" && grep -ioE '<h1[^>]*>[^<]+' /tmp/home.html | head -5
echo "=== JSON-LD ===" && grep -c 'application/ld+json' /tmp/home.html
echo "=== Schema @types ===" && grep -oE '"@type"\s*:\s*"[^"]+"' /tmp/home.html | sort -u
echo "=== Canonical ===" && grep -ioE '<link[^>]+rel=["'"'"']canonical["'"'"'][^>]+href=["'"'"'][^"'"'"']+' /tmp/home.html | head -1
echo "=== Robots Meta ===" && grep -ioE '<meta[^>]+name=["'"'"']robots["'"'"'][^>]+content=["'"'"'][^"'"'"']+' /tmp/home.html
echo "=== Lang ===" && grep -oE 'lang=["'"'"'][^"'"'"']+' /tmp/home.html | head -1
```

Bewertung pro Punkt:
| Befund | Bewertung |
|--------|-----------|
| Title fehlt | KRITISCH |
| Title <30 Z. oder >65 Z. | Verbesserungsbedarf |
| Meta-Description fehlt | Hoch |
| H1 fehlt oder mehrere | Mittel |
| JSON-LD = 0 | Hoch |
| Schema-@types <3 | Mittel |
| Canonical fehlt | Mittel |
| Robots-Meta = noindex | KRITISCH (außer absichtlich) |
| lang fehlt | Niedrig |

### Schritt 5 — Google PageSpeed Insights (kostenfreier API-Key)

```bash
# Mit API-Key (empfohlen, 25k/Tag Quota)
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com%2F&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices&key=YOUR_KEY" > /tmp/psi-mobile.json

curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com%2F&strategy=desktop&category=performance&category=seo&category=accessibility&category=best-practices&key=YOUR_KEY" > /tmp/psi-desktop.json
```

Wichtige Felder extrahieren:
```bash
node -e "
const j = JSON.parse(require('fs').readFileSync('/tmp/psi-mobile.json'));
const r = j.lighthouseResult;
console.log('Performance:', Math.round(r.categories.performance.score*100));
console.log('SEO:', Math.round(r.categories.seo.score*100));
console.log('LCP:', r.audits['largest-contentful-paint'].displayValue);
console.log('CLS:', r.audits['cumulative-layout-shift'].displayValue);
console.log('TBT:', r.audits['total-blocking-time'].displayValue);
console.log('CrUX:', j.loadingExperience?.overall_category || 'no field data');
"
```

API-Key holen: [console.cloud.google.com](https://console.cloud.google.com) → "PageSpeed Insights API" enablen → API key erstellen. **Kostenlos**.

Alternativ ohne Key (Public-Quota 25 Calls/Tag/IP):
```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com%2F&strategy=mobile"
```

### Schritt 6 — Lighthouse CLI lokal

Falls Node.js installiert:
```bash
npx lighthouse https://example.com/ --output=json --output-path=/tmp/lh.json --quiet --chrome-flags="--headless"
```

Gibt dieselben Metriken wie PSI v5, aber lokal — kein Quota-Limit. Funktioniert auch für interne/staging Sites.

### Schritt 7 — Schema.org Validator (web)

Manuell: [validator.schema.org](https://validator.schema.org) → URL einfügen → siehe welche Schemas erkannt werden + Errors.

Oder: [Google Rich Results Test](https://search.google.com/test/rich-results).

### Schritt 8 — Google Search Console (wenn vorhanden)

Wenn der User Zugriff auf die GSC der Domain hat:

1. **Indexierung-Status** → Coverage-Report. Wie viele URLs "indexiert" vs "nicht indexiert"? Was sind häufige Errors?
2. **Performance** → Top-Queries (welche Keywords bringen Klicks?), Top-Pages (welche URLs?), CTR-Übersicht
3. **Core Web Vitals** → Field-Data (echte Nutzer-Daten, nicht Labor)
4. **Manual Actions** → 0 Einträge? Gut. Sonst: Penalty-Verdacht.
5. **Sitemaps** → Submitted vs Discovered

Ohne GSC: bitten dass User Zugriff einrichtet. Setup ist kostenlos und dauert 5 Minuten ([Anleitung](https://support.google.com/webmasters/answer/9008080)).

## Output-Format (für Einsteiger)

Kurzbericht in 1 Seite Markdown:

```markdown
# SEO-Check: example.com (Stand: TT.MM.JJJJ)

## 🟢 Was läuft gut
- ...

## 🟡 Was verbesserbar ist
- ...

## 🔴 Was kritisch ist
- ...

## Drei konkrete Sofort-Maßnahmen
1. ... (Aufwand: X Std., Effekt: Y)
2. ...
3. ...

## Wann sich ein größeres Audit lohnt
Wenn 2+ rote Punkte vorhanden und/oder Sichtbarkeit fällt: Erweiterung auf
das `seo-outreach-report`-Skill (Sistrix-VI-Trend + DataForSEO-Rankings + Wettbewerb)
sinnvoll. Kosten: ca. €0,05–0,50 pro Domain für die paid APIs.
```

## Verwandte Skills

- **seo-outreach-report** — wenn das Free-Audit auf größeres Problem hindeutet und Budget vorhanden
- **post-core-update-recovery** — wenn der Sichtbarkeitsverlust mit einem Google-Core-Update korreliert
- **claude-seo:seo-audit** (plugin) — wenn umfassendes Multi-Skill-Audit gewünscht (15 spezialisierte Subagents)

## Häufige Beginner-Missverständnisse

| Aussage | Realität |
|---------|----------|
| "Ich brauche unbedingt Sistrix" | Für ersten Check nein. Search Console + PSI sind oft genug. |
| "SEO ist Black Box, kann man nicht selbst machen" | Die Basics (Title, Meta, Schema, Performance) sind self-checkbar. |
| "Schnellere Website = bessere Rankings" | Nur Mittel. CWV ist wichtig, aber nicht der Hauptfaktor. |
| "Mehr Pages = besser ranken" | Nein. Thin Content schadet. Qualität > Quantität. |
| "Backlinks kaufen ist Abkürzung" | Falsch. Erhöht Spam-Score, Recovery extrem teuer. |

## Tools-Übersicht (alle kostenlos)

| Tool | Was es macht | Setup |
|------|--------------|-------|
| [Google Search Console](https://search.google.com/search-console) | Indexierung, Rankings, CWV-Field-Data, Manual Actions | 5 Min Setup (DNS-Verifikation) |
| [PageSpeed Insights API v5](https://developers.google.com/speed/docs/insights/v5/get-started) | Lab + CrUX-Field-Data, 25k Calls/Tag frei | API Key in GCP, 2 Min |
| [Lighthouse CLI](https://github.com/GoogleChrome/lighthouse) | Lokale Performance/SEO/A11y-Audits | `npm install -g lighthouse` |
| [Schema.org Validator](https://validator.schema.org) | JSON-LD prüfen | Browser, kein Account |
| [Google Rich Results Test](https://search.google.com/test/rich-results) | Welche Rich Snippets sind erkennbar | Browser, kein Account |
| [Wayback Machine](https://web.archive.org/) | Historische Versionen einer Website | Browser |
| [Mozilla Observatory](https://observatory.mozilla.org/) | Security-Header-Check | Browser |
| [Web.dev Measure](https://web.dev/measure/) | Lighthouse als Web-UI | Browser |
| **curl** | robots.txt, sitemap, headers, HTML | Bei jedem Mac/Linux dabei |

## Faustregeln

- **Title 50–60 Zeichen** ist ideal (Google zeigt ~60 Pixel-Limit)
- **Meta-Description 120–160 Zeichen**
- **PSI Mobile Performance ≥ 75** für gute UX
- **LCP < 2.5s** für "gut", **< 4s** für "verbesserungsbedürftig"
- **CLS < 0.1** für "gut"
- **Mindestens 5+ verschiedene Schema-@types** auf der Startseite für moderne Shop/Org-Site
- **H1 = genau 1** pro Seite

## Wo der Free-Check an Grenzen stößt

Wenn du folgende Fragen beantworten willst, brauchst du paid APIs:
- "Wie hat sich meine Sichtbarkeit in den letzten 12 Monaten entwickelt?" → Sistrix-VI-History
- "Welche Keywords ranke ich Position 4-20 (Quick Wins)?" → DataForSEO Labs
- "Wer sind meine 5 größten Konkurrenten im Suchergebnis?" → DataForSEO + Sistrix
- "Wie viele Domains verlinken zu mir, mit welchem Spam-Score?" → DataForSEO Backlinks
- "Wie schneide ich gegen 6 Konkurrenten im Längsschnitt ab?" → Sistrix mit mehreren Domains

Wenn 2+ dieser Fragen geschäftskritisch sind, kann ein Upgrade auf den `seo-outreach-report`-Skill mit Sistrix + DataForSEO sinnvoll sein. Ob sich die monatlichen Tool-Kosten rechnen, hängt vom konkreten Anwendungsfall ab — pro Einsatz die Kosten gegen den erwarteten Hebel (z. B. Klarheit für eine Investitionsentscheidung, Onboarding eines Neukunden, Quartals-Status für ein internes Team) prüfen.
