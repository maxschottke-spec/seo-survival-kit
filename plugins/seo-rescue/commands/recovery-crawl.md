# Recovery Crawl

## Zweck

Screaming Frog MCP Crawl durchfuehren und die Ergebnisse in eine strukturierte, priorisierte Issues-Liste transformieren. Identifiziert technische SEO-Probleme die Recovery blockieren. Falls Screaming Frog MCP nicht verfuegbar ist, Fallback auf lokalen Minimal-Crawler oder CSV-Import.

## Trigger

`/seo-rescue:recovery-crawl <domain>`

## Input-Kontrakt

| Feld | Quelle | Pflicht |
|------|--------|---------|
| `domain` | CLI-Argument | ja |

Normalisierung gemaess Schritt 1 des Ablaufs. `www.` wird NICHT entfernt.

## Capabilities

| Capability | Pflicht/Optional | Verwendung |
|-----------|-----------------|-----------|
| `crawl_issues` | pflicht (mit Fallback) | Technische SEO-Issues identifizieren |
| `indexability_check` | optional | Canonicals, noindex, robots-Blockierung pruefen |
| `page_metadata` | optional | H1, Meta-Description, Title extrahieren |

## Bevorzugte Provider

- **crawl_issues**: Screaming Frog MCP (`sf_crawl`, `sf_generate_bulk_export`)
- **indexability_check**: Screaming Frog MCP (`Canonicals:Non-Indexable` Filter)
- **page_metadata**: Screaming Frog MCP (`H1:Missing`, `Meta Description:Missing`)

## Fallback-Provider

### Paid Fallbacks (wenn Screaming Frog MCP nicht verfuegbar)

| Capability | Paid Fallback |
|-----------|--------------|
| `crawl_issues` | Sitebulb, JetOctopus, Lumar (Deepcrawl), Botify (manueller CSV-Export) |
| `indexability_check` | Sitebulb, Lumar |
| `page_metadata` | Sitebulb, JetOctopus |

### Free / Lokale Fallbacks

| Capability | Free/Lokal Fallback |
|-----------|-------------------|
| `crawl_issues` | Lokaler Minimal-Crawler (100 URLs, 1 req/s, respektiert robots.txt) via `scripts/recovery-crawl.js` |
| `crawl_issues` | Manuelle Crawl-CSV unter `~/.cache/seo-rescue/{slug}/imports/crawl.csv` |
| `page_metadata` | Manuelle Crawl-CSV mit H1/Meta-Spalten |

CSV-Importe werden unter `~/.cache/seo-rescue/{slug}/imports/` erwartet.

## Script CLI Contract

```bash
node scripts/recovery-crawl.js --domain <domain> --cache-dir <path>
```

| Exit Code | Bedeutung |
|-----------|-----------|
| `0` | Crawl abgeschlossen (complete oder partial) |
| `1` | Crawl fehlgeschlagen (kein Provider, kein CSV) |
| `2` | Security-Abbruch (Symlink, Path-Traversal) |
| `3` | Lock-Timeout (anderer Command laeuft) |

## Ablauf

### Schritt 1: Domain normalisieren

Normalisiere den Input gemaess dem gemeinsamen Input-Kontrakt:

- Entferne Protokoll (`https://`, `http://`), Pfad, Query-Parameter, Fragment, Trailing Slash
- `www.` wird NICHT entfernt — `www.example.com` und `example.com` sind verschiedene Domains
- Erzeuge folgende Felder:
  - `input_domain` — das Original exakt so wie vom User eingegeben
  - `domain` — normalisierte Domain (kein Protokoll, kein Pfad, kein Trailing Slash)
  - `canonical_domain` — auf `null` setzen (wird von spaeteren Commands gesetzt)
  - `slug` — sicherer Dateiname via `safeSlug()` aus `lib/safe.js`

Fuehre aus:

```bash
node -e "const { normalizeDomain } = require('./plugins/seo-rescue/lib/safe.js'); console.log(JSON.stringify(normalizeDomain('{domain}')))"
```

Ersetze `{domain}` durch den tatsaechlichen User-Input. Falls `normalizeDomain()` einen Fehler wirft (z.B. leerer Input, ungueltiger Slug), Abbruch mit Status `failed`.

### Schritt 2: Cache-Verzeichnis anlegen

Erstelle das domainspezifische Cache-Verzeichnis unter `~/.cache/seo-rescue/{slug}/`:

```bash
node -e "const { ensureDomainDir } = require('./plugins/seo-rescue/lib/safe.js'); console.log(ensureDomainDir('{slug}'))"
```

