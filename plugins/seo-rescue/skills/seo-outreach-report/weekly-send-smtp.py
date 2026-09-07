#!/usr/bin/env python3
"""weekly-send-smtp.py — Versand des Wochenberichts über SMTP, nicht über Mail.app.

Warum es das gibt: Der Versand über AppleScript an Mail.app ist in einer
produktiven Kette drei Wochen in Folge gescheitert. Gemessen: Alles bis
einschließlich beider Prüf-Gates war in einer Minute fertig, danach hing der
Mail-Block 29 Minuten, bis der Wächter ihn abschoss. Das `with timeout of 600
seconds` im AppleScript greift dabei nicht — es begrenzt nur das Warten auf
eine ANTWORT; nimmt Mail das Ereignis an und antwortet nie, läuft es unbegrenzt.

SMTP hat keine GUI-Abhängigkeit, keine AppleEvents und ein echtes Zeitlimit.
Nur Standardbibliothek, keine Abhängigkeiten.

  weekly-send-smtp.py --pdf DATEI --subject TEXT --slug SLUG [--to ADRESSE] [--dry-run]

Konfiguration: `config.weekly[slug].mail` in der (privaten) audit-config.json —
  to, from, body, smtp_host (Standard smtp.gmail.com), smtp_port (Standard 465,
  implizites TLS), keychain_service (Standard "seo-weekly-smtp").

Zugangsdaten: NIE in einer Datei, NIE im Repo. Reihenfolge:
  1. Umgebungsvariable SMTP_PASSWORD (Linux-Cron, CI)
  2. macOS-Schlüsselbund: security add-generic-password -a <from> -s <keychain_service> -w '<app-passwort>' -U

--dry-run baut die Nachricht vollständig und sendet NICHT — zum Prüfen der
Kette, ohne dass etwas den Rechner verlässt.

Ausgang: 0 gesendet (oder Trockenlauf) · 1 Versand fehlgeschlagen · 2 Aufruffehler.
Ein Fehlschlag ist bewusst laut und ungleich null: Ein stiller Fehlschlag beim
Versand ist genau das, was hier drei Wochen lang passiert ist.
"""

import argparse
import json
import mimetypes
import os
import smtplib
import subprocess
import sys
from email.message import EmailMessage
from pathlib import Path

TIMEOUT_S = 90  # echtes Limit — der Grund, warum es diesen Weg gibt


def config(slug: str) -> dict:
    path = os.environ.get("SEO_AUDIT_CONFIG") or str(Path.home() / ".config" / "seo-rescue" / "audit-config.json")
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    try:
        return d["weekly"][slug]["mail"]
    except KeyError as e:
        raise SystemExit(f"FEHLER: weekly.{slug}.mail ({e}) fehlt in {path}")


def password(account: str, service: str) -> str:
    env = os.environ.get("SMTP_PASSWORD")
    if env:
        return env
    try:
        r = subprocess.run(
            ["security", "find-generic-password", "-a", account, "-s", service, "-w"],
            capture_output=True, text=True, timeout=20, check=False)
        pw = r.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pw = ""
    if not pw:
        raise SystemExit(
            f"FEHLER: kein SMTP-Passwort — weder SMTP_PASSWORD gesetzt noch ein Schlüsselbund-Eintrag "
            f"(Dienst '{service}', Konto '{account}'). Ohne das wird nicht gesendet.")
    return pw


def build(mailcfg: dict, subject: str, pdf: Path, to: str) -> EmailMessage:
    m = EmailMessage()
    m["From"] = mailcfg["from"]
    m["To"] = to
    m["Subject"] = subject
    m.set_content(mailcfg.get("body", ""))
    typ, _ = mimetypes.guess_type(pdf.name)
    main, _, sub = (typ or "application/pdf").partition("/")
    m.add_attachment(pdf.read_bytes(), maintype=main, subtype=sub, filename=pdf.name)
    return m


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--pdf", required=True)
    p.add_argument("--subject", required=True)
    p.add_argument("--slug", required=True)
    p.add_argument("--to", help="überschreibt den Empfänger aus der Konfiguration")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()

    pdf = Path(a.pdf).expanduser()
    if not pdf.is_file():
        print(f"FEHLER: {pdf} existiert nicht", file=sys.stderr)
        return 2

    cfg = config(a.slug)
    to = a.to or cfg["to"]
    host = cfg.get("smtp_host", "smtp.gmail.com")
    port = int(cfg.get("smtp_port", 465))
    service = cfg.get("keychain_service", "seo-weekly-smtp")
    msg = build(cfg, a.subject, pdf, to)

    print(f"An:      {to}")
    print(f"Von:     {cfg['from']}")
    print(f"Betreff: {a.subject}")
    print(f"Anhang:  {pdf.name} ({pdf.stat().st_size} Bytes)")
    print(f"Server:  {host}:{port}")

    if a.dry_run:
        print("TROCKENLAUF — nicht gesendet.")
        return 0

    # Passwort VOR dem Verbindungsaufbau auflösen: Ein Konfigurationsfehler soll
    # scheitern, bevor irgendetwas das Netz berührt.
    pw = password(cfg["from"], service)
    try:
        with smtplib.SMTP_SSL(host, port, timeout=TIMEOUT_S) as s:
            s.login(cfg["from"], pw)
            s.send_message(msg)
    except Exception as e:  # noqa: BLE001 — jeder Fehler hier muss laut sein
        print(f"VERSAND FEHLGESCHLAGEN: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    print("Gesendet.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
