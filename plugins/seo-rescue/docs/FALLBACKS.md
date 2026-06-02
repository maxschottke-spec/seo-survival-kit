# Recovery Workflow — Fallbacks

## Minimalbetrieb ohne kostenpflichtige Tools

Das seo-rescue Plugin funktioniert auch komplett ohne Sistrix, DataForSEO oder Screaming Frog. Die Ergebnis-Qualitaet ist dann eingeschraenkt, aber der Workflow laeuft vollstaendig durch.

## Verfuegbare kostenlose Datenquellen

### Google Search Console CSV

Exportiere aus der Google Search Console:
- Leistungsbericht > Suchanfragen (queries.csv)
- Leistungsbericht > Seiten (pages.csv)
- Links (links.csv)

Lege die Dateien ab unter:
```
~/.cache/seo-rescue/{domain-slug}/imports/gsc/
```

### Manuelle Keyword-CSV

Erstelle `keywords.csv` mit mindestens den Spalten `keyword` und `position`:
```csv
keyword,position,volume,url
matratze 140x200,12,880,/matratzen/140x200/
lattenrost test,8,1200,/blog/lattenrost-test/
```

Pfad: `~/.cache/seo-rescue/{domain-slug}/imports/keywords.csv`

### Manuelle Backlink-CSV

Erstelle `backlinks.csv` mit mindestens `source_url` und `target_url`:
```csv
source_url,target_url,domain,nofollow
https://blog.example.org/review,https://example.com/,blog.example.org,false
```

Pfad: `~/.cache/seo-rescue/{domain-slug}/imports/backlinks.csv`

### Manuelle Crawl-CSV

Lege Screaming-Frog-kompatible Exporte ab unter:
```
~/.cache/seo-rescue/{domain-slug}/imports/crawl/
```

### Lokaler Minimal-Crawler

Wenn keine Crawl-Daten vorhanden sind, nutzt `recovery-crawl` automatisch einen lokalen Crawler:
- Liest `/sitemap.xml`
- Prueft bis zu 100 URLs
- Extrahiert Status, Title, H1, Meta Description, Canonical, robots
- Respektiert robots.txt
- 1 Request pro Sekunde

## Was ist mit Fallbacks moeglich?

| Capability | Mit Fallback | Einschraenkung |
|-----------|-------------|---------------|
| Diagnose | Ja | Keine VI-Daten, keine Core-Update-Korrelation |
| Keywords | Ja (GSC/CSV) | Kein Suchvolumen, keine Intent-Daten |
| Backlinks | Ja (GSC/CSV) | Kein Spam-Score, keine Autoritaet |
| Crawl | Ja (Lokal/CSV) | Max 100 URLs, kein JS-Rendering |
| Monitoring | Ja (CSV/History) | Score nur mit verfuegbaren Komponenten |

## Wichtige Regel

> Lieber `partial` + `low confidence` als scheinbar vollstaendige, aber irrefuehrende Ergebnisse.

Alle Outputs kennzeichnen transparent, welche Provider genutzt wurden (`providers_used`) und welche Capabilities fehlen (`missing_capabilities`).
