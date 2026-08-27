package controller

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	. "minisAPI/models"
	"strings"
	"time"
)

// Kalender-Abo: die Einsaetze eines Ministranten als ICS-Datei.
//
// Der Weg mit dem besten Verhaeltnis von Aufwand zu Nutzen. Einmal im
// Handy-Kalender abonniert, stehen die Einsaetze im Familienkalender - mit der
// Erinnerung, die der Kalender ohnehin kann, und sichtbar auch fuer die Eltern,
// ohne dass die die App installieren muessen.

// ErrKalenderTokenUnbekannt: zu diesem Link gehoert kein Benutzer.
var ErrKalenderTokenUnbekannt = errors.New("Dieser Kalender-Link gilt nicht mehr")

// Annahme fuer die Dauer eines Termins. Die Datenbank kennt nur den Beginn
// (event.time_begin), ein Ende gibt es nicht. Eine Stunde ist die Dauer einer
// Messe; ohne Angabe wuerden manche Kalender den Termin ueber den ganzen Tag
// legen.
const messeDauer = "PT1H"

// Zeitzone der Termine. Die Datenbank speichert lokale Zeit ohne Zone.
//
// Ausgegeben wird trotzdem in UTC (DTSTART mit Z): das braucht keinen
// VTIMEZONE-Block, den sonst jeder Client anders auslegt. Damit das auf dem
// distroless-Image funktioniert, bindet main.go time/tzdata ein - dort gibt es
// keine Zeitzonendateien im Dateisystem.
const zeitzone = "Europe/Berlin"

// NeuerKalenderToken erzeugt einen neuen Link und verwirft den alten.
//
// Damit ist ein Link, der irgendwo gelandet ist, wo er nicht hingehoert, mit
// einem Klick wertlos.
func NeuerKalenderToken(userId string) (string, error) {
	roh := make([]byte, 32)
	if _, err := rand.Read(roh); err != nil {
		return "", err
	}
	// URL-taugliche Kodierung ohne Auffuellzeichen: der Wert steht in einer
	// Adresse, die von Hand kopiert wird.
	token := base64.RawURLEncoding.EncodeToString(roh)

	res, err := ExecuteDDL("UPDATE user SET calendar_token = ? WHERE id = ?", token, userId)
	if err != nil {
		return "", err
	}
	betroffen, err := res.RowsAffected()
	if err != nil {
		return "", err
	}
	if betroffen == 0 {
		return "", sql.ErrNoRows
	}
	return token, nil
}

// KalenderToken liest den vorhandenen Link. Leer heisst: noch keiner vergeben.
func KalenderToken(userId string) (string, error) {
	var token sql.NullString
	err := ExecuteSQLRow("SELECT calendar_token FROM user WHERE id = ?", userId).Scan(&token)
	if err != nil {
		return "", err
	}
	return token.String, nil
}

// KalenderFuerBenutzer baut die ICS-Datei zu einem Link.
func KalenderFuerBenutzer(token string) (string, error) {
	if strings.TrimSpace(token) == "" {
		return "", ErrKalenderTokenUnbekannt
	}

	var userId int
	var vorname, nachname string
	err := ExecuteSQLRow(
		"SELECT id, firstname, lastname FROM user WHERE calendar_token = ?", token,
	).Scan(&userId, &vorname, &nachname)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrKalenderTokenUnbekannt
	}
	if err != nil {
		return "", err
	}

	events, err := GetEventsForUser(fmt.Sprint(userId))
	if err != nil {
		return "", err
	}

	name := strings.TrimSpace(vorname + " " + nachname)
	return baueKalender(fmt.Sprintf("Ministrieren – %s", name), events), nil
}

// KalenderFuerTermin baut die ICS-Datei zu einer einzelnen Messe, fuer die, die
// nichts abonnieren wollen.
func KalenderFuerTermin(eventId string) (Event, string, error) {
	var ev Event
	err := ExecuteSQLRow(`
		SELECT e.id, e.name, e.date_begin, e.time_begin, l.name
		FROM event e
		INNER JOIN location l ON l.id = e.location_id
		WHERE e.id = ?`, eventId,
	).Scan(&ev.Id, &ev.Name, &ev.DateBegin, &ev.TimeBegin, &ev.Location)
	if errors.Is(err, sql.ErrNoRows) {
		return Event{}, "", ErrMesseNichtGefunden
	}
	if err != nil {
		return Event{}, "", err
	}

	namen, err := getAssignedNames(ev.Id)
	if err != nil {
		return Event{}, "", err
	}
	ev.AssignedNames = namen

	return ev, baueKalender(ev.Name, []Event{ev}), nil
}