Ersetze `{slug}` durch den in Schritt 1 ermittelten Slug. Das Verzeichnis wird mit Modus 0700 angelegt (nur der aktuelle User hat Zugriff). Falls das Verzeichnis ein Symlink ist, Abbruch mit Status `failed`.

### Schritt 3: Run-ID generieren

Generiere eine eindeutige Run-ID fuer diesen Lauf:

```bash
node -e "const { randomUUID } = require('crypto'); console.log('crawl-' + randomUUID().slice(0,8) + '-' + Date.now())"
```

Speichere die Run-ID als `run_id`. Sie wird im Output-Schema mitgefuehrt.

### Schritt 4: Crawl starten (Screaming Frog MCP)

Starte den Screaming Frog MCP Crawl mit dem Tool `sf_crawl`:

- URL: `https://{domain}` (normalisierte Domain mit Protokoll)
- Crawl-Limit: 500 URLs

Speichere die Crawl-ID aus der Antwort fuer die nachfolgende Fortschrittsueberwachung.

Falls `sf_crawl` nicht verfuegbar ist oder sofort einen Fehler zurueckgibt:
- Warnung in `warnings` eintragen: `"Screaming Frog MCP nicht verfuegbar — Fallback wird versucht"`
- Weiter mit Schritt 5 (Fallback-Strategie)

### Schritt 5: Fortschritt ueberwachen (Screaming Frog MCP)

Nur wenn Schritt 4 erfolgreich war:

Rufe `sf_crawl_progress` mit der Crawl-ID in regelmaessigen Abstaenden auf, bis der Crawl abgeschlossen ist.

- Pruefe den Status auf `"complete"` oder `"finished"`
- Bei Status `"aborted"` oder `"error"`: Warnung eintragen `"Crawl wurde abgebrochen — partielle Daten"`, Status = `partial`, weiter mit Schritt 6 falls teilweise Daten vorhanden
- Bei Timeout (> 10 Minuten ohne Abschluss): Warnung eintragen `"Crawl-Timeout — moegliche partielle Daten"`, weiter mit Schritt 6

### Schritt 6: Bulk-Exports generieren (Screaming Frog MCP)

Nur wenn SF-Crawl abgeschlossen oder partial:

Generiere fuer folgende Filter jeweils einen Export via `sf_generate_bulk_export` und lies das Ergebnis mit `sf_export_crawl`:

| Filter-Name | Export-Typ | Mapping auf Issue-Typ |
|-------------|------------|----------------------|
| `Response Codes:Client Error (4xx)` | Internal HTML | `broken_internal_link` |
| `Response Codes:Redirection (3xx)` | Internal HTML | `redirect_chain` |
| `H1:Missing` | Internal HTML | `missing_h1` |
| `H1:Duplicate` | Internal HTML | `duplicate_h1` |
| `Meta Description:Missing` | Internal HTML | `missing_meta_description` |
| `Canonicals:Non-Indexable` | Internal HTML | `non_indexable_canonical` |
| `Internal:All` | Internal HTML | Interne Linkstruktur (fuer Orphan-Pages-Erkennung) |

Fuer jeden Export:
1. Rufe `sf_generate_bulk_export` mit dem entsprechenden Filter und `crawl_id` auf
2. Lies die Ergebnis-Daten aus der Antwort
3. Extrahiere betroffene URLs und Anzahl

Falls ein einzelner Export fehlschlaegt: Warnung eintragen (`"Export fuer {filter} fehlgeschlagen — Issue-Typ wird uebersprungen"`), weiter mit naechstem Filter.

Falls alle SF-Exports fehlschlagen: Warnung eintragen, weiter mit Schritt 7 (lokaler Fallback).

**Orphan-Pages-Erkennung:**

Vergleiche alle gecrawlten URLs aus dem `Internal:All`-Export mit den intern verlinkten URLs. URLs die gecrawlt wurden, aber keine eingehenden internen Links haben (ausser der Startseite), sind Orphan-Pages. Mappe diese als `orphan_page`-Issues.

### Schritt 7: Fallback — Lokaler Minimal-Crawler oder CSV-Import

Nur wenn SF-Crawl nicht verfuegbar oder alle Exports fehlgeschlagen:

**Option A: CSV-Import**

Pruefe ob `~/.cache/seo-rescue/{slug}/imports/crawl.csv` existiert. Falls ja:
- Lade Issues aus CSV (erwartete Spalten: `url`, `status_code`, `h1`, `meta_description`, `canonical`)
- Eintragen in `source_notes`: `"Crawl-Daten aus manueller CSV, kein Live-Crawl"`
- `crawler_provider = "csv_import"`, `local_crawler_used = false`
- Status = `partial`

**Option B: Lokaler Minimal-Crawler**

Falls kein CSV-Import vorhanden, starte den lokalen Minimal-Crawler via Script:

