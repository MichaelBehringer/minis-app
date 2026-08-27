# server

Go-Backend des Ministrantenplans. Gin, MySQL/MariaDB, JWT.

## Starten

```bash
cp .env.example .env    # Zugang zur Testdatenbank, Signaturschluessel
go run .
```

Im Log muss `Datenbank erreichbar` stehen. `sql.Open` baut noch keine
Verbindung auf, sondern prueft nur den DSN - deshalb pingt `InitDB` einmal
explizit. Ohne das faellt ein falscher Zugang erst bei der ersten Anfrage
eines Nutzers auf.

## Tests

```bash
go test ./...
gofmt -l .
go vet ./...
```

Getestet ist, was ohne Datenbank pruefbar und sicherheitsrelevant ist: die
Rollenpruefung der Middleware und die Token-Behandlung. Der Test zum
`none`-Verfahren haelt fest, dass ein Token ohne Signatur abgelehnt wird -
ohne `jwt.WithValidMethods` wuerde die Bibliothek das im Token angegebene
Verfahren akzeptieren.

## Umgebungsvariablen

Siehe `.env.example`. Alle haben einen Default, damit die Anwendung lokal auch
ohne Datei startet; produktiv werden sie ueber docker-compose gesetzt.

| Variable | Zweck |
|---|---|
| `MINIS_DB_DSN` | Zugang zur Datenbank |
| `MINIS_JWT_SECRET` | Signaturschluessel der Anmeldung |
| `MINIS_LISTEN_ADDR` | Adresse, auf der gelauscht wird. Im Container `:8080` |

## Aufbau

| Datei | Inhalt |
|---|---|
| `main.go` | Routen, Handler, geordnetes Herunterfahren |
| `controller/authController.go` | Anmeldung, Token erzeugen und pruefen |
| `controller/dbController.go` | Verbindung samt Zeitgrenzen, die drei SQL-Helfer |
| `controller/eventController.go` | Messen, Einteilung, Verfuegbarkeit |
| `controller/userController.go` | Benutzer, Rollen, Wunschpartner |
| `controller/pdfController.go` | Plan als PDF |
| `middleware/authUser.go` | Token pruefen, Rollen durchsetzen |
| `schema.sql` | Schema der Datenbank |
| `migrations/` | einmalig anzuwendende Aenderungen an einer bestehenden Datenbank |
| `ressources/` | Schriften und Logo fuer die PDF-Erzeugung |

## Worauf zu achten ist

**Die drei SQL-Helfer geben Fehler zurueck.** `ExecuteSQL` gab bei einem Fehler
frueher `nil` zurueck, und kein Aufrufer hat das geprueft - `results.Next()` auf
`nil` ist eine Panik. `ExecuteDDL` verwarf den Fehler ganz, weshalb Handler
auch dann Erfolg meldeten, wenn nichts gespeichert wurde. Beide Rueckgabewerte
gehoeren geprueft.

**Rollen sind Untergrenzen.** Es gibt drei: 1 Ministrant, 2 Ministrantenrat,
3 Admin. `AllowMinRole(2)` laesst 2 und 3 durch. Ein Vergleich auf Gleichheit
wuerde den Admin aussperren.

**Die Anmeldeabfrage kommt ohne `UPPER()` aus.** Die Kollation von
`user.username` ist `utf8mb4_unicode_ci` und vergleicht ohnehin ohne Ruecksicht
auf Gross- und Kleinschreibung. Ein `UPPER()` um die Spalte macht nur den
UNIQUE-Index unbenutzbar.

**Klartext-Passwoerter.** `user.password` ist nicht gehasht. Siehe die
Anmerkung im README des Projekts.
