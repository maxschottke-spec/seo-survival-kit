# Lessons Learned — post-core-update-recovery

Datierte Lern-Einträge aus realen Core-Update-Recoveries. Format: `## YYYY-MM-DD — Update-Name — Kurztitel`.

**Pflege-Regel:** Bei jedem Core-Update-Hit auf einer Domain die in unseren Sessions auftaucht, hier eintragen: welches Update, welcher Drop, welches Recovery-Tempo, was hat funktioniert/nicht. Nach 3+ Einträgen zu einem Pattern → Hauptskill konsolidieren.

---

## 2026-03/04 — March 2026 Core Update — Mid-size DE-Shop

**Kontext:** Mittelgroßer DE-Shop, VI-Drop −50 % zwischen 27.03. und 08.04.2026.

**Befund:**
- Brand-Keywords blieben stabil → bestätigt Authority-Pattern (nicht Manual Action)
- CWV stabil (PSI Desktop PASS, Mobile-Lab schwach aber CrUX unverändert) → bestätigt: kein Tech-Hebel
- Sistrix-Sprachregelung zum Update: "Autorität schlägt Austauschbarkeit"

**Konsequenz:** Erste Recovery-Maßnahmen (CWV-Tuning, Image-Compression −5,7 MB) zeigten 8 Wochen später noch keine Wirkung — bestätigt: Tech ist nicht der Hebel. Authority-Schicht ist primär.

**Quelle:** Sistrix-VI-Trace + GSC-Klick-Diff vom betroffenen Shop.

---

## 2026-04/05 — April/May 2026 News-Update — DE-News-Publisher

**Kontext:** Deutsche News-Site, Sichtbarkeit von 0,35 (März 2026) → 0,14 (21.05.2026) = −60 % in 6 Wochen.

**Befund:**
- Klassisches News-/YMYL-Pattern (Bandbreite über alle Topics)
- Recovery noch nicht im Gange — Domain steht aktuell in "Bodenbildung"-Phase
- Author-Schemas und EEAT-Signale waren auf Stichproben-URLs schwach (Foto/Bio fehlt teilweise)

**Konsequenz:** Pattern bestätigt — bei News-Sites ist Author-Authority + Original-Insight der primäre Recovery-Hebel. Tech (PSI 59 mobile) ist Hygiene, nicht Hauptursache.

**Quelle:** Audit am 2026-05-21 (Daten archiviert, Site-Name anonymisiert).

---

## 2026-05-21 — 4-Wochen-Recovery-Update (DE-Matratzen-Shop nach März-Core-Update)

**Kontext:** Vier Wochen nach Beginn der Recovery-Maßnahmen — Status-Check.

**Befund:**
- Tech-Hygiene-Layer komplett: 5 HTTP-500 → 404 fixed, 139 Redirects ausgerollt, Schema-Layer via Drittanbieter-Plugin live, Image-Compression −5,7 MB, Mobile-PSI von 32 auf 58.
- Sichtbarkeits-Index: **unverändert** (0,0618 vor → 0,0618 nach 4 Wochen Tech-Arbeit).
- Brand-Keywords weiter stabil, Generic-Keywords weiter weg.
- ABER: CTR auf Bestandsrankings stieg auf einigen URLs (Title-/Meta-Rewrites zeigen Wirkung in 1-3 Wochen).

**Konsequenz:**
1. **Bestätigt:** Tech-Hygiene ist NICHT der Sichtbarkeits-Hebel bei Core-Update-Hits. 4 Wochen intensive Tech-Arbeit → Null VI-Bewegung. Authority-Hebel braucht 3-4 Monate erste sichtbare Wirkung.
2. **Neue Lesson:** CTR-Rewrites (Title/Meta-Optimierung) zeigen schnellere Wirkung (1-3 Wochen) als Authority-Aufbau. Sind aber Hebel auf "wer-klickt-was-bereits-rankt", nicht "was-rankt-überhaupt".
3. **Recovery-Sequenz validiert:** Phase A (Authority-Foundation) MUSS in den ersten 8 Wochen begonnen werden — wer wartet bis Phase D Tech fertig ist, verliert Monate.

**Quelle:** Pilot-Domain Recovery-Tracking 2026-05-21 (interne Dokumentation, anonymisiert).

## 2026-05-21 — Site-Wide-URL-Health-Check als Recovery-Trigger

