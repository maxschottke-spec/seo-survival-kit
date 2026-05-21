# Alternative Tool-Adapter — Welche Bezahltools kann ich statt Sistrix/DataForSEO nutzen?

Dieser Skill liefert **standardmäßig** die Pipeline mit Sistrix + DataForSEO + Google PSI. Wenn du bereits **andere kostenpflichtige Tools** abonniert hast, ist es oft günstiger diese zu integrieren statt parallel Sistrix zu zahlen. Hier die Mapping-Tabelle plus Code-Patterns für die häufigsten Alternativen.

## Pflicht-Datenpunkte (was die Pipeline braucht)

Für einen kompletten Report werden diese Datenpunkte benötigt — egal von welchem Tool:

| Datenpunkt | Wo's eingesetzt wird |
|------------|----------------------|
| **Sichtbarkeits-Index** (aktuell) | KPI-Kachel "Sichtbarkeit Google" + Trend |
| **Sichtbarkeits-Historie** (18 Monate, monatlich) | VI-Chart Kapitel 3 |
| **All-Time Max + Date** | "Abstand zum Höchststand" KPI |
| **Top-100-Keywords mit Position + SV** | Kapitel 4 (Top-15-Tabelle + Quick-Wins) |
| **Positions-Verteilung** (Top 3 / 10 / 20 / 50 / 100) | Verteilungs-Bars |
| **Wettbewerber** (Top-8 mit ETV + Schnittmenge) | Kapitel 5 |
| **Backlink-Profil-KPIs** (RD-Count, total, spam-score, rank) | Kapitel 8 |
| **Top verlinkende Domains** | Tabelle in Kapitel 8 |
| **PSI-Daten** (Mobile + Desktop Performance/SEO/A11y/BP, CWV) | Kapitel 6 |
| **On-Page-Signale** (Title, Meta, H1, Schema, Bilder-Alt) | Kapitel 7 — kommt aus seo-onpage.js + lokalem HTML |

## Tool-Mapping

### Visibility-Index (Sistrix-Standard)

| Tool | Verfügbar? | Notes |
|------|------------|-------|
| **Sistrix** | ✅ Default | API-Endpoint `domain.sichtbarkeitsindex` mit `date` parameter pro Monat |
| **XOVI** | ✅ alternativ | Eigener "OVI"-Index, ähnliche Methodik. API: `https://api.xovi.de/` (deutsche Domain-Fokus) |
| **Searchmetrics** | ✅ alternativ | "SEO Visibility" Index. API via `api.searchmetrics.com` |
| **SEMrush** | ⚠️ partiell | Bietet keinen direkten Visibility-Index aber `Domain Overview` mit "Authority Score" + Traffic-Schätzungen. Workaround: berechne Visibility aus den Top-Keywords-Positionen × Suchvolumen |
| **Ahrefs** | ⚠️ partiell | Kein klassischer VI. Hat aber `Domain Rating` (DR) + Organic Traffic Estimate — kann als Proxy genutzt werden |
| **Moz** | ⚠️ partiell | Nur DA/PA — kein VI |

**Empfehlung:** Sistrix ist der DE-Standard. XOVI für reine DE-Sites gleichwertig. Searchmetrics teurer, eher Enterprise.

### Keyword-Rankings (DataForSEO-Default)

| Tool | Verfügbar? | Notes |
|------|------------|-------|
| **DataForSEO Labs** | ✅ Default | Pay-per-call, sehr günstig |
| **Ahrefs** | ✅ direkt-replace | `Site Explorer` → Organic Keywords. Reichhaltiger aber teurer (Subscription) |
| **SEMrush** | ✅ direkt-replace | `Domain Analytics` → Organic Research. Sehr ähnliche Datenqualität wie Ahrefs |
| **Sistrix** | ❌ in Standard-Tier nicht via API | UI-Toolbox hat alle Daten, API benötigt höheren Tier |
| **Moz Keyword Explorer** | ⚠️ teilweise | Hat Keywords aber nicht die "ranked_keywords"-Auflösung |
| **Mangools (KWFinder/SERPChecker)** | ⚠️ teilweise | Kleinere Datenbank |
| **Google Search Console** | ✅ direkt aber begrenzt | Nur eigene Property — kostenlos. Für Outreach-Reports auf Fremd-Domain ungeeignet |

