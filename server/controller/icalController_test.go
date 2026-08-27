package controller

import (
	. "minisAPI/models"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestIcsText(t *testing.T) {
	faelle := []struct {
		name     string
		ein      string
		erwartet string
	}{
		{
			// Ohne Maskierung zerlegt ein Komma den Wert in mehrere - aus einem
			// Namen werden zwei Werte, und der Kalender zeigt Unsinn.
			name: "Komma", ein: "Sonntagsmesse, Hochamt",
			erwartet: `Sonntagsmesse\, Hochamt`,
		},
		{
			name: "Semikolon", ein: "Taufe; Hochzeit",
			erwartet: `Taufe\; Hochzeit`,
		},
		{
			// Ein Zeilenumbruch beendet sonst das Feld mitten im Text und der
			// Rest wird als eigene, unbekannte Eigenschaft gelesen.
			name: "Zeilenumbruch", ein: "Zeile1\r\nZeile2",
			erwartet: `Zeile1\nZeile2`,
		},
		{
			name: "Backslash zuerst", ein: `a\b`,
			erwartet: `a\\b`,
		},
		{
			name: "Umlaute bleiben", ein: "Bodenmüller",
			erwartet: "Bodenmüller",
		},
	}

	for _, f := range faelle {
		t.Run(f.name, func(t *testing.T) {
			if got := icsText(f.ein); got != f.erwartet {
				t.Errorf("icsText(%q) = %q, erwartet %q", f.ein, got, f.erwartet)
			}
		})
	}
}

func TestIcsFalten(t *testing.T) {
	t.Run("kurze Zeile bleibt", func(t *testing.T) {
		kurz := "SUMMARY:Vorabendmesse"
		if got := icsFalten(kurz); got != kurz {
			t.Errorf("kurze Zeile veraendert: %q", got)
		}
	})

	t.Run("jede Zeile bleibt unter 76 Oktetten", func(t *testing.T) {
		// RFC 5545 verlangt das. Eine Beschreibung mit acht Namen ist schnell
		// laenger - genau der Normalfall hier.
		lang := "DESCRIPTION:Eingeteilt: " + strings.Repeat("Anna Adler, ", 12)
		for _, zeile := range strings.Split(icsFalten(lang), "\r\n") {
			if len(zeile) > 75 {
				t.Errorf("Zeile mit %d Oktetten: %q", len(zeile), zeile)
			}
		}
	})

	t.Run("Fortsetzungen beginnen mit einem Leerzeichen", func(t *testing.T) {
		lang := "DESCRIPTION:" + strings.Repeat("x", 200)
		zeilen := strings.Split(icsFalten(lang), "\r\n")
		if len(zeilen) < 3 {
			t.Fatalf("nicht gefaltet: %d Zeilen", len(zeilen))
		}
		for _, zeile := range zeilen[1:] {
			if !strings.HasPrefix(zeile, " ") {
				t.Errorf("Fortsetzung ohne Leerzeichen: %q", zeile)
			}
		}
	})

	t.Run("trennt nicht mitten in einem Umlaut", func(t *testing.T) {
		// Gezaehlt wird in Oktetten; ein Umlaut braucht zwei. Ein Schnitt
		// dazwischen macht die Datei unlesbar.
		lang := "DESCRIPTION:" + strings.Repeat("ü", 100)
		zusammen := strings.ReplaceAll(icsFalten(lang), "\r\n ", "")
		if zusammen != lang {
			t.Error("der zusammengesetzte Text stimmt nicht mehr")
		}
		for _, zeile := range strings.Split(icsFalten(lang), "\r\n") {
			if !utf8.ValidString(zeile) {
				t.Errorf("Zeile ist kein gueltiges UTF-8: %q", zeile)
			}
		}
	})
}

func TestBaueKalender(t *testing.T) {
	events := []Event{
		{
			Id:            42,
			Name:          "Vorabendmesse",
			DateBegin:     "2026-09-05",
			TimeBegin:     "18:00:00",
			Location:      "Stadtpfarrkirche",
			AssignedNames: []string{"Anna Adler", "Ben Bauer"},
		},
		{
			// Winterzeit: hier gilt +01:00, im September +02:00. Beides muss
			// stimmen, sonst steht der Termin eine Stunde falsch im Kalender.
			Id:        43,
			Name:      "Christmette",
			DateBegin: "2026-12-24",
			TimeBegin: "22:00:00",
			Location:  "Stadtpfarrkirche",
		},
		{
			// Ein unlesbares Datum darf nicht die ganze Datei unbrauchbar
			// machen.
			Id:        44,
			Name:      "Kaputt",
			DateBegin: "kein Datum",
			TimeBegin: "18:00:00",
		},
	}

	ics := baueKalender("Ministrieren – Anna Adler", events)

	for _, muss := range []string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"END:VCALENDAR",
		// Stabile UID: ohne sie legt der Kalender bei jeder Aktualisierung neue
		// Termine an, statt die vorhandenen zu aendern.
		"UID:minis-event-42@ministranten.dynv6.net",
		"UID:minis-event-43@ministranten.dynv6.net",
		"SUMMARY:Vorabendmesse",
		"LOCATION:Stadtpfarrkirche",
		// Sommerzeit: 18:00 lokal ist 16:00 UTC.
		"DTSTART:20260905T160000Z",
		// Winterzeit: 22:00 lokal ist 21:00 UTC.
		"DTSTART:20261224T210000Z",
		"DURATION:PT1H",
	} {
		if !strings.Contains(ics, muss) {
			t.Errorf("%q fehlt in der Datei", muss)
		}
	}

	if strings.Contains(ics, "minis-event-44") {
		t.Error("der Termin mit unlesbarem Datum wurde aufgenommen")
	}

	// Genau zwei Termine, der dritte ist ausgefallen.
	if anzahl := strings.Count(ics, "BEGIN:VEVENT"); anzahl != 2 {
		t.Errorf("%d Termine, erwartet 2", anzahl)
	}
	if strings.Count(ics, "BEGIN:VEVENT") != strings.Count(ics, "END:VEVENT") {
		t.Error("BEGIN und END passen nicht zusammen")
	}

	// CRLF ist vorgeschrieben, nicht nur ueblich.
	if strings.Contains(strings.ReplaceAll(ics, "\r\n", ""), "\n") {
		t.Error("es gibt Zeilenenden ohne CR")
	}

	// Ein Termin ohne Eingeteilte braucht keine leere Beschreibung.
	if strings.Contains(ics, "DESCRIPTION:Eingeteilt: \r\n") {
		t.Error("leere Beschreibung ausgegeben")
	}
}

func TestKalenderFuerBenutzerOhneToken(t *testing.T) {
	// Ohne Datenbank pruefbar: ein leerer Token darf nicht zu einer Abfrage
	// fuehren, die zufaellig eine Zeile mit NULL trifft.
	if _, err := KalenderFuerBenutzer("   "); err != ErrKalenderTokenUnbekannt {
		t.Errorf("Fehler = %v, erwartet ErrKalenderTokenUnbekannt", err)
	}
}