**Kontext:** Pre-Diagnose-Schritt vor Phase B Topical-Hubs.

**Befund:** Crawl der Shop-Domain (514 URLs aus Sitemap) ergab:
- **340+ URLs broken** (HTTP 500 / 404 / Soft-404)
- Klassisches Pattern bei eCommerce-Shops mit jahrelangem Product-Lifecycle ohne Cleanup
- Crawl-Budget-Verschwendung dadurch erheblich
- Google sieht "viel kaputt" als Authority-Signal-Verschlechterung

**Konsequenz:** Ein **Pre-Phase-A-Audit** sollte zur Pflicht werden bei jedem Core-Update-Recovery-Mandat:
1. Sitemap.xml ziehen
2. Jede URL auf HTTP-Status prüfen (Status 200 vs 4xx/5xx Verteilung)
3. >10 % Broken-Rate → Redirect-Map vor Authority-Aufbau erstellen
4. Erwartete Recovery +28–57 % VI bei Vollumsetzung des Cleanups + nachgelagertem Authority-Aufbau

**Konsequenz für SKILL.md:** Diagnose-Pflichtschritte sollten um "Site-Wide-URL-Health-Check" erweitert werden — derzeit nur erwähnt, sollte expliziter Schritt 1.5 werden.

**Quelle:** Pilot-Domain Site-Wide-Audit 2026-05-21 (Crawl-Daten archiviert, anonymisiert).

---

## 2026-05-22 — AI-Citations als vorgelagerter Recovery-Indikator (DE-Matratzen-Shop)

**Kontext:** 8 Wochen nach March-Core-Update-Hit. Sistrix-VI noch unten (~0.06 vs Pre-Update 0.13), aber Sistrix UI zeigt frische **+22% Trend** + neue AI-Citation-Metriken in der Toolbox.

**Befund:**
- Klassischer VI hängt hinter der Realität ~3-5 Tage (API vs UI), Recovery-Indikator dort: +22% Trend trotz absoluter Niedrigwerte
- **AI Citations sind explosiv:** 153 Google AI Mode + 121 Google AI Overviews + 22 ChatGPT = **296 AI-Surface-Erwähnungen** trotz niedrigem klassischen VI
- 8+ Authority-Cluster-Keywords ranken Pos 1 (Manufacturer-Intent-Head-Terms in 3 Schreibvarianten à la "[kategorie]hersteller [land]" / "[land-adjektiv] [kategorie]hersteller" / "[kategorie]-hersteller [land]", dazu ein "[material-begriff]" und ein "[standardgrößen-begriff]", etc.)
- Erste sichtbare Bewegung nach 8 Wochen — Framework sagte 3-4 Monate

**Konsequenz:** Pattern "AI Citations vorgelagerter Indikator" könnte das Recovery-Tracking-Modell erweitern. Hypothese: Google testet im AI Mode neue Authority-Signale, die später in den klassischen Index durchschlagen. **Tracking-Empfehlung für künftige Recoveries:** zusätzlich zu Sistrix-VI auch AI-Citation-Counts (Sistrix-Toolbox-Metrik seit 2026) wöchentlich pullen.

**Konsequenz für SKILL.md:** "Realistische Expectations"-Sektion sollte ergänzt werden um AI-Citations als positiven Frühindikator — wenn die hochgehen, ist der klassische VI 2-3 Monate später dran.

**Quelle:** Pilot-Domain Sistrix-Toolbox-UI 2026-05-22 (Screenshot, anonymisiert).

**⚠ KORREKTUR 2026-06-03 zum 22.05.-Eintrag:** Der „+22 % UI-Trend"-Befund vom 22.05. war NICHT echte Recovery sondern Pre-Mai-Update-Plateau. Mai 2026 Core Update (21.05.-02.06.) hat die Pilot-Domain mit −47,7 % Klicks getroffen. Die „Recovery früher als Framework-Vorhersage"-Hypothese ist NICHT haltbar. AI-Citations-Hypothese bleibt offen. Siehe Eintrag 2026-06-03 unten für korrigierte Lese und Multi-Update-Sequenz-Befund.

---

## 2026-06-03 — Multi-Update-Sequence + Mai 2026 Core Update — Mid-size DE D2C Mattress

**Kontext:** Historischer GSC-Tiefenscan (16-Monate-Voll-Pull) auf der Pilot-Domain aus den vorherigen Einträgen. Ergebnis: was als „1 Update + Recovery" diagnostiziert war, ist tatsächlich **5 Updates in 14 Monaten** plus 1 Major Gain.

