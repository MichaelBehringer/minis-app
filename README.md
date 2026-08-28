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
Dasselbe gilt jetzt auch außerhalb des Containers: `go run .` ohne diese beiden
Werte bricht ab. Vorher griff dort ein Default aus dem Quellcode, und der zeigte
auf die Produktivdatenbank.

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

### Kommt ein Update auch bei installierten Apps an?

Viele öffnen die Anwendung über ein Symbol auf dem Startbildschirm. Drei Dinge
sorgen dafür, dass Updates dort ankommen:

1. **`index.html` wird nicht gecacht** (`Cache-Control: no-cache` in
   `ui/ui-nginx.conf`). Die alte Auslieferung über httpd setzte gar keine
   Cache-Header, ein Browser durfte die Seite also nach eigenem Ermessen
   behalten. Genau daran scheitern Updates sonst.
2. **Der Service Worker sieht aktiv nach.** Ein Browser prüft von sich aus bei
   einer Navigation. Eine vom Startbildschirm gestartete App wird aber meist
   nur in den Vordergrund geholt und nicht neu geladen — deshalb prüft
   `PwaUpdatePrompt` bei jedem Zurückkehren in die App und zusätzlich stündlich.
3. **`/static/` heilt alte Installationen.** Die alte Fassung lud ihre Dateien
   von dort. Hängt bei jemandem noch die alte `index.html` im Cache, bekommt
   sie statt eines fehlenden Skripts `public/legacy-reload.js`, das Service
   Worker und Caches abräumt und die Seite unter neuer Adresse frisch lädt.

### Wie lange bleibt man angemeldet?

Das Häkchen **„Angemeldet bleiben"** entscheidet darüber, und zwar jetzt auch am
Server — vorher wirkte es nur darauf, ob das Frontend das Token in
`localStorage` oder in `sessionStorage` legt; die Gültigkeitsdauer war in beiden
Fällen dieselbe.

| | Gültigkeit | Ablage im Browser |
|---|---|---|
| mit Häkchen | 1 Jahr | `localStorage` — übersteht das Schließen |
| ohne Häkchen | 12 Stunden | `sessionStorage` — endet mit dem Tab |

**Die Sitzung verlängert sich durch Benutzung.** Ist die Hälfte der Gültigkeit
vorbei, legt die `AuthUser`-Middleware ein frisches Token in den Antwortkopf
`X-Neues-Token`; der Interceptor im Frontend ersetzt damit das alte — und zwar
im selben Speicher, damit aus einer Sitzung ohne Häkchen nicht doch eine
dauerhafte wird. Wer die App mindestens einmal im halben Jahr öffnet, wird
praktisch nie abgemeldet.

Ein Token **ohne** Ablaufdatum wäre der scheinbar einfachere Weg und ist
bewusst nicht gewählt: es bliebe für immer brauchbar, wenn es einmal
abgegriffen wird, und man könnte es nur noch loswerden, indem man den
Signaturschlüssel wechselt — was alle gleichzeitig abmeldet. Die Verlängerung
erreicht dasselbe Ergebnis für den Nutzer, lässt ein liegengelassenes Token
aber verfallen.

Eine Erneuerung eines **abgelaufenen** Tokens gibt es nicht — sonst wäre das
Ablaufdatum wirkungslos. Wer zu lange weg war, meldet sich neu an.

### Müssen sich alle neu anmelden?

**Ja, einmal.** Die Tokens der alten Fassung hatten kein Ablaufdatum, und
`parseToken` fordert jetzt eines (`jwt.WithExpirationRequired`). Alte Tokens
werden damit abgewiesen, auch wenn derselbe Signaturschlüssel weiterverwendet
würde — es hängt also nicht daran, dass der Schlüssel gewechselt wird.

Der Ablauf für den Nutzer: beim ersten Öffnen kommt „Sitzung abgelaufen. Bitte
neu anmelden.", die Sitzung wird beendet und die Anmeldemaske erscheint. Kein
weißer Bildschirm und keine Kette von Fehlermeldungen.

## Wartung

Aus der Crontab (`sudo crontab -e`):

```cron
30 2 * * * sh /home/ubuntu/minis-app/certs/cert.sh
0 */8 * * * /home/ubuntu/minis-app/backup/backup.sh
```

`certs/cert.sh` erneuert das Zertifikat **und lädt nginx neu**. Der Reload ist
der entscheidende Schritt: nginx liest Zertifikate nur beim Start, ohne ihn
würde nach einer Erneuerung weiter das alte ausgeliefert.

