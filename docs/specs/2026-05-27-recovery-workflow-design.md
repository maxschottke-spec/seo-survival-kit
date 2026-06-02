# Recovery Workflow Automation — Claude Code Command Design Spec

**Date:** 2026-05-27
**Revised:** 2026-05-28
**Status:** Approved with implementation notes
**Scope:** 5 neue Claude Code Commands im seo-rescue Plugin plus Dokumentation, Tool-Fallbacks, Onboarding, Tests und Safety-Utilities.

---

## Ziel

Die manuellen Schritte der SEO-Recovery-Arbeit in wiederholbare, automatisierte Claude Code Commands giessen. Jeder Command einzeln nutzbar, plus ein Orchestrator der alle verkettet. Das System muss mit unterschiedlichen Tool-Setups funktionieren — von Vollausstattung (Sistrix + DataForSEO + Screaming Frog) ueber Teilsetup bis zum reinen CSV-/Lokal-Betrieb.

---

## Zielstruktur

```
plugins/seo-rescue/
├── CLAUDE.md
├── commands/
│   ├── recovery-diagnose.md
│   ├── recovery-crawl.md
│   ├── recovery-plan.md
│   ├── recovery-monitor.md
│   └── recovery-full.md
├── scripts/
│   ├── recovery-crawl.js
│   └── recovery-monitor.js
├── lib/
│   └── safe.js
├── references/
│   ├── RECOVERY_SYSTEM.md
│   ├── DECISION_ENGINE.md
│   └── CORE_UPDATES.md
├── schemas/
│   ├── befund.schema.json
│   ├── issues.schema.json
│   ├── action-plan.schema.json
│   └── history.schema.json
├── docs/
│   ├── ONBOARDING.md
│   ├── SETUP.md
│   ├── TOOL_PROVIDERS.md
│   ├── FALLBACKS.md
│   └── TROUBLESHOOTING.md
└── test-fixtures/
    ├── gsc/
    │   ├── queries.csv
    │   ├── pages.csv
    │   └── links.csv
    ├── crawl/
    │   ├── internal.csv
    │   ├── response-codes.csv
    │   ├── h1.csv
    │   ├── meta-descriptions.csv
    │   └── canonicals.csv
    ├── imports/
    │   ├── keywords.csv
    │   └── backlinks.csv
    └── expected/
        ├── befund.minimal.json
        ├── issues.minimal.json
        ├── action-plan.minimal.json
        └── history.minimal.ndjson
```

### Verzeichnis-Konventionen

| Verzeichnis | Inhalt | Regel |
|-------------|--------|-------|
| `commands/` | Markdown-Dateien, eine pro Command | Jede Datei ist ein eigenstaendiger Claude Code Command mit vollstaendigem Kontrakt |
| `scripts/` | Node.js-Scripts fuer script-backed Commands | Kein `package.json`, keine `npm install`-Abhaengigkeit, shared Safety aus `lib/` |
| `lib/` | Geteilte Primitives | `safe.js` mit allen Safety-Helpern |
| `references/` | Wissensbasis-Dokumente | Von Commands als Reasoning-Kontext referenziert, nicht direkt ausfuehrbar |
| `schemas/` | JSON-Schema-Definitionen | Validierbare Schemata fuer alle Output-Artefakte |
| `docs/` | Dokumentation und Onboarding | Setup, Tool-Provider, Fallbacks, Troubleshooting |
| `test-fixtures/` | Minimale Beispieldaten | Lokal testbar ohne externe APIs |

### Command-Datei-Pflichtabschnitte

Jede Command-Datei unter `commands/` muss enthalten:

- Zweck
- Trigger
- Input-Kontrakt
- Benoetigte Capabilities
- Bevorzugte Provider
- Fallback-Provider
- Ablauf
- Output-Pfad
- Output-Schema
- Fehlerbehandlung
- Validierungsregeln
- Graceful-Degradation-Regeln
- Datenqualitaetsregeln
- Human-Approval-Regeln (falls Massnahmen vorgeschlagen werden)

---

## Command-Uebersicht

| # | Command | Typ | Trigger | Funktion |
|---|---------|-----|---------|----------|
| 1 | `recovery-diagnose` | Markdown | `/seo-rescue:recovery-diagnose <domain>` | Diagnose mit bestmoeglicher Datenlage |
| 2 | `recovery-crawl` | Script | `/seo-rescue:recovery-crawl <domain>` | Crawl-Issues aus bester verfuegbarer Quelle |
| 3 | `recovery-plan` | Markdown | `/seo-rescue:recovery-plan <domain>` | Priorisierter, defensiver Recovery-Plan |
| 4 | `recovery-monitor` | Script | `/seo-rescue:recovery-monitor <domain>` | Monitoring mit Voll-, Teil- oder Minimaldaten |
| 5 | `recovery-full` | Markdown | `/seo-rescue:recovery-full <domain>` | Orchestrator: 1→2→3→4 sequenziell |

### Datenfluss

```
Domain → [1: Diagnose] → befund.json
                ↓
         [2: Crawl] → issues.json
                ↓
  befund + issues → [3: Plan] → action-plan.json
                ↓
         [4: Monitor] → history.ndjson (append)
```

---

## Gemeinsamer Input-Kontrakt

Alle Commands akzeptieren eine Domain als Argument. Die Normalisierung erfolgt einheitlich:

### Domain-Normalisierung

| Input | `input_domain` | `domain` | `canonical_domain` | `slug` |
|-------|----------------|----------|-------------------|--------|
| `example.com` | `example.com` | `example.com` | `null` | `example-com` |
| `https://example.com` | `https://example.com` | `example.com` | `null` | `example-com` |
| `https://example.com/pfad?q=1#f` | `https://example.com/pfad?q=1#f` | `example.com` | `null` | `example-com` |
| `www.example.com` | `www.example.com` | `www.example.com` | `null` | `www-example-com` |
| `https://www.example.com/pfad?q=1#f` | `https://www.example.com/pfad?q=1#f` | `www.example.com` | `null` | `www-example-com` |
| `http://www.example.com/` | `http://www.example.com/` | `www.example.com` | `null` | `www-example-com` |

**Regeln:**
1. Domain darf mit oder ohne Protokoll uebergeben werden.
2. Normalisierung entfernt ausschliesslich: Protokoll, Pfad, Query, Fragment, Trailing Slash.
3. `www.` wird **nicht** automatisch entfernt. `www.example.com` und `example.com` sind unterschiedliche Domains mit getrennten Cache-Verzeichnissen.
4. Jeder Command speichert immer vier Felder: `input_domain` (Original-Eingabe), `domain` (normalisierter Hostname), `canonical_domain` (bevorzugte Domain falls projektseitig bekannt, sonst `null`), `slug` (safeSlug-validierter Dateiname).
5. Der Slug wird ueber `safeSlug()` aus `plugins/seo-rescue/lib/safe.js` validiert.
6. Validierung schlaegt fehl bei: leerer Eingabe, unsicherem Hostname, Slug-Laenge >63 Zeichen, Zeichen ausserhalb `[a-z0-9_-]`, Pfad-Traversal, Slash oder Backslash im Slug.

**`canonical_domain`:** Wird nicht automatisch gesetzt. Kann projektseitig definiert werden wenn bekannt ist, dass z.B. `www.example.com` auf `example.com` kanonisiert. Ermoeglicht in Zukunft Cross-Referenz zwischen www- und non-www-Variante, ohne dass die Normalisierung Annahmen trifft.

---

## Storage- und Write-Safety-Regeln

### Verzeichnisstruktur

