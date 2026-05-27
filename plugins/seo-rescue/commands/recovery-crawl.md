# Recovery Crawl

## Zweck

Screaming Frog MCP Crawl durchfuehren und die Ergebnisse in eine strukturierte, priorisierte Issues-Liste transformieren. Identifiziert technische SEO-Probleme die Recovery blockieren.

## Trigger

`/seo-rescue:recovery-crawl <domain>`

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

### Schritt 3: Crawl starten

Starte den Screaming Frog MCP Crawl mit dem Screaming Frog MCP Tool `sf_crawl`:

- URL: `https://{domain}` (normalisierte Domain mit Protokoll)
- Maximale URLs: 500

Speichere die Crawl-ID aus der Antwort fuer die nachfolgende Fortschrittsueberwachung.

Falls `sf_crawl` nicht verfuegbar ist oder sofort einen Fehler zurueckgibt:
- Fehler in `errors` eintragen: `"Screaming Frog MCP nicht verfuegbar — Crawl nicht moeglich"`
- Status = `failed`, Abbruch

### Schritt 4: Fortschritt ueberwachen

Rufe `sf_crawl_progress` mit der Crawl-ID in regelmaessigen Abstaenden auf, bis der Crawl abgeschlossen ist.

- Pruefe den Status auf `"complete"` oder `"finished"`
- Extrahiere `crawled_urls` aus dem Fortschritts-Report
- Bei Status `"aborted"` oder `"error"`: Warnung eintragen `"Crawl wurde abgebrochen — partielle Daten"`, Status = `partial`, weiter mit Schritt 5 falls teilweise Daten vorhanden
- Bei Timeout (> 10 Minuten ohne Abschluss): Warnung eintragen `"Crawl-Timeout — moegliche partielle Daten"`, weiter mit Schritt 5

### Schritt 5: Bulk-Exports generieren

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

Falls alle Exports fehlschlagen: Fehler eintragen, Status = `failed`.

**Orphan-Pages-Erkennung:**

Vergleiche alle gecrawlten URLs aus dem `Internal:All`-Export mit den intern verlinkten URLs. URLs die gecrawlt wurden, aber keine eingehenden internen Links haben (ausser der Startseite), sind Orphan-Pages. Mappe diese als `orphan_page`-Issues.

### Schritt 6: Issues klassifizieren

Assembliere die `rawIssues` als Array von Objekten mit folgender Struktur pro Issue-Typ:

```json
{
  "type": "<issue-type>",
  "count": <integer>,
  "affected_urls": <integer>,
  "details": [<detail-objekte-aus-export>]
}
```

Rufe dann den Helper-Script auf um Issues zu klassifizieren und die `issues.json` zu schreiben:

```bash
node -e "
const { writeIssuesJSON } = require('./plugins/seo-rescue/scripts/recovery-crawl.js');
const result = writeIssuesJSON(domain, slug, inputDomain, crawledUrls, rawIssues, warnings, errors);
console.log(JSON.stringify(result.summary));
"
```

Ersetze `domain`, `slug`, `inputDomain`, `crawledUrls`, `rawIssues`, `warnings`, `errors` durch die in den vorigen Schritten gesammelten Werte als JavaScript-Literale.

## Issue-Typen und Severity-Mapping

| Issue-Typ | Default Severity | Upgrade-Bedingung |
|-----------|-----------------|-------------------|
| `broken_internal_link` | `high` | `critical` wenn Ziel-URL mehr als 100 eingehende interne Links hat |
| `redirect_chain` | `medium` | `high` wenn urspruengliches Topic durch Redirect verloren geht (URL-Semantik-Bruch) |
| `non_indexable_canonical` | `high` | kein Upgrade |
| `missing_h1` | `medium` | kein Upgrade |
| `duplicate_h1` | `low` | `medium` wenn mehr als 10 betroffene URLs |
| `missing_meta_description` | `low` | kein Upgrade |
| `orphan_page` | `medium` | kein Upgrade |

