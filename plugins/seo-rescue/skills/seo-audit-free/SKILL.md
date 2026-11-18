---
name: seo-audit-free
description: 'Use when the user wants a basic SEO health check on a domain WITHOUT paying for any SEO tools — e.g. "kostenloser SEO-Check", "SEO ohne Sistrix", "ich habe nur Google Search Console und nichts anderes", "Anfänger-Audit", "wo fange ich beim SEO an", "billiges SEO" oder als Vorstufe vor dem entscheidet ob die kostenpflichtigen Tools (Sistrix, DataForSEO) sinnvoll sind. Anti-Use: NICHT für tiefere Wettbewerbsanalyse, Sichtbarkeitsverlauf, oder professionelle Outreach-Reports — dafür existiert `seo-outreach-report` mit den paid APIs.'
user-invocable: true
argument-hint: '[domain]'
allowed-tools: [Read, Bash(curl:*), Bash(node:*), Bash(npx lighthouse:*), Bash(grep:*), Bash(head:*), Bash(sort:*), Bash(echo:*)]
license: MIT
metadata:
  author: Max Schottke
  version: '0.5.6'
  category: marketing
---

# Beginner SEO Audit — nur kostenlose Tools

> **Language note (English readers):** This skill text and its report template are written in German. The workflow itself is language-independent: eight steps (index check, robots.txt and sitemap, HTTP headers, on-page signals, PageSpeed Insights, Lighthouse, schema validator, Search Console). Ask Claude to "answer in English" and it will run the same steps and write the report in English; the template headings below carry both languages.
>
> **Hinweis:** Skilltext und Berichtsvorlage sind deutsch. Auf Wunsch antwortet Claude englisch.

## Overview

Ein gewollt minimaler SEO-Check, der **ohne kostenpflichtige APIs** (Sistrix, DataForSEO, Ahrefs, SEMrush) auskommt. Nutzt nur:
- Google Search Console (eigene Property)
- Google PageSpeed Insights v5 (öffentlich, 25k Calls/Tag frei mit kostenlosem API-Key; ohne Key oft HTTP 429, siehe Schritt 5)
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
# Erst den Statuscode: Bei 404 liefern viele Server eine HTML-Fehlerseite,
# die mit "| head" wie Inhalt aussieht, aber keine robots.txt ist.
curl -s -o /dev/null -w 'robots.txt:  HTTP %{http_code} (%{content_type})\n' https://example.com/robots.txt
curl -s -o /dev/null -w 'sitemap.xml: HTTP %{http_code} (%{content_type})\n' https://example.com/sitemap.xml
# Inhalt nur auswerten, wenn oben HTTP 200 steht:
curl -s https://example.com/robots.txt | head -100
curl -s https://example.com/sitemap.xml | head -50
```

Steht dort kein `HTTP 200`, gibt es die Datei nicht (oder sie wird umgeleitet: bei 301/302 dieselben Befehle mit `-L` wiederholen). Eine fehlende robots.txt ist kein Fehler, eine fehlende Sitemap ein Befund. Die Sitemap muss nicht unter `/sitemap.xml` liegen: Massgeblich ist die `Sitemap:`-Zeile in der robots.txt.

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
echo "=== Lang ===" && grep -ioE '<html[^>]*[[:space:]]lang=["'"'"']?[a-zA-Z-]+' /tmp/home.html | head -1
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

### Schritt 5 — Google PageSpeed Insights (kostenfreier API-Key empfohlen)

```bash
# Mit API-Key (empfohlen, 25k/Tag Quota)
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com%2F&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices&key=YOUR_KEY" > /tmp/psi-mobile.json

curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com%2F&strategy=desktop&category=performance&category=seo&category=accessibility&category=best-practices&key=YOUR_KEY" > /tmp/psi-desktop.json
```

API-Key holen: [console.cloud.google.com](https://console.cloud.google.com) → "PageSpeed Insights API" enablen → API key erstellen. **Kostenlos**.

Ohne Key (derselbe Aufruf ohne `&key=…`, gleiche Kategorien, gleiche Ausgabedatei):
```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com%2F&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices" > /tmp/psi-mobile.json
```

**Ehrlicher Hinweis:** Ohne Key läuft der Aufruf über ein Kontingent, das sich alle schlüssellosen Aufrufer teilen. Er antwortet deshalb oft mit HTTP 429 („Quota exceeded“), auch beim allerersten Versuch. Dann nicht wiederholen, sondern entweder den kostenlosen Key anlegen (2 Minuten) oder direkt Schritt 6 nehmen: Lighthouse lokal liefert dieselben Labor-Werte ohne Kontingent, nur ohne die CrUX-Felddaten.

Wichtige Felder extrahieren (bricht bei einer Fehlerantwort mit klarer Meldung ab, statt abzustürzen):
```bash
node -e "
const fs = require('fs');
const file = process.argv[1] || '/tmp/psi-mobile.json';
let j;
try { j = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('PSI: ' + file + ' ist kein lesbares JSON (' + e.message + ')'); process.exit(1); }
if (j.error) {
  console.error('PSI-Fehler ' + (j.error.code || '?') + ': ' + (j.error.message || 'ohne Meldung'));
  if (j.error.code === 429) console.error('Kontingent erschoepft: kostenlosen API-Key anlegen oder Schritt 6 (Lighthouse lokal) nehmen.');
  process.exit(1);
}
const r = j.lighthouseResult;
if (!r || !r.categories) { console.error('PSI: Antwort ohne lighthouseResult'); process.exit(1); }
const score = (k) => (r.categories[k] && r.categories[k].score != null) ? Math.round(r.categories[k].score * 100) : 'n/a';
const audit = (k) => (r.audits && r.audits[k] && r.audits[k].displayValue) || 'n/a';
console.log('Performance:', score('performance'));
console.log('SEO:', score('seo'));
console.log('LCP:', audit('largest-contentful-paint'));
console.log('CLS:', audit('cumulative-layout-shift'));
console.log('TBT:', audit('total-blocking-time'));
console.log('CrUX:', (j.loadingExperience && j.loadingExperience.overall_category) || 'no field data');
" /tmp/psi-mobile.json
```

### Schritt 6 — Lighthouse CLI lokal

Falls Node.js installiert:
```bash
npx lighthouse https://example.com/ --output=json --output-path=/tmp/lh.json --quiet --chrome-flags="--headless"
```

Gibt dieselben Labor-Metriken wie PSI v5, aber lokal — kein Quota-Limit, dafür keine CrUX-Felddaten. Braucht eine lokale Chrome- oder Chromium-Installation. Funktioniert auch für interne/staging Sites.

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

## Output-Format (für Einsteiger) / Report template

Kurzbericht in 1 Seite Markdown. Die Überschriften stehen zweisprachig da; im Bericht nur die Sprache verwenden, in der der Nutzer schreibt.

```markdown
# SEO-Check: example.com (Stand / as of: TT.MM.JJJJ)

## 🟢 Was läuft gut / What works
- ...

## 🟡 Was verbesserbar ist / What can be improved
- ...

## 🔴 Was kritisch ist / What is critical
- ...

## Drei konkrete Sofort-Maßnahmen / Three immediate actions
1. ... (Aufwand / effort: X Std., Effekt / effect: Y)
2. ...
3. ...

## Wann sich ein größeres Audit lohnt / When a larger audit pays off
Wenn 2+ rote Punkte vorhanden und/oder Sichtbarkeit fällt: Erweiterung auf
das `seo-outreach-report`-Skill (Sistrix-VI-Trend + DataForSEO-Rankings + Wettbewerb)
sinnvoll. Kosten: ca. 0,15–0,75 pro Domain für die paid APIs (Sistrix-Credits plus DataForSEO, siehe COSTS.md im Repository).
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