```
~/.cache/seo-rescue/
  www-example-com/
    .lock                 # Write-Lock
    befund.json           # Command 1 Output
    issues.json           # Command 2 Output
    action-plan.json      # Command 3 Output
    history.ndjson        # Command 4 Output (append-only)
    run.log               # Optionales Logging
    crawl/
      raw/                # Screaming Frog Exports
    imports/
      gsc/                # GSC CSV Imports
      keywords.csv        # Manuelle Keyword-CSV
      backlinks.csv       # Manuelle Backlink-CSV
      crawl/              # Manuelle Crawl-CSVs
```

Hinweis: `www.example.com` und `example.com` erzeugen getrennte Verzeichnisse (`www-example-com/` vs. `example-com/`). Zusammenfuehrung nur ueber `canonical_domain` wenn projektseitig definiert.

### Cache-Sicherheit

| Regel | Implementierung |
|-------|----------------|
| Verzeichnis-Modus | `0700` (nur Owner lesen/schreiben/traversieren) |
| Symlink-Verweigerung | Vor jedem Schreibvorgang pruefen, ob Ziel ein Symlink ist. Falls ja: abbrechen mit Fehler. |
| Pfad-Traversal | Slug darf keine `/`, `\`, `..` enthalten. `safeSlug()` lehnt diese ab. |
| Verzeichnis-Erstellung | `mkdirSync(path, { recursive: true, mode: 0o700 })` |
| Keine Writes ausserhalb | Kein Schreibvorgang ausserhalb `~/.cache/seo-rescue/{slug}/` |

### Locking

Da keine neuen npm-Dependencies erlaubt sind, kein `flock()` verwenden. Stattdessen dependency-free Node.js-Locking:

| Mechanismus | Beschreibung |
|-------------|-------------|
| **Lock-Erstellung** | `fs.openSync(lockPath, 'wx')` (exklusiv) |
| **Lock-Inhalt** | JSON mit `pid`, `timestamp`, `command`, `token` |
| **Polling** | Wenn Lock existiert: bis Timeout (Default 30s) pollen |
| **Stale Lock TTL** | Default 10 Minuten. Stale Locks duerfen nur nach Pruefung entfernt werden. |
| **Release** | `releaseLock()` loescht die Lock-Datei nur wenn sie zum eigenen Prozess/Token gehoert |

### Write-Helpers in `lib/safe.js`

Neue und bestehende Exports:

```js
safeSlug(input)                        // bestehend
normalizeDomain(input)                 // bestehend
ensureSafeDomainDir(slug)              // erweitert: erstellt auch Unterverzeichnisse
acquireLock(domainDir, command)        // erweitert: speichert pid, timestamp, command, token
releaseLock(lock)                      // erweitert: prueft Token-Ownership
atomicWriteJSON(filePath, data)        // erweitert: .tmp-{pid}-{timestamp} statt .tmp
appendNDJSON(filePath, entry)          // bestehend, muss mit Lock genutzt werden
safeReadJSON(filePath)                 // neu: size-capped JSON-Read mit Parse
safeReadLatestImport(dir, patterns)    // neu: neueste Datei aus Import-Verzeichnis
maskSecrets(value)                     // neu: maskiert API-Keys/Credentials in Strings
safeLog(domainDir, runId, message)     // neu: append an run.log mit maskSecrets
```

**Regeln:**
- Fuer finale JSON-Artefakte immer `atomicWriteJSON()` nutzen.
- `atomicWriteJSON()` schreibt zuerst in `*.tmp-{pid}-{timestamp}` und renamed danach auf das Ziel.
- `appendNDJSON()` muss mit Lock genutzt werden.
- `history.ndjson` ist append-only.
- Jede NDJSON-Zeile muss ein vollstaendiger JSON-Eintrag mit `\n`-Terminator sein.
- `writeFileExclusive()` bleibt als Legacy/Low-Level-Primitive.

---

## Run-ID und Artefakt-Versionierung

Jeder Command erzeugt eine `run_id`.

**Format:** `YYYYMMDD-HHMMSS-{short-random}`

Alle Artefakte enthalten:

```json
{
  "run_id": "20260527-210000-a1b2c3",
  "schema_version": "1.0.0"
}
```

`recovery-full` verwendet eine gemeinsame `run_id` fuer alle vier Schritte.

Schemas dokumentieren dieselbe Version. Breaking Changes erhoehen die Major Version.

---

## Gemeinsame Artefakt-Felder

Alle JSON-Outputs (`befund.json`, `issues.json`, `action-plan.json`, jede Zeile in `history.ndjson`) enthalten diese Standard-Felder:

```json
{
  "schema_version": "1.0.0",
  "run_id": "20260527-210000-a1b2c3",
  "status": "complete|partial|failed",
  "input_domain": "https://www.example.com/pfad?q=1#f",
  "domain": "www.example.com",
  "canonical_domain": null,
  "slug": "www-example-com",
  "timestamp": "2026-05-27T21:00:00Z",
  "warnings": [],
  "errors": [],
  "data_quality": "good|partial|poor",
  "confidence": "high|medium|low",
  "providers_used": [],
  "missing_capabilities": []
}
```

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `schema_version` | string | Semver der Schema-Version |
| `run_id` | string | Eindeutige Kennung des Laufs |
| `status` | enum | `complete` = alle Datenquellen erfolgreich. `partial` = mindestens eine wichtige Capability fehlt oder wurde per schwachem Fallback ersetzt. `failed` = keine minimale sinnvolle Ausgabe moeglich oder Sicherheits-/Validierungsfehler. |
| `input_domain` | string | Unveraenderte User-Eingabe |
| `domain` | string | Normalisierter Hostname (ohne Protokoll/Pfad/Query/Fragment, mit `www.` falls vorhanden) |
| `canonical_domain` | string\|null | Bevorzugte Domain falls projektseitig bekannt, sonst `null` |
| `slug` | string | safeSlug-validierter Dateiname |
| `timestamp` | string | ISO 8601 UTC |
| `warnings` | string[] | Nicht-kritische Probleme |
| `errors` | string[] | Kritische Fehler die zum `partial` oder `failed` Status fuehrten |
| `data_quality` | enum | `good` = alle kritischen Capabilities vorhanden, Daten frisch und vollstaendig. `partial` = mindestens eine wichtige Capability fehlt, sinnvoller Output aber moeglich. `poor` = nur kostenlose/minimale/lokale Daten vorhanden; Ergebnis stark eingeschraenkt. |
| `confidence` | enum | `high\|medium\|low` — darf nie hoeher sein als die schwaechste zentrale Datenquelle |
| `providers_used` | string[] | Liste genutzter Provider |
| `missing_capabilities` | string[] | Liste fehlender Capabilities |

**Prominentes Prinzip:**

> Kein Command darf eine hohe Sicherheit vortaeuschen, wenn nur schwache oder kostenlose Fallback-Daten genutzt wurden. Lieber `partial` + `low confidence` als vollstaendige, aber irrefuehrende Diagnose.

---

## Tool-Abstraktion und Fallback-Strategie

Commands duerfen nicht direkt von einem einzigen Tool abhaengig sein. Jeder Datenbedarf wird als Capability beschrieben.

### Capabilities

- `visibility_history` — Sichtbarkeitsverlauf ueber Zeit
- `keyword_rankings` — aktuelle Keyword-Positionen und -Volumen
- `backlink_summary` — Backlink-Profil und Referring Domains
- `crawl_issues` — technische SEO-Probleme aus Crawl
- `indexability_check` — Indexierungsstatus und -hindernisse
- `page_metadata` — Title, Meta Description, H1, Canonical, robots
- `serp_snapshot` — aktuelle SERP-Positionen fuer spezifische Keywords
- `core_update_dates` — Datums-Liste bekannter Google Core Updates

### Provider-Result-Format

```json
{
  "provider": "sistrix|dataforseo|screamingfrog|semrush|ahrefs|xovi|searchmetrics|se-ranking|sitebulb|jetoctopus|lumar|botify|gsc_csv|local_crawler|manual_csv|none",
  "capability": "visibility_history",
  "status": "complete|partial|failed|unavailable",
  "data_freshness": "fresh|stale|unknown",
  "confidence": "high|medium|low",
  "warnings": []
}
```

### Provider-Matrix

| Capability | Primary Provider | Paid Fallbacks | Free / Local Fallbacks | Wenn nichts verfuegbar |
|-----------|------------------|----------------|------------------------|-----------------------|
| `visibility_history` | Sistrix | Semrush, Ahrefs, Searchmetrics, Xovi | GSC CSV Export, manuell importierte CSV | Feld `null`, Status `partial`, keine harte Core-Update-Aussage |
| `keyword_rankings` | DataForSEO | Semrush, Ahrefs, Sistrix Keywords, SE Ranking | GSC CSV Export, manuelle Keyword-CSV | leeres Array, Status `partial`, Plan ohne Keyword-Priorisierung |
| `backlink_summary` | DataForSEO | Ahrefs, Majestic, Semrush Backlinks | GSC Links Export, manuelle Backlink-CSV | `backlink_profile: null`, Warning setzen |
| `crawl_issues` | Screaming Frog MCP | Sitebulb, JetOctopus, Lumar, Botify | lokaler Minimal-Crawler, manuelle Crawl-CSV | `issues.json` partial mit nur verfuegbaren Checks |
| `indexability_check` | Screaming Frog | Sitebulb, Lumar | robots.txt + sitemap + HTTP HEAD/GET + meta robots Parser | reduzierte Indexability-Wertung |
| `page_metadata` | Screaming Frog | Sitebulb | lokaler Fetch + HTML Parser | nur gecrawlte/fetchbare Seiten bewerten |
| `serp_snapshot` | DataForSEO | Semrush, Ahrefs, SE Ranking | manuelle CSV | SERP Snapshot auslassen |
| `core_update_dates` | `CORE_UPDATES.md` | gepflegte externe Referenz | manuell gepflegte Liste | `core_update_correlation: unknown` |

---

## Provider Selection Rules

- Nutze pro Capability den frischesten Provider mit hoechster Confidence.
- Bei gleicher Frische: Primary Provider bevorzugen.
- Paid Provider schlagen manuelle CSVs, wenn beide frisch sind.
- GSC kann Keyword- und Seitenentwicklung ersetzen, aber nicht den Sichtbarkeitsindex.
- Manuelle CSVs muessen immer als `confidence: low|medium` markiert werden, nie `high`.
- Wenn mehrere Provider widerspruechliche Daten liefern, keine harte Diagnose behaupten. Stattdessen Warning setzen und Confidence reduzieren.
- Provider-Rohdaten werden nicht in Hauptartefakte dupliziert.

---

## Datenfrische

### Frischegrenzen

| Quelle | Fresh wenn | Sonst |
|--------|-----------|-------|
| Sistrix / API-Daten | ≤ 7 Tage alt | `stale` |
| DataForSEO Live-Daten | aktueller Lauf | `stale` |
| GSC CSV | Exportdatum oder Datei-Modified-Date ≤ 14 Tage | `stale` |
| Manuelle CSV | Datei-Modified-Date ≤ 14 Tage | `stale` |
| Crawl-Daten | ≤ 7 Tage alt | `stale` |
| CORE_UPDATES.md | Datei-Modified-Date ≤ 90 Tage | `stale` |

### Regeln

- Stale Daten duerfen genutzt werden, muessen aber `data_freshness: "stale"` bekommen.
- Stale zentrale Daten reduzieren `confidence`.
- Wenn nur stale Daten verfuegbar sind, hoechstens `data_quality: "partial"`.

---

## Kostenlose / lokale Fallbacks

### Google Search Console CSV

Unterstuetzte Imports:

- Leistungsbericht nach Suchanfragen
- Leistungsbericht nach Seiten
- Links-Export
- Indexierungs-/Abdeckungs-Export, falls vorhanden

Cache-Pfad: `~/.cache/seo-rescue/{slug}/imports/gsc/`

Dateiformate: CSV oder JSON. Command soll vorhandene Dateien automatisch erkennen. Wenn mehrere Dateien vorhanden sind, neueste verwenden. Importierte Daten immer mit `provider: "gsc_csv"` markieren.

### Manuelle Keyword-CSV

Pfad: `~/.cache/seo-rescue/{slug}/imports/keywords.csv`

Erwartete Spalten:

| Spalte | Pflicht | Beschreibung |
|--------|---------|-------------|
| `keyword` | ja | Suchbegriff |
| `position` | ja | Aktuelle Position |
| `previous_position` | nein | Vorherige Position |
| `volume` | nein | Monatliches Suchvolumen |
| `url` | nein | Rankende URL |
| `intent` | nein | commercial, informational, navigational, transactional |

### Manuelle Backlink-CSV

Pfad: `~/.cache/seo-rescue/{slug}/imports/backlinks.csv`

Erwartete Spalten:

| Spalte | Pflicht | Beschreibung |
|--------|---------|-------------|
| `source_url` | ja | Linkgebende URL |
| `target_url` | ja | Ziel-URL |
| `domain` | nein | Linkgebende Domain |
| `nofollow` | nein | true/false |
| `authority` | nein | Domain Authority/Rating |
| `status` | nein | HTTP Status des Links |

### Manuelle Crawl-CSV

Pfad: `~/.cache/seo-rescue/{slug}/imports/crawl/`

Erwartete moegliche Dateien: `internal.csv`, `response-codes.csv`, `h1.csv`, `meta-descriptions.csv`, `canonicals.csv`, `inlinks.csv`

### Lokaler Minimal-Crawler

Wenn Screaming Frog nicht verfuegbar ist:

1. Sitemap aus `/sitemap.xml` lesen
2. Bis zu 100 URLs pruefen
3. HTTP Status pruefen
4. canonical tag pruefen
5. title extrahieren
6. meta description extrahieren
7. h1 extrahieren
8. robots meta pruefen
9. interne Links optional oberflaechlich sammeln

**Limits:**

| Regel | Wert |
|-------|------|
| Max URLs | 100 |
| Timeout pro Request | 10 Sekunden |
| User-Agent | `seo-rescue-local-crawler` |
| robots.txt | respektieren, sofern abrufbar |
| Formulare | nicht ausfuellen |
| Login-Bereiche | nicht crawlen |
| Externe Links | nicht crawlen |
| Rate Limit | maximal 1 Request pro Sekunde |

Output: `issues.json` mit `data_quality: "poor"` oder `"partial"`, aber kein harter Abbruch.

---

## Abbruchregeln

**Grundregel:** Ein Command bricht nur ab, wenn keine minimale sinnvolle Ausgabe erzeugt werden kann oder Domain/Input/Cache-Sicherheit verletzt ist.

### Graceful Degradation

| Situation | Verhalten |
|-----------|----------|
| Sistrix fehlt | weiter mit GSC/Semrush/Ahrefs/CSV oder `vi_* = null` |
| DataForSEO fehlt | weiter mit GSC-Keyword-CSV oder leerem Keyword-Set |
| Backlinkdaten fehlen | weiter mit `backlink_profile = null` |
| Screaming Frog fehlt | lokaler Minimal-Crawler oder manuelle Crawl-CSV verwenden |
| Core-Update-Daten fehlen/veraltet | `core_update_correlation = "unknown"` |

### Harte Fehler (Abbruch)

- Ungueltige Domain
- Cache-Pfad unsicher
- Lock kann nicht erworben werden
- Keine einzige Datenquelle fuer den jeweiligen Command verfuegbar
- Output-Schema kann auch nach Fallback nicht erfuellt werden

### Exit Codes fuer Scripts

| Code | Bedeutung |
|------|----------|
| `0` | `complete` oder `partial`, Output wurde geschrieben |
| `1` | `failed`, kein nutzbarer Output |
| `2` | Sicherheits-/Validierungsfehler |
| `3` | Lock Timeout |

---

## Command 1: `recovery-diagnose` (Markdown)

### Zweck
Automatische Diagnose einer Domain mit bestmoeglicher Datenlage. Primaer Sistrix + DataForSEO, aber mit bezahlten, kostenlosen und manuellen Fallbacks.

### Trigger
`/seo-rescue:recovery-diagnose <domain>`

### Input-Kontrakt
- `<domain>` — Domain gemaess gemeinsamer Normalisierung
- Keine weiteren Argumente

### Capabilities

| Capability | Pflicht | Verwendung |
|-----------|---------|-----------|
| `visibility_history` | nein | VI-Verlauf, Core-Update-Korrelation |
| `keyword_rankings` | nein | Position-Verteilung, Quick Wins, Top Losers |
| `backlink_summary` | nein | Backlink-Profil |
| `core_update_dates` | nein | Korrelationspruefung |
| `serp_snapshot` | nein | Optionale Anreicherung |

### Bevorzugte Provider
- Sistrix fuer VI / Sichtbarkeitsverlauf
- DataForSEO fuer Keywords, Backlinks, Domain-Metriken

### Paid Fallbacks
Semrush, Ahrefs, Xovi, Searchmetrics, SE Ranking

### Free / Local Fallbacks
GSC CSV, manuelle Keyword-CSV, manuelle Backlink-CSV, `references/CORE_UPDATES.md`

### Ablauf
1. **Domain normalisieren** — Input → `input_domain`, `domain`, `canonical_domain`, `slug`
2. **Run-ID erzeugen** — `YYYYMMDD-HHMMSS-{random}`
3. **Cache-Verzeichnis** anlegen/pruefen — `~/.cache/seo-rescue/{slug}/`
4. **Lock** acquiren
5. **Sichtbarkeit abrufen** — Sistrix VI (primaer) → Paid Fallbacks → GSC CSV → `null`
6. **Keyword-Analyse** — DataForSEO `ranked_keywords/live` (primaer) → Paid Fallbacks → GSC CSV → manuelle Keyword-CSV → leeres Set
7. **Backlink-Profil** — DataForSEO `backlinks/summary/live` (primaer) → Paid Fallbacks → GSC Links CSV → manuelle Backlink-CSV → `null`
8. **Core-Update-Korrelation** — `references/CORE_UPDATES.md` pruefen. Wenn Datei aelter als 90 Tage: maximal `correlation: "low"` oder `"unknown"`.
9. **Diagnosis-Klassifikation** — Bestimme `diagnosis` und `severity`
10. **Befund assemblieren** — Schema-konformes JSON mit `providers_used`, `missing_capabilities`, `data_quality`, `confidence`
11. **Schema validieren** — gegen `schemas/befund.schema.json`
12. **Atomic Write** — `befund.json.tmp-{pid}-{ts}` → `befund.json`
13. **Lock** releasen

### Diagnosis-Klassifikation

**`diagnosis`:**
- `core-update`: VI-Drop korreliert mit Core Update (correlation high/medium) UND breiter Keyword-Verlust
- `technical`: Crawl-Fehler dominieren, kein Core-Update-Timing
- `content`: Thin-Content-Signale, wenige Rankings trotz indexierter Seiten
- `mixed`: Kombination aus mehreren Faktoren
- `healthy`: Kein signifikanter Drop, stabile Rankings

**Wenn kein VI verfuegbar:** Diagnose darf `technical`, `content`, `mixed` oder `healthy` sein, aber nicht sicher `core-update`.

**`severity`:**
- `critical`: VI-Drop > 40%
- `high`: VI-Drop > 20%
- `medium`: VI-Drop > 10%
- `low`: VI-Drop ≤ 10%

### Output-Pfad
`~/.cache/seo-rescue/{slug}/befund.json`

### Output-Schema
Definiert in `schemas/befund.schema.json`. Beispiel:

```json
{
  "schema_version": "1.0.0",
  "run_id": "20260527-210000-a1b2c3",
  "status": "partial",
  "input_domain": "https://www.example.com",
  "domain": "www.example.com",
  "canonical_domain": null,
  "slug": "www-example-com",
  "timestamp": "2026-05-27T21:00:00Z",
  "warnings": ["Sistrix API not available, using GSC CSV fallback"],
  "errors": [],
  "data_quality": "partial",
  "confidence": "medium",
  "providers_used": ["gsc_csv", "dataforseo"],
  "missing_capabilities": ["visibility_history"],
  "vi_current": null,
  "vi_peak": null,
  "vi_drop_pct": null,
  "vi_trend_4w_pct": null,
  "vi_trend_12w_pct": null,
  "core_update_correlation": "unknown",
  "core_update_name": null,
  "keywords_total": 1330,
  "position_distribution": {
    "t3": 45,
    "t10": 120,
    "t20": 280,
    "t50": 600,
    "t100": 1330
  },
  "quick_wins": [
    { "keyword": "matratze 140x200", "position": 12, "volume": 880, "intent": "commercial" }
  ],
  "top_losers": [
    { "keyword": "lattenrost 140x200", "position_before": 5, "position_after": 42, "volume": 2400 }
  ],
  "backlink_profile": {
    "referring_domains": 291,
    "total_backlinks": 1850,
    "dofollow_pct": 42,
    "nofollow_pct": 58,
    "spam_score": 38,
    "broken_backlinks": 5
  },
  "diagnosis": "core-update",
  "severity": "high",
  "recovery_stage_estimate": "R2",
  "summary_de": "Freitext-Zusammenfassung der Diagnose auf Deutsch",
  "source_notes": [
    {
      "field": "keywords_total",
      "source": "dataforseo.ranked_keywords.live",
      "note": "Location 2276 (Germany), limit 100"
    }
  ]
}
```

**Hinweis:** Beispielwerte sind illustrativ und duerfen niemals uebernommen werden.

### Fehlerbehandlung
| Fehler | Verhalten | Status |
|--------|----------|--------|
| Sistrix nicht erreichbar | Warnung, weiter ohne VI-Daten. `vi_*` = `null`. | `partial` |
| DataForSEO MCP nicht verfuegbar | Warnung, weiter mit GSC/CSV oder leerem Keyword-Set. | `partial` |
| Keine einzige Datenquelle verfuegbar | Fehler, Abbruch. | `failed` |
| Domain nicht aufloesbar | Fehler, Abbruch. | `failed` |
| Lock nicht erwerbbar (Timeout 30s) | Fehler, Abbruch. | `failed` |

### Graceful-Degradation-Regeln
- Kein VI verfuegbar → `vi_* = null`, Core-Update-Korrelation maximal `unknown`
- Keine Keyworddaten → `keywords_total = 0`, `quick_wins = []`, `top_losers = []`, Warning, Status `partial`
- Keine Backlinkdaten → `backlink_profile = null`, Warning, Status `partial`
- Alle drei fehlen → Status `failed`

### Datenqualitaetsregeln
- `data_quality = "good"` nur wenn VI + Keywords + Backlinks alle `fresh` und `complete`
- `data_quality = "partial"` wenn mindestens eine zentrale Capability fehlt oder `stale`
- `data_quality = "poor"` wenn nur kostenlose/manuelle Daten verfuegbar

### Validierungsregeln
- `vi_drop_pct` muss negativ sein wenn `vi_current < vi_peak`
- `position_distribution` Werte muessen monoton steigend sein (t3 ≤ t10 ≤ t20 ≤ t50 ≤ t100)
- `dofollow_pct + nofollow_pct` muss 100 ergeben (±1 Rundungsfehler)
- `diagnosis` muss einer der Werte sein: `core-update | technical | content | mixed | healthy`
- `severity` muss einer der Werte sein: `critical | high | medium | low`
- Fehlende Capabilities muessen in `missing_capabilities` stehen
- Genutzte Provider muessen in `providers_used` stehen

---

## Command 2: `recovery-crawl` (Script-backed)

### Zweck
Crawl-Issues aus der besten verfuegbaren Quelle erzeugen. Primaer Screaming Frog MCP, aber mit Export- und lokalem Minimal-Crawler-Fallback.

### Trigger
`/seo-rescue:recovery-crawl <domain>`

### Input-Kontrakt
- `<domain>` — Domain gemaess gemeinsamer Normalisierung
- Keine weiteren Argumente

### Capabilities

| Capability | Pflicht | Verwendung |
|-----------|---------|-----------|
| `crawl_issues` | ja (mit Fallback) | Broken Links, Redirects, Status Codes |
| `indexability_check` | nein | Canonical, robots meta, noindex |
| `page_metadata` | nein | Title, H1, Meta Description |

### Bevorzugte Provider
Screaming Frog MCP

### Paid Fallbacks
Sitebulb, JetOctopus, Lumar, Botify

### Free / Local Fallbacks
Manuelle Crawl-CSV, lokaler Minimal-Crawler

### Verantwortlichkeits-Trennung

**Claude-Aufgaben:**
- Domain normalisieren
- Cache-Verzeichnis anlegen
- Crawl via Screaming-Frog-MCP starten, falls verfuegbar
- Crawl-Fortschritt ueberwachen
- Bulk-Exports erzeugen und nach `~/.cache/seo-rescue/{slug}/crawl/raw/` speichern
- Wenn SF nicht verfuegbar: nach vorhandenen Crawl-Exports suchen, falls keine: lokalen Minimal-Crawler verwenden
- Danach `scripts/recovery-crawl.js` aufrufen

**Script-Aufgaben (`scripts/recovery-crawl.js`):**
- Lokale Exports aus `crawl/raw/` oder `imports/crawl/` lesen
- Issues normalisieren
- Technische Severity klassifizieren
- Gegen `schemas/issues.schema.json` validieren
- `issues.json` per `atomicWriteJSON()` schreiben

### Script CLI Contract

```bash
node scripts/recovery-crawl.js --domain example.com --cache-dir ~/.cache/seo-rescue/example-com
```

Exit Codes: `0` = complete/partial, `1` = failed, `2` = Sicherheitsfehler, `3` = Lock Timeout

### Ablauf
1. **Domain normalisieren**
2. **Run-ID erzeugen**
3. **Cache-Verzeichnis** anlegen
4. **Lock** acquiren
5. **Crawl starten** via `sf_crawl` (max 500 URLs) oder Fallback
6. **Fortschritt** ueberwachen (SF MCP) oder Fallback-Daten laden
7. **Bulk-Exports** generieren oder Import-CSVs lesen
8. **Issues klassifizieren** via `scripts/recovery-crawl.js`
9. **Schema validieren**
10. **Atomic Write** — `issues.json`
11. **Lock** releasen

### Output-Pfad
`~/.cache/seo-rescue/{slug}/issues.json`

### Output-Schema
Definiert in `schemas/issues.schema.json`. Beispiel:

```json
{
  "schema_version": "1.0.0",
  "run_id": "20260527-211500-b2c3d4",
  "status": "complete",
  "input_domain": "https://www.example.com",
  "domain": "www.example.com",
  "canonical_domain": null,
  "slug": "www-example-com",
  "timestamp": "2026-05-27T21:15:00Z",
  "warnings": [],
  "errors": [],
  "data_quality": "good",
  "confidence": "high",
  "providers_used": ["screamingfrog"],
  "missing_capabilities": [],
  "crawl_limit": 500,
  "crawled_internal_html_urls": 500,
  "exported_rows_total": 514,
  "raw_exports_used": ["4xx", "3xx", "h1_missing", "h1_duplicate", "meta_missing", "canonicals", "internal_all"],
  "crawler_provider": "screamingfrog",
  "local_crawler_used": false,
  "issues": [
    {
      "type": "broken_internal_link",
      "severity": "critical",
      "count": 438,
      "affected_urls": 15,
      "details": [
        {
          "target": "/matratzen-topper-180x200/",
          "status": 404,
          "inlink_count": 106,
          "top_sources": ["/produkt-a/", "/produkt-b/"]
        }
      ]
    }
  ],
  "summary": {
    "critical": 2,
    "high": 5,
    "medium": 8,
    "low": 12,
    "total_issues": 27
  }
}
```

### Issue-Typen und Severity-Mapping

| Issue-Typ | Default-Severity | Upgrade-Bedingung |
|-----------|-----------------|-------------------|
| `broken_internal_link` | high | → critical wenn >100 Inlinks betroffen |
| `redirect_chain` | medium | → high wenn `original_topic_lost` |
| `non_indexable_canonical` | high | kein Upgrade im Crawl (Traffic-Upgrades erst in `recovery-plan`) |
| `missing_h1` | medium | — |
| `duplicate_h1` | low | → medium wenn >10 Pages |
| `missing_meta_description` | low | — |
| `orphan_page` | medium | — |

### Fehlerbehandlung
| Fehler | Verhalten | Status |
|--------|----------|--------|
| SF MCP nicht verfuegbar | Fallback auf Import-CSV oder Minimal-Crawler. | `partial` |
| Crawl bricht ab | Export der bis dahin gecrawlten URLs. | `partial` |
| Kein Crawl und keine Import-Daten | Fehler, kein nutzbarer Output. | `failed` |
| Lock nicht erwerbbar | Fehler, Abbruch. | `failed` |

### Graceful-Degradation-Regeln
- SF fehlt + Import-CSV vorhanden → `data_quality: "partial"`, `crawler_provider: "manual_csv"`
- SF fehlt + kein Import + lokaler Crawler → `data_quality: "poor"`, `local_crawler_used: true`
- SF fehlt + kein Import + kein Crawler → `failed`

### Validierungsregeln
- `crawled_internal_html_urls` muss > 0 sein (sonst `failed`)
- `summary.total_issues` muss gleich Summe aus critical+high+medium+low sein
- Jeder Issue-Eintrag muss `type`, `severity`, `count` enthalten
- `severity` muss einer der Werte sein: `critical | high | medium | low`

---

## Command 3: `recovery-plan` (Markdown)

### Zweck
Aus allen verfuegbaren Diagnose-, Crawl-, Import- und Referenzdaten einen priorisierten, defensiven Recovery-Plan erzeugen.

### Trigger
`/seo-rescue:recovery-plan <domain>`

### Input-Kontrakt
- `<domain>` — Domain gemaess gemeinsamer Normalisierung
- **Flexible Voraussetzungen:** Mindestens eines der Artefakte `befund.json`, `issues.json` oder Import-Dateien muss verfuegbar sein.

### Capabilities
- Priorisierte Auswertung vorhandener Artefakte
- Evidence-basiertes Massnahmen-Sequencing
- Risiko-Bewertung

### Input-Flexibilitaet

| Situation | Verhalten |
|-----------|----------|
| `befund.json` + `issues.json` vorhanden | Vollstaendiger Plan |
| Nur `befund.json` vorhanden | Diagnose-/Content-/Keyword-Plan |
| Nur `issues.json` vorhanden | Technischer Recovery-Plan |
| Beide fehlen, aber Imports vorhanden | Minimal-Plan aus Imports |
| Nichts vorhanden | `failed` |

### Ablauf
1. **Domain normalisieren**
2. **Run-ID erzeugen**
3. **Inputs laden** — `befund.json`, `issues.json`, Import-Dateien aus Cache
4. **Input-Validierung** — mindestens eine Quelle muss nutzbar sein
5. **Lock** acquiren
6. **Recovery-Phase bestimmen** (R1–R5) — Referenz: `references/RECOVERY_SYSTEM.md`
7. **Do-Not-Touch-Liste** erstellen — stabile Top-10 Keywords identifizieren
8. **Issues priorisieren** — Impact × Aufwand × Risiko. Referenz: `references/DECISION_ENGINE.md`
9. **Keyword-/Traffic-Severity-Upgrades** — hier, nicht im Crawl
10. **30/60/90-Tage-Plan** generieren
11. **Risiko bewerten** (green/yellow/red/black)
12. **Schema validieren**
13. **Atomic Write** — `action-plan.json`
14. **Lock** releasen

### Priorisierungs-Logik
1. **Protect Winners** (R1) — Nichts anfassen was rankt. Do-Not-Touch.
2. **Stop Bleeding** — 404s fixen, Redirect-Chains aufloesen, Canonical-Fehler korrigieren
3. **Quick Wins** — Keywords Pos 4–20 mit hohem Volumen staerken
4. **Authority Building** — Content-Luecken schliessen, E-E-A-T staerken
5. **Expansion** — Neue Keywords nur wenn R1–R4 stabil

### Evidence-Pflicht

Jede Action braucht ein `evidence`-Array:

```json
{
  "evidence": [
    "issues.json: broken_internal_link count=438 affected_urls=15",
    "befund.json: vi_drop_pct=-30.3",
    "RECOVERY_SYSTEM.md: stop_bleeding priority in R2"
  ]
}
```

Actions ohne harte Datenbasis bekommen `risk: "yellow"` oder hoeher, niemals automatisch `green`.

### Batch-Change-Limit
- Gilt vor allem fuer Content-, Template-, Canonical- und interne Linkstruktur-Aenderungen auf rankingrelevanten Seiten.
- Eindeutige 404-Redirect-Fixes duerfen gebuendelt umgesetzt werden, wenn Ziel-URLs fachlich eindeutig sind.
- Default: max 3–5 URL-Aenderungen/Tag fuer risikobehaftete Massnahmen.

### Human Approval Gate

```json
{
  "requires_human_approval": true,
  "implementation_status": "proposed"
}
```

Kein Command darf `implementation_status` auf `implemented` setzen.

> **Der Plan setzt keine SEO-Aenderungen automatisch um. Er dient der menschlichen Freigabe.**

### Output-Pfad
`~/.cache/seo-rescue/{slug}/action-plan.json`

### Output-Schema
Definiert in `schemas/action-plan.schema.json`. Beispiel:

```json
{
  "schema_version": "1.0.0",
  "run_id": "20260527-213000-c3d4e5",
  "status": "complete",
  "input_domain": "https://www.example.com",
  "domain": "www.example.com",
  "canonical_domain": null,
  "slug": "www-example-com",
  "timestamp": "2026-05-27T21:30:00Z",
  "warnings": [],
  "errors": [],
  "data_quality": "good",
  "confidence": "high",
  "providers_used": ["sistrix", "dataforseo", "screamingfrog"],
  "missing_capabilities": [],
  "requires_human_approval": true,
  "implementation_status": "proposed",
  "current_phase": "R2",
  "next_phase_criteria": "VI stabil ueber 0.12 fuer 4 Wochen",
  "do_not_touch": [
    { "keyword": "markenname matratze", "position": 1, "reason": "stable_winner" }
  ],
  "actions": [
    {
      "priority": 1,
      "timeline": "30d",
      "action": "301-Redirects fuer 15 tote URLs einrichten",
      "type": "redirect_fix",
      "risk": "green",
      "impact": "high",
      "effort": "low",
      "affected_urls": 15,
      "inlinks_recovered": 438,
      "source_issue": "broken_internal_link",
      "batch_limit": null,
      "evidence": [
        "issues.json: broken_internal_link count=438 affected_urls=15",
        "RECOVERY_SYSTEM.md: stop_bleeding priority in R2"
      ]
    }
  ],
  "expected_impact": {
    "vi_recovery_pct": "+25-50%",
    "timeline_weeks": "8-12",
    "confidence": "medium"
  }
}
```

### Fehlerbehandlung
| Fehler | Verhalten | Status |
|--------|----------|--------|
| Kein Artefakt und kein Import vorhanden | Fehler, Abbruch. | `failed` |
| Nur Teilinformationen vorhanden | Plan mit Einschraenkungen und Warnings. | `partial` |
| Lock nicht erwerbbar | Fehler, Abbruch. | `failed` |

### Datenqualitaetsregeln
- Keine aggressiven Empfehlungen bei `data_quality: "poor"`
- Keine `confidence: "high"` bei fehlenden zentralen Artefakten
- Klare Warnings wenn Plan auf Teilinformationen basiert

### Validierungsregeln
- `current_phase`: `R1 | R2 | R3 | R4 | R5`
- `actions[].risk`: `green | yellow | red | black`
- `actions[].impact`: `critical | high | medium | low`
- `actions[].effort`: `low | medium | high`
- `actions` sortiert nach `priority` aufsteigend
- `batch_limit` gesetzt wenn `risk != "green"` (fuer rankingrelevante Aenderungen)
- `requires_human_approval` muss `true` sein
- `implementation_status` muss `"proposed"` sein
- Jede Action muss `evidence` Array enthalten

---

## Command 4: `recovery-monitor` (Script-backed)

### Zweck
Monitoring soll mit Vollsetup, Teilsetup oder minimalen lokalen Daten laufen koennen.

### Trigger
`/seo-rescue:recovery-monitor <domain>`

### Input-Kontrakt
- `<domain>` — Domain gemaess gemeinsamer Normalisierung
- **Optional:** `befund.json`, `issues.json`, Import-Dateien im Cache

### Capabilities

| Capability | Pflicht | Verwendung |
|-----------|---------|-----------|
| `visibility_history` | nein | VI-Trend |
| `keyword_rankings` | nein | Keyword-Stabilitaet |
| `backlink_summary` | nein | Backlink-Trend |
| `crawl_issues` | nein | Issue-Reduktion |

### Fallbacks
- GSC CSV Zeitvergleich
- Manuelle Keyword-CSV
- Zuletzt bekannter `befund.json`-Stand
- Zuletzt bekannter `history.ndjson`-Eintrag

### Script CLI Contract

```bash
node scripts/recovery-monitor.js --domain example.com --cache-dir ~/.cache/seo-rescue/example-com
```

Exit Codes: `0` = complete/partial, `1` = failed, `2` = Sicherheitsfehler, `3` = Lock Timeout

### Recovery-Score-Formel

```
score =
  vi_trend_score * 0.30 +
  keyword_stability_score * 0.25 +
  quick_win_score * 0.20 +
  issue_reduction_score * 0.15 +
  backlink_quality_score * 0.10
