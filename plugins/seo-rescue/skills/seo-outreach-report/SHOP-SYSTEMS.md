# Shop-System-spezifische Anbindung

Wo werden die SEO-Felder (Title, Meta, Schema, Canonicals, Redirects, Robots) pro Shop-System gepflegt? Was sind bekannte Gotchas? Diese Doku ist für Inhaber/Entwickler die einen Audit umsetzen wollen.

## Shopware 6

**Title + Meta-Beschreibung pro Produkt/Kategorie:**
- Admin → Katalog → Produkte → einzelnes Produkt → Reiter "SEO"
- Felder: "SEO Meta Title", "SEO Meta Description", "SEO Keywords"
- Alternativ Massenpflege via Import/Export oder Bulk-Editor

**Title-Template + Meta-Template (sitewide):**
- Admin → Einstellungen → Shop → SEO → "Meta Title-Template"
- Variablen: `{{ product.name }}`, `{{ category.name }}`, `{{ shop.name }}`

**Schema-Markup:**
- Shopware 6 hat **integriertes Schema** für Product (auto), Organization (Storefront-Setting)
- Für erweiterte Schemas (FAQ, BreadcrumbList, AggregateRating) → Plugin nötig:
  - **DreiscSeoPro** (kostenpflichtig, deutsch, voll-featured)
  - **NetInventors SEO Professional** (sehr verbreitet)
  - **WebspaceCommerce Schema** (basic, freemium)

**Canonicals:**
- Auto-generiert. Override pro Produkt im SEO-Tab möglich
- Achtung bei Filter-URLs: oft Duplikat-Problem — Plugins wie "SEO-URLs Plus" lösen das

**Redirects (301):**
- Admin → Einstellungen → Shop → URL-Weiterleitungen
- CSV-Import möglich. Format: `source_url;target_url`
- ⚠️ **Falle**: DreiscSeoPro matcht Redirects **case-insensitive** — wenn Source und Target nur Groß-/Kleinschreibungs-Unterschied haben → infinite Loop. Vor Import case-Check!

**Robots.txt:**
- Standardmäßig generiert. Manuell nur über Theme-Override editierbar
- Achtung: Nach Update ggf. wieder überschrieben

**Bekannte Gotchas Shopware:**
- Cache-Warmer braucht oft mehrere Stunden für Index-Pflege nach Massenänderungen
- CMS-Block-Editor (`cms-block` type=text) erlaubt **kein** Custom-HTML — Anbruch bei Komponenten gefährlich. Lieber Twig-Templates über das Theme nutzen
- Media-Upload via Admin-API hat eigene Quirks — bei Performance-Optimierung lieber direkt im FTP/Storage

## Shopify

**Title + Meta:**
- Admin → Products/Collections → "Search engine listing preview" → Edit website SEO
- Pro Produkt/Kategorie/Blog-Post manuell

**Title-Template (sitewide):**
- Theme → Customize → Theme settings → "SEO" (oder direkt im Theme-Code in `theme.liquid`: `<title>{{ page_title }} – {{ shop.name }}</title>`)

**Schema-Markup:**
- Shopify Dawn-Theme hat **Basic-Schema** für Product, Organization
- Für erweitertes Schema: App-Store hat z.B. "JSON-LD for SEO" (von Ben Tomlin)
- Custom: Theme-Code `snippets/json-ld.liquid` editieren

**Canonicals:**
- Auto. Pro Page nicht direkt überschreibbar — über Liquid `{%- if canonical_url -%}{{ canonical_url }}{%- endif -%}`

**Redirects:**
- Admin → Online Store → Navigation → URL Redirects
- CSV-Import via Bulk-Import-App oder Shopify CLI

**Robots.txt:**
- Bis Shopify 2.0: hartcodiert
- Ab 2021/2022: Theme → robots.txt.liquid override möglich

**Bekannte Gotchas Shopify:**
- App-Sprawl: viele Apps fügen tracking-/Schema-Scripts hinzu → schlechte PSI mobile
- URL-Struktur teilweise vorgegeben (`/collections/`, `/products/`, `/pages/`) — international SEO erschwert
- Multi-Currency / Multi-Language braucht "Shopify Markets" oder externes Plugin wie Langify

## WooCommerce (WordPress)

**Title + Meta:**
- Yoast SEO oder Rank Math (Standard-Plugins) — pro Produkt/Page Felder im Editor
- Massenpflege: Bulk Editor in den jeweiligen Plugins

**Title-Template:**
- Yoast → SEO → Search Appearance → Templates
- Rank Math → Titles & Meta → Templates

**Schema-Markup:**
- WooCommerce hat **Basic-Product-Schema** integriert (seit 4.0)
- Erweitert: Yoast SEO Premium oder Rank Math (FAQ, How-To, Review, Recipe etc.)
- Custom: Hooks `woocommerce_structured_data_product` filterbar

