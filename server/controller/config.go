package controller

import (
	"fmt"
	"os"
	"strings"
)

// Env liest eine Umgebungsvariable und faellt auf def zurueck, wenn sie nicht
// gesetzt oder leer ist.
func Env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

// pflichtwerte sind die Variablen, die keinen Default haben duerfen.
//
// Vorher stand hinter beiden der echte Produktivwert im Quellcode: der DSN
// samt Host und Passwort (dbController.go) und der Signaturschluessel
// (authController.go). Gedacht war das als "startet auch ohne .env". Der Preis
// war, dass ein `go run .` ohne .env sich mit der PRODUKTIVDATENBANK verbindet.
//
// Die Werte stehen ohnehin in der Git-Historie; sie aus dem Code zu nehmen holt
// keine Vertraulichkeit zurueck. Was es verhindert, ist der Fehlgriff.
var pflichtwerte = []string{"MINIS_DB_DSN", "MINIS_JWT_SECRET"}

// PruefePflichtwerte gibt einen Fehler zurueck, wenn eine Pflichtvariable
// fehlt. Aufzurufen beim Start, vor dem ersten Zugriff auf die Datenbank.
//
// Dieselbe Strenge wie in docker-compose.yml, wo ${VAR:?...} den Start
// abbricht - dort galt sie bisher nur fuer den Container.
func PruefePflichtwerte() error {
	fehlend := []string{}
	for _, key := range pflichtwerte {
		if strings.TrimSpace(os.Getenv(key)) == "" {
			fehlend = append(fehlend, key)
		}
	}
	if len(fehlend) == 0 {
		return nil
	}

	return fmt.Errorf(
		"%s nicht gesetzt. Lokal: cp server/.env.example server/.env und ausfuellen. Im Container: siehe .env neben der docker-compose.yml",
		strings.Join(fehlend, " und "),
	)
}
