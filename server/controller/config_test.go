package controller

import (
	"strings"
	"testing"
)

// Der Start darf ohne diese Werte nicht durchlaufen. Vorher stand hinter beiden
// der echte Produktivwert im Quellcode - ein `go run .` ohne .env verband sich
// also mit der Produktivdatenbank.
func TestPruefePflichtwerte(t *testing.T) {
	t.Run("beide gesetzt", func(t *testing.T) {
		t.Setenv("MINIS_DB_DSN", "u:p@tcp(127.0.0.1:3306)/minis")
		t.Setenv("MINIS_JWT_SECRET", "geheim")
		if err := PruefePflichtwerte(); err != nil {
			t.Errorf("Fehler obwohl alles gesetzt: %v", err)
		}
	})

	t.Run("Schluessel fehlt", func(t *testing.T) {
		t.Setenv("MINIS_DB_DSN", "u:p@tcp(127.0.0.1:3306)/minis")
		t.Setenv("MINIS_JWT_SECRET", "")
		err := PruefePflichtwerte()
		if err == nil {
			t.Fatal("kein Fehler bei fehlendem Schluessel")
		}
		// Die Meldung muss sagen, was fehlt - sonst sucht man im Log.
		if !strings.Contains(err.Error(), "MINIS_JWT_SECRET") {
			t.Errorf("Meldung nennt die Variable nicht: %v", err)
		}
	})

	t.Run("nur Leerzeichen zaehlt als fehlend", func(t *testing.T) {
		t.Setenv("MINIS_DB_DSN", "   ")
		t.Setenv("MINIS_JWT_SECRET", "geheim")
		if err := PruefePflichtwerte(); err == nil {
			t.Error("Leerzeichen wurden als Wert akzeptiert")
		}
	})

	t.Run("beide fehlen werden beide genannt", func(t *testing.T) {
		t.Setenv("MINIS_DB_DSN", "")
		t.Setenv("MINIS_JWT_SECRET", "")
		err := PruefePflichtwerte()
		if err == nil {
			t.Fatal("kein Fehler")
		}
		for _, key := range pflichtwerte {
			if !strings.Contains(err.Error(), key) {
				t.Errorf("%s fehlt in der Meldung: %v", key, err)
			}
		}
	})
}