```bash
node scripts/recovery-crawl.js --domain {domain} --cache-dir ~/.cache/seo-rescue/{slug} --max-urls 100 --rate 1
```

Hinweise:
- Max. 100 URLs
- Rate: 1 Request/Sekunde
- Respektiert `robots.txt`
- `crawler_provider = "local"`, `local_crawler_used = true`
- Status = `partial`

Falls weder CSV-Import noch lokaler Crawler verfuegbar:
- Fehler eintragen: `"Kein Crawl-Provider verfuegbar — weder SF MCP, CSV-Import noch lokaler Crawler"`
- Status = `failed`, Abbruch

### Schritt 8: Issues klassifizieren

Assembliere die `rawIssues` als Array von Objekten mit folgender Struktur pro Issue-Typ:

```json
{
  "type": "<issue-type>",
  "count": "<integer>",
  "affected_urls": "<integer>",
  "details": ["<detail-objekte-aus-export>"]
}
```

Rufe dann den Helper-Script auf um Issues zu klassifizieren und die `issues.json` zu schreiben:

```bash
node -e "
const { writeIssuesJSON } = require('./plugins/seo-rescue/scripts/recovery-crawl.js');
const result = writeIssuesJSON(domain, slug, inputDomain, crawlLimit, crawledInternalHtmlUrls, exportedRowsTotal, rawIssues, warnings, errors, crawlerProvider, localCrawlerUsed, rawExportsUsed);
console.log(JSON.stringify(result.summary));
"
```

Ersetze alle Variablen durch die in den vorigen Schritten gesammelten Werte als JavaScript-Literale.

## Issue-Typen und Severity-Mapping

| Issue-Typ | Default Severity | Hinweis |
|-----------|-----------------|---------|
| `broken_internal_link` | `high` | `critical` wenn Ziel-URL mehr als 100 eingehende interne Links hat |
| `redirect_chain` | `medium` | `high` wenn urspruengliches Topic durch Redirect verloren geht (URL-Semantik-Bruch) |
| `non_indexable_canonical` | `high` | kein Upgrade |
| `missing_h1` | `medium` | kein Upgrade |
| `duplicate_h1` | `low` | `medium` wenn mehr als 10 betroffene URLs |
| `missing_meta_description` | `low` | kein Upgrade |
| `orphan_page` | `medium` | kein Upgrade |

Hinweis: Traffic-basierte Severity-Upgrades (z.B. fuer hochfrequentierte URLs) werden in `recovery-plan` vorgenommen, nicht hier. Das Severity-Mapping in `scripts/recovery-crawl.js` ist fuer das Issues-JSON massgebend.

## Output-Pfad

`~/.cache/seo-rescue/{slug}/issues.json`

## Output-Schema

```json
{
  "schema_version": "2.0",
  "run_id": "crawl-b2c3d4e5-1716820000000",
  "status": "partial",
  "data_quality": "partial",
  "confidence": "medium",
  "providers_used": ["screaming_frog_mcp"],
  "missing_capabilities": [],
  "crawler_provider": "screaming_frog_mcp",
  "local_crawler_used": false,
  "raw_exports_used": ["Response Codes:Client Error (4xx)", "H1:Missing"],
  "crawl_limit": 500,
  "crawled_internal_html_urls": 312,
  "exported_rows_total": 47,
  "source_notes": [],
  "domain": "example.com",
  "timestamp": "2026-05-27T14:00:00Z",
  "warnings": [],
  "errors": [],
  "summary": {
    "total_issues": 23,
    "critical": 2,
    "high": 8,
    "medium": 9,
    "low": 4
  },
  "issues": []
}
```

## Ausgabe an den User

Nach erfolgreichem Schreiben der Issues, gib folgende Informationen aus:

1. **Status-Zeile:** `[recovery-crawl] {domain} — Status: {status} | Gecrawlte URLs: {crawled_internal_html_urls} (Limit: {crawl_limit})`
2. **Provider:** `Crawler: {crawler_provider} | Lokaler Crawler: {local_crawler_used}`
3. **Issues-Summary:** `Critical: {critical} | High: {high} | Medium: {medium} | Low: {low} | Gesamt: {total_issues}`
4. **Top-Issues:** Liste die 3 schwerwiegendsten Issues mit Typ, Severity und Anzahl betroffener URLs
5. **Fehlende Capabilities** (falls vorhanden): `Fehlende Daten: {missing_capabilities.join(', ')}`
6. **Naechster Schritt:** Empfehle basierend auf dem Ergebnis:
   - `critical > 0` → `/seo-rescue:recovery-plan` fuer priorisierten Aktionsplan
   - `high > 5` → `/seo-rescue:recovery-plan` fuer priorisierten Aktionsplan
   - `total_issues = 0` → technisch sauber; weiter mit Content-Analyse
   - `status = partial` → Hinweis auf incomplete Crawl-Daten, Wiederholung empfohlen

