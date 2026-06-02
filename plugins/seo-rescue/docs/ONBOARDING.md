# Recovery Workflow — Onboarding

## Was ist das seo-rescue Plugin?

Das seo-rescue Plugin fuer Claude Code automatisiert SEO-Recovery-Workflows nach Google Core Updates. Es diagnostiziert Sichtbarkeitsverluste, identifiziert technische Probleme, erstellt priorisierte Massnahmenplaene und trackt den Recovery-Fortschritt.

## Verfuegbare Commands

| Command | Funktion |
|---------|----------|
| `/seo-rescue:recovery-diagnose <domain>` | Automatische Diagnose (VI, Keywords, Backlinks, Core-Update-Korrelation) |
| `/seo-rescue:recovery-crawl <domain>` | Technischer Crawl + Issue-Klassifikation |
| `/seo-rescue:recovery-plan <domain>` | Priorisierter 30/60/90-Tage Action-Plan |
| `/seo-rescue:recovery-monitor <domain>` | Woechentliches Recovery-Tracking mit Score |
| `/seo-rescue:recovery-full <domain>` | Alle vier Schritte in einem Durchlauf |

## Schnellstart

### Minimaler Start (ohne kostenpflichtige Tools)

1. Google Search Console CSV-Exporte in `~/.cache/seo-rescue/{domain-slug}/imports/gsc/` ablegen
2. `/seo-rescue:recovery-full example.com` ausfuehren
3. Outputs pruefen (befund.json, issues.json, action-plan.json)
4. Action-Plan manuell freigeben
5. Woechentlich `/seo-rescue:recovery-monitor example.com` ausfuehren

### Voller Start (Sistrix + DataForSEO + Screaming Frog)

1. API-Keys konfigurieren (siehe SETUP.md)
2. Screaming Frog MCP Server starten
3. `/seo-rescue:recovery-full example.com` ausfuehren
4. Ergebnisse mit `data_quality: "good"` und `confidence: "high"` erhalten

## Output-Dateien

| Datei | Beschreibung |
|-------|-------------|
| `befund.json` | Diagnose-Ergebnis mit VI, Keywords, Backlinks, Core-Update-Korrelation |
| `issues.json` | Technische SEO-Issues mit Severity-Klassifikation |
| `action-plan.json` | Priorisierter Massnahmenplan mit Evidence und Risiko-Bewertung |
| `history.ndjson` | Zeitreihe der Recovery-Fortschritte (append-only) |

## Wichtige Felder in den Outputs

- `data_quality`: `good` (alle Daten frisch), `partial` (Teilinformationen), `poor` (nur Minimal-Daten)
- `confidence`: `high`, `medium`, `low` — nie hoeher als die schwaechste Datenquelle
- `providers_used`: welche Tools/Datenquellen genutzt wurden
- `missing_capabilities`: welche Capabilities nicht verfuegbar waren

## Wichtiger Hinweis

Keine SEO-Aenderungen werden automatisch umgesetzt. Alle Massnahmen im Action-Plan muessen manuell geprueft und freigegeben werden. Der `action-plan.json` enthaelt immer `requires_human_approval: true`.
