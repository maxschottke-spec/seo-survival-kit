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