```

### Komponenten-Normalisierung

**`vi_trend_score`:**
- +10% oder mehr seit Baseline = 100
- 0% = 50
- -10% oder schlechter = 0
- Linear dazwischen

**`keyword_stability_score`:**
- Anteil der Baseline-Top-10-Keywords, die weiterhin Top 10 sind
- 100% erhalten = 100, 50% = 50, 0% = 0

**`quick_win_score`:**
- Anteil der Quick-Win-Keywords, die sich um mindestens 3 Positionen verbessert haben oder Top 10 erreicht haben

**`issue_reduction_score`:**
- Prozentualer Rueckgang offener `critical` + `high` Issues gegenueber Baseline
- Falls kein frischer Crawl vorhanden: Wert aus letztem History-Eintrag uebernehmen, `issue_data_fresh: false`

**`backlink_quality_score`:**
- Kombination aus referring_domains_delta, dofollow_pct_delta, spam_score_delta (invertiert)
- Wenn Backlinkdaten fehlen: neutral mit 50 bewerten, Warning setzen

### Score-Berechnung bei fehlenden Daten
- Score nur berechnen wenn mindestens zwei Komponenten vorhanden sind
- Sonst `score: null`
- `data_quality: "poor"`
- Klare Warning setzen

### Output-Pfad
`~/.cache/seo-rescue/{slug}/history.ndjson` (append-only)

### Output-Schema
Definiert in `schemas/history.schema.json`. Jede Zeile:

```json
{"schema_version":"1.0.0","run_id":"20260527-210000-d4e5f6","status":"complete","input_domain":"www.example.com","domain":"www.example.com","canonical_domain":null,"slug":"www-example-com","timestamp":"2026-05-27T21:00:00Z","warnings":[],"errors":[],"data_quality":"good","confidence":"high","providers_used":["sistrix","dataforseo"],"missing_capabilities":[],"vi":0.108,"vi_delta_pct":2.3,"score":62,"phase":"R2","keywords_t10":120,"keywords_t10_delta":5,"top_losers_recovered":3,"issues_open":27,"issues_fixed":12,"issue_data_fresh":true,"component_scores":{"vi_trend_score":65,"keyword_stability_score":80,"quick_win_score":55,"issue_reduction_score":40,"backlink_quality_score":50}}
```

### Fehlerbehandlung
| Fehler | Verhalten | Status |
|--------|----------|--------|
| Sistrix nicht erreichbar | Warnung, `vi` = `null`, Score ohne VI-Komponente. | `partial` |
| DataForSEO nicht verfuegbar | Warnung, Keyword-Stabilitaet aus CSV/letztem Eintrag. | `partial` |
| Keine Datenquelle verfuegbar | Eintrag mit `score: null`, `data_quality: "poor"`. | `partial` |
| `history.ndjson` corrupt | Warnung, kein Delta, aktueller Eintrag wird trotzdem geschrieben. | `partial` |
| Lock nicht erwerbbar | Fehler, Abbruch. | `failed` |

### Validierungsregeln
- `score`: 0–100 oder `null`
- `phase`: `R1 | R2 | R3 | R4 | R5`
- `vi` > 0 oder `null`
- Jede NDJSON-Zeile mit `\n` terminiert und als eigenstaendiges JSON parsebar
- Wenn kein frischer Crawl: `issues_fixed` nicht neu behaupten, `issue_data_fresh: false`

---

## Command 5: `recovery-full` (Orchestrator)

### Zweck
Ein vollstaendiger Recovery-Workflow, der die Workflows der vier Einzelcommands sequenziell nach denselben Vertraegen ausfuehrt.

### Trigger
`/seo-rescue:recovery-full <domain>`

### Input-Kontrakt
- `<domain>` — Domain gemaess gemeinsamer Normalisierung
- Keine weiteren Argumente

### Ablauf

Der Orchestrator fuehrt die gleichen Workflows und Output-Vertraege sequenziell aus. Er ruft nicht zwingend Slash-Commands als Subcommands auf.

```
1. Domain normalisieren (einmalig)
2. Gemeinsame run_id erzeugen

