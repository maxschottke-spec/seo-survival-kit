# Recovery Workflow — Setup

## Voraussetzungen

- Claude Code installiert
- seo-rescue Plugin installiert (`/plugin marketplace add maxschottke-spec/seo-survival-kit`)
- Node.js 18+ (fuer Scripts)

## Plugin-Pfad

Nach Installation liegt das Plugin unter dem Claude Code Plugin-Verzeichnis. Die Recovery-Commands sind sofort verfuegbar via `/seo-rescue:recovery-*`.

## MCP-Konfiguration

### Screaming Frog MCP (optional)

Fuer `recovery-crawl` im Voll-Modus. Ohne SF MCP werden manuelle CSV-Imports genutzt; ohne CSV-Import bricht `recovery-crawl` mit Status `failed` ab.

### DataForSEO MCP (optional)

Fuer `recovery-diagnose` und `recovery-monitor`. Ohne DataForSEO werden GSC-CSVs oder manuelle Keyword-CSVs genutzt.

## Environment-Variablen

| Variable | Verwendung | Pflicht |
|----------|-----------|---------|
| `SISTRIX_API_KEY` | Sistrix Sichtbarkeitsindex | Nein |
| `DATAFORSEO_LOGIN` | DataForSEO API Login | Nein |
| `DATAFORSEO_PASSWORD` | DataForSEO API Passwort | Nein |
| `GOOGLE_API_KEY` | Google PageSpeed Insights | Nein |
| `SEO_CACHE_DIR` | Alternativer Cache-Pfad | Nein (Default: `~/.cache/seo-rescue/`) |

Keine dieser Variablen ist Pflicht. Das System funktioniert auch ohne kostenpflichtige API-Keys im Minimal-Modus.

## Cache-Verzeichnis

Standard: `~/.cache/seo-rescue/`

- Modus: `0700` (nur Owner)
- Symlinks werden verweigert
- Lock-Dateien verhindern parallele Writes
- Atomic Writes verhindern korrupte Dateien

## Sicherheit

- Keine API-Keys in Logs oder Artefakten
- `maskSecrets()` filtert Credentials aus allen Ausgaben
- Lock-Dateien enthalten PID und Token fuer Ownership-Pruefung
- Stale Locks werden nach 10 Minuten entfernt
