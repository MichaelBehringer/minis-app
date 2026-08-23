package controller

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/go-sql-driver/mysql"
)

func TestIdListe(t *testing.T) {
	faelle := []struct {
		name     string
		wert     sql.NullString
		erwartet []int
	}{
		{
			// GROUP_CONCAT liefert NULL, wenn es keine Zeile gibt.
			name:     "NULL wird eine leere Liste",
			wert:     sql.NullString{},
			erwartet: []int{},
		},
		{
			name:     "leerer Text",
			wert:     sql.NullString{String: "", Valid: true},
			erwartet: []int{},
		},
		{
			name:     "eine Id",
			wert:     sql.NullString{String: "7", Valid: true},
			erwartet: []int{7},
		},
		{
			name:     "mehrere Ids",
			wert:     sql.NullString{String: "3,17,42", Valid: true},
			erwartet: []int{3, 17, 42},
		},
		{
			name:     "mehrstellige Ids am Rand",
			wert:     sql.NullString{String: "100,2,68", Valid: true},
			erwartet: []int{100, 2, 68},
		},
	}

	for _, f := range faelle {
		t.Run(f.name, func(t *testing.T) {
			got := idListe(f.wert)
			if len(got) != len(f.erwartet) {
				t.Fatalf("%v, erwartet %v", got, f.erwartet)
			}
			for i := range got {
				if got[i] != f.erwartet[i] {
					t.Fatalf("%v, erwartet %v", got, f.erwartet)
				}
			}
		})
	}

	t.Run("gibt nie nil zurueck", func(t *testing.T) {
		// Sonst steht in der JSON-Antwort null statt [] und die Anwendung
		// muesste beides unterscheiden.
		if idListe(sql.NullString{}) == nil {
			t.Error("nil statt leerer Liste")
		}
	})
}

func TestIstDoppelterEintrag(t *testing.T) {
	if !istDoppelterEintrag(&mysql.MySQLError{Number: 1062, Message: "Duplicate entry"}) {
		t.Error("1062 wurde nicht als doppelter Eintrag erkannt")
	}
	if istDoppelterEintrag(&mysql.MySQLError{Number: 1045, Message: "Access denied"}) {
		t.Error("1045 wurde als doppelter Eintrag erkannt")
	}
	if istDoppelterEintrag(nil) {
		t.Error("nil wurde als doppelter Eintrag erkannt")
	}
	if istDoppelterEintrag(errors.New("irgendwas anderes")) {
		t.Error("fremder Fehler wurde als doppelter Eintrag erkannt")
	}
	// Muss auch durch ein Wrapping hindurch erkannt werden.
	umhuellt := errors.Join(errors.New("Kontext"), &mysql.MySQLError{Number: 1062})
	if !istDoppelterEintrag(umhuellt) {
		t.Error("umhuellter 1062 wurde nicht erkannt")
	}
}

func TestGetWeekdayKeys(t *testing.T) {
	// Die Werte in user_weekday sind MON..SUN; das SQL vergleicht sie mit
	// LOWER(TRIM(...)), deshalb muessen die Schluessel hier klein sein.
	faelle := map[string]string{
		"2026-08-23": "sun", // ein Sonntag
		"2026-08-24": "mon",
		"2026-08-29": "sat",
	}

	for datum, erwartet := range faelle {
		keys, err := getWeekdayKeys(datum)
		if err != nil {
			t.Fatalf("%s: %v", datum, err)
		}
		if keys[0] != erwartet {
			t.Errorf("%s ergab %q, erwartet %q", datum, keys[0], erwartet)
		}
	}

	if _, err := getWeekdayKeys("kein-datum"); err == nil {
		t.Error("unlesbares Datum ergab keinen Fehler")
	}
}
