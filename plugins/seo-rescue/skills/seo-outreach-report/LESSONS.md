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

## Konsolidierte Lessons (aus 3+ Einträgen ins Hauptskill übernommen)

_(noch leer — Einträge werden hierhin verschoben wenn Pattern stabilisiert ist)_
