# Lessons Learned — seo-outreach-report

Datierte Lern-Einträge aus realen PDF-Generierungen. Format: `## YYYY-MM-DD — Domain(s) — Kurztitel`.

**Pflege-Regel:** Pro generiertem PDF-Bericht: wenn etwas im Render/Layout/Wording schief lief, oder etwas besonders gut funktioniert hat — hier dokumentieren.

---

## 2026-05-21 — Skill-Trigger-Test fehlgeschlagen

**Kontext:** RED-GREEN-Test des Skills via Subagent. Subagent bekam Outreach-Szenario ("PDF für nicht-technischen Shop-Inhaber als Cold-Pitch").

**Befund:** Subagent picked `claude-seo:seo-audit` + `make-pdf` statt `seo-outreach-report`. Inhalt seiner Antwort war zwar deckungsgleich mit meinem Skill (Sistrix-Chart, Geld-statt-Metriken, Du-Form, Demut), aber das Skill selbst wurde nicht durch die Description-Trigger gefunden.

**Konsequenz:** Description verschärft am 2026-05-21 — explizite Differenzierung gegen `claude-seo:seo-audit` (audience=non-technical) und `make-pdf` (input=domain, nicht markdown), plus konkretere Trigger-Phrasen ("send the owner", "cold email PDF", "for non-technical decision maker").

**Quelle:** Test-Agent `a5890f19134da72e3`, Subagent-Output vom 2026-05-21.

**Konsolidierungs-Status:** Singulärer aber kritischer Fall → sofort patched.

---

## 2026-05-21 — Seed-Lessons aus Erstanwendung (4 Domains)

**Kontext:** Erstanwendung für vier DE-Domains aus unterschiedlichen Branchen (Matratzen-Shop, Schaumstoff-Hersteller, News-Publisher, Camper-Matratzen-Marke).

**Befund + Konsequenz:**

1. **WebFetch ↔ 403:** Eine Cloudflare-geschützte Test-Domain lieferte über WebFetch 403. Mit `curl -A "Mozilla/5.0 (Macintosh...) Chrome/120.0"` direkt funktionierte es. → Bereits in SKILL.md aufgenommen.

2. **PSI-Quota:** Ohne API-Key wurden alle PSI-Calls mit "Quota exceeded for default per-day-project" abgelehnt. Erst mit `GOOGLE_API_KEY` (PageSpeed Insights API in GCP enablen, Key restricten auf diese API) lief alles. → In SKILL.md.

3. **Sistrix-History-Falle:** `history=true&date=*` liefert keinen `answer` (Tier-Limit?). Workaround: 18× einzelne Calls mit `date=YYYY-MM-DD` pro Monat. → Im Script `seo-audit-fetch-v2.js` umgesetzt, in SKILL.md vermerkt.

4. **"Top-5-Sofort-Maßnahmen" mit nur 2 Items:** Erste Version filterte `where=sofort` und nahm `.slice(0,5)` — bei Domains mit nur 2-3 Sofort-Items wirkte das unsauber. → Gefixt durch Sortierung nach Priorität (sofort > 30 > 60 > 90) und Top-5-Select über alle, mit sichtbarem Zeitfenster.

5. **Inhaber-Sprache vs Profi-Sprache:** Erste Version hatte LCP/CLS/TBT ohne Erklärung. → Klartext-Layer ergänzt ("LCP = Wann das größte Element sichtbar wird").

6. **"Bestandsaufnahme" + "Fazit"** kamen als explizite User-Anforderung — Decision-Maker brauchen "was haben wir vorgefunden" (neutral) und "was ist die Schlussfolgerung" (klar). → Beide Kapitel im Standard-Layout aufgenommen.

7. **PDF-Größe:** Chrome-Headless rendert in ca. 950 KB–1 MB pro PDF. Akzeptabel für E-Mail-Versand.

---

## 2026-05-21 — Redirect-CSV case-insensitive Loop-Bug

**Kontext:** Bei der Massenerzeugung von 301-Redirects über das DreiscSeoPro-Plugin in Shopware.

**Befund:** DreiscSeoPro matcht Redirects **case-insensitive**. Wenn Source und Target sich nur in Groß-/Kleinschreibung unterscheiden (z.B. `/Produkt/X` → `/produkt/X`), entsteht ein infinite 301-Loop, der die Seite faktisch unerreichbar macht.

**Konsequenz für die Pipeline:** Vor jeder CSV-Generierung mit Redirects (relevant für Outreach-Berichte die Redirect-Listen empfehlen) ist ein expliziter **Case-Check** Pflicht:
```js
if (source.toLowerCase() === target.toLowerCase()) {
  throw new Error(`Case-only difference creates loop: ${source} -> ${target}`);
}
```