func baueKalender(titel string, events []Event) string {
	var b strings.Builder

	zeile := func(s string) {
		b.WriteString(icsFalten(s))
		// CRLF ist in RFC 5545 vorgeschrieben, nicht nur ueblich.
		b.WriteString("\r\n")
	}

	zeile("BEGIN:VCALENDAR")
	zeile("VERSION:2.0")
	zeile("PRODID:-//Pfarrei Wemding//Ministrantenplan//DE")
	zeile("CALSCALE:GREGORIAN")
	zeile("METHOD:PUBLISH")
	zeile("X-WR-CALNAME:" + icsText(titel))
	zeile("X-WR-TIMEZONE:" + zeitzone)
	// Hinweis an den Client, wie oft er nachsehen soll. Ohne Angabe fragen
	// manche einmal am Tag, andere einmal in der Woche.
	zeile("REFRESH-INTERVAL;VALUE=DURATION:PT12H")
	zeile("X-PUBLISHED-TTL:PT12H")

	jetzt := time.Now().UTC().Format("20060102T150405Z")

	for _, ev := range events {
		beginn, err := terminBeginn(ev.DateBegin, ev.TimeBegin)
		if err != nil {
			// Ein unlesbares Datum darf nicht die ganze Datei unbrauchbar
			// machen - dieser Termin faellt weg, der Rest bleibt.
			continue
		}

		zeile("BEGIN:VEVENT")
		// Stabile UID aus der Id der Messe. Ohne sie legt der Kalender bei jeder
		// Aktualisierung neue Termine an, statt die vorhandenen zu aendern -
		// der haeufigste Fehler bei ICS-Abos.
		zeile(fmt.Sprintf("UID:minis-event-%d@ministranten.dynv6.net", ev.Id))
		zeile("DTSTAMP:" + jetzt)
		zeile("DTSTART:" + beginn.UTC().Format("20060102T150405Z"))
		zeile("DURATION:" + messeDauer)
		zeile("SUMMARY:" + icsText(ev.Name))
		if ev.Location != "" {
			zeile("LOCATION:" + icsText(ev.Location))
		}
		if len(ev.AssignedNames) > 0 {
			zeile("DESCRIPTION:" + icsText("Eingeteilt: "+strings.Join(ev.AssignedNames, ", ")))
		}
		zeile("END:VEVENT")
	}

	zeile("END:VCALENDAR")
	return b.String()
}

func terminBeginn(datum string, zeit string) (time.Time, error) {
	ort, err := time.LoadLocation(zeitzone)
	if err != nil {
		return time.Time{}, err
	}
	if zeit == "" {
		zeit = "00:00:00"
	}
	return time.ParseInLocation("2006-01-02 15:04:05", datum+" "+zeit, ort)
}

// icsText maskiert die Sonderzeichen eines Textwerts nach RFC 5545.
//
// Ohne das zerlegt ein Komma im Messenamen den Wert in mehrere - und ein
// Zeilenumbruch beendet das Feld mitten im Text.
func icsText(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\r\n", "\\n")
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "\\n")
	s = strings.ReplaceAll(s, ";", "\\;")
	s = strings.ReplaceAll(s, ",", "\\,")
	return s
}

// icsFalten bricht eine Zeile auf hoechstens 75 Oktette um.
//
// RFC 5545 verlangt das, und eine Beschreibung mit acht Namen ist schnell
// laenger. Fortsetzungszeilen beginnen mit einem Leerzeichen. Gezaehlt wird in
// Oktetten, nicht in Zeichen: ein Umlaut braucht zwei, und ein Umbruch mitten
// in einem Zeichen macht die Datei unlesbar.
func icsFalten(zeile string) string {
	const grenze = 75

	if len(zeile) <= grenze {
		return zeile
	}

	var b strings.Builder
	rest := zeile
	erste := true

	for len(rest) > 0 {
		// Fortsetzungszeilen haben ein Leerzeichen vorweg und damit ein Oktett
		// weniger Platz.
		platz := grenze
		if !erste {
			platz = grenze - 1
		}

		if len(rest) <= platz {
			if !erste {
				b.WriteString("\r\n ")
			}
			b.WriteString(rest)
			break
		}

		// Nicht mitten in einem Mehrbyte-Zeichen trennen.
		schnitt := platz
		for schnitt > 0 && !gueltigerSchnitt(rest, schnitt) {
			schnitt--
		}
		if schnitt == 0 {
			schnitt = platz
		}

		if !erste {
			b.WriteString("\r\n ")
		}
		b.WriteString(rest[:schnitt])
		rest = rest[schnitt:]
		erste = false
	}

	return b.String()
}

// Ein Schnitt ist gueltig, wenn danach kein Folgebyte eines UTF-8-Zeichens
// steht (Bitmuster 10xxxxxx).
func gueltigerSchnitt(s string, i int) bool {
	if i >= len(s) {
		return true
	}
	return s[i]&0xC0 != 0x80
}
