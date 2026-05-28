# Recovery Workflow — Tool Provider

## Capability-Matrix

| Capability | Beschreibung | Primary | Paid Fallbacks | Free/Local Fallbacks |
|-----------|-------------|---------|----------------|---------------------|
| visibility_history | Sichtbarkeitsverlauf | Sistrix | Semrush, Ahrefs, Searchmetrics, Xovi | GSC CSV, manuelle CSV |
| keyword_rankings | Keyword-Positionen | DataForSEO | Semrush, Ahrefs, SE Ranking | GSC CSV, manuelle CSV |
| backlink_summary | Backlink-Profil | DataForSEO | Ahrefs, Majestic, Semrush | GSC Links, manuelle CSV |
| crawl_issues | Technische Issues | Screaming Frog MCP | Sitebulb, JetOctopus, Lumar | Lokaler Crawler, manuelle CSV |
| indexability_check | Indexierungsstatus | Screaming Frog | Sitebulb, Lumar | robots.txt + HTTP Check |
| page_metadata | Title, H1, Meta | Screaming Frog | Sitebulb | Lokaler Fetch + HTML Parse |
| serp_snapshot | SERP-Positionen | DataForSEO | Semrush, Ahrefs | manuelle CSV |
| core_update_dates | Core Update Daten | CORE_UPDATES.md | — | manuell gepflegt |

## Datenqualitaet je Provider

| Provider | Erwartete Qualitaet | Einschraenkungen |
|----------|-------------------|-----------------|
| Sistrix | high | Nur Sichtbarkeitsindex, keine Keywords/Backlinks |
| DataForSEO | high | API-Kosten pro Request |
| Screaming Frog | high | Erfordert laufenden MCP Server |
| GSC CSV | medium | Nur eigene Domains, keine Wettbewerberdaten |
| Manuelle CSV | low-medium | Abhaengig von Exportquelle und Aktualitaet |
| Lokaler Crawler | low | Max 100 URLs, kein JS-Rendering |

## Hinweis

Konkrete MCP-Toolnamen koennen lokal abweichen. Die Capability-basierte Abstraktion sorgt dafuer, dass die Commands mit jedem Provider funktionieren, der die jeweilige Capability erfuellen kann.
