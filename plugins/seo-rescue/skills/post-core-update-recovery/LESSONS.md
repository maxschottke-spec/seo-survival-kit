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

**Quelle:** Verapur-Recovery-Tracking 2026-05-21 (verapur-claude Repo, branch feat/bwa-comforteo-matralux-2026-05-20).

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

**Quelle:** Verapur Site-Wide-Audit 2026-05-21, siehe `data/seo/site-wide-audit-2026-05-21.json` (privat).

---

## 2026-05-22 — AI-Citations als vorgelagerter Recovery-Indikator (DE-Matratzen-Shop)

**Kontext:** 8 Wochen nach March-Core-Update-Hit. Sistrix-VI noch unten (~0.06 vs Pre-Update 0.13), aber Sistrix UI zeigt frische **+22% Trend** + neue AI-Citation-Metriken in der Toolbox.

**Befund:**
- Klassischer VI hängt hinter der Realität ~3-5 Tage (API vs UI), Recovery-Indikator dort: +22% Trend trotz absoluter Niedrigwerte
- **AI Citations sind explosiv:** 153 Google AI Mode + 121 Google AI Overviews + 22 ChatGPT = **296 AI-Surface-Erwähnungen** trotz niedrigem klassischen VI
- 8+ Authority-Cluster-Keywords ranken Pos 1 ("matratzenhersteller deutschland", "deutsche matratzenhersteller", "matratzen-hersteller deutschland", "komfortschaum", "normale matratzengröße", etc.)
- Erste sichtbare Bewegung nach 8 Wochen — Framework sagte 3-4 Monate

**Konsequenz:** Pattern "AI Citations vorgelagerter Indikator" könnte das Recovery-Tracking-Modell erweitern. Hypothese: Google testet im AI Mode neue Authority-Signale, die später in den klassischen Index durchschlagen. **Tracking-Empfehlung für künftige Recoveries:** zusätzlich zu Sistrix-VI auch AI-Citation-Counts (Sistrix-Toolbox-Metrik seit 2026) wöchentlich pullen.

**Konsequenz für SKILL.md:** "Realistische Expectations"-Sektion sollte ergänzt werden um AI-Citations als positiven Frühindikator — wenn die hochgehen, ist der klassische VI 2-3 Monate später dran.

**Quelle:** Verapur Sistrix-Toolbox 2026-05-22 (User-Screenshot der UI).

---

## Konsolidierte Lessons (aus 3+ Einträgen ins Hauptskill übernommen)

_(noch leer)_