**Canonicals:**
- Yoast/Rank Math automatisch
- Manuell override im SEO-Plugin-Feld pro Page

**Redirects:**
- Yoast Premium ODER Rank Math (free) ODER eigenständige Plugins (Redirection)
- htaccess für tieferen Stack
- Bulk-Import meist via Plugin-CSV

**Robots.txt:**
- Yoast/Rank Math haben Editor in der Admin-UI
- Sonst `robots_txt`-Filter in Theme-functions.php

**Bekannte Gotchas WooCommerce:**
- Plugin-Conflicts häufig — wenn 2 SEO-Plugins parallel aktiv: Chaos
- Performance: viele WP-Themes laden zu viel JS — Gefahr von schlechtem PSI mobile
- WPML / Polylang für Multi-Lang: jeweils eigene SEO-Config

## Magento 2 / Adobe Commerce

**Title + Meta:**
- Admin → Catalog → Products → einzelnes Produkt → Reiter "Search Engine Optimization"
- Felder: "Meta Title", "Meta Keywords", "Meta Description"

**Title-Template:**
- Stores → Configuration → General → Design → HTML Head → "Default Title"
- Variablen via `getTitle()` im Theme

**Schema-Markup:**
- Magento 2 hat **JSON-LD Default für Product, Breadcrumb, Organization** (seit 2.3)
- Erweitert: Extensions wie "Magmodules SEO Suite" oder "MageWorx SEO"

**Canonicals:**
- Auto, kann pro Produkt im "Search Engine Optimization"-Tab überschrieben werden

**Redirects:**
- Admin → Marketing → SEO & Search → URL Rewrites
- Bulk-Import via CSV oder M2-Module

**Robots.txt:**
- Admin → Content → Configuration → Design → Search Engine Robots → "Edit custom instruction of robots.txt File"

**Bekannte Gotchas Magento:**
- Cache-Flush nach SEO-Änderungen Pflicht (sonst nicht im Frontend sichtbar)
- URL-Indexer muss laufen — `bin/magento indexer:reindex`
- Sehr ressourcenhungrig — Performance-Optimierung kritisch

## Gambio (Standard 4.x, GX-Modified)

**Title + Meta:**
- Backend → Artikel → einzelner Artikel → Tab "SEO"
- Felder: "Meta Title", "Meta Description", "Meta Keywords"

**Title-Template:**
- Backend → Konfiguration → Meta-Tags-Sets — pro Bereich (Startseite, Kategorie, Artikel) eigene Templates

**Schema-Markup:**
- Gambio 4.x: **sehr begrenzte Schema-Integration** out-of-the-box
- Erweitert: Module/Plugins wie "Schema.org für Gambio" (extern, oft custom)
- Custom: Smarty-Template-Anpassung in `templates/main/html/header.html`

**Canonicals:**
- Auto-generiert, im SEO-Tab pro Artikel überschreibbar

**Redirects:**
- Backend → Boxen & Module → Module "URL-Weiterleitungen"
- Oder direkt via .htaccess für mehr Kontrolle

**Robots.txt:**
- Liegt im Document-Root, manuell editieren via FTP

**Bekannte Gotchas Gambio:**
- Gambio-Versionen aus 2021 oder älter haben veraltete Templates — Update-Pflicht für moderne SEO
- Performance-Module ("Boost") begrenzt — bei größeren Shops oft eigene Server-Optimierung nötig
- Schema-Implementierung ist Hauptlücke — fast immer Plugin-/Custom-Lösung nötig

## JTL-Shop (5.x)

**Title + Meta:**
- Admin → Marketing → Suchmaschinenoptimierung → Artikel-SEO
- Pro Artikel/Kategorie/CMS-Seite manuell

**Title-Template:**
- Admin → Marketing → Suchmaschinenoptimierung → Vorlagen

**Schema-Markup:**
- JTL-Shop hat **Schema.org Product, Organization, Breadcrumb** out-of-the-box (seit 5.0)
- Erweitert: Plugin "JTL Schema Enhanced" oder ähnliche

**Canonicals:**
- Auto. Override pro Artikel im SEO-Bereich

**Redirects:**
- Admin → System → Wartung → URL-Weiterleitungen
- Bulk-Import via .htaccess oder Plugin

**Robots.txt:**
- Liegt im Document-Root des Shops, manuell

**Bekannte Gotchas JTL:**
- JTL-Wawi (Warenwirtschaft) ist primäres Tool → SEO-Daten oft im Wawi gepflegt, dann synchronisiert
- Performance: Mediadateien-Größen-Kontrolle wichtig (JTL-Wawi exportiert oft 5MB-JPGs)

## OXID eShop