Das Severity-Mapping wird vom `scripts/recovery-crawl.js` Helper angewendet — es ist NICHT manuell zu berechnen.

## Output-Pfad

`~/.cache/seo-rescue/{slug}/issues.json`

## Ausgabe an den User

Nach erfolgreichem Schreiben der Issues, gib folgende Informationen aus:

1. **Status-Zeile:** `[recovery-crawl] {domain} — Status: {status} | Gecrawlte URLs: {crawled_urls}`
2. **Issues-Summary:** `Critical: {critical} | High: {high} | Medium: {medium} | Low: {low} | Gesamt: {total_issues}`
3. **Top-Issues:** Liste die 3 schwerwiegendsten Issues mit Typ, Severity und Anzahl betroffener URLs
4. **Naechster Schritt:** Empfehle basierend auf dem Ergebnis:
   - `critical > 0` → `/seo-rescue:recovery-plan` fuer priorisierten Aktionsplan
   - `high > 5` → `/seo-rescue:recovery-plan` fuer priorisierten Aktionsplan
   - `total_issues = 0` → technisch sauber; weiter mit Content-Analyse
   - `status = partial` → Hinweis auf incomplete Crawl-Daten, Wiederholung empfohlen

## Fehlerbehandlung

| Fehler | Verhalten | Status |
|--------|-----------|--------|
| SF MCP nicht verfuegbar (`sf_crawl` schlaegt fehl) | Fehler eintragen, Abbruch. Hinweis: Screaming Frog MCP muss installiert und erreichbar sein. | `failed` |
| Crawl bricht ab (Status `aborted`) | Warnung eintragen, weiter mit partiellen Daten falls `crawled_urls > 0`. | `partial` |
| Crawl-Timeout (> 10 Minuten) | Warnung eintragen, weiter mit partiellen Daten. | `partial` |
| Einzelner Bulk-Export fehlgeschlagen | Warnung eintragen, Issue-Typ auf 0 setzen, weiter. | `partial` |
| Alle Bulk-Exports fehlgeschlagen | Fehler eintragen, Abbruch. | `failed` |
| `crawled_urls = 0` nach Crawl | Fehler eintragen, Abbruch. Domain moeglicherweise nicht erreichbar. | `failed` |
| Domain nicht aufloesbar oder leerer Input | Fehler eintragen, Abbruch. | `failed` |
| `safeSlug()` schlaegt fehl | Fehler eintragen, Abbruch. Hinweis: Domain-Format ueberpruefen. | `failed` |
| Lock nicht erwerbbar (Timeout 30s) | Fehler eintragen, Abbruch. Anderer Command laeuft moeglicherweise fuer diese Domain. | `failed` |

## Validierungsregeln

Pruefe vor dem Schreiben via `writeIssuesJSON`:

- `crawled_urls > 0` — sonst `failed`
- `summary.total_issues = summary.critical + summary.high + summary.medium + summary.low`
- Jedes Issue benoetigt: `type`, `severity`, `count`
- `severity` muss exakt einer sein von: `critical | high | medium | low`
- `type` muss exakt einer sein von: `broken_internal_link | redirect_chain | non_indexable_canonical | missing_h1 | duplicate_h1 | missing_meta_description | orphan_page`
- `slug` muss dem Pattern `^[a-z0-9][a-z0-9_-]{0,63}$` entsprechen
- `timestamp` muss ein gueltiges ISO-8601-Datum mit Uhrzeit sein

## Referenzen

- `scripts/recovery-crawl.js` — Issue-Klassifikation + atomares Schreiben via `writeIssuesJSON()`
- `schemas/issues.schema.json` — vollstaendiges JSON-Schema des Output-Objekts
- `lib/safe.js` — `normalizeDomain()`, `safeSlug()`, `ensureDomainDir()`, `acquireLock()`, `releaseLock()`, `atomicWriteJSON()`
