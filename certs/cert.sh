#!/bin/bash
#
# Erneuert das Zertifikat und legt es dort ab, wo nginx es erwartet.
#
# Laeuft per crontab, Zeitplan siehe README.

set -u

APP_DIR=/home/ubuntu/minis-app
DOMAIN=ministranten.dynv6.net

certbot renew || {
	echo "certbot renew fehlgeschlagen" >&2
	exit 1
}

# -L: certbot legt unter live/ Symlinks ab. Ohne -L wuerde ein Link ins
# Container-Dateisystem kopiert, der dort auf nichts zeigt.
cp -L "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$APP_DIR/certs/privkey.pem" || exit 1
cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$APP_DIR/certs/fullchain.pem" || exit 1

# Der eigentlich wichtige Schritt, der bisher fehlte.
#
# nginx liest Zertifikate nur beim Start. Ohne dieses Neuladen liefert es nach
# einer Erneuerung weiter das alte aus - bis zum naechsten Neustart des
# Containers. Da es hier keinen naechtlichen Neustart gibt, waere das
# Zertifikat irgendwann abgelaufen, obwohl certbot seine Arbeit getan hat.
#
# reload statt restart: die Konfiguration wird geprueft, und laufende
# Verbindungen brechen nicht ab. Ist der Container nicht da, ist das kein
# Fehler - beim naechsten Start liest er die neuen Dateien ohnehin.
if docker compose -f "$APP_DIR/docker-compose.yml" ps --status running --services 2>/dev/null | grep -qx nginx; then
	docker compose -f "$APP_DIR/docker-compose.yml" exec -T nginx nginx -s reload || {
		echo "nginx-Reload fehlgeschlagen - Zertifikat liegt bereit, wird aber erst beim naechsten Start aktiv" >&2
		exit 1
	}
	echo "Zertifikat erneuert und nginx neu geladen"
else
	echo "Zertifikat erneuert, nginx laeuft nicht - wird beim naechsten Start uebernommen"
fi
