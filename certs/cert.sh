#!/bin/bash
# Erneuert das Let's-Encrypt-Zertifikat und legt es dort ab, wo der
# nginx-Container es erwartet (Mount ./certs aus der docker-compose.yml).
#
# Läuft per crontab:  30 2 * * * sh /root/minis-app/certs/cert.sh

APP_DIR=/root/minis-app
DOMAIN=ministranten.dynv6.net

# Erneuert nur, wenn das Zertifikat in weniger als 30 Tagen abläuft, sonst
# passiert hier nichts. Braucht Port 80 frei - der ist es, weil der Stack nur
# 11200 nach außen veröffentlicht.
certbot renew

cp -L "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$APP_DIR/certs/privkey.pem"
cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$APP_DIR/certs/fullchain.pem"

# Der private Schlüssel muss nicht für alle lesbar sein. Der nginx-Master läuft
# im Container als root und kommt weiterhin dran.
chmod 600 "$APP_DIR/certs/privkey.pem"
