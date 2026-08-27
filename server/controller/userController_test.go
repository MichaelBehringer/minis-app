package controller

import (
	"errors"
	"testing"
)

// Die Rollenregel ist die sicherheitsrelevante Stelle an den Stammdaten: bis
// hierher konnte die Rolle ueberhaupt nicht ueber die Anwendung geaendert
// werden (role_id stand in keinem UPDATE), jetzt kann sie es - und dann muss
// klar sein, wer welche Rolle vergeben darf.
func TestPruefeRollenwechsel(t *testing.T) {
	const (
		mini      = 1
		rat       = 2
		admin     = 3
		ichBinRat = 5
		anderer   = 9
	)

	faelle := []struct {
		name        string
		eigeneRolle int
		eigeneId    int
		zielId      int
		alteRolle   int
		neueRolle   int
		erwartet    error
	}{
		{
			// Der Normalfall: die Maske schickt immer alle Felder, auch die
			// unveraenderten. Ohne diese Ausnahme koennte niemand mehr seinen
			// eigenen Vornamen speichern.
			name: "gleiche Rolle ist kein Wechsel", eigeneRolle: rat,
			eigeneId: ichBinRat, zielId: ichBinRat, alteRolle: rat, neueRolle: rat,
			erwartet: nil,
		},
		{
			name: "Rat macht einen Mini zum Rat", eigeneRolle: rat,
			eigeneId: ichBinRat, zielId: anderer, alteRolle: mini, neueRolle: rat,
			erwartet: nil,
		},
		{
			name: "Rat stuft einen Rat zum Mini zurueck", eigeneRolle: rat,
			eigeneId: ichBinRat, zielId: anderer, alteRolle: rat, neueRolle: mini,
			erwartet: nil,
		},
		{
			// Der Fall, um den es hier geht.
			name: "Rat hebt die eigene Rolle nicht an", eigeneRolle: rat,
			eigeneId: ichBinRat, zielId: ichBinRat, alteRolle: rat, neueRolle: admin,
			erwartet: ErrEigeneRolle,
		},
		{
			// Auch das Absenken der eigenen Rolle nicht - sonst sperrt sich der
			// letzte Admin selbst aus der Einteilung aus.
			name: "auch das Absenken der eigenen Rolle nicht", eigeneRolle: admin,
			eigeneId: ichBinRat, zielId: ichBinRat, alteRolle: admin, neueRolle: mini,
			erwartet: ErrEigeneRolle,
		},
		{
			name: "Rat vergibt keine Adminrolle", eigeneRolle: rat,
			eigeneId: ichBinRat, zielId: anderer, alteRolle: mini, neueRolle: admin,
			erwartet: ErrRolleNichtErlaubt,
		},
		{
			name: "Admin vergibt die Adminrolle", eigeneRolle: admin,
			eigeneId: ichBinRat, zielId: anderer, alteRolle: mini, neueRolle: admin,
			erwartet: nil,
		},
		{
			// Eine Rolle 0 oder negativ gibt es nicht; die Fremdschluessel
			// wuerden es abweisen, aber mit einer 500 statt einer Meldung.
			name: "Rolle 0 gibt es nicht", eigeneRolle: admin,
			eigeneId: ichBinRat, zielId: anderer, alteRolle: mini, neueRolle: 0,
			erwartet: ErrRolleNichtErlaubt,
		},
	}

	for _, f := range faelle {
		t.Run(f.name, func(t *testing.T) {
			err := PruefeRollenwechsel(f.eigeneRolle, f.eigeneId, f.zielId, f.alteRolle, f.neueRolle)
			if !errors.Is(err, f.erwartet) {
				t.Errorf("Fehler = %v, erwartet %v", err, f.erwartet)
			}
		})
	}
}

func TestPruefeRollenvergabe(t *testing.T) {
	// Beim Anlegen gibt es keine alte Rolle, nur die Obergrenze.
	if err := PruefeRollenvergabe(2, 2); err != nil {
		t.Errorf("eigene Rolle vergeben: %v", err)
	}
	if err := PruefeRollenvergabe(2, 3); !errors.Is(err, ErrRolleNichtErlaubt) {
		t.Errorf("hoehere Rolle vergeben: %v", err)
	}
	if err := PruefeRollenvergabe(3, 1); err != nil {
		t.Errorf("Admin legt einen Mini an: %v", err)
	}
}