## Sicherung

`backup/backup.sh` erzeugt zwei Dinge in `/root/minis-backup` und committet sie
in das dortige Git-Repository — dasselbe Verfahren wie in atw-app, die Skripte
sind bis auf Namen, Pfade und den Punkt unten Zeile für Zeile dieselben:

- `dump.sql` — vollständiger `mysqldump`, das ist die Grundlage zum
  Zurückspielen.
- `csv/<tabelle>.csv` — je Tabelle eine Datei zum Lesen und Auswerten, etwa in
  einer Tabellenkalkulation, mit dem vollständigen Inhalt. Praktischer
  Nebeneffekt: im Git-Diff ist auf einen Blick zu sehen, was sich seit der
  letzten Sicherung geändert hat.

Vorbereitung: das Repository muss existieren und ein Remote haben, sonst bricht
das Skript beim Hochladen ab.

```bash
mkdir -p /root/minis-backup && cd /root/minis-backup
git init && git remote add origin <adresse>
```

### Woher der Zugang kommt

Adresse, Benutzer, Passwort und Datenbankname liest das Skript aus
`MINIS_DB_DSN` in der `.env`, damit sie nur an einer Stelle stehen. Daraus
ergeben sich zwei Wege:

| Datenbank | Weg |
|---|---|
| **außerhalb der VM** (der Fall hier) | Anmeldung mit dem Zugang aus dem DSN, über die Adresse aus dem DSN |
| auf der VM selbst (`localhost`, `127.0.0.1`, `host.docker.internal`) | ohne Benutzernamen über den Unix-Socket; MariaDB erkennt den aufrufenden Systembenutzer (`root`) |

**Das ist der einzige Unterschied zu atw-app.** Dort liegt die Datenbank auf
derselben VM, deshalb kennt das Skript dort nur den Socket-Weg. Hier steht im
DSN eine externe Adresse — über den Socket ist sie nicht erreichbar.

Zugang und Adresse gehen über eine temporäre Datei an `mysqldump`, nicht über
die Kommandozeile: Argumente sind in `ps` für jeden Nutzer des Systems sichtbar.

Soll für die Sicherung ein anderes Konto verwendet werden als das der
Anwendung, geht das über die `.env`:

```
MINIS_BACKUP_DB_USER=…
MINIS_BACKUP_DB_PASSWORD=…
```

### Meldung, wenn es schiefgeht

Ein Backup, dessen Ausfall niemand bemerkt, ist keins. Wenn in der `.env` ein
Thema hinterlegt ist, meldet sich das Skript bei jedem Fehler über ntfy:

```
MINIS_BACKUP_NTFY_TOPIC=ein-eigenes-thema-fuer-meldungen
```

Gemeldet wird jeder Schritt: ein fehlgeschlagener `mysqldump`, ein leerer oder
unvollständiger Dump, ein Fehler beim CSV-Export, und — der Fall, der sonst
unbemerkt bleibt — ein **fehlgeschlagenes `git push`**. Der Commit liegt dann
lokal, und die Sicherung ist faktisch beendet, ohne dass es auffällt.

### Zurückspielen

Einmal ausprobieren, solange nichts brennt. Ein Backup, das nie zurückgespielt
wurde, ist eine Vermutung:

```bash
# In eine Testdatenbank, nicht über den Bestand
mariadb -e "CREATE DATABASE minis_test"
mariadb minis_test < /root/minis-backup/dump.sql

# Gegenprobe: gleiche Zeilenzahl wie im Original?
mariadb -e "SELECT COUNT(*) FROM minis.plan"
mariadb -e "SELECT COUNT(*) FROM minis_test.plan"

mariadb -e "DROP DATABASE minis_test"
```

Im Ernstfall auf den Bestand, mit einem älteren Stand aus der Historie:

```bash
cd /root/minis-backup
git log --oneline                 # gewünschten Stand suchen
git show <commit>:dump.sql > /tmp/wiederherstellung.sql
docker compose -f /root/minis-app/docker-compose.yml stop server
mariadb minis < /tmp/wiederherstellung.sql
docker compose -f /root/minis-app/docker-compose.yml start server
```

### Was dieses Verfahren leistet und was nicht

- **Auswärtige Ablage:** ja, das Git-Remote liegt nicht auf der VM. Ein
  Totalverlust der VM ist abgedeckt.