3. "Starte Diagnose fuer {domain}..."
   → recovery-diagnose Workflow ausfuehren
   → Kurz-Befund ausgeben
   → Bei status=failed UND keine alternative Datenquelle: Abbruch
   → Bei status=failed MIT Fallback-Moeglichkeit: Fallback versuchen

4. "Starte Crawl..."
   → recovery-crawl Workflow ausfuehren
   → Issue-Summary ausgeben
   → Bei status=failed: Minimal-Crawler oder Import-Fallback versuchen

5. "Erstelle Action-Plan..."
   → recovery-plan Workflow ausfuehren
   → Top-5 Massnahmen ausgeben

6. "Richte Monitoring ein..."
   → recovery-monitor Workflow ausfuehren (initialer Baseline)
   → Recovery-Score ausgeben

7. Zusammenfassung
```

### Statuslogik
- `complete`: alle vier Schritte `complete`
- `partial`: mindestens ein nicht-kritischer Schritt `partial` oder `failed`
- `failed`: Diagnose ist `failed` und keine alternative Datenquelle verfuegbar

### Finale Zusammenfassung muss enthalten:
- Status je Schritt
- Wichtigste Diagnose
- Wichtigste technische Issues
- Top-5 Actions
- Initialer Recovery-Score
- Pfade zu allen erzeugten Artefakten
- Gesammelte Warnings/Errors
- Genutzte Provider
- Fehlende Capabilities
- Welche Ergebnisse nur eingeschraenkt belastbar sind
- Welche naechsten manuellen Schritte noetig sind

---

## Output-Schemas und Schema Policy

Alle JSON-Schemas erweitern um:

```json
{
  "schema_version": { "const": "1.0.0" },
  "run_id": { "type": "string" },
  "data_quality": { "enum": ["good", "partial", "poor"] },
  "confidence": { "enum": ["high", "medium", "low"] },
  "providers_used": { "type": "array", "items": { "type": "string" } },
  "missing_capabilities": { "type": "array", "items": { "type": "string" } },
  "canonical_domain": { "type": ["string", "null"] }
}
```

### Schema Policy
- Schemas sollen `additionalProperties: false` nur fuer stabile Top-Level-Strukturen nutzen.
- Provider-spezifische Rohdaten duerfen nicht in Hauptartefakte geschrieben werden.
- Grosse Rohdaten bleiben unter `crawl/raw/` oder `imports/`.
- Null-Werte sind erlaubt, wenn eine Capability fehlt.
- Fehlende Pflichtfelder sind nicht erlaubt.
- Jeder `null`-Wert fuer zentrale Felder braucht eine Warning oder Missing-Capability.
- Jeder Command muss vor finalem Schreiben gegen das passende Schema validieren.
- Wenn Validierung fehlschlaegt: Artefakt nicht final schreiben, Fehler in `errors`, Status auf `failed` oder `partial`.

---

## Core-Update-Referenz

`references/CORE_UPDATES.md` Regeln:

- Die Liste muss regelmaessig gepflegt werden.
- Wenn die Liste aelter als 90 Tage ist, darf keine `high` Core-Update-Korrelation behauptet werden.
- In diesem Fall `core_update_correlation` auf `unknown` oder maximal `low` setzen.
- Falls keine vertrauenswuerdigen Daten vorhanden sind, keine Core-Update-Diagnose behaupten.

---

## Rohdaten- und Datenschutz-Policy

- Rohdaten werden lokal im Cache gespeichert.
- Keine Rohdaten an externe Dienste senden, ausser der jeweilige Provider wurde explizit als Datenquelle genutzt.
- Keine API-Keys in Logs, Artefakten oder Fehlermeldungen speichern.
- Keine vollstaendigen Credential-Werte aus `.env` ausgeben.
- Fehlerausgaben muessen Secrets maskieren (`maskSecrets()`).
- Grosse Rohdaten nicht in `befund.json`, `issues.json`, `action-plan.json` duplizieren.
- Provider-Antworten, die personenbezogene oder sensible Daten enthalten koennten, nur als lokale Rohdaten speichern und in Artefakten zusammenfassen.

---

## Logging

Pro Domain optional: `~/.cache/seo-rescue/{slug}/run.log`

**Regeln:**
- Keine Secrets
- Jeder Command loggt Start, Ende, Provider-Auswahl, Warnings, Errors
- Logs sind hilfreich, aber nicht Voraussetzung fuer Outputs
- Bei `recovery-full` gemeinsame `run_id` verwenden
- Logausgaben muessen `maskSecrets()` verwenden

---

## Dokumentation und Onboarding

Das seo-rescue Plugin muss neben den Commands auch verstaendliche Dokumentation fuer Setup, Tool-Anbindung, Fallbacks und Betrieb enthalten. Onboarding-Dokumentation ist Teil des Lieferumfangs. Die Implementierung gilt erst als vollstaendig, wenn die Docs angelegt und mit der Command-Logik konsistent sind.

### `docs/ONBOARDING.md`
- Was das seo-rescue Plugin macht
- Welche Commands verfuegbar sind
- Minimaler Start ohne kostenpflichtige Tools
- Voller Start mit Sistrix, DataForSEO und Screaming Frog
- Beispiel-Workflow
- Erklaerung der Output-Dateien und -Felder
- Hinweis: Keine SEO-Aenderungen werden automatisch umgesetzt.

### `docs/SETUP.md`
- Voraussetzungen fuer Claude Code
- Plugin-Pfad, MCP-Konfiguration
- Environment-Variablen (API Keys)
- Cache-Pfad, Rechte und Sicherheit

### `docs/TOOL_PROVIDERS.md`
- Capability-Matrix mit allen Providern
- Erwartete Datenqualitaet je Provider
- Bekannte Einschraenkungen
- Hinweis: konkrete MCP-Toolnamen koennen lokal abweichen

### `docs/FALLBACKS.md`
- Minimalbetrieb ohne kostenpflichtige Tools
- Import-Formate (GSC, Keywords, Backlinks, Crawl)
- Welche Aussagen dann moeglich/nicht belastbar sind
- Regel: Lieber `partial` + `low confidence` als irrefuehrende Ergebnisse

### `docs/TROUBLESHOOTING.md`
- Typische Fehler und Loesungen
- Lock-Probleme, korrupte Dateien, fehlende Provider
- Interpretation von `warnings`, `errors`, `missing_capabilities`

---

## Onboarding-Prinzip

Das Plugin muss fuer drei Nutzungsstufen funktionieren:

### 1. Minimal-Modus
- Keine kostenpflichtigen Tools
- GSC CSV, manuelle CSVs, lokaler Minimal-Crawler
- `data_quality: "poor"` oder `"partial"`, `confidence: "low"`

### 2. Standard-Modus
- Ein bis zwei angebundene SEO-Tools (z.B. Sistrix oder DataForSEO plus lokale Crawl-Daten)
- Meist `data_quality: "partial"`, `confidence: "medium"`

### 3. Voll-Modus
- Sistrix + DataForSEO + Screaming Frog MCP
- `data_quality: "good"`, `confidence: "high"` (nur sofern Daten frisch und vollstaendig)

> Neue Nutzer duerfen nicht durch fehlende API-Keys blockiert werden. Das System soll immer den besten moeglichen Workflow mit vorhandenen Daten ausfuehren und sauber kennzeichnen, wie belastbar das Ergebnis ist.

---

## Testplan

### Pflichttests

1. **Domain-Normalisierung** — example.com, https://example.com/path?q=1, www.example.com, https://www.example.com/path, ungueltige Inputs
2. **Cache-Safety** — kein Schreiben ausserhalb `~/.cache/seo-rescue/{slug}/`, Symlink-Ziel verweigern, unsichere Slugs ablehnen
3. **Locking** — paralleler Write wird blockiert, stale Lock wird nach TTL entfernt, fremder Lock wird nicht geloescht
4. **Atomic Writes** — `.tmp-*` wird geschrieben, finaler Rename funktioniert, kaputte Temp-Dateien ueberschreiben keine finalen Artefakte
5. **Minimal-Modus** — keine API-Keys, GSC-/manuelle CSVs vorhanden, lokaler Minimal-Crawler laeuft, Outputs mit `data_quality: "poor"` oder `"partial"`
6. **Voll-Modus** — Sistrix + DataForSEO + Screaming Frog verfuegbar, Outputs mit `data_quality: "good"` nur bei vollstaendigen/frischen Daten
7. **Schema-Validierung** — valide Outputs bestehen, invalide Outputs werden nicht final geschrieben
8. **Script CLI** — `recovery-crawl.js` und `recovery-monitor.js` akzeptieren dokumentierte Argumente, Exit Codes entsprechen der Spec

---

## Test Fixtures

Unter `plugins/seo-rescue/test-fixtures/` minimale Beispieldaten:

```
test-fixtures/
├── gsc/
│   ├── queries.csv
│   ├── pages.csv
│   └── links.csv
├── crawl/
│   ├── internal.csv
│   ├── response-codes.csv
│   ├── h1.csv
│   ├── meta-descriptions.csv
│   └── canonicals.csv
├── imports/
│   ├── keywords.csv
│   └── backlinks.csv
└── expected/
    ├── befund.minimal.json
    ├── issues.minimal.json
    ├── action-plan.minimal.json
    └── history.minimal.ndjson