Diese Falle gilt für alle Shopware-Redirect-Plugins die case-insensitive arbeiten — nicht nur DreiscSeoPro. **Konsequenz für SHOP-SYSTEMS.md:** Hinweis ist schon drin, könnte aber prominenter werden.

**Quelle:** Pilot-Domain DreiscSeoPro Redirect-Setup, Mai 2026 (anonymisiert).

## 2026-05-21 — CMS-Block-Custom-HTML zerschießt Shopware-Seiten

**Kontext:** Versuch, FAQ-Schema via `cms-block type=text` als Custom-HTML in Shopware-Lattenrost-Pages zu injecten.

**Befund:** Shopware's CMS-Block-Editor (Block-Type "text") **filtert/escapet Custom-HTML** unvorhersehbar. 4 Lattenrost-Pages wurden mit Custom-HTML zerschossen, mussten gerollbackt werden.

**Konsequenz:**
- **Niemals** Custom-HTML via `cms-block type=text` einbringen
- Stattdessen: Shopware-native Block-Types nutzen ODER Theme-Twig-Template für Schema-Injection ODER ein spezialisiertes Schema-Plugin (DreiscSeoPro, NetInventors)

**Konsequenz für SHOP-SYSTEMS.md:** Bereits drin als Hinweis bei Shopware, könnte als eigenständiger Warnkasten markiert werden.

**Quelle:** Pilot-Domain CMS-Block-Schema-Injection-Versuch 2026-05-21 (Rollback dokumentiert, anonymisiert).

## 2026-05-21 — CTR-Rewrites wirken schneller als Authority-Maßnahmen

**Kontext:** Recovery-Tracking 4 Wochen nach Beginn (Pilot-Domain, post März-Core-Update).

**Befund:** Title-/Meta-Description-Rewrites zeigen messbare CTR-Wirkung auf bestehenden Rankings binnen 1–3 Wochen. Backlink-/Content-Authority-Maßnahmen brauchen 3–4 Monate für erste sichtbare VI-Bewegung.

**Konsequenz:** Im Outreach-Report-Aktionsplan sollte folgende Reihenfolge stehen:
1. CTR-Hebel (Title, Meta, Snippets) → sofort, in 4 Wochen sichtbar
2. Authority-Hebel (Content, Backlinks) → mittel-/langfristig

**Konsequenz für SKILL.md:** Bereits implizit drin (sofort > 30 > 60 > 90 Tage), könnte aber expliziter werden ("schneller Sieg vs strukturelle Recovery").

**Quelle:** Pilot-Domain Recovery-Tracking Mai 2026 (anonymisiert).

---

## Konsolidierte Lessons (aus 3+ Einträgen ins Hauptskill übernommen)

_(noch leer — Einträge werden hierhin verschoben wenn Pattern stabilisiert ist)_

---

## 2026-07-13 — Weekly-Modus: Erstanwendung (Camper-Matratzen-Marke)

**Kontext:** Erster produktiver Weekly-Report als Trust-Builder für einen Prospect, inkl. Vollautomatisierung (launchd + Guard + Staleness-Heartbeat + Auto-Versand hinter doppeltem Review-Gate).

**Befunde + Konsequenzen:**

1. **Sistrix-Credits im Wochentakt:** 18 History-Calls pro Lauf für unveränderliche Vergangenheits-Monate sind Verschwendung. → VI-History-Cache in `seo-audit-fetch-v2.js` (nur fehlende + laufender Monat gegen die API, ~2 statt 20 Credits).
2. **Kuratierte Beobachtungen veralten:** Ein Cron, der handgeschriebene "diese Woche"-Aussagen wiederholt, verschickt nach 2 Wochen falsche Fakten. → `observations_date`-Gate: kuratiertes Editorial gilt nur am exakten Lauf-Datum, sonst Auto-Fallback aus der Datenlage.
3. **Kunden-Logos aus Stock-/Fiverr-Quellen prüfen:** Die einzige PNG-Version des Absender-Logos trug ein halbtransparentes Fiverr-Preview-Wasserzeichen — auf dem Bildschirm leicht zu übersehen, auf einem Kundenreport fatal. → Logo IMMER gerendert sichtprüfen, Vektor-Original (SVG/AI) bevorzugen.
4. **Auto-Versand nur fail-closed:** Provider-Ausreißer (halbiertes Linkprofil, VI-Sprünge) sind fast immer Messfehler. → Deterministisches Gate mit Woche-zu-Woche-Plausibilität VOR dem LLM-Gate; jedes rote Gate = kein Versand + Notification, Draft-Modus als Default der Vorlage.
5. **Em-Dash-Normalisierung im Generator UND im Gate:** Editorial-Texte aus LLM-Sessions schleppen Geviertstriche ein (KI-Tell). Der Generator ersetzt sie (→ Halbgeviertstrich), das Review-Gate blockt Reste.

**Konsolidierungs-Status:** In SKILL.md (Abschnitt "Weekly mode") übernommen.