**Empfehlung Reihenfolge:** DataForSEO Labs (Pay-per-call ist günstigst für gelegentliche Audits) → Ahrefs (wenn schon abonniert) → SEMrush (wenn schon abonniert).

### Backlink-Profil

| Tool | Verfügbar? | Notes |
|------|------------|-------|
| **DataForSEO Backlinks** | ✅ Default | Pay-per-call |
| **Ahrefs** | ✅ direkt-replace | Goldstandard für Backlinks. Größte Index-Basis |
| **SEMrush** | ✅ direkt-replace | Vergleichbar mit Ahrefs |
| **Majestic** | ✅ alternativ | "Trust Flow" + "Citation Flow" — eigene Metriken |
| **Moz Link Explorer** | ✅ alternativ | DA/PA Industry-Standard, aber teurer |
| **Sistrix Link-Modul** | ⚠️ extra | Optional dazubuchbar |

**Empfehlung:** Wer Ahrefs hat, sollte Backlinks von dort holen — Index ist 2-3× größer als DataForSEO.

### Wettbewerber-Analyse

| Tool | Verfügbar? | Notes |
|------|------------|-------|
| **DataForSEO Labs** (`competitors_domain/live`) | ✅ Default | Liefert Top-Wettbewerber nach SERP-Überlappung |
| **Ahrefs** | ✅ direkt | `Competing Domains` |
| **SEMrush** | ✅ direkt | `Competitive Positioning Map` |
| **Similarweb** | ✅ alternativ | Eher Traffic-/Brand-fokussiert, weniger SEO-zentriert |
| **Sistrix** | ⚠️ UI-only | Hat Wettbewerbs-Analyse in UI, API requires upgrade |

### PSI / Core Web Vitals

| Tool | Verfügbar? | Notes |
|------|------------|-------|
| **Google PSI v5** | ✅ Default | KOSTENLOS, 25k/Tag mit Key |
| **Lighthouse CLI** | ✅ Alternativ lokal | Open Source, läuft lokal |
| **WebPageTest** | ✅ alternativ | Pay-per-test oder Free-Tier, detaillierter |
| **GTmetrix** | ✅ alternativ | API verfügbar im Pro-Tier |
| **CrUX API** | ✅ Echtdaten | Standalone CrUX-API für Field-Data (kostenlos) |

**Empfehlung:** PSI v5 ist kostenfrei und Goldstandard. Lighthouse CLI als lokale Fallback wenn PSI-Quota erschöpft.

### Crawling / Technische On-Page-Analyse

| Tool | Verfügbar? | Notes |
|------|------------|-------|
| **Custom (curl + regex)** | ✅ Default | Was die `seo-onpage.js` macht — nur Startseite |
| **Screaming Frog SEO Spider** | ✅ Tiefer Crawl | Hat MCP-Server (`mcp__screaming-frog__*`) — empfohlen für 100+-URL-Crawls |
| **Sitebulb** | ✅ alternativ | Desktop-Tool, eigene UI |
| **OnCrawl** | ✅ alternativ | Cloud-basiert, Log-File-Analyse |
| **DeepCrawl/Lumar** | ✅ alternativ | Enterprise |

**Empfehlung:** Für Outreach-Report reicht die Startseiten-Regex. Wenn der User Screaming-Frog-MCP hat → ergänzen für robuste Crawl-Daten.

## Adapter-Pattern (wie integrieren)

### Approach 1 — Drop-In-Replacement im Fetcher

