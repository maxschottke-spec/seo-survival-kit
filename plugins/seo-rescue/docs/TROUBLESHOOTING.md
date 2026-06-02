# Recovery Workflow — Troubleshooting

## Haeufige Fehler

### MCP-Server nicht erreichbar

**Symptom:** Command meldet "MCP not available" oder aehnlich.

**Loesung:**
- Pruefen ob Screaming Frog MCP Server laeuft
- Pruefen ob DataForSEO MCP Server konfiguriert ist
- Der Command laeuft trotzdem weiter mit Fallback-Daten (CSV, lokaler Crawler)

### API-Keys fehlen

**Symptom:** Warnings wie "Sistrix API not available".

**Loesung:**
- Keys sind optional. Der Workflow funktioniert im Minimal-Modus.
- Fuer bessere Datenqualitaet: Keys in .env oder Environment setzen (siehe SETUP.md)

### Cache-Lock haengt

**Symptom:** "acquireLock: timeout" Fehler.

**Loesung:**
- Stale Locks werden automatisch nach 10 Minuten entfernt
- Manuell: `rm ~/.cache/seo-rescue/{domain-slug}/.lock`
- Pruefen ob ein anderer Command noch laeuft (PID in Lock-Datei)

### Korrupte JSON-/NDJSON-Dateien

**Symptom:** "invalid JSON" Fehler beim Lesen.

**Loesung:**
- Die betroffene Datei loeschen oder umbenennen
- Command erneut ausfuehren — erzeugt die Datei neu
- `history.ndjson`: einzelne korrupte Zeilen verhindern nicht das Schreiben neuer Eintraege

### Schema-Validierung schlaegt fehl

**Symptom:** "Schema validation failed" Warnung.

**Loesung:**
- Artefakt wurde nicht final geschrieben
- Pruefen welche Felder fehlen (in `errors` Array)
- Command mit mehr Datenquellen erneut ausfuehren

### Domain wird falsch normalisiert

**Symptom:** www-/non-www-Verwechslung.

**Loesung:**
- `www.example.com` und `example.com` sind getrennte Domains
- Den exakten Hostname verwenden, der in Google rankt
- `canonical_domain` kann spaeter projektseitig gesetzt werden

### Keine Datenquellen verfuegbar

**Symptom:** "failed" Status, keine Outputs.

**Loesung:**
1. GSC CSV-Exporte anlegen (siehe FALLBACKS.md)
2. Oder manuelle Keyword-/Backlink-CSVs erstellen
3. Command erneut ausfuehren

## Change Governance Fehler

### Missing Change History

**Symptom:** `recovery-audit` reports `not_audit_safe_reconstruction: true`
**Ursache:** Kein `change-history.ndjson` fuer die Domain vorhanden.
**Loesung:** Audit rekonstruiert aus API-Zustand, markiert alle Eintraege als `reconstructed: true`. Kuenftige Sessions muessen Changes loggen.
**Praevention:** Jede Live-Schreiboperation muss zu change-history.ndjson appenden.

### API 500 bei seo-url PATCH

**Symptom:** Shopware gibt HTTP 500 beim PATCHen eines seo-url Eintrags.
**Ursache:** Mehrere nicht-geloeschte seo-url Eintraege zeigen bereits auf denselben `foreignKey` im selben Sales Channel (undokumentiertes Constraint).
**Diagnose:** Alle seo-url Eintraege fuer den Ziel-foreignKey im Live-Channel abfragen. Nicht-geloeschte zaehlen.
**Workaround:** Anderen foreignKey (andere Kategorie) als Redirect-Ziel verwenden, oder existierende Eintraege zuerst loeschen.
**Sauberer Fix:** Rico/Shopware Admin: doppelte seo-url Eintraege manuell bereinigen.

### Falscher Slug in seo-url

**Symptom:** seo-url PATCH erfolgreich, aber URL gibt weiterhin 404.
**Ursache:** Der gepatchte Eintrag hat einen anderen Slug als die tatsaechliche Request-URL. Shopware's URL-Resolver matched exakt (case-sensitiv, mit/ohne Trailing Slash).
**Diagnose:** seo-url Eintraege per Slug abfragen. Pruefen ob der Slug mit dem URL-Pfad exakt uebereinstimmt.

### DreiscSeo 301->404 Ketten

