# minis-app

Ministrantenplan der Pfarrei Wemding. Go-Backend, React-Frontend als
installierbare PWA, ausgeliefert über Docker.

Erreichbar unter `https://ministranten.dynv6.net:33333`.

## Was die Anwendung macht

Ministranten (Rolle 1) sehen ihre eigenen Einsätze und pflegen ihre Sperrtage,
Wochentage und Wunschpartner. Ministrantenrat (Rolle 2) und Admin (Rolle 3)
teilen darüber hinaus Ministranten zu Messen ein, legen Messen an und
exportieren den Plan als PDF.

Die Rechte im Backend hängen an **mindestens** einer Rolle
(`AllowMinRole(2)`), nicht an Gleichheit — ein Vergleich auf `=== 2` würde den
Admin aussperren.

## Aufbau

| Dienst | Image | Aufgabe |
|---|---|---|
| `nginx` | `nginx:1.30-alpine` | TLS auf Port 33333, verteilt auf `ui` und `server` |
| `ui` | `nginx:1.30-alpine` | liefert den Frontend-Build aus, mit Kompression und Cache-Headern |
| `server` | `gcr.io/distroless/static-debian12` | Go-Backend auf Port 8080 |

Die Datenbank läuft nicht im Container.

## Inbetriebnahme auf der VM

### 1. Zugangsdaten anlegen

```bash
cp .env.example .env
nano .env
```

Die `.env` ist gitignored und enthält den Datenbank-Zugang und den
Signaturschlüssel der Anmeldung. Fehlt sie, bricht `docker compose up` mit
einer Meldung ab — es wird nichts stillschweigend mit Standardwerten gestartet.

**Beide Werte müssen gewechselt werden.** Sie standen bis zur Modernisierung im
Quellcode und stehen damit dauerhaft in der Git-Historie. Für den
Signaturschlüssel:

```bash
openssl rand -base64 48
```

Ein Wechsel des Schlüssels meldet alle einmal ab. Das sollte ohnehin einmal
passieren, weil die bisherigen Tokens kein Ablaufdatum hatten.

### 2. Zertifikate

nginx erwartet `certs/fullchain.pem` und `certs/privkey.pem`. Ohne sie startet
der Container nicht.

```bash
certbot certonly --standalone -d ministranten.dynv6.net \
  --non-interactive --agree-tos -m <mailadresse>
sh certs/cert.sh
```

### 3. Starten

```bash
docker compose up --build -d
docker compose logs -f server
```

Im Log muss `Datenbank erreichbar` stehen. Steht dort etwas anderes, sagt die
Meldung, woran es liegt:

| Meldung | Ursache |
|---|---|
| `connection refused` | MySQL lauscht nicht auf dieser Adresse |
| `i/o timeout` | Pakete werden verworfen — Firewall |
| `Access denied` | Benutzer nicht von dieser Adresse zugelassen |

### 4. Prüfen

```bash
# Läuft alles?
docker compose ps

# Kommt die Datenbank an?  (401 ist richtig — falsches Passwort, aber die
# Abfrage lief)
curl -sk -o /dev/null -w '%{http_code}\n' -X POST \
  https://ministranten.dynv6.net:33333/server/login \
  -H 'Content-Type: application/json' -d '{"username":"x","password":"x"}'

# Wird komprimiert ausgeliefert?  content-encoding: gzip muss dabei sein
curl -skI -H 'Accept-Encoding: gzip' \
  https://ministranten.dynv6.net:33333/assets/index-*.js | grep -i content-encoding

# Ist der PDF-Plan wirklich geschützt?  Muss 401 sein, nicht ein PDF mit Namen.
curl -sk -o /dev/null -w '%{http_code}\n' \
  'https://ministranten.dynv6.net:33333/server/pdf/events?from=2026-01-01&to=2026-12-31'
```

## Aktualisieren

```bash
git pull
docker compose up --build -d
```

Die Nutzer bekommen beim nächsten Öffnen den Hinweis „Neue Version verfügbar"
und entscheiden selbst, wann sie neu laden. Die `.env` bleibt unberührt.

## Wartung

Aus der Crontab (`sudo crontab -e`):

```cron
30 2 * * * sh /home/ubuntu/minis-app/certs/cert.sh
```

`certs/cert.sh` erneuert das Zertifikat **und lädt nginx neu**. Der Reload ist
der entscheidende Schritt: nginx liest Zertifikate nur beim Start, ohne ihn
würde nach einer Erneuerung weiter das alte ausgeliefert.

## Datenbank

Das Schema liegt in `server/schema.sql` — bis zur Modernisierung existierte es
nur implizit in den SQL-Zeichenketten des Go-Codes.

Eine leere Datenbank aufbauen:

```bash
mariadb -e "CREATE DATABASE minis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mariadb minis < server/schema.sql
```

Für eine bestehende Datenbank gibt es `server/migrations/`. Die dort liegenden
Anweisungen sind einmalig anzuwenden:

```bash
mariadb minis < server/migrations/001_unique_indizes.sql
```

`001` legt UNIQUE-Indizes auf `ban`, `user_weekday` und `preference_together`.
Die Anwendung verlässt sich darauf: sie fängt den MySQL-Fehler 1062 ab und
behandelt einen doppelten Eintrag als „schon erledigt" statt als Fehler. Ohne
die Indizes gibt es diesen Fehler nicht und es entstehen stille Duplikate.

## Entwicklung

Backend:

```bash
cd server
cp .env.example .env    # lokale Werte, u.a. der Zugang zur Testdatenbank
go run .
go test ./...
```

Frontend: siehe `ui/README.md`.

## Offen

**Die Passwörter stehen im Klartext** (`user.password`). Das ist bewusst noch
nicht geändert. Wer die Datenbank oder ein Backup sieht, hat damit alle
Zugänge — und die Verbindung zur Datenbank ist nicht per TLS gesichert (`tls`
ist im DSN nicht gesetzt).

Dazu kommt: die Passwörter sind zwischen 2 und 13 Zeichen lang, die meisten
genau fünf, und der Anmeldeendpunkt hat keine Begrenzung der Fehlversuche.
Durchprobieren ist damit in Sekunden erledigt. Eine Sperre nach wenigen
Fehlversuchen pro Benutzername und IP fasst die Passwörter nicht an und nimmt
dem Problem die Spitze — sie ist der naheliegende nächste Schritt.

Ein Backup-Konzept gibt es bisher nicht.
