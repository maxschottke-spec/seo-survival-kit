# Recovery Diagnose

## Zweck

Automatische Diagnose einer Domain: Core-Update-Betroffenheit pruefen, VI-Drop quantifizieren, Keyword-Verluste identifizieren, Backlink-Profil scannen. Ergebnis ist ein strukturierter Befund als Grundlage fuer alle weiteren Recovery-Commands.

## Trigger

`/seo-rescue:recovery-diagnose <domain>`

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

### Schritt 3: Sistrix VI abrufen

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

**Falls Sistrix NICHT verfuegbar:**

Warnung in `warnings` Array eintragen: `"Sistrix API nicht erreichbar — VI-Daten fehlen"`.
Setze `vi_current`, `vi_peak`, `vi_drop_pct`, `vi_trend_4w_pct`, `vi_trend_12w_pct` auf `null`.
Weiter mit Schritt 4.

### Schritt 4: DataForSEO MCP — Keyword-Analyse

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

**Falls DataForSEO MCP nicht verfuegbar:**

Fehler in `errors` Array eintragen: `"DataForSEO MCP nicht verfuegbar — Keyword-Diagnose nicht moeglich"`.
Diagnose kann ohne Keyword-Daten nicht erstellt werden. Status = `failed`, Abbruch.

**Falls Endpoint leere Daten liefert:**

Warnung eintragen. Felder auf `null` bzw. leere Arrays setzen. Weiter mit Schritt 5.

### Schritt 5: DataForSEO MCP — Backlink-Profil

**Endpoint:** `backlinks/summary/live`

**Parameter:**
- `target`: normalisierte Domain
- `target_type`: `"domain"`
- `include_subdomains`: `true`

**Aus der Antwort extrahieren:**

```json
{
  "referring_domains": <integer>,
  "total_backlinks": <integer>,
  "dofollow_pct": <number 0-100>,
  "nofollow_pct": <number 0-100>,
  "spam_score": <number 0-100>,
  "broken_backlinks": <integer>
}
```

Berechne `dofollow_pct` und `nofollow_pct` falls nicht direkt geliefert:
- `dofollow_pct = (dofollow_count / total_backlinks) * 100`
- `nofollow_pct = (nofollow_count / total_backlinks) * 100`

**Falls Endpoint nicht verfuegbar oder leere Daten:**

Warnung eintragen. `backlink_profile` auf `null` setzen. Weiter mit Schritt 6.

### Schritt 6: DataForSEO MCP — Domain-Autoritaet

**Endpoint:** `domain_rank_overview/live`

**Parameter:**
- `target`: normalisierte Domain
- `location_code`: `2276`
- `language_code`: `de`

Extrahiere `domain_rank` (falls vorhanden) und ergaenze damit die `backlink_profile`-Sektion oder fuege es als separates Feld hinzu. Falls der Endpoint nicht verfuegbar ist: Warnung, weiter ohne Domain-Rank.

### Schritt 7: Core-Update-Korrelation

Lies `../../references/CORE_UPDATES.md` fuer die Datumsliste bekannter Google Core Updates.

**Korrelations-Logik:**

Bestimme den Zeitpunkt des groessten VI-Drops (falls VI-Daten vorhanden). Pruefe fuer jedes bekannte Core Update:

- Drop-Datum liegt <= 4 Wochen nach `Rollout-Start` → `correlation = "high"`, `core_update_name` = Name des Updates
- Drop-Datum liegt 4–8 Wochen nach `Rollout-Start` → `correlation = "medium"`, `core_update_name` = Name des Updates
- Drop-Datum liegt > 8 Wochen nach oder VOR `Rollout-Start` → `correlation = "low"`
- Kein zeitlicher Zusammenhang mit keinem bekannten Update → `correlation = "none"`

**Falls keine VI-Daten verfuegbar (Sistrix fehlt):**

Setze `core_update_correlation = "none"` und `core_update_name = null`. Warnung eintragen.

**Nimm das am staerksten korrelierende Update** (hoechste Korrelation, bei Gleichstand das juengste). Setze `core_update_name` entsprechend.

### Schritt 8: Diagnosis-Klassifikation

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

**Deutschsprachige Zusammenfassung (`summary_de`):**

Schreibe 2–4 Saetze auf Deutsch, die die wichtigsten Befund-Punkte zusammenfassen:
- Art und Schwere des Problems
- Zusammenhang mit Core Update (falls vorhanden)
- Wichtigste Keyword-Beobachtung
- Naechste empfohlene Massnahme

### Schritt 9: Befund schreiben

Assembliere alle Daten in ein JSON-Objekt gemaess `../../schemas/befund.schema.json`.

**Pflichtfelder:**