**Symptom:** Deaktivierte Kategorie-URL gibt 301 statt erwartetem 404, und das 301-Ziel ist ebenfalls 404.
**Ursache:** DreiscSeo hat eine eigene Redirect-Tabelle (`dreisc-seo-redirect`) unabhaengig von Shopwares `seo-url` Tabelle. Aktive DreiscSeo-Redirects ueberschreiben Shopwares 404-Verhalten.
**Diagnose:** `/dreisc-seo-redirect` nach der Quell-URL abfragen. Pruefen ob `active: true`.
**Fix:** DreiscSeo Redirect-Eintrag auf `active: false` PATCHen.
**Praevention:** Vor Kategorie-Deaktivierung die DreiscSeo Redirect-Tabelle auf Redirects ZUM deaktivierten Ziel pruefen.

### "ALLESS" / Breiter Batch Stop

**Symptom:** Claude stoppt und meldet einen Hard Stop.
**Ursache:** User gab eine breite Freigabe wie "alles", "mach alles", "ALLESS" die keine gueltige explizite Freigabe per SAFE_LIVE_CHANGE_RULES.md darstellt.
**Loesung:** User muss spezifische Freigabe mit Bezug auf Anzahl und Typ der Aenderungen geben.

### Budget ueberschritten

**Symptom:** Claude stoppt und meldet Budget-Erschoepfung.
**Ursache:** Kumulierte Risikopunkte ueberschreiten das Budget des aktuellen Modus.
**Loesung:** User kann (a) hoeheren Budget-Modus freigeben, (b) verbleibende Aenderungen priorisieren, oder (c) Session beenden.

### Freigabe ungueltig

**Symptom:** Claude fragt erneut nach Freigabe.
**Ursache:** Freigabe des Users hat nicht den Plan referenziert (siehe SAFE_LIVE_CHANGE_RULES.md).
**Loesung:** User gibt Freigabe die die spezifischen Aenderungen oder deren Anzahl benennt.

### Shopware Sales Channel Verwechslung

**Symptom:** seo-url Eintrag existiert und ist korrekt, URL gibt trotzdem 404.
**Ursache:** Der seo-url Eintrag ist im falschen Sales Channel (Headless API statt Live Storefront).
**Diagnose:** `salesChannelId` auf dem seo-url Eintrag pruefen.
**Fix:** Eintrag im korrekten Sales Channel erstellen oder verschieben.

### Canonical-Konflikt auf Blog-Seiten

**Symptom:** Blog-Seiten haben 2x `<link rel="canonical">` Tags.
**Ursache:** Shopware Base-Theme rendert den Navigations-Canonical (Root-Category = Homepage) UND das Blog-Plugin rendert den korrekten Blog-Canonical.
**Fix:** Twig-Block `{% block layout_head_canonical %}` im Theme fuer Blog-Detail-Seiten ueberschreiben. Nicht ueber API fixbar.

### Why Claude refuses new SEO changes

**Symptom:** Claude antwortet "Settlement Gate aktiv. Ich mache keine neuen Live-SEO-Optimierungen, weil der letzte Major Batch noch nicht belastbar ausgewertet ist." obwohl der User Live-Aenderungen will.

**Ursache:** In `~/.cache/seo-rescue/{slug}/recovery-gate.json` ist `settlement_gate_active: true`. Der letzte Major Batch (siehe `references/SEO_SETTLEMENT_GATE.md` section 3) hat das Settlement-Gate aktiviert. Solange das Gate aktiv ist, sind nur `audit_only` und `emergency_rollback` Modi erlaubt.

**Warum das so ist:**

- GSC hat 2-3 Tage Lag, brauchbare Klick-Delta-Auswertung braucht 7-10 Tage
- Sistrix VI aktualisiert woechentlich, API-Tier limitiert
- Google's Re-Crawl-/Re-Index-Zyklen fuer Redirects, Deaktivierungen, CMS-Aenderungen brauchen 5-14 Tage
- Eine zweite Aenderungswelle waehrend dieses Fensters macht Ursache-Wirkung fuer beide Wellen unauswertbar
- "Revert and re-add" innerhalb 14 Tage triggert oft ein Penalty-Signal
- Niedrige GSC-Klicks waehrend des Gate-Fensters sind der erwartete Zustand, kein Trigger zu handeln

**Was Claude waehrend des Gates erlaubt:**