**Befund (alle Daten 28d-Pre vs Post normalisiert):**

| Update | Δ Klicks | Verdict |
|---|---:|---|
| Juni 2025 Core Update | −1,1 % | neutral |
| August 2025 Spam Update | −0,3 % Klicks, −18,8 % Impr. | Frühwarnung, ignoriert |
| Dezember 2025 Core Update | **+20,6 %** | **major_gain** |
| Februar 2026 Discover Update | −21,8 % | moderate_hit (in Originaldiagnose übersehen) |
| März 2026 Spam Update | −32,2 % | major_hit |
| März 2026 Core Update | −36,3 % | major_hit |
| Mai 2026 Core Update | −47,7 % | major_hit (frisch) |

**Pre-Hit-Baseline-Korrektur:** Original-Diagnose nutzte „letztes stabiles Plateau vor März-Hit" als Baseline (~1.077 Klicks/Woche im Februar 2026). Tiefenscan zeigt: das Februar-Plateau war bereits eroded — echter Pre-Hit war Sommer/Herbst 2025 (1.150-1.300 Klicks/Woche). Recovery-Stand wurde dadurch zu optimistisch berichtet (~62 % vom Pre-Hit statt tatsächlich ~37-40 %).

**Fünf Framework-Lessons (N=1, candidate-stage):**

1. **Pre-Hit-Baseline-Selection:** Framework sollte echten historischen Peak prüfen, nicht „letzte stabile Phase vor Hit". Bei Multi-Update-Sequenzen ist das letzte Plateau oft schon erodet.
2. **Cumulative-Decline-Detection (Quiet Death):** Pilot-Domain hat 11 Queries die kontinuierlich über 6-60 Wochen sinken, OHNE Update-Korrelation. Brand-Query −80 % über 59 Wochen, generic-money-Queries ähnlich. Diese „quiet deaths" sind oft SERP-Feature-Absorption (AIO) oder Brand-Erosion — eigene Diagnose-Schicht nötig.
3. **Phoenix-Query-Detection (selten):** Nur 2 von 14.000+ Queries kamen nach Tod zurück. Realitäts-Anker: einmal verlorene Rankings kehren selten zurück. Strategy = neue Cluster aufbauen statt verlorene reaktivieren.
4. **Multi-Update-Sequence Stage Modeling:** Stage-Modell muss erlauben Stage 3 → Stage 1 (Re-Entry) bei neuem Hit. Aktuell linear modelliert. Plus: „Active update window" als Stage-Gate-Parameter („no progression during rollout").
5. **Heterogene Page-Trajectory:** Site-Level −37-40 % verbirgt: einzelne Pages ranging von −90 % bis +621 %. Cluster-Analyse nötig (Format-Match-Slug Winner vs Broad-Adjective Loser).

**Konsequenz für Pilot-Domain:**
- Stage zurück auf 1 (Acute Damage) vom frischen Mai-Update
- Settlement-Phase mindestens 28 Tage (echte Post-Daten erst Ende Juni)
- Recovery-Operations (Schema-Fix, Canonical-Fix) konnten Update-Wirkung NICHT abfedern — notwendig aber nicht hinreichend
- Editorial-Authority-Outreach als Mittelfrist-Hebel jetzt höhere Priorität (Dezember 2025 Gain zeigt: Authority wird belohnt)

**Konsequenz für Framework:**
- Diese 5 Lessons sind N=1 Stage (candidates). Move zu validated nach N=2 cross-case Confirmation
- Implementation-Plan: siehe `private/cases/case-001/patterns/2026-06-03-multi-update-sequence-lessons.md` (case-internal)
- Roadmap-Relevanz: Lesson 1, 2, 4 sind v0.6/v0.7 Material. Lesson 3, 5 sind kleinere Erweiterungen.

**Quelle:** GSC-Tiefenscan via `searchAnalytics.query` mit 16-Monate-Range, Aggregation per Tag/Woche, Update-Daten via Search Engine Land Web-Verifikation.

---

## Konsolidierte Lessons (aus 3+ Einträgen ins Hauptskill übernommen)

_(noch leer — die 5 Framework-Lessons aus dem 2026-06-03-Eintrag sind N=1 candidates und warten auf cross-case Bestätigung)_