```json
{
  "status": "complete" | "partial" | "failed",
  "input_domain": "<original user input>",
  "domain": "<normalisierte domain>",
  "canonical_domain": null,
  "slug": "<safe-slug>",
  "timestamp": "<ISO-8601-datetime>",
  "warnings": [],
  "errors": [],
  "vi_current": <number|null>,
  "vi_peak": <number|null>,
  "vi_drop_pct": <number|null>,
  "vi_trend_4w_pct": <number|null>,
  "vi_trend_12w_pct": <number|null>,
  "core_update_correlation": "high" | "medium" | "low" | "none",
  "core_update_name": "<string|null>",
  "keywords_total": <integer|null>,
  "position_distribution": { "t3": int, "t10": int, "t20": int, "t50": int, "t100": int } | null,
  "quick_wins": [...],
  "top_losers": [...],
  "backlink_profile": { ... } | null,
  "diagnosis": "core-update" | "technical" | "content" | "mixed" | "healthy",
  "severity": "critical" | "high" | "medium" | "low",
  "recovery_stage_estimate": "R1" | "R2" | "R3" | "R4" | "R5" | null,
  "summary_de": "<deutschsprachige Zusammenfassung>"
}
```

**Status-Regeln:**

- `"complete"` — alle Kernfelder befuellt (Sistrix + DataForSEO vorhanden)
- `"partial"` — mindestens Keyword-Daten vorhanden, aber ein oder mehrere optionale Datenquellen fehlen (z.B. Sistrix)
- `"failed"` — DataForSEO MCP nicht verfuegbar oder Domain nicht aufloesbar; Abbruch, kein Befund

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

## Ausgabe an den User

Nach erfolgreichem Schreiben des Befunds, gib folgende Informationen aus:

1. **Status-Zeile:** `[recovery-diagnose] {domain} — Status: {status} | Severity: {severity} | Diagnose: {diagnosis}`
2. **VI-Summary** (falls verfuegbar): `VI: {vi_current} (Peak: {vi_peak}, Drop: {vi_drop_pct}%)`
3. **Core-Update-Korrelation:** `Core Update: {core_update_name} ({core_update_correlation})`
4. **Keywords:** `Rankende Keywords: {keywords_total} | Quick Wins: {quick_wins.length}`
5. **Naechster Schritt:** Empfehle basierend auf der Diagnose das naechste /seo-rescue:-Command:
   - `core-update` → `/seo-rescue:post-core-update-recovery`
   - `technical` → `/seo-rescue:seo-audit-free`
   - `content` → `/seo-rescue:recovery-plan`
   - `mixed` → `/seo-rescue:recovery-plan`
   - `healthy` → keine weiteren Massnahmen noetig

## Fehlerbehandlung

| Fehler | Verhalten | Status |
|--------|-----------|--------|
| Sistrix API nicht erreichbar | Warnung eintragen, weiter ohne VI-Daten. `vi_current/vi_peak/vi_drop_pct` = `null`. | `partial` |
| DataForSEO MCP nicht verfuegbar | Fehler eintragen, Diagnose nicht moeglich. Abbruch. | `failed` |
| DataForSEO Endpoint liefert leere Daten | Warnung eintragen, betroffenes Feld = `null` oder leeres Array. | `partial` |
| Domain nicht aufloesbar oder leerer Input | Fehler eintragen, Abbruch. | `failed` |
| `safeSlug()` schlaegt fehl (ungueltige Zeichen) | Fehler eintragen, Abbruch. Hinweis an User: Domain-Format ueberpruefen. | `failed` |
| Lock nicht erwerbbar (Timeout 30s) | Fehler eintragen, Abbruch. Hinweis: anderer Command laeuft moeglicherweise fuer diese Domain. | `failed` |
| Befund-Datei existiert bereits | Ueberschreiben via `atomicWriteJSON` ist immer erlaubt (idempotent). | — |

## Validierungsregeln

Pruefe vor dem Schreiben:

- `vi_drop_pct` muss negativ sein wenn `vi_current < vi_peak`
- `position_distribution` Werte muessen monoton steigend sein: `t3 <= t10 <= t20 <= t50 <= t100`
- `dofollow_pct + nofollow_pct` muss 100 ergeben (+/- 1 Rundungsfehler toleriert)
- `diagnosis` muss exakt einer der Werte sein: `core-update | technical | content | mixed | healthy`
- `severity` muss exakt einer der Werte sein: `critical | high | medium | low`
- `slug` muss dem Pattern `^[a-z0-9][a-z0-9_-]{0,63}$` entsprechen
- `timestamp` muss ein gueltiges ISO-8601-Datum mit Uhrzeit sein

Bei einem Validierungsfehler: Warnung eintragen und Wert auf den naechsten gueltigen Wert korrigieren (z.B. negative t3 auf 0 setzen) oder Abbruch wenn Korrektur nicht moeglich.

## Referenzen

- `../../references/CORE_UPDATES.md` — Datumsliste bekannter Google Core Updates
- `../../references/RECOVERY_SYSTEM.md` — Schwellwerte, Recovery-Stage-Definitionen (R1–R5)
- `../../schemas/befund.schema.json` — vollstaendiges JSON-Schema des Output-Objekts
- `../../lib/safe.js` — `normalizeDomain()`, `safeSlug()`, `ensureDomainDir()`, `acquireLock()`, `releaseLock()`, `atomicWriteJSON()`