- Read-only Crawls, GSC-/Sistrix-/DataForSEO-Pulls
- Live-HTTP-Checks (Status, Canonical, Robots)
- Schema-Drafts (lokal, kein Live-Push)
- Rico-/Entwickler-Briefings
- Monitoring-Dashboards, QA-Reports
- Rollback-Plan-Drafts
- Ticket-Erstellung
- Repo-Datei-Aenderungen
- Backlink-Audits

**Was Claude waehrend des Gates blockiert:**

- Neue Title-Rewrites
- Neue interne Links
- Linkblock-Reduktionen
- Content-Aenderungen
- Neue Kategorie-Deaktivierungen
- Neue Redirect-Experimente
- Neue Canonical-Konsolidierungen
- Neue Plugin-Config-Aenderungen
- Template-/H1-Fixes (ohne Notfall)
- AIO-/Content-Passage-Optimierungen live
- "Noch schnell"-Fixes

**Loesung wenn Aenderung wirklich noetig ist:**

- **Technical Emergency** (`SEO_SETTLEMENT_GATE.md` section 7.A): Live 404 auf wichtiger Seite, 301→404, noindex auf wichtiger Seite, kaputtes Canonical, robots blockiert, Rich-Result-Markup verifiziert falsch, Shopware/API-State-Widerspruch
- **Rollback/Stabilisierung** (`SEO_SETTLEMENT_GATE.md` section 7.B): Reaktivierung versehentlich deaktivierter URL, Deaktivierung eines 301→404-Redirects, Anchor-Entschaerfung bei medizinisch/rechtlich riskantem Begriff
- **Explicit Emergency Approval** (`SEO_SETTLEMENT_GATE.md` section 7.C): Mit Change Plan + Risikopunkten + Datenbasis + Rollback + Live-QA + expliziter Freigabe

**Loesung wenn nichts davon zutrifft:**

Warten. Re-Evaluation am `next_allowed_review_date` aus dem Gate-Objekt. Unlock-Kriterien aus section 9 erfuellen: Zeit + Daten + Stabilitaet + Decision.

### "Reserve nutzen" / "Budget übrig" Pressure-Stop

**Symptom:** Claude stoppt und antwortet "nicht ohne neuen Change Plan und explizite Freigabe", obwohl Budget rechnerisch nicht erschoepft ist.

**Ursache:** Der User hat Pressure-Phrasen genutzt: "Budget übrig", "Reserve nutzen", "noch schnell", "falls Zeit", "weitere kleine Fixes". Diese sind explizit als Stop-Trigger in `SEO_CHANGE_GOVERNOR.md` Hard Stop Rule #22 + `SAFE_LIVE_CHANGE_RULES.md` "Unused-Budget Pressure" registriert.

**Hintergrund:** Ungenutztes CG-Budget ist **kein Umsetzungsauftrag**. Das Per-Cycle-Cap ist nicht das Per-Cycle-Minimum. Reserve bleibt Reserve. Jede zusaetzliche Massnahme braucht einen neuen Change Plan, eigene Risikopunkte, Datenbasis, Rollback-Plan und explizite Freigabe.

**Loesung:** Wenn die Massnahme legitim ist, neuen Change Plan mit konkreten URLs, Typ, Risikopunkten erstellen und explizite Freigabe per `SAFE_LIVE_CHANGE_RULES.md` Format einholen.

## Output-Felder interpretieren

### warnings

Nicht-kritische Hinweise. Der Output ist nutzbar, aber einzelne Aspekte koennten unvollstaendig sein.

### errors

Kritische Fehler. Wenn `status: "failed"`, beschreiben die Errors warum.

### missing_capabilities

Welche Daten-Capabilities nicht verfuegbar waren. Hilft einzuschaetzen, welche API-Anbindung den groessten Qualitaetssprung bringen wuerde.

### data_quality und confidence

- `good` + `high`: Alle wichtigen Daten frisch und vollstaendig
- `partial` + `medium`: Nutzbar, aber einzelne Aspekte fehlen
- `poor` + `low`: Nur Minimal-Daten, Ergebnis stark eingeschraenkt

## "Hypothese intern konsistent, extern falsch"