## Fehlerbehandlung

| Fehler | Verhalten | Status |
|--------|-----------|--------|
| SF MCP nicht verfuegbar (`sf_crawl` schlaegt fehl) | Warnung, Fallback-Versuch (CSV oder lokaler Crawler). | `partial` |
| SF MCP nicht verfuegbar, kein Fallback | Fehler eintragen, Abbruch. | `failed` |
| Crawl bricht ab (Status `aborted`) | Warnung eintragen, weiter mit partiellen Daten falls `crawled_internal_html_urls > 0`. | `partial` |
| Crawl-Timeout (> 10 Minuten) | Warnung eintragen, weiter mit partiellen Daten. | `partial` |
| Einzelner Bulk-Export fehlgeschlagen | Warnung eintragen, Issue-Typ auf 0 setzen, weiter. | `partial` |
| Alle SF-Exports fehlgeschlagen | Warnung, Fallback-Versuch (CSV oder lokaler Crawler). | `partial` |
| Lokaler Crawler schlaegt fehl | Warnung, CSV-Import-Versuch. | `partial` |
| Kein Provider verfuegbar (SF + lokal + CSV) | Fehler eintragen, Abbruch. | `failed` |
| `crawled_internal_html_urls = 0` nach Crawl | Fehler eintragen, Abbruch. Domain moeglicherweise nicht erreichbar. | `failed` |
| Domain nicht aufloesbar oder leerer Input | Fehler eintragen, Abbruch. | `failed` |
| `safeSlug()` schlaegt fehl | Fehler eintragen, Abbruch. Hinweis: Domain-Format ueberpruefen. | `failed` |
| Lock nicht erwerbbar (Timeout 30s) | Fehler eintragen (Exit Code 3), Abbruch. | `failed` |
| Symlink-Erkennung im Cache-Pfad | Fehler eintragen (Exit Code 2), Abbruch. | `failed` |

## Validierungsregeln

Pruefe vor dem Schreiben via `writeIssuesJSON`:

- `crawled_internal_html_urls > 0` — sonst `failed`
- `summary.total_issues = summary.critical + summary.high + summary.medium + summary.low`
- Jedes Issue benoetigt: `type`, `severity`, `count`
- `severity` muss exakt einer sein von: `critical | high | medium | low`
- `type` muss exakt einer sein von: `broken_internal_link | redirect_chain | non_indexable_canonical | missing_h1 | duplicate_h1 | missing_meta_description | orphan_page`
- `slug` muss dem Pattern `^[a-z0-9][a-z0-9_-]{0,63}$` entsprechen
- `timestamp` muss ein gueltiges ISO-8601-Datum mit Uhrzeit sein
- `schema_version` muss `"2.0"` sein
- `run_id` muss gesetzt und non-empty sein
- `crawler_provider` muss gesetzt sein: `screaming_frog_mcp | sitebulb | csv_import | local`
- `local_crawler_used` muss Boolean sein

## Graceful-Degradation-Regeln

| Szenario | Verhalten |
|---------|-----------|
| SF MCP nicht verfuegbar | `partial`; Fallback auf lokalen Crawler oder CSV |
| Lokaler Crawler nicht verfuegbar | `partial`; Fallback auf CSV |
| Nur CSV-Import verfuegbar | `partial`; `data_quality = "poor"` |
| Kein Provider verfuegbar | `failed` |
| Einzelne Exports fehlgeschlagen | Issue-Typ auf 0; `partial` |
| Crawl-Timeout | Weiter mit gecrawlten URLs; `partial` |

## Datenqualitaetsregeln

- `"good"`: SF-MCP-Crawl vollstaendig, alle Exports erfolgreich
- `"partial"`: SF-Crawl partial ODER einzelne Exports fehlgeschlagen ODER lokaler Crawler verwendet
- `"poor"`: Nur CSV-Import; keine Live-Crawl-Daten

Bei `data_quality = "poor"`: Expliziter Hinweis an den User, dass Issues-Liste auf manuellen Daten basiert und moeglicherweise unvollstaendig ist.

## Referenzen

- `scripts/recovery-crawl.js` — Issue-Klassifikation + atomares Schreiben via `writeIssuesJSON()`; lokaler Minimal-Crawler
- `schemas/issues.schema.json` — vollstaendiges JSON-Schema des Output-Objekts
- `lib/safe.js` — `normalizeDomain()`, `safeSlug()`, `ensureDomainDir()`, `acquireLock()`, `releaseLock()`, `atomicWriteJSON()`
