#!/bin/sh
# weekly-runner.example.sh — Vorlage für einen vollautomatischen Weekly-Report-Versand.
# Kopieren, Platzhalter füllen, per launchd/cron wöchentlich starten (z. B. Mo 07:15).
#
# Kette (FAIL-CLOSED — jedes rote Gate bricht ab, es wird NICHTS versendet):
#   1) Render-Pipeline (fetch → extract → onpage → weekly-gen)
#   2) Review-Gate 1: deterministischer Linter (seo-weekly-review.js)
#   3) Review-Gate 2: Editorial-Review via Claude headless (PASS/FAIL)
#   4) Versand via Apple Mail (macOS) — oder Draft-Modus (AUTO_SEND=0 / FORCE_DRAFT=1)
#
# ⚠️ Automatischer Mail-Versand an Kunden ist eine bewusste Governance-Entscheidung.
#    Standard-Empfehlung: mit AUTO_SEND=0 (Draft-Modus) starten und erst nach
#    mehreren sauberen Wochen auf 1 stellen. Doppelversand-Schutz per sent-Flag.
#
# Monitoring: Wrapper wie launchd-guard (Fehler-Alerts) + Staleness-Heartbeat
# empfohlen, damit "still" nie "kaputt" bedeutet.
set -eu

# ---- Konfiguration (anpassen) -------------------------------------------------
SLUG="client-a"                                  # Slug aus audit-config.json
RECIPIENT="owner@example.com"                    # Empfänger
SENDER="you@example.com"                         # Muss als Account in Apple Mail existieren
AUTO_SEND="0"                                    # 0 = Draft in Mail ablegen, 1 = senden
SKILL="$(cd "$(dirname "$0")" && pwd)"           # Skill-Verzeichnis (dieses Script liegt dort)
export SEO_AUDIT_CONFIG="$HOME/.config/seo-rescue/audit-config.json"
ENVF="$HOME/.config/seo-rescue/.env"             # SISTRIX_API_KEY, DATAFORSEO_*, GOOGLE_API_KEY
NODE="$(command -v node)"
CLAUDE="$(command -v claude || echo /usr/local/bin/claude)"
MAILBODY="Hi,

anbei der wöchentliche SEO-Status: die wichtigsten Zahlen, die Bewegungen zur Vorwoche und meine Einordnung.

Viele Grüße"
# -------------------------------------------------------------------------------

TODAY=$(date +%Y-%m-%d)
CACHE="${SEO_CACHE_DIR:-$HOME/.cache/seo-rescue}"
SENT_FLAG="$CACHE/$SLUG-weekly/sent-$TODAY.flag"
notify() { osascript -e "display notification \"$1\" with title \"SEO-Weekly $SLUG\" sound name \"Basso\"" 2>/dev/null || true; }

[ -f "$SENT_FLAG" ] && { echo "Heute bereits versendet — skip."; exit 0; }
[ "${FORCE_DRAFT:-0}" = "1" ] && AUTO_SEND=0

# ---- 1) Render-Pipeline
HOST=$("$NODE" -e 'console.log(require(process.env.SEO_AUDIT_CONFIG).targets.find(t=>t.slug==="'"$SLUG"'").host)')
curl -s --fail --max-time 60 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" \
  "$HOST" -o "$CACHE/$SLUG-home.html"
"$NODE" --env-file="$ENVF" "$SKILL/seo-audit-fetch-v2.js" "$SLUG"
"$NODE" "$SKILL/seo-extract-v2.js" "$SLUG"
"$NODE" "$SKILL/seo-onpage.js"
"$NODE" "$SKILL/seo-weekly-gen.js" "$SLUG"

# ---- 2) Review-Gate 1: deterministischer Linter
if ! "$NODE" "$SKILL/seo-weekly-review.js" "$SLUG"; then
  notify "Review-Gate 1 ROT — kein Versand."
  exit 1
fi

# ---- 3) Review-Gate 2: Editorial-Review (Claude headless)
REPORT_TEXT=$("$NODE" -e '
const fs=require("fs"),p=process.env.HOME+"/.cache/seo-rescue/'"$SLUG"'-weekly/report-'"$TODAY"'.html";
console.log(fs.readFileSync(process.env.SEO_CACHE_DIR? process.env.SEO_CACHE_DIR+"/'"$SLUG"'-weekly/report-'"$TODAY"'.html" : p,"utf8")
  .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/g," ").replace(/\s+/g," ").trim());')
REVIEW_PROMPT='Du bist das letzte Review-Gate vor dem automatischen Versand eines wöchentlichen SEO-Reports an einen externen Geschäftsführer. Der Reporttext folgt als Input. Prüfe streng: 1. kaputte oder widersprüchliche Zahlen, Platzhalter, abgeschnittene Sätze. 2. unprofessionelles oder sprachlich falsches Deutsch. 3. Abmahnrisiko-Wording (Heilversprechen, unbelegte Superlative, erfundene Fakten). 4. Verrät der Report konkrete Schritt-für-Schritt-Umsetzungsanleitungen? (WAS+WARUM ok, detailliertes WIE ist ein Fehler.) 5. Wirkt etwas wie ein Datenfehler, den ein Profi nie verschicken würde? Antworte mit GENAU einer Zeile: nur PASS oder FAIL: <kurze Begründung>.'
VERDICT=$(printf '%s' "$REPORT_TEXT" | "$CLAUDE" -p "$REVIEW_PROMPT" --model claude-sonnet-5 2>/dev/null) || VERDICT="FAIL: claude-cli nicht verfügbar"
echo "Editorial-Review: $VERDICT"
case "$VERDICT" in PASS*) ;; *) notify "Editorial-Review ROT — kein Versand."; exit 1;; esac

# ---- 4) Versand bzw. Draft (Apple Mail, macOS)
DOMAIN=$("$NODE" -e 'console.log(require(process.env.SEO_AUDIT_CONFIG).targets.find(t=>t.slug==="'"$SLUG"'").domain)')
PDF="${SEO_PDF_OUTPUT_DIR:-$HOME/Downloads}/SEO-Weekly-$DOMAIN-$TODAY.pdf"
SUBJECT="SEO-Weekly $DOMAIN – KW$(date +%V) ($(date +%d.%m.%Y))"

osascript \
  -e "on run argv" \
  -e "set {theTo, theFrom, theSubject, theBody, thePdf, doSend} to argv" \
  -e "tell application \"Mail\"" \
  -e "  set msg to make new outgoing message with properties {subject:theSubject, content:theBody & linefeed & linefeed, visible:false}" \
  -e "  set sender of msg to theFrom" \
  -e "  tell msg to make new to recipient at end of to recipients with properties {address:theTo}" \
  -e "  tell msg to make new attachment with properties {file name:POSIX file thePdf} at after the last paragraph" \
  -e "  delay 3" \
  -e "  if doSend is \"1\" then" \
  -e "    send msg" \
  -e "  else" \
  -e "    save msg" \
  -e "  end if" \
  -e "end tell" \
  -e "end run" \
  -- "$RECIPIENT" "$SENDER" "$SUBJECT" "$MAILBODY" "$PDF" "$AUTO_SEND"

if [ "$AUTO_SEND" = "1" ]; then
  touch "$SENT_FLAG"
  notify "Report versendet ($SUBJECT)."
else
  notify "Report-ENTWURF in Mail abgelegt ($SUBJECT)."
fi