In `seo-audit-fetch-v2.js` die `sistrix()` + `d4sPost()`-Funktionen durch tool-spezifische Funktionen ersetzen. Beispiel für Ahrefs:

```js
const AHREFS_TOKEN = process.env.AHREFS_API_TOKEN;

async function ahrefsBacklinks(target) {
  const r = await fetch(`https://api.ahrefs.com/v3/site-explorer/backlinks-stats?target=${target}&token=${AHREFS_TOKEN}`);
  return r.json();
}

// Map Ahrefs response to the same shape as DataForSEO so seo-extract-v2.js doesn't need changes:
function ahrefsToD4SShape(ahrefsResp) {
  return {
    tasks: [{ result: [{
      backlinks: ahrefsResp.backlinks_total,
      referring_domains: ahrefsResp.referring_domains,
      rank: ahrefsResp.domain_rating, // map DR to "rank"
      // ...
    }]}],
  };
}
```

**Pro:** Minimaler Aufwand. Bestehender extract.js arbeitet weiter.
**Contra:** Mapping zwischen Tool-Response-Schemas nötig.

### Approach 2 — Tool-Detection + Switch

Im Fetcher:

```js
const BACKLINK_PROVIDER = process.env.BACKLINK_PROVIDER || 'dataforseo';

async function fetchBacklinks(target) {
  switch (BACKLINK_PROVIDER) {
    case 'ahrefs':   return ahrefsBacklinks(target);
    case 'semrush':  return semrushBacklinks(target);
    case 'majestic': return majesticBacklinks(target);
    default:         return d4sBacklinks(target);
  }
}
```

User setzt `BACKLINK_PROVIDER=ahrefs` in `.env`, Rest läuft automatisch.

**Pro:** User-konfigurierbar ohne Code-Änderung.
**Contra:** Mehr Code-Maintenance.

### Approach 3 — Komplett ersetzter Daten-Loader

Skip die API-Calls komplett — User füttert eigene CSV/JSON-Daten ein:

```js
// audit-config.json
{
  "targets": [...],
  "data_sources": {
    "client-a": {
      "vi_history": "./data/client-a-vi.csv",     // user-provided
      "keywords": "./data/client-a-keywords.csv", // user-provided (e.g. SEMrush export)
      "backlinks": "./data/client-a-backlinks.csv"
    }
  }
}
```

Dann hat User volle Kontrolle, kann Daten aus beliebigen Tools exportieren und einfüttern.

**Pro:** Tool-agnostisch, max Flexibilität.
**Contra:** User muss Exports selbst machen, kein "Run pipeline" sondern Mehr-Schritt-Prozess.

## Aktuell empfohlene Setups nach Budget

### Bootstrap (€0/Monat)
- **PSI v5** (free)
- **Lighthouse CLI** (free)
- **Google Search Console** (free, eigene Properties)
- Verwendung: `seo-audit-free` skill

### Lean Pro (€30–80/Monat)
- **DataForSEO** (~$5–10 pay-per-use für 1–2 Audits/Monat)
- **PSI v5** (free)
- **Sistrix Starter Tier** (~€100/Monat, deutscher Markt-Fokus)
- Verwendung: `seo-outreach-report` mit Default-Setup

### Established Agency (€300+/Monat)
- Eines von Ahrefs/SEMrush (~€100–200/Monat)
- Sistrix Plus (~€200/Monat)
- DataForSEO Pay-per-use für Massenabfragen
- Screaming Frog (€199/Jahr für SEO Spider Lizenz)
- Verwendung: `seo-outreach-report` mit Custom-Adapter (siehe Approach 2)

### Enterprise (€1000+/Monat)
- Ahrefs Enterprise + SEMrush Enterprise (Doppel-Coverage)
- Sistrix Enterprise mit Vollzugriff API
- Searchmetrics oder Conductor
- Verwendung: Custom-Pipeline auf eigene API-Endpunkte, dieser Skill als Template

## Migrations-Beispiel: Von Sistrix → XOVI

Falls du nur XOVI hast und kein Sistrix:

```js
// In seo-audit-fetch-v2.js — sistrix() ersetzen durch xovi()
const XOVI_KEY = process.env.XOVI_API_KEY;
async function xovi(method, params) {
  const url = `https://api.xovi.de/v1/${method}?token=${XOVI_KEY}&${new URLSearchParams(params)}`;
  const r = await fetch(url);
  return r.json();
}