```

Die Fixtures muessen so klein sein, dass sie ohne externe APIs lokal testbar sind.

---

## Definition of Done

Die Implementierung gilt erst als fertig, wenn:

- Alle 5 Commands existieren und die Pflichtabschnitte enthalten
- Alle Scripts ausfuehrbar sind und CLI Contract erfuellen
- Alle JSON-Schemas existieren und `schema_version` enthalten
- Alle Docs existieren (ONBOARDING, SETUP, TOOL_PROVIDERS, FALLBACKS, TROUBLESHOOTING)
- `lib/safe.js` alle Safety-Helper enthaelt
- Minimal-Modus ohne API-Keys funktioniert
- Standard-/Voll-Modus sauber dokumentiert ist
- Beispiel-Domain mit lokalen Testdaten erfolgreich durchlaeuft
- Erzeugte JSON-Dateien gegen Schemas validieren
- NDJSON-History append-only funktioniert
- Locking gegen parallele Writes getestet ist
- Keine Secrets in Logs oder Artefakten landen
- Keine automatischen SEO-Aenderungen umgesetzt werden
- `action-plan.json` immer `requires_human_approval: true` enthaelt

---

## Maintenance

Regelmaessig pruefen:

- `CORE_UPDATES.md` mindestens monatlich aktualisieren
- Provider-MCP-Namen bei Aenderungen aktualisieren
- CSV-Parser gegen reale Exporte testen
- Schemas versionieren
- Docs synchron mit Commands halten
- Test-Fixtures bei Schema-Aenderungen aktualisieren

---

## Nicht im Scope

- Keine automatische Umsetzung von SEO-Aenderungen ohne menschliche Freigabe
- Kein automatisches Deployment von Redirects, Canonicals oder Content-Aenderungen
- Kein automatisches Scheduling innerhalb des Plugins (nur ueber externe Cron-/Scheduler-Mechanismen)
- Kein Kunden-Dashboard / keine Web-UI
- Kein PDF-Rendering
- Report-PDF-Rendering bleibt im bestehenden `seo-outreach-report` Skill

---

## Kompatibilitaet

- Bestehende Commands/Funktionen im Plugin bleiben unveraendert
- Neue Commands nutzen dieselben MCP-Tools die bereits konfiguriert sind
- Cache-Pattern konsistent mit bestehendem `~/.cache/seo-rescue/`
- `safeSlug()` fuer alle Domain-Slugs (bestehendes `lib/safe.js` erweitert)
- Keine neuen npm-Dependencies
- JSON-Schemata in `schemas/` ermoeglichen Validierung ausserhalb von Claude