**Title + Meta:**
- Admin → Stammdaten → Artikel → "SEO" Tab
- Pro Artikel/Kategorie

**Title-Template:**
- Admin → Stammdaten → Konfigurationen → "Standard Titel"

**Schema-Markup:**
- OXID hat **Basic Schema** (Product, Org) ab 6.x
- Erweitert: Module wie "OXID SEO Suite"

**Canonicals + Redirects + Robots:**
- Standard-Tools im Backend, OXID-Module für Erweiterung

**Gotchas:** etwas ältere Tech-Stack, kleinere Plugin-Community als Shopware.

## Webflow

**Title + Meta:**
- Pro Page: Page Settings → "SEO settings"
- Title und Description pro Page

**Title-Template:**
- Site-Settings → SEO → Title/Description (default für Pages ohne eigene Werte)

**Schema-Markup:**
- Custom: über Webflow's "Embed"-Block JSON-LD einbinden
- Oder via Webflow Designer-API mit Code-Injection (im Project-Settings → Custom Code)

**Canonicals:**
- Auto. Custom canonical via Page-Settings → "Custom code in head"

**Redirects:**
- Site-Settings → Hosting → "301 Redirects"
- CSV-Import möglich

**Robots.txt:**
- Site-Settings → SEO → Indexing → robots.txt editieren

**Bekannte Gotchas Webflow:**
- Production-Hosting vs Webflow-Subdomain (`*.webflow.io`) — Subdomain ist immer `noindex`
- CMS-Collection-Items haben eigene SEO-Felder pro Item, nicht vergessen
- Auto-generated alt-Texts schwach — manuell pflegen

## Wix

**Title + Meta:**
- Editor → Pages → ⚙️ → "SEO Basics"
- Pro Page Title + Description

**Title-Template:**
- Site Dashboard → SEO Tools → "Site Verification" + "Default Settings"