// XOVI hat einen "ovi" endpoint mit shape:
// { domain, ovi_current, ovi_date, history: [{date, value}, ...] }
// Map nach Sistrix-Shape damit extract.js nicht angepasst werden muss:
function xoviToSistrixShape(x) {
  return {
    answer: [{
      sichtbarkeitsindex: [{ domain: x.domain, date: x.ovi_date, value: String(x.ovi_current) }],
    }],
  };
}
```

## Wichtig: keine vendor-lock-in

Der Skill ist **bewusst** so gebaut, dass die Daten-Provider austauschbar sind. Das HTML/PDF-Layout bleibt identisch, egal welches Tool die Daten liefert. Falls die Standard-Pipeline nicht passt: 30–60 Min Adapter-Schreiben spart oft €100+/Monat Subscription für ein Tool das du nicht brauchst.

## Anti-Patterns

**Nicht tun:**
- Mehrere Tools für die GLEICHE Datenkategorie parallel anfragen (z.B. Ahrefs + SEMrush für Backlinks gleichzeitig) — Doppel-Kosten, kaum Mehrwert
- Tools-Subscription für einen einmaligen Audit kaufen — DataForSEO Pay-per-call ist günstiger
- Daten zwischen Tools mitteln (z.B. "Ahrefs sagt 200 RDs, Moz sagt 180, ich nehm 190") — jedes Tool hat anderen Crawler-Index, nicht aggregieren
- Sistrix-Wert als absolute Wahrheit ansehen — Sistrix misst DE-Suchergebnisse, nicht globale Markt-Relevanz

## Tool-Vergleichs-Tabelle (Stand 05/2026)

| Tool | Subscription | API-Tier | DE-Daten | Backlinks | Visibility | Keywords | Empfehlung |
|------|---------------|----------|----------|-----------|------------|----------|------------|
| Sistrix Toolbox | €100–500/Mo | extra | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | DE-Markt Goldstandard |
| Ahrefs | €100–400/Mo | inkl. | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Global-Standard für Pros |
| SEMrush | €120–450/Mo | inkl. | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Ahrefs-Alternative |
| DataForSEO | Pay-per-call | ✅ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ (mit Labs) | ⭐⭐⭐⭐ | Günstigst für Audits |
| XOVI | €50–200/Mo | inkl. | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | DE-Alternative zu Sistrix |
| Searchmetrics | Enterprise | inkl. | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Enterprise-only |
| Moz | €99–599/Mo | inkl. | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | DA/PA-fokussiert |
| Majestic | €50–400/Mo | inkl. | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | – | ⭐⭐ | Backlinks-Spezialist |
| Screaming Frog | €199/Jahr | – | ⭐⭐⭐⭐⭐ | – (eigene Crawls) | – | – | On-Page-Crawl Standard |
| Mangools | €30–100/Mo | – | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | Budget-Option |

**Persönliche Faustregel:** Wenn DE-Markt-Fokus → Sistrix + DataForSEO. Wenn international → Ahrefs ODER SEMrush + DataForSEO als Spitze. Wenn Budget → DataForSEO solo (ohne Sistrix) + PSI + Lighthouse.

## Beitragen

PRs für neue Adapter-Implementierungen sind willkommen. Bitte:
1. Adapter-Funktion in einer eigenen Datei (`adapters/<tool-name>.js`)
2. Map zur Standard-Shape dokumentieren
3. Beispiel-Response im Test-Folder
4. README-Update in dieser TOOLS.md mit Verfügbarkeits-Tabellen-Update
