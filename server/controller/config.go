package controller

import "os"

// Env liest eine Umgebungsvariable und faellt auf def zurueck, wenn sie nicht
// gesetzt oder leer ist.
//
// Die Defaults sind so gewaehlt, dass die Anwendung ohne gesetzte Variablen
// lokal startet. Fuer den Produktivbetrieb gehoeren sie in eine .env - siehe
// server/.env.example.
func Env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}