**Symptom:** Eine AI-generierte Diagnose ist logisch geschlossen, mit klarer Mechanik, gestützt durch Open-Source-Code-Lesen einer Komponente im Stack. Der Fix-Plan wird detailliert ausgearbeitet. Bei lokaler Verifikation durch den Operator (oder Entwickler) stellt sich heraus: die Komponente ist tatsächlich beteiligt, aber nicht der Verursacher der beobachteten Wirkung. Eine andere Komponente, oft kommerziell und Closed-Source, sitzt im selben Override- oder Subscriber-Chain und produziert das eigentliche Symptom.

**Ursache:** AI-Diagnose kann nur sehen, was öffentlich einsehbar ist (Live-HTML, Open-Source-Repos, Crawl-Output, dokumentierte API-States). Wenn ein Closed-Source-Plugin oder ein lokales Theme-Override im selben Render-Chain sitzt und das beobachtete Symptom produziert, ist die AI strukturell blind dafür. Die Hypothese kann jedes verfügbare Open-Source-Detail korrekt einordnen und trotzdem die falsche Komponente als Verursacher benennen.

**Beispiel-Pattern (originating recovery case, Mai 2026):** D2C-Shop verliert 79 % seiner 28-Tage-Klicks an einen Plugin-Bug. AI identifiziert ein Open-Source-Blog-Plugin als wahrscheinlichen Verursacher auf Basis einer einsehbaren Block-Override-Mechanik, baut einen Theme-Override-Fix-Plan. Operator-Developer inspiziert die installierten Plugin-Files am Server, findet die tatsächliche Quelle in einem kommerziellen Closed-Source-SEO-Plugin, das im Template-Inheritance-Chain zwischen dem Open-Source-Plugin und dem Shopware-Core sitzt. Die ursprüngliche Hypothese war intern konsistent (Code im Open-Source-Plugin existiert und kann die Doppelung triggern) und extern falsch in der Attribution (die Doppelung wird vom Plugin dahinter erzeugt, nicht vom Open-Source-Plugin selbst).

**Diagnose-Regel:** Vor jedem Live-Fix muss die Hypothese den Hypothesis Verification Gate auf Status `verified` durchlaufen (siehe `references/HYPOTHESIS_VERIFICATION_GATE.md`). Open-Source-Code-Lesen alleine ist weak-tier verification und erlaubt höchstens `likely`. Strong-tier verification erfordert einen direkten Zugriff auf den installierten Stack: Server-File-Inspect, Live-API-State-Read, GSC-URL-Inspection, Staging-Reproduction, oder explizite Operator/Developer-Bestätigung.

**Lösung:**

1. Den AI-generierten Fix-Plan als Hypothese mit Status `likely` markieren, nicht als `verified` behandeln, auch wenn er logisch geschlossen wirkt
2. Mindestens eine alternative Hypothese formulieren (z.B.: welche anderen Komponenten in derselben Override-Chain könnten den Effekt produzieren?)
3. Operator-Direktzugriff einholen: installierte Plugin-Files inspizieren, nicht nur die Upstream-Repos
4. Erst nach `verified` durch strong-tier Verifikation Fix-Plan in Change Plan überführen
5. Fix-Scope strikt an die verifizierte Komponente binden; nicht aufweiten auf Komponenten die "vermutlich auch betroffen sind"

**Quervorbeugung:** Diese Failure-Mode tritt besonders häufig auf bei Plugin-Stacks mit gemischten Open-Source- und Closed-Source-Komponenten in derselben Template-Inheritance- oder Subscriber-Chain (typisch in Shopware, WordPress, Magento, Drupal). Bei reinem Open-Source-Stack ist das Risiko geringer, weil die AI alle Override-Chains einsehen kann. Bei reinem Closed-Source-Stack ist es offensichtlich, dass externe AI-Forensik nicht ausreicht — die Trap liegt im Mischfall, wo AI eine Komponente komplett lesen kann und übersehen wird, dass eine andere Komponente daneben das gleiche Symptom auch produzieren könnte.

**Verwandte Patterns:**

- "Plugin-Install triggert latenten Bug in unverwandter Komponente" — siehe `feedback_post_plugin_install_seo_pre_post_crawl` und `SAFE_LIVE_CHANGE_RULES.md` section "Plugin-Install / Cache-Rebuild Pre-/Post-Crawl Rule"
- "Verified-Scope Expansion" — wenn ein Fix für eine URL verifiziert ist, ist er nicht automatisch für ähnliche URLs verifiziert. Siehe `HYPOTHESIS_VERIFICATION_GATE.md` Hard Stop 25 in `SEO_CHANGE_GOVERNOR.md`
