---
description: "Automatic domain diagnosis: Core Update impact, VI drop, keyword losses, backlink profile."
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, mcp__*
---

# Recovery Diagnose

## Zweck

Automatische Diagnose einer Domain: Core-Update-Betroffenheit pruefen, VI-Drop quantifizieren, Keyword-Verluste identifizieren, Backlink-Profil scannen. Ergebnis ist ein strukturierter Befund als Grundlage fuer alle weiteren Recovery-Commands.

## Change Governance

Mode: `audit_only`. Change Budget: 0. Keine Live-Shop-Writes. Nur Cache-Report-Artefakte.

Wenn `change-history.ndjson` existiert, wird sie am Anfang gelesen und im Befund referenziert. Jede Aussage muss Quelle und Confidence tragen.

## Settlement Gate Awareness

Dieses Command ist read-only (`audit_only`, Change Budget 0) — ein aktiver Settlement Gate (`../../references/SEO_SETTLEMENT_GATE.md`) blockiert es NIE. Es muss den Gate-State aber kennen und ausweisen:

1. Lies `~/.cache/seo-rescue/{slug}/recovery-gate.json`, falls vorhanden. **Writer dieser Datei ist `recovery-audit`** (siehe `commands/recovery-audit.md`, Settlement Gate Detection) — recovery-diagnose liest sie nur. Fehlt die Datei, gilt der Gate als `never_triggered`: keine Warnung, normaler Ablauf.
2. Falls `settlement_gate_active = true`:
   - Diagnose laeuft normal weiter — read-only Analyse ist waehrend eines aktiven Gates immer erlaubt.
   - In den Befund (Top-Level) das Feld `settlement_gate_status` aufnehmen, gespiegelt aus der Gate-Datei:

     ```json
     "settlement_gate_status": {
       "active": true,
       "next_allowed_review_date": "2026-06-06",
       "unlock_status": "blocked"
     }
     ```

     (`unlock_status`: `blocked | partial | open`, direkt aus der Gate-Datei uebernommen.)
   - In der User-Ausgabe eine Zeile ausgeben: `Settlement Gate: AKTIV bis {next_allowed_review_date} — read-only Diagnose erlaubt, Live-Aenderungen blockiert`
   - Jeder Empfehlungstext (insbesondere `summary_de` und der "Naechster Schritt") darf KEINE sofortigen Live-Aenderungen vorschlagen. Naechste Schritte als "jetzt vorbereiten/Drafts erstellen, Ausfuehrung nach Gate-Re-Evaluation" formulieren (`prepare_now_execute_later`-Prinzip aus `SEO_SETTLEMENT_GATE.md`).
3. Falls Gate-Datei fehlt oder `settlement_gate_active = false`: `settlement_gate_status: { "active": false }` in den Befund schreiben. Keine User-Ausgabe-Zeile noetig.

## Trigger

`/seo-rescue:recovery-diagnose <domain>`

## Input-Kontrakt

| Feld | Quelle | Pflicht |
|------|--------|---------|
| `domain` | CLI-Argument | ja |

Normalisierung gemaess Schritt 1 des Ablaufs. `www.` wird NICHT entfernt.

## Capabilities

| Capability | Pflicht/Optional | Verwendung |
|-----------|-----------------|-----------|
| `visibility_history` | optional | VI-Trend berechnen, Core-Update-Korrelation |
| `keyword_rankings` | optional | Quick-Wins, Top-Losers, Position-Distribution |
| `backlink_summary` | optional | Backlink-Profil, Spam-Score |
| `core_update_dates` | optional | Korrelation mit Drop-Timing |
| `serp_snapshot` | optional | Intent-Klassifikation fuer Keywords |

## Bevorzugte Provider

- **visibility_history**: Sistrix MCP (`SISTRIX_API_KEY`)
- **keyword_rankings**: DataForSEO MCP
- **backlink_summary**: DataForSEO MCP (`backlinks/summary/live`)
- **core_update_dates**: `../../references/CORE_UPDATES.md`
- **serp_snapshot**: DataForSEO MCP (`serp/google/organic/live`)

## Fallback-Provider

### Paid Fallbacks (wenn Primaeranbieter nicht verfuegbar)

| Capability | Paid Fallback |
|-----------|--------------|
| `visibility_history` | Semrush, Ahrefs, Xovi, Searchmetrics, SE Ranking (manueller CSV-Export) |
| `keyword_rankings` | Semrush, Ahrefs, SE Ranking (manueller CSV-Export) |
| `backlink_summary` | Ahrefs, Majestic, Moz (manueller Export) |