**Schema-Markup:**
- Wix hat **Auto-Schema** für Product (Wix Stores), Organization
- Custom Schema via "Velo" Code (Wix' Code-Layer) oder Embed-HTML

**Canonicals:**
- Auto. Override per Page in SEO Basics → "Advanced SEO"

**Redirects:**
- Site Dashboard → SEO Tools → "URL Redirect Manager"

**Robots.txt:**
- Site Dashboard → SEO Tools → "Robots.txt Editor"

**Bekannte Gotchas Wix:**
- Wix Lite-Plans haben eingeschränkten SEO-Zugriff
- URL-Strukturen historisch problematisch (`/?p=`) — bei alten Sites Migrations-Aufwand

## Squarespace

**Title + Meta:**
- Pro Page: Page Settings → "SEO"
- Title + Description pro Page

**Schema-Markup:**
- Squarespace hat **eingebautes Product-Schema** in Commerce-Theme
- Custom Schema via Code Injection im Settings → "Advanced" → "Code Injection"

**Canonicals + Redirects + Robots:**
- Standardisiert in Settings → "URLs & SEO"

**Gotchas:** weniger Customization als Shopify oder WooCommerce.

## Custom / Headless (Next.js, Astro, Nuxt, Custom-React/Vue)

**Title + Meta:**
- Im Code: `<Head>`-Komponente in Next.js, `<svelte:head>` in SvelteKit, etc.
- SSR/SSG entscheidet ob Suchmaschine die Daten sieht — Pflicht: **echtes Server-Rendering** für SEO-Daten

**Schema-Markup:**
- JSON-LD inline im `<head>` rendern
- Beim SSR/SSG so generieren dass Crawler es sieht

**Canonicals:**
- Manuell im `<head>`-Setup — kein Auto

**Redirects:**
- Server-Config (nginx/Apache) ODER Framework-Config (next.config.js `redirects()`)

**Robots.txt + Sitemap.xml:**
- Statisch generieren beim Build (next-sitemap, astrojs-sitemap etc.)

**Bekannte Gotchas Headless:**
- Client-Side-Only-Rendering ist ein **SEO-Killer** — alle SEO-relevanten Daten müssen SSR/SSG sein
- API-First-Stacks haben oft schlechtes Default-SEO-Setup — Vor-Audit besonders kritisch
- Performance ist meist sehr gut (auto), aber Schema-Implementation oft schwach

## Übergreifend: Welche Aktionen sind plattform-unabhängig?

Diese Schritte funktionieren immer, unabhängig vom Shop-System:

1. **Google Search Console** verifizieren (über Domain-DNS oder HTML-File)
2. **Sitemap.xml** in der Search Console einreichen
3. **Google Analytics 4** oder Matomo einrichten
4. **PSI Mobile Score >75** als Ziel
5. **Title 50–60 Zeichen + Meta 120–160 Zeichen** auf allen Hauptseiten
6. **Schema.org Product + Organization** mindestens
7. **HTTPS** + **HSTS-Header** + **HTTP/2 oder /3**

## Onboarding-Workflow: Wie wird die Pipeline angeschlossen?

### Voraussetzungen
- macOS, Linux, oder WSL2 mit Node.js 18+
- Google Chrome (für die PDF-Renderung via Chrome-Headless)
- API-Credentials für Sistrix + DataForSEO + Google PSI (siehe `.env.example` in diesem Skill)

### Schritt 1 — Plugin installieren
```
/plugin marketplace add maxschottke-spec/seo-survival-kit
/plugin install seo-rescue@seo-survival-kit
/reload-plugins
```

### Schritt 2 — Credentials einrichten
```bash
mkdir -p ~/.config/seo-rescue
cp ~/.claude/plugins/cache/maxschottke-spec-seo-survival-kit/plugins/seo-rescue/skills/seo-outreach-report/.env.example ~/.config/seo-rescue/.env
chmod 600 ~/.config/seo-rescue/.env
# .env editieren und API-Keys eintragen
```

### Schritt 3 — Audit-Config für deine Domains
```bash
cp ~/.claude/plugins/cache/maxschottke-spec-seo-survival-kit/plugins/seo-rescue/skills/seo-outreach-report/audit-config.example.json ./audit-config.json
# audit-config.json editieren — targets + narrative pro Slug
```

### Schritt 4 — Homepage-Cache fürs On-Page-Audit
Pro Domain im audit-config.json:
```bash
CACHE_DIR="${SEO_CACHE_DIR:-$HOME/.cache/seo-rescue}"; mkdir -p "$CACHE_DIR" && chmod 700 "$CACHE_DIR"
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "https://your-domain.de/" > "$CACHE_DIR/your-slug-home.html"
```
(Wobei `your-slug` der `slug`-Wert aus audit-config.json ist)

### Schritt 5 — Pipeline laufen lassen
```bash
ENV_PATH=~/.config/seo-rescue/.env
node --env-file="$ENV_PATH" ~/.claude/plugins/cache/maxschottke-spec-seo-survival-kit/plugins/seo-rescue/skills/seo-outreach-report/seo-audit-fetch-v2.js
node ~/.claude/plugins/cache/maxschottke-spec-seo-survival-kit/plugins/seo-rescue/skills/seo-outreach-report/seo-extract-v2.js
node ~/.claude/plugins/cache/maxschottke-spec-seo-survival-kit/plugins/seo-rescue/skills/seo-outreach-report/seo-onpage.js
node ~/.claude/plugins/cache/maxschottke-spec-seo-survival-kit/plugins/seo-rescue/skills/seo-outreach-report/seo-report-gen.js
```

PDF landet in `~/Downloads/SEO-Auswertung-<domain>-<date>.pdf`.

### Schritt 6 — Verifizieren
1. PDF öffnen, durchlesen aus Inhaber-Perspektive
2. Werte gegen Search Console quergecheckt (wenn Zugriff)
3. Bei Anomalien: das Skill verwendet plain JSON in `~/.cache/seo-rescue/<slug>-summary.json` — manuell prüfen

## Häufige Anbindungs-Fehler

| Symptom | Lösung |
|---------|--------|
| `Config not found: ./audit-config.json` | Setze `SEO_AUDIT_CONFIG=/absolute/path/to/audit-config.json` |
| `Chrome not found at /Applications/...` | Setze `CHROME_PATH=/path/to/chrome` oder installiere Chrome |
| `Unsafe slug rejected` | Slug-Whitelist: nur `a-z A-Z 0-9 - _`. Anpassen in audit-config.json |
| `Skip <slug>: ~/.cache/seo-rescue/<slug>-raw.json missing` | Erst Schritt 5 fetch lauf vorher |
| `Skip <slug>: ~/.cache/seo-rescue/<slug>-home.html missing` | Schritt 4 (Homepage-Cache) ausführen |
| `Skip <slug>: no narrative entry` | In audit-config.json `narrative.<slug>` mit allen Pflicht-Feldern ergänzen |
| Sistrix `error_code: 5001` | Tier zu niedrig — Sistrix Toolbox API Tier upgraden |
| DataForSEO `401 Unauthorized` | Login (Email) statt Dashboard-Passwort? Du brauchst das **API Password** aus dem Account-Settings |

## Quer-Referenz

- [TOOLS.md](./TOOLS.md) — Alternative Tools (Ahrefs/SEMrush/XOVI etc.)
- `COSTS.md` (Repo-Root, nicht im Plugin-Paket) — was kostet die Pipeline pro Domain
- `SECURITY.md` (Repo-Root, nicht im Plugin-Paket) — was die Scripts dürfen/nicht
- `ONBOARDING.md` (Repo-Root, nicht im Plugin-Paket) — generelles 15-Min-Setup