- **Aufbewahrung:** die Git-Historie, also unbegrenzt. Alte Stände lassen sich
  nicht löschen, das Repository wächst dauerhaft. Ein Lauf ohne Änderungen
  committet nichts (`--skip-dump-date`), es entsteht also nicht dreimal am Tag
  ein Eintrag ohne Inhalt.
- **Datenverlust im Ernstfall:** bis zu 8 Stunden.
- **Personenbezogene Daten:** Dump und CSV enthalten Namen, Kontaktdaten und —
  solange die Passwörter nicht gehasht sind — die Passwörter im Klartext. Von
  61 Konten, überwiegend Kinder. Beides liegt damit dauerhaft und praktisch
  unlöschbar beim Anbieter des Git-Remotes. Das ist eine bewusste Entscheidung;
  der wirksame Hebel dagegen ist nicht das Backup, sondern die Passwörter zu
  hashen. Soll eine Spalte doch aus den CSVs herausbleiben, geht das über
  `AUSGESCHLOSSEN` in `backup/export_csv.py` — der Dump kann sie nicht
  auslassen, weil er sonst zum Zurückspielen unbrauchbar wäre.

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

```bash
mariadb minis < server/migrations/002_kontaktdaten.sql
mariadb minis < server/migrations/003_kalender_token.sql
```

`001` legt UNIQUE-Indizes auf `ban`, `user_weekday` und `preference_together`.
Die Anwendung verlässt sich darauf: sie fängt den MySQL-Fehler 1062 ab und
behandelt einen doppelten Eintrag als „schon erledigt" statt als Fehler. Ohne
die Indizes gibt es diesen Fehler nicht und es entstehen stille Duplikate.

`002` ergänzt `user` um `phone`, `email` und `note`. Alle drei sind optional.
Telefon und E-Mail darf jeder für sich selbst pflegen; die Bemerkung ist eine
Notiz des Ministrantenrats und wird einem Ministranten weder ausgeliefert noch
von ihm angenommen. In `/userHead` — die Liste, die jeder Angemeldete für die
Wunschpartner-Auswahl lesen darf — und im PDF-Plan erscheinen die Spalten
nicht.

## Der Plan als PDF

Zwei Layouts, beide über `go-pdf/fpdf`:

| Route | Rechte | Inhalt |
|---|---|---|
| `GET /pdf/events?from=&to=` | ab Rolle 2 | der Aushang: je Messe eine Namensliste |
| `GET /pdf/events/:userId?from=` | eigene Id oder ab Rolle 2 | der persönliche Plan: eine Zeile je Termin, mit Uhrzeit, Ort und den Mitzugeteilten |

Der persönliche Plan beginnt ohne `from` bei heute — ein Ausdruck mit den
Einsätzen des letzten Jahres gehört nicht an den Kühlschrank.

## Kalender-Abo

Jeder kann sich unter „Meine Einstellungen → Kalender" einen persönlichen Link
erzeugen und im Handy-Kalender abonnieren. Danach stehen die eigenen Einsätze im
Familienkalender — mit der Erinnerung, die der Kalender ohnehin kann, und
sichtbar auch für die Eltern, ohne dass die die App installieren müssen.

```
https://ministranten.dynv6.net:33333/server/ical/<token>
```

Drei Punkte, an denen so etwas sonst schiefgeht:

- **Der Link ist ein Zugangsmittel, kein Datum.** Wer ihn hat, sieht die
  Einsätze dieser Person ohne Anmeldung. Deshalb ist es ein eigener
  Zufallswert (`user.calendar_token`) und nicht das JWT der Anwendung, deshalb
  liest und schreibt ihn **nur die Person selbst** — auch ein Admin bekommt
  einen fremden Link nicht (`AllowSelfOnly`) —, und deshalb lässt er sich neu
  erzeugen: damit ist der alte sofort wertlos.
- **Stabile `UID` je Termin**, gebildet aus der Id der Messe. Ohne sie legt der
  Kalender bei jeder Aktualisierung neue Termine an, statt die vorhandenen zu
  ändern.
- **Zeiten in UTC.** Die Datenbank speichert lokale Zeit ohne Zone; ausgegeben
  wird `DTSTART:…Z`. Das erspart einen `VTIMEZONE`-Block, den jeder Client
  anders auslegt. Damit die Umrechnung auf dem distroless-Image funktioniert,
  bindet `main.go` `time/tzdata` ein — dort gibt es kein
  `/usr/share/zoneinfo`.

Die Dauer einer Messe ist mit einer Stunde angenommen; die Datenbank kennt nur
den Beginn.

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