### Free / Lokale Fallbacks

| Capability | Free/Lokal Fallback |
|-----------|-------------------|
| `visibility_history` | GSC CSV-Export (Performance-Report, 16 Monate) |
| `keyword_rankings` | Manuelle Keyword-CSV aus GSC oder eigener Tabelle |
| `backlink_summary` | Manuelle Backlink-CSV aus Google Search Console (Links-Report) |
| `core_update_dates` | `../../references/CORE_UPDATES.md` (kein Netzwerk noetig) |

CSV-Importe werden unter `~/.cache/seo-rescue/{slug}/imports/` erwartet.

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
node -e "const { randomUUID } = require('crypto'); console.log('diag-' + randomUUID().slice(0,8) + '-' + Date.now())"
```

Speichere die Run-ID als `run_id`. Sie wird im Output-Schema mitgefuehrt.

### Schritt 4: Sistrix VI abrufen

Pruefe ob ein Sistrix API Key verfuegbar ist (Environment-Variable `SISTRIX_API_KEY` oder `.env`-Datei im Projekt-Root).

**Falls Sistrix verfuegbar:**

Rufe folgende Endpoints auf:

1. `domain.sichtbarkeitsindex` — aktueller Sichtbarkeitsindex (VI) fuer Deutschland
   - Parameter: `domain={domain}`, `country=de`
   - Extrahiere: `vi_current` (neuester Wert)

2. VI-History fuer 18 monatliche Snapshots (6 Monate) via Einzelabfragen
   - Berechne: `vi_peak` (Maximum ueber alle Snapshots)
   - Berechne: `vi_drop_pct = ((vi_current - vi_peak) / vi_peak) * 100` (negativ wenn gefallen)
   - Berechne: `vi_trend_4w_pct` (Prozentaenderung letzte 4 Wochen)
   - Berechne: `vi_trend_12w_pct` (Prozentaenderung letzte 12 Wochen)

**Falls Sistrix NICHT verfuegbar — GSC-CSV-Fallback:**

Pruefe ob `~/.cache/seo-rescue/{slug}/imports/gsc-performance.csv` existiert. Falls ja:
- Leite VI-Proxy aus `clicks`-Spalte ab (kein echter VI, daher `vi_current = null`, aber `source_notes` eintragen)
- Eintragen in `source_notes`: `"VI aus GSC-CSV approx (klick-basiert, kein echter Sistrix-VI)"`

Falls kein CSV-Import vorhanden:
- Warnung in `warnings` Array eintragen: `"Sistrix API nicht erreichbar — VI-Daten fehlen, kein Import-Fallback gefunden"`
- Setze `vi_current`, `vi_peak`, `vi_drop_pct`, `vi_trend_4w_pct`, `vi_trend_12w_pct` auf `null`
- Weiter mit Schritt 5.

### Schritt 5: DataForSEO MCP — Keyword-Analyse

Rufe ueber DataForSEO MCP auf.

**Endpoint:** `ranked_keywords/live`

**Parameter:**
- `target`: normalisierte Domain
- `location_code`: `2276` (Deutschland)
- `language_code`: `de`
- `limit`: `100`
- `order_by`: `["keyword_data.keyword_info.search_volume,desc"]`

**Aus der Antwort extrahieren:**

- `keywords_total` — Gesamtzahl rankender Keywords (aus `total_count` oder `items_count`)
- `position_distribution` — Objekt mit kumulativen Positionen:
  - `t3`: Anzahl Keywords auf Position 1–3
  - `t10`: Anzahl Keywords auf Position 1–10
  - `t20`: Anzahl Keywords auf Position 1–20
  - `t50`: Anzahl Keywords auf Position 1–50
  - `t100`: Anzahl Keywords auf Position 1–100
- `quick_wins` — Keywords auf Position 4–20 mit `search_volume >= 100`, sortiert nach Volumen absteigend, maximal 15 Eintraege. Pro Eintrag:
  - `keyword`: der Suchbegriff
  - `position`: aktuelle Position
  - `volume`: monatliches Suchvolumen
  - `intent`: falls vorhanden aus DataForSEO-Daten, sonst `"unknown"`
- `top_losers` — falls DataForSEO historische Positions-Daten liefert: Keywords mit groesstem negativem Positions-Delta (position nach minus position vorher, aufsteigend sortiert = groesste Verluste zuerst), maximal 10 Eintraege. Falls keine historischen Daten: leeres Array.

**Falls DataForSEO MCP nicht verfuegbar — CSV-Fallback:**

Pruefe ob `~/.cache/seo-rescue/{slug}/imports/keywords.csv` existiert. Falls ja:
- Lade Keyword-Daten aus CSV (erwartete Spalten: `keyword`, `position`, `volume`)
- Eintragen in `source_notes`: `"Keyword-Daten aus manueller CSV, kein DataForSEO-Live-Abruf"`
- Status = `partial` (nicht `failed`)

Falls kein CSV-Import vorhanden:
- Warnung in `warnings` Array eintragen: `"DataForSEO MCP nicht verfuegbar — Keyword-Daten fehlen"`
- `keywords_total`, `position_distribution`, `quick_wins`, `top_losers` auf `null` bzw. leere Arrays setzen
- Status wird spaeter auf `partial` gesetzt (nicht `failed` — Diagnose kann mit reinen VI-Daten fortgesetzt werden)
- Weiter mit Schritt 6.

**Falls Endpoint leere Daten liefert:**

Warnung eintragen. Felder auf `null` bzw. leere Arrays setzen. Weiter mit Schritt 6.

### Schritt 6: DataForSEO MCP — Backlink-Profil

**Endpoint:** `backlinks/summary/live`

**Parameter:**
- `target`: normalisierte Domain
- `target_type`: `"domain"`
- `include_subdomains`: `true`

**Aus der Antwort extrahieren:**

```json
{
  "referring_domains": "<integer>",
  "total_backlinks": "<integer>",
  "dofollow_pct": "<number 0-100>",
  "nofollow_pct": "<number 0-100>",
  "spam_score": "<number 0-100>",
  "broken_backlinks": "<integer>"
}
```

Berechne `dofollow_pct` und `nofollow_pct` falls nicht direkt geliefert:
- `dofollow_pct = (dofollow_count / total_backlinks) * 100`
- `nofollow_pct = (nofollow_count / total_backlinks) * 100`

Hinweis: Die Beispielwerte im Output-Schema (`dofollow_pct: 42`, `nofollow_pct: 58`) sind illustrativ und nicht normativ — die tatsaechlichen Werte kommen aus dem API-Aufruf.

**Falls Endpoint nicht verfuegbar — CSV-Fallback:**

Pruefe ob `~/.cache/seo-rescue/{slug}/imports/backlinks.csv` existiert. Falls ja:
- Lade Backlink-Daten aus CSV
- Eintragen in `source_notes`: `"Backlink-Daten aus manueller CSV (z.B. GSC Links-Report)"`

Falls kein CSV-Import vorhanden:
- Warnung eintragen. `backlink_profile` auf `null` setzen. Weiter mit Schritt 7.

### Schritt 7: DataForSEO MCP — Domain-Autoritaet

**Endpoint:** `domain_rank_overview/live`

**Parameter:**
- `target`: normalisierte Domain
- `location_code`: `2276`
- `language_code`: `de`

Extrahiere `domain_rank` (falls vorhanden) und ergaenze damit die `backlink_profile`-Sektion oder fuege es als separates Feld hinzu. Falls der Endpoint nicht verfuegbar ist: Warnung, weiter ohne Domain-Rank.

### Schritt 8: Core-Update-Korrelation

Lies `../../references/CORE_UPDATES.md` fuer die Datumsliste bekannter Google Core Updates.

**Aktualitaetspruefung:**

Pruefe das Datei-Aenderungsdatum von `CORE_UPDATES.md`. Falls aelter als 90 Tage:
- Eintragen in `warnings`: `"CORE_UPDATES.md ist aelter als 90 Tage — Core-Update-Korrelation maximal 'low' oder 'unknown'"`
- Setze `core_update_correlation` auf maximal `"low"` (kein `"medium"` oder `"high"` bei veraltetem Referenz-File)

**Korrelations-Logik (nur wenn CORE_UPDATES.md aktuell):**

Bestimme den Zeitpunkt des groessten VI-Drops (falls VI-Daten vorhanden). Pruefe fuer jedes bekannte Core Update:

- Drop-Datum liegt <= 4 Wochen nach `Rollout-Start` → `correlation = "high"`, `core_update_name` = Name des Updates
- Drop-Datum liegt 4–8 Wochen nach `Rollout-Start` → `correlation = "medium"`, `core_update_name` = Name des Updates
- Drop-Datum liegt > 8 Wochen nach oder VOR `Rollout-Start` → `correlation = "low"`
- Kein zeitlicher Zusammenhang mit keinem bekannten Update → `correlation = "none"`

**Falls keine VI-Daten verfuegbar (Sistrix fehlt):**

Setze `core_update_correlation = "unknown"` und `core_update_name = null`. Warnung eintragen.

**Nimm das am staerksten korrelierende Update** (hoechste Korrelation, bei Gleichstand das juengste). Setze `core_update_name` entsprechend.

### Schritt 9: Pre-Hit-Baseline-Selektion (experimental, N=1)

Bestimmt die Recovery-Baseline als **historisches Peak-Plateau** statt als letztes stabiles Plateau vor dem Hit. Ergebnis geht ins Feld `pre_hit_baseline`. **Markiert als `maturity: "experimental_n1"`** — N=1-Heuristik (Lesson 1, case-001), KEINE validierte Metrik. Verändert die Stage-Schätzung (Schritt 10) NICHT.

1. **Zeitreihe wählen (source-adaptiv, längste verfügbare Reihe):**
   - GSC-CSV-Import `~/.cache/seo-rescue/{slug}/imports/gsc-performance.csv` mit Spalten `date,clicks` vorhanden → wöchentliche Klick-Reihe über den vollen CSV-Range. `source: "gsc_csv"`, `unit: "clicks_per_week"`.
   - sonst die Sistrix-VI-Snapshots aus Schritt 4 → `source: "sistrix_vi"`, `unit: "visibility_index"`.
   - sonst keine Reihe → `pre_hit_baseline: { "value": null, "unit": "clicks_per_week", "method": "unavailable", "source": "none", "maturity": "experimental_n1", "window_weeks": null, "window_limited": false, "erosion_vs_last_plateau_pct": null, "multi_update_erosion_detected": false, "recovery_vs_baseline_pct": null }`. Warnung eintragen. Weiter mit Schritt 10.
2. **Mindestlänge:** Hat die Reihe < 8 Perioden, ist keine belastbare Plateau-Erkennung möglich → wie der „keine Reihe"-Fall behandeln (`method: "unavailable"`).
3. **Peak-Plateau bestimmen:** Bilde den rollierenden 4-Perioden-Mittelwert über die Reihe. `value` = Maximum dieses Mittelwerts (höchstes *gehaltenes* Niveau, kein Einzel-Spike). `method: "historical_peak"`.
4. **Letztes stabiles Plateau vor jüngstem Hit:** Identifiziere den letzten signifikanten Drop (Periode-über-Periode-Rückgang > 15 % ODER ein in `../../references/CORE_UPDATES.md` dokumentiertes Update-Fenster). `last_stable_plateau` = Mittelwert der ~4 Perioden direkt davor.
5. **Erosion berechnen:** `erosion_vs_last_plateau_pct = round((last_stable_plateau - value) / value * 100)`. Ist der Wert `< -15`: `multi_update_erosion_detected: true`, Warnung `"pre_hit_baseline: stabile Phase vor Hit ist selbst >15% unter historischem Peak — Multi-Update-Erosion"` eintragen, und einen Satz dazu in `summary_de` aufnehmen. Sonst `false`.
6. **Fortschritt melden:** `recovery_vs_baseline_pct = round((current - value) / value * 100)`, wobei `current` der jüngste Reihen-Wert ist (jüngster Klick-Wochenwert bzw. `vi_current`). Reines Reporting.
7. **Fenster-Ehrlichkeit:** `window_weeks` = Anzahl Perioden der genutzten Reihe. `window_limited: true`, falls `window_weeks < 52` (z.B. Sistrix-6-Monats-Fenster) — signalisiert, dass ein früherer Peak abgeschnitten sein könnte.

### Schritt 10: Diagnosis-Klassifikation

Bestimme `diagnosis` und `severity` basierend auf allen gesammelten Daten.

**Diagnosis:**

| Wert | Bedingung |
|------|-----------|
| `core-update` | VI-Drop korreliert mit Core Update (`correlation = "high"` oder `"medium"`) UND breiter Keyword-Verlust (Keywords aus vielen URL-Clustern) |
| `technical` | Crawl-Fehler oder strukturelle Probleme dominieren; kein Core-Update-Timing; Brand-Keywords auch betroffen |
| `content` | Thin-Content-Signale: wenige Rankings trotz vieler indexierter Seiten; `keywords_total / bekannte_seitenanzahl < 0.1` |
| `mixed` | Kombination aus mehreren Faktoren (z.B. Core-Update-Timing + strukturelle Probleme) |
| `healthy` | Kein signifikanter Drop; stabile Rankings; `vi_drop_pct > -10` |

**Severity:**

| Wert | Bedingung |
|------|-----------|
| `critical` | `vi_drop_pct < -40` |
| `high` | `vi_drop_pct < -20` |
| `medium` | `vi_drop_pct < -10` |
| `low` | `vi_drop_pct >= -10` oder VI-Daten fehlen |

**Falls VI-Daten fehlen:** Bestimme Severity allein aus Keyword-Daten (Position-Distribution, Anzahl Quick-Wins etc.) und setze Severity auf den konservativsten plausiblen Wert.

**Recovery-Stage-Schaetzung (`recovery_stage_estimate`):**

Lies `../../references/RECOVERY_SYSTEM.md` fuer die Stage-Definitionen (R1–R5).

| Stage | Indikation |
|-------|-----------|
| `R1` | Frischer Drop, keine positiven Signale, vi_trend_4w_pct stark negativ |
| `R2` | Drop stabilisiert, aber kein Wachstum, vi_trend_4w_pct nahe 0 |
| `R3` | Erste positive Bewegung sichtbar, vi_trend_4w_pct leicht positiv |
| `R4` | Klares Wachstum, aber noch unter vi_peak |
| `R5` | Annaehernd erholt (vi_current >= 0.9 * vi_peak) |
| `null` | Nicht bestimmbar (VI-Daten fehlen) |

**Stage-State-Machine (`stage_status`, experimental, N=1):**

Überlagert die rohe `recovery_stage_estimate` mit Freeze-/Re-Entry-Regeln (Lesson 4a). Markiert `maturity: "experimental_n1"`. Liest die Rollout-Fenster (Start/Ende) aus `../../references/CORE_UPDATES.md` — dieselbe Datei wie Schritt 8.

1. **Kein/veraltetes CORE_UPDATES.md** (Datei fehlt oder > 90 Tage alt): keine Freezes — `stage = recovery_stage_estimate`, `raw_stage = recovery_stage_estimate`, `progression_allowed: true`, `frozen_reason: null`, `re_entry_detected: false`, `re_entry_from: null`, `active_update: null`, `days_since_rollout_end: null`, `maturity: "experimental_n1"`. Fertig.
2. **active_update_window:** Liegt das heutige Datum innerhalb [Rollout-Start, Rollout-Ende] eines Eintrags → `frozen_reason: "active_update_window"`, `progression_allowed: false`, `active_update` = Update-Name.
3. **post_update_settlement:** sonst, liegt heute in (Rollout-Ende, Rollout-Ende + 28 Tage] des jüngsten Eintrags → `frozen_reason: "post_update_settlement"`, `progression_allowed: false`, `days_since_rollout_end` = Tage seit Rollout-Ende. Sonst `frozen_reason: null`, `progression_allowed: true`.
4. **Re-Entry:** endete das jüngste Update ≤ 28 Tage vor heute UND `vi_trend_4w_pct < -10` → `re_entry_detected: true`, `re_entry_from` = `recovery_stage_estimate`, effektive `stage = "R1"`. Sonst `re_entry_detected: false`, `re_entry_from: null`, `stage = recovery_stage_estimate`.
   (Re-Entry und Freeze können gleichzeitig gelten: `stage = "R1"`, `progression_allowed` bleibt `false`.)
5. `raw_stage` ist immer = `recovery_stage_estimate`.

Dies ist NICHT der Settlement Gate (§12a / `SEO_SETTLEMENT_GATE.md`) — jener ist operator-batch-getriggert und blockt Live-Writes; `stage_status` friert nur die Stage-Bewertung ein.

**Deutschsprachige Zusammenfassung (`summary_de`):**

Schreibe 2–4 Saetze auf Deutsch, die die wichtigsten Befund-Punkte zusammenfassen:
- Art und Schwere des Problems
- Zusammenhang mit Core Update (falls vorhanden)
- Wichtigste Keyword-Beobachtung
- Naechste empfohlene Massnahme

### Schritt 11: Befund schreiben

Assembliere alle Daten in ein JSON-Objekt gemaess `../../schemas/befund.schema.json`.

**Pflichtfelder:**

```json
{
  "schema_version": "2.0",
  "run_id": "<diag-xxxxxxxx-timestamp>",
  "status": "complete | partial | failed",
  "data_quality": "good | partial | poor",
  "confidence": "high | medium | low | none",
  "providers_used": ["sistrix", "dataforseo", "core_updates_md"],
  "missing_capabilities": ["keyword_rankings"],
  "input_domain": "<original user input>",
  "domain": "<normalisierte domain>",
  "canonical_domain": null,
  "slug": "<safe-slug>",
  "timestamp": "<ISO-8601-datetime>",
  "warnings": [],
  "errors": [],
  "source_notes": [],
  "vi_current": "<number|null>",
  "vi_peak": "<number|null>",
  "vi_drop_pct": "<number|null>",
  "vi_trend_4w_pct": "<number|null>",
  "vi_trend_12w_pct": "<number|null>",
  "core_update_correlation": "high | medium | low | none | unknown",
  "core_update_name": "<string|null>",
  "keywords_total": "<integer|null>",
  "position_distribution": { "t3": 0, "t10": 0, "t20": 0, "t50": 0, "t100": 0 },
  "quick_wins": [],
  "top_losers": [],
  "backlink_profile": {
    "referring_domains": 320,
    "total_backlinks": 1840,
    "dofollow_pct": 42,
    "nofollow_pct": 58,
    "spam_score": 12,
    "broken_backlinks": 14
  },
  "diagnosis": "core-update | technical | content | mixed | healthy",
  "severity": "critical | high | medium | low",
  "recovery_stage_estimate": "R1 | R2 | R3 | R4 | R5 | null",
  "settlement_gate_status": { "active": false },
  "pre_hit_baseline": {
    "value": "<number|null>",
    "unit": "clicks_per_week | visibility_index",
    "method": "historical_peak | last_plateau | unavailable",
    "source": "gsc_csv | sistrix_vi | none",
    "maturity": "experimental_n1",
    "window_weeks": "<integer|null>",
    "window_limited": false,
    "erosion_vs_last_plateau_pct": "<number|null>",
    "multi_update_erosion_detected": false,
    "recovery_vs_baseline_pct": "<number|null>"
  },
  "summary_de": "<deutschsprachige Zusammenfassung>"
}
```

Hinweis: `backlink_profile`-Beispielwerte sind illustrativ. Tatsaechliche Werte kommen aus dem API-Aufruf oder CSV-Import.

**Status-Regeln:**

- `"complete"` — alle Kernfelder befuellt (Sistrix + DataForSEO vorhanden)
- `"partial"` — mindestens eine Datenquelle verfuegbar (z.B. nur VI, nur Keywords, oder nur CSV-Imports); Diagnose eingeschraenkt moeglich
- `"failed"` — KEINE Datenquelle verfuegbar (weder Sistrix noch DataForSEO MCP noch CSV-Imports); Abbruch

Hinweis: DataForSEO MCP nicht verfuegbar fuehrt zu `"partial"` (nicht `"failed"`), wenn GSC-CSV oder andere Imports vorhanden sind. Erst wenn gaenzlich keine alternative Datenquelle existiert, ist der Status `"failed"`.

**Data-Quality-Regeln:**

| Wert | Bedingung |
|------|-----------|
| `"good"` | Alle Capabilities frisch und vollstaendig befuellt (Sistrix + DataForSEO live) |
| `"partial"` | Mindestens eine Capability fehlt oder kommt aus CSV-Fallback |
| `"poor"` | Nur Free/Lokal-Daten (GSC-CSV oder manuelle CSVs); keine Live-API-Daten |

**Confidence-Regeln:**

| Wert | Bedingung |
|------|-----------|
| `"high"` | `data_quality = "good"` und Diagnosis eindeutig |
| `"medium"` | `data_quality = "partial"` oder Diagnosis ambivalent |
| `"low"` | `data_quality = "poor"` oder widersprueche zwischen Datenquellen |
| `"none"` | Keine verwertbaren Daten |

**Atomares Schreiben via `safe.js`:**

```bash
node -e "
const { ensureDomainDir, acquireLock, releaseLock, atomicWriteJSON } = require('./plugins/seo-rescue/lib/safe.js');
const path = require('path');
const dir = ensureDomainDir('{slug}');
const lock = acquireLock(dir);
try {
  atomicWriteJSON(path.join(dir, 'befund.json'), BEFUND_OBJECT);
} finally {
  releaseLock(lock);
}
"
```

Ersetze `{slug}` durch den ermittelten Slug und `BEFUND_OBJECT` durch das vollstaendige JSON-Objekt als JavaScript-Literal.

## Output-Pfad

`~/.cache/seo-rescue/{slug}/befund.json`

## Output-Schema

```json
{
  "schema_version": "2.0",
  "run_id": "diag-a1b2c3d4-1716820000000",
  "status": "partial",
  "data_quality": "partial",
  "confidence": "medium",
  "providers_used": ["sistrix"],
  "missing_capabilities": ["keyword_rankings", "backlink_summary"],
  "source_notes": ["VI aus Sistrix live", "Keyword-Daten fehlen — DataForSEO MCP nicht erreichbar, kein CSV-Import gefunden"],
  "domain": "example.com",
  "vi_current": 0.108,
  "vi_peak": 0.215,
  "vi_drop_pct": -49.8,
  "core_update_correlation": "high",
  "core_update_name": "March 2024 Core Update",
  "diagnosis": "core-update",
  "severity": "critical",
  "recovery_stage_estimate": "R2",
  "settlement_gate_status": {
    "active": true,
    "next_allowed_review_date": "2026-06-06",
    "unlock_status": "blocked"
  },
  "summary_de": "Die Domain verzeichnete einen VI-Drop von 49.8% korrelierend mit dem March 2024 Core Update. ..."
}
```

## Ausgabe an den User

Nach erfolgreichem Schreiben des Befunds, gib folgende Informationen aus:

1. **Status-Zeile:** `[recovery-diagnose] {domain} — Status: {status} | Severity: {severity} | Diagnose: {diagnosis}`
2. **Datenqualitaet:** `Datenqualitaet: {data_quality} | Confidence: {confidence}`
3. **VI-Summary** (falls verfuegbar): `VI: {vi_current} (Peak: {vi_peak}, Drop: {vi_drop_pct}%)`
4. **Core-Update-Korrelation:** `Core Update: {core_update_name} ({core_update_correlation})`
5. **Keywords:** `Rankende Keywords: {keywords_total} | Quick Wins: {quick_wins.length}`
6. **Fehlende Capabilities** (falls vorhanden): `Fehlende Daten: {missing_capabilities.join(', ')}`
7. **Pre-Hit-Baseline** (experimentell, nur falls `pre_hit_baseline.method != "unavailable"`): `Pre-Hit-Baseline: {value} {unit} ({method} aus {source}, N=1 experimentell) | Erholung vs. Peak: {recovery_vs_baseline_pct}%`. Bei `multi_update_erosion_detected = true` zusaetzlich: `⚠ Multi-Update-Erosion: stabile Phase vor Hit {erosion_vs_last_plateau_pct}% unter historischem Peak`
8. **Settlement Gate** (nur falls `settlement_gate_status.active = true`): `Settlement Gate: AKTIV bis {next_allowed_review_date} — read-only Diagnose erlaubt, Live-Aenderungen blockiert`
9. **Naechster Schritt:** Empfehle basierend auf der Diagnose das naechste /seo-rescue:-Command:
   - `core-update` → `/seo-rescue:post-core-update-recovery`
   - `technical` → `/seo-rescue:seo-audit-free`
   - `content` → `/seo-rescue:recovery-plan`
   - `mixed` → `/seo-rescue:recovery-plan`
   - `healthy` → keine weiteren Massnahmen noetig

   Bei aktivem Settlement Gate: Empfehlung als "jetzt vorbereiten, ausfuehren nach Gate-Re-Evaluation am {next_allowed_review_date}" formulieren — keine sofortigen Live-Aenderungen vorschlagen.

## Fehlerbehandlung

| Fehler | Verhalten | Status |
|--------|-----------|--------|
| Sistrix API nicht erreichbar, kein CSV-Import | Warnung eintragen, weiter ohne VI-Daten. `vi_current/vi_peak/vi_drop_pct` = `null`. | `partial` |
| Sistrix API nicht erreichbar, GSC-CSV vorhanden | Warnung + source_note eintragen, weiter mit CSV-Proxy. | `partial` |
| DataForSEO MCP nicht verfuegbar, kein CSV-Import | Warnung eintragen. Keyword-Felder = `null`. Diagnose eingeschraenkt. | `partial` |
| DataForSEO MCP nicht verfuegbar, keywords.csv vorhanden | Warnung + source_note, weiter mit CSV. | `partial` |
| ALLE Datenquellen nicht verfuegbar (keine API, kein CSV) | Fehler eintragen, Abbruch. | `failed` |
| DataForSEO Endpoint liefert leere Daten | Warnung eintragen, betroffenes Feld = `null` oder leeres Array. | `partial` |
| Domain nicht aufloesbar oder leerer Input | Fehler eintragen, Abbruch. | `failed` |
| `safeSlug()` schlaegt fehl (ungueltige Zeichen) | Fehler eintragen, Abbruch. Hinweis an User: Domain-Format ueberpruefen. | `failed` |
| Lock nicht erwerbbar (Timeout 30s) | Fehler eintragen, Abbruch. Hinweis: anderer Command laeuft moeglicherweise fuer diese Domain. | `failed` |
| Befund-Datei existiert bereits | Ueberschreiben via `atomicWriteJSON` ist immer erlaubt (idempotent). | — |
| CORE_UPDATES.md aelter als 90 Tage | Warnung, core_update_correlation maximal "low". | `partial` |

## Validierungsregeln

Pruefe vor dem Schreiben:

- `vi_drop_pct` muss negativ sein wenn `vi_current < vi_peak`
- `position_distribution` Werte muessen monoton steigend sein: `t3 <= t10 <= t20 <= t50 <= t100`
- `dofollow_pct + nofollow_pct` muss 100 ergeben (+/- 1 Rundungsfehler toleriert)
- `diagnosis` muss exakt einer der Werte sein: `core-update | technical | content | mixed | healthy`
- `severity` muss exakt einer der Werte sein: `critical | high | medium | low`
- `slug` muss dem Pattern `^[a-z0-9][a-z0-9_-]{0,63}$` entsprechen
- `timestamp` muss ein gueltiges ISO-8601-Datum mit Uhrzeit sein
- `schema_version` muss `"2.0"` sein
- `run_id` muss gesetzt und non-empty sein
- `data_quality` muss exakt einer sein von: `good | partial | poor`
- `confidence` muss exakt einer sein von: `high | medium | low | none`
- `providers_used` muss ein Array sein (darf leer sein wenn status = failed)
- `missing_capabilities` muss ein Array sein
- `pre_hit_baseline.maturity` muss `"experimental_n1"` sein
- Falls `pre_hit_baseline.value = null`, muss `pre_hit_baseline.method = "unavailable"` sein
- `pre_hit_baseline.method`, `.source`, `.unit` muessen im jeweiligen Schema-Enum liegen

Bei einem Validierungsfehler: Warnung eintragen und Wert auf den naechsten gueltigen Wert korrigieren (z.B. negative t3 auf 0 setzen) oder Abbruch wenn Korrektur nicht moeglich.

## Graceful-Degradation-Regeln

| Szenario | Verhalten |
|---------|-----------|
| Kein VI (Sistrix fehlt, kein CSV) | `vi_current/vi_peak/vi_drop_pct/vi_trend_*` = `null`; `data_quality` max `"partial"` |
| Keine Keywords (DataForSEO fehlt, kein CSV) | `keywords_total = null`, `quick_wins = []`, `top_losers = []`; `data_quality` max `"partial"` |
| Kein Backlink-Profil | `backlink_profile = null`; kein Abbruch |
| Alle Capabilities fehlen | `status = "failed"`, `data_quality = "poor"`, `confidence = "none"` |
| Nur GSC-CSV als Quelle | `data_quality = "poor"`, `confidence = "low"` |
| Keine verwertbare Zeitreihe / CSV ohne `date`-Spalte / Reihe < 8 Perioden | `pre_hit_baseline.method = "unavailable"`, `.value = null`, Warnung; Diagnose laeuft normal weiter |
| CORE_UPDATES.md veraltet (> 90 Tage) | `core_update_correlation` max `"low"` oder `"unknown"` |

## Datenqualitaetsregeln

- `"good"`: VI aus Sistrix live + Keywords aus DataForSEO live + CORE_UPDATES.md aktuell
- `"partial"`: Mindestens eine Capability kommt aus CSV-Fallback ODER eine Capability fehlt vollstaendig
- `"poor"`: Nur Free/Lokal-Daten (keine Live-API-Daten); alle Recommendations mit entsprechendem Vorbehalt versehen

Bei `data_quality = "poor"`: Keine aggressiven Empfehlungen. Jede Handlungsempfehlung muss explizit auf die eingeschraenkte Datenlage hinweisen.

## Referenzen

- `../../references/CORE_UPDATES.md` — Datumsliste bekannter Google Core Updates
- `../../references/RECOVERY_SYSTEM.md` — Schwellwerte, Recovery-Stage-Definitionen (R1–R5)
- `../../references/SEO_SETTLEMENT_GATE.md` — Settlement-Gate-Definition, Exceptions, Unlock-Kriterien
- `../../schemas/befund.schema.json` — vollstaendiges JSON-Schema des Output-Objekts
- `../../schemas/recovery-gate.schema.json` — Gate-State-Schema (`recovery-gate.json`)
- `../../lib/safe.js` — `normalizeDomain()`, `safeSlug()`, `ensureDomainDir()`, `acquireLock()`, `releaseLock()`, `atomicWriteJSON()`
