package controller

import (
	"database/sql"
	"errors"
	"fmt"
	. "minisAPI/models"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

// ErrBereitsEingeteilt: die Person ist fuer diese Messe schon eingeteilt.
//
// Die Tabelle plan hat einen UNIQUE-Index auf (user_id, event_id), ein
// doppeltes Zuweisen laeuft also in einen Datenbankfehler. Der wurde vorher
// verschluckt und der Handler meldete trotzdem Erfolg. Jetzt ist es ein
// eigener Fall - fachlich kein Fehler, sondern schon erledigt.
var ErrBereitsEingeteilt = errors.New("Diese Person ist fuer diese Messe bereits eingeteilt")

// istDoppelterEintrag erkennt den UNIQUE-Verstoss von MySQL (Fehler 1062).
func istDoppelterEintrag(err error) bool {
	var mysqlErr *mysql.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1062
}

func GetEventsForUser(userId string) ([]Event, error) {
	statement := `select e.id, e.name as eventName, e.date_begin, e.time_begin, e.location_id, l.name as locationName from event e
	inner join plan p on e.id = p.event_id
	inner join location l on l.id = e.location_id
	where p.user_id = ?
	order by date_begin`

	results, err := ExecuteSQL(statement, userId)
	if err != nil {
		return nil, err
	}
	defer results.Close()

	events := []Event{}
	for results.Next() {
		var event Event
		if err := results.Scan(&event.Id, &event.Name, &event.DateBegin, &event.TimeBegin, &event.LocationID, &event.Location); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	// Ohne diese Pruefung sieht ein Abbruch mitten im Lesen wie eine kurze
	// Liste aus - die Anwendung zeigt zu wenige Einsaetze und meldet nichts.
	if err := results.Err(); err != nil {
		return nil, err
	}
	// Erst schliessen, dann die zweite Abfrage: solange die aeussere Abfrage
	// laeuft, belegt sie ihre Verbindung.
	results.Close()

	for i := range events {
		namen, err := getAssignedNames(events[i].Id)
		if err != nil {
			return nil, err
		}
		events[i].AssignedNames = namen
	}

	return events, nil
}

// getAssignedNames liefert die Namen aller zu einem Termin eingeteilten
// Ministranten, alphabetisch.
func getAssignedNames(eventId int) ([]string, error) {
	rows, err := ExecuteSQL(`
		SELECT CONCAT(u.firstname, ' ', u.lastname)
		FROM plan p
		INNER JOIN user u ON u.id = p.user_id
		WHERE p.event_id = ?
		ORDER BY u.lastname, u.firstname`, eventId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	namen := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		namen = append(namen, name)
	}
	return namen, rows.Err()
}

func GetEventsByDateRange(from string, to string) ([]PlannedEvent, error) {
	statement := `select e.id, e.name as eventName, e.date_begin, e.time_begin,
        e.location_id, l.name as locationName, e.minimalUser
        from event e
        inner join location l on l.id = e.location_id
        where date_begin BETWEEN ? AND ?
        order by date_begin, time_begin`

	results, err := ExecuteSQL(statement, from, to)
	if err != nil {
		return nil, err
	}
	defer results.Close()

	events := []PlannedEvent{}
	for results.Next() {
		var event PlannedEvent
		if err := results.Scan(&event.Id, &event.Name, &event.DateBegin, &event.TimeBegin,
			&event.LocationID, &event.Location, &event.MinimalUser); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	if err := results.Err(); err != nil {
		return nil, err
	}

	// Erst nach dem Schliessen der Rows: die Zuweisungen brauchen eine eigene
	// Abfrage, und solange die aeussere laeuft, belegt sie ihre Verbindung.
	results.Close()

	for i := range events {
		zugewiesen, err := getAssignedUsers(events[i].Id)
		if err != nil {
			return nil, err
		}
		events[i].AssignedUserIds = zugewiesen
	}

	return events, nil
}

// GetPlanByDateRange liefert den Gesamtplan eines Zeitraums.
//
// Bis hierher sah ein Ministrant nur seine eigenen Einsaetze. Wer am Sonntag
// dran ist, stand nur im PDF - und das ist ab Rolle 2. Dabei haengt genau
// dieser Plan in der Kirche aus.
//
// Bewusst ohne minimalUser-Vergleich, ohne Kontaktdaten und ohne die Ids der
// Messe hinaus: Namen, Zeit, Ort. Genau das, was am Aushang steht.
func GetPlanByDateRange(from string, to string) ([]PlanEvent, error) {
	results, err := ExecuteSQL(`
		SELECT e.id, e.name, e.date_begin, e.time_begin, l.name, IFNULL(e.minimalUser, 0)
		FROM event e
		INNER JOIN location l ON l.id = e.location_id
		WHERE e.date_begin BETWEEN ? AND ?
		ORDER BY e.date_begin, e.time_begin`, from, to)
	if err != nil {
		return nil, err
	}
	defer results.Close()

	plan := []PlanEvent{}
	for results.Next() {
		var ev PlanEvent
		if err := results.Scan(&ev.Id, &ev.Name, &ev.DateBegin, &ev.TimeBegin,
			&ev.Location, &ev.MinimalUser); err != nil {
			return nil, err
		}
		plan = append(plan, ev)
	}
	if err := results.Err(); err != nil {
		return nil, err
	}

	// Erst nach dem Schliessen: solange die aeussere Abfrage laeuft, belegt sie
	// ihre Verbindung.
	results.Close()

	for i := range plan {
		namen, err := getAssignedNames(plan[i].Id)
		if err != nil {
			return nil, err
		}
		plan[i].AssignedNames = namen

		ids, err := getAssignedUsers(plan[i].Id)
		if err != nil {
			return nil, err
		}
		plan[i].AssignedUserIds = ids
	}

	return plan, nil
}

func AddUserToEvent(eventId string, userId int) error {
	_, err := ExecuteDDL(
		"INSERT INTO plan (user_id, event_id) VALUES (?, ?)",
		userId,
		eventId,
	)
	if istDoppelterEintrag(err) {
		return ErrBereitsEingeteilt
	}
	return err
}

func RemoveUserFromEvent(eventId string, userId int) error {
	_, err := ExecuteDDL(
		"DELETE FROM plan WHERE event_id = ? AND user_id = ?",
		eventId,
		userId,
	)
	return err
}

// ErrMesseNichtGefunden meldet eine Id, zu der es keine Messe gibt.
//
// Getrennt von technischen Fehlern, damit der Handler 404 antworten kann statt
// 500: eine Messe, die gerade von jemand anderem geloescht wurde, ist kein
// Serverfehler.
var ErrMesseNichtGefunden = errors.New("Diese Messe gibt es nicht")

// UpdateEvent aendert eine bestehende Messe.
//
// Bis hierher gab es nur Anlegen. Ein Tippfehler in Uhrzeit, Ort oder
// Sollstaerke war damit endgueltig - und eine Serie mit falschem Wochentag
// erzeugte dreissig Termine, die nur per SQL wieder wegzubekommen waren.
func UpdateEvent(eventId string, ev Event) error {
	res, err := ExecuteDDL(`
		UPDATE event
		SET name = ?, date_begin = ?, time_begin = ?, location_id = ?,
			minimalUser = ?, ignoreWeekday = ?
		WHERE id = ?`,
		ev.Name, ev.DateBegin, ev.TimeBegin, ev.LocationID,
		ev.MinimalUser, ev.IgnoreWeekday, eventId,
	)
	if err != nil {
		return err
	}

	// RowsAffected ist 0, wenn es die Id nicht gibt - aber auch, wenn sich
	// nichts geaendert hat. Deshalb getrennt nachsehen, ob die Messe existiert.
	betroffen, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if betroffen == 0 {
		var vorhanden int
		if err := ExecuteSQLRow("SELECT COUNT(*) FROM event WHERE id = ?", eventId).Scan(&vorhanden); err != nil {
			return err
		}
		if vorhanden == 0 {
			return ErrMesseNichtGefunden
		}
	}
	return nil
}

// DeleteEvent loescht eine Messe samt ihrer Einteilungen.
//
// In einer Transaktion, weil beides zusammengehoert: plan hat einen
// Fremdschluessel auf event, ein Loeschen ohne die Einteilungen schlaegt fehl -
// und ein Loeschen der Einteilungen ohne die Messe waere ein stiller
// Datenverlust. Die Zahl der entfernten Einteilungen geht zurueck, damit der
// Aufrufer sie melden kann.
func DeleteEvent(eventId string) (int, error) {
	tx, err := GetDB().Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res, err := tx.Exec("DELETE FROM plan WHERE event_id = ?", eventId)
	if err != nil {
		return 0, err
	}
	einteilungen, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}

	res, err = tx.Exec("DELETE FROM event WHERE id = ?", eventId)
	if err != nil {
		return 0, err
	}
	messen, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	if messen == 0 {
		return 0, ErrMesseNichtGefunden
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return int(einteilungen), nil
}

func CreateEvent(ev Event) (int, error) {
	statement := `
        INSERT INTO event (name, date_begin, time_begin, location_id, minimalUser, ignoreWeekday)
        VALUES (?, ?, ?, ?, ?, ?)
    `
	result, err := ExecuteDDL(
		statement,
		ev.Name,
		ev.DateBegin,
		ev.TimeBegin,
		ev.LocationID,
		ev.MinimalUser,
		ev.IgnoreWeekday,
	)
	if err != nil {
		return 0, err
	}

	// Stand vorher direkt hinter dem Aufruf: war result nil, weil das INSERT
	// fehlgeschlagen war, gab es hier eine Panik.
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	return int(id), nil
}

// CreateEvents legt mehrere Messen in einer Transaktion an.
//
// Entweder alle oder keine: eine halb angelegte Serie waere schlechter als
// keine, weil man die fehlenden Termine erst suchen muesste.
func CreateEvents(events []Event) ([]int, error) {
	if len(events) == 0 {
		return []int{}, nil
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	// Greift nur, wenn kein Commit stattgefunden hat.
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
        INSERT INTO event (name, date_begin, time_begin, location_id, minimalUser, ignoreWeekday)
        VALUES (?, ?, ?, ?, ?, ?)
    `)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	ids := make([]int, 0, len(events))
	for _, ev := range events {
		result, err := stmt.Exec(ev.Name, ev.DateBegin, ev.TimeBegin, ev.LocationID, ev.MinimalUser, ev.IgnoreWeekday)
		if err != nil {
			return nil, fmt.Errorf("Messe am %s: %w", ev.DateBegin, err)
		}
		id, err := result.LastInsertId()
		if err != nil {
			return nil, err
		}
		ids = append(ids, int(id))
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return ids, nil
}

func GetLocations() ([]Location, error) {
	results, err := ExecuteSQL("SELECT id, name FROM location ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer results.Close()

	list := []Location{}
	for results.Next() {
		var loc Location
		if err := results.Scan(&loc.Id, &loc.Name); err != nil {
			return nil, err
		}
		list = append(list, loc)
	}
	return list, results.Err()
}

// GetEventNames liefert die bisher verwendeten Messenamen, die haeufigsten
// zuerst.
//
// Der Name ist Freitext, und das ist im Bestand sichtbar auseinandergelaufen:
// 46 verschiedene Werte bei 122 Messen, darunter "Sontagsmesse" achtmal neben
// "Sonntagsmesse" vierundzwanzigmal. Derselbe Termintyp, zwei Schreibweisen,
// und im PDF steht es so, wie es eingetippt wurde. Eine Vorschlagsliste haelt
// das Muster, ohne Freitext zu verbieten.
func GetEventNames() ([]string, error) {
	results, err := ExecuteSQL(`
		SELECT name
		FROM event
		WHERE name IS NOT NULL AND TRIM(name) <> ''
		GROUP BY name
		ORDER BY COUNT(*) DESC, name
		LIMIT 40`)
	if err != nil {
		return nil, err
	}
	defer results.Close()

	namen := []string{}
	for results.Next() {
		var n string
		if err := results.Scan(&n); err != nil {
			return nil, err
		}
		namen = append(namen, n)
	}
	return namen, results.Err()
}

// ErrOrtNichtGefunden meldet eine Id, zu der es keinen Ort gibt.
var ErrOrtNichtGefunden = errors.New("Diesen Ort gibt es nicht")

// ErrOrtInBenutzung meldet einen Ort, an dem noch Messen haengen.
var ErrOrtInBenutzung = errors.New("An diesem Ort hängen noch Messen")

func CreateLocation(name string) (int, error) {
	res, err := ExecuteDDL("INSERT INTO location (name) VALUES (?)", name)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return int(id), nil
}

func UpdateLocation(locationId string, name string) error {
	res, err := ExecuteDDL("UPDATE location SET name = ? WHERE id = ?", name, locationId)
	if err != nil {
		return err
	}
	// RowsAffected ist auch 0, wenn der Name gleich geblieben ist - deshalb
	// getrennt nachsehen, ob es den Ort gibt.
	betroffen, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if betroffen == 0 {
		var vorhanden int
		if err := ExecuteSQLRow("SELECT COUNT(*) FROM location WHERE id = ?", locationId).Scan(&vorhanden); err != nil {
			return err
		}
		if vorhanden == 0 {
			return ErrOrtNichtGefunden
		}
	}
	return nil
}

// DeleteLocation loescht einen Ort, an dem keine Messe haengt.
//
// Bewusst mit eigener Pruefung statt den Fremdschluessel laufen zu lassen: der
// wuerde denselben Fall als Datenbankfehler melden, und der Nutzer bekaeme
// "Fehler beim Loeschen" statt "daran haengen noch 113 Messen".
func DeleteLocation(locationId string) error {
	var messen int
	if err := ExecuteSQLRow("SELECT COUNT(*) FROM event WHERE location_id = ?", locationId).Scan(&messen); err != nil {
		return err
	}
	if messen > 0 {
		return fmt.Errorf("%w (%d)", ErrOrtInBenutzung, messen)
	}

	res, err := ExecuteDDL("DELETE FROM location WHERE id = ?", locationId)
	if err != nil {
		return err
	}
	betroffen, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if betroffen == 0 {
		return ErrOrtNichtGefunden
	}
	return nil
}

func getAssignedUsers(eventId int) ([]int, error) {
	rows, err := ExecuteSQL("SELECT user_id FROM plan WHERE event_id = ?", eventId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []int{}
	for rows.Next() {
		var userId int
		if err := rows.Scan(&userId); err != nil {
			return nil, err
		}
		list = append(list, userId)
	}
	return list, rows.Err()
}

func GetBanDates(userId string) ([]string, error) {
	results, err := ExecuteSQL("SELECT ban_date FROM ban WHERE user_id = ?", userId)
	if err != nil {
		return nil, err
	}
	defer results.Close()

	// Nicht als nil-Slice: die JSON-Antwort waere sonst null statt [], und die
	// Anwendung muesste beides unterscheiden.
	dates := []string{}
	for results.Next() {
		var date string
		if err := results.Scan(&date); err != nil {
			return nil, err
		}
		dates = append(dates, date)
	}
	return dates, results.Err()
}

func AddBlockDate(userId string, date string) error {
	_, err := ExecuteDDL("INSERT INTO ban (user_id, ban_date) VALUES (?, ?)", userId, date)
	// Derselbe Tag zweimal ist keine Meldung wert - gesperrt ist gesperrt.
	if istDoppelterEintrag(err) {
		return nil
	}
	return err
}

func RemoveBlockDate(userId string, date string) error {
	_, err := ExecuteDDL("DELETE FROM ban WHERE user_id = ? AND ban_date = ?", userId, date)
	return err
}

// Obergrenze fuer einen Zeitraum. Ein Jahr deckt jeden sinnvollen Fall ab und
// begrenzt gleichzeitig, was ein Tippfehler im Datum anrichten kann.
const maxTageJeZeitraum = 366

// zeitraumGrenzen prueft die beiden Datumsangaben und bringt sie in die
// richtige Reihenfolge.
//
// Vertauschte Grenzen werden still korrigiert: wer im Kalender erst das Ende
// und dann den Anfang antippt, meint denselben Zeitraum.
// ZeitraumGrenzen liest und normalisiert die Grenzen eines Zeitraums.
//
// Exportiert, weil nicht nur das Sperren einen Zeitraum begrenzen muss: auch
// der Gesamtplan soll nicht in einem Aufruf den ganzen Bestand samt Namen
// herausgeben.
func ZeitraumGrenzen(von string, bis string) (time.Time, time.Time, error) {
	// Bewusst ohne %w um den Fehler von time.Parse: dessen Text nennt das
	// interne Layout ("as \"2006\"") und landet ueber den Handler beim Nutzer.
	a, err := time.Parse("2006-01-02", von)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("Startdatum nicht lesbar")
	}
	b, err := time.Parse("2006-01-02", bis)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("Enddatum nicht lesbar")
	}
	if b.Before(a) {
		a, b = b, a
	}

	// +1, weil beide Randtage dazugehoeren.
	tage := int(b.Sub(a).Hours()/24) + 1
	if tage > maxTageJeZeitraum {
		return time.Time{}, time.Time{}, fmt.Errorf("Zeitraum umfasst %d Tage, erlaubt sind %d", tage, maxTageJeZeitraum)
	}

	return a, b, nil
}

// AddBlockDates sperrt alle Tage eines Zeitraums und gibt zurueck, wie viele
// neu dazugekommen sind.
func AddBlockDates(userId string, von string, bis string) (int, error) {
	a, b, err := ZeitraumGrenzen(von, bis)
	if err != nil {
		return 0, err
	}

	// Ein INSERT mit mehreren Wertezeilen statt einer Anweisung je Tag.
	//
	// INSERT IGNORE, weil bereits gesperrte Tage kein Fehler sind: der
	// UNIQUE-Index auf (user_id, ban_date) wuerde sonst beim ersten schon
	// vorhandenen Tag abbrechen und den Rest des Zeitraums nicht mehr
	// eintragen.
	platzhalter := []string{}
	args := []interface{}{}
	for t := a; !t.After(b); t = t.AddDate(0, 0, 1) {
		platzhalter = append(platzhalter, "(?, ?)")
		args = append(args, userId, t.Format("2006-01-02"))
	}

	result, err := ExecuteDDL(
		"INSERT IGNORE INTO ban (user_id, ban_date) VALUES "+strings.Join(platzhalter, ", "),
		args...,
	)
	if err != nil {
		return 0, err
	}

	neu, err := result.RowsAffected()
	if err != nil {
		// Die Tage sind gesetzt, nur die Anzahl ist unbekannt. Kein Fehler,
		// den der Nutzer sehen muesste.
		return 0, nil
	}
	return int(neu), nil
}

// RemoveBlockDates gibt alle Tage eines Zeitraums wieder frei.
func RemoveBlockDates(userId string, von string, bis string) (int, error) {
	a, b, err := ZeitraumGrenzen(von, bis)
	if err != nil {
		return 0, err
	}

	result, err := ExecuteDDL(
		"DELETE FROM ban WHERE user_id = ? AND ban_date BETWEEN ? AND ?",
		userId, a.Format("2006-01-02"), b.Format("2006-01-02"),
	)
	if err != nil {
		return 0, err
	}

	entfernt, err := result.RowsAffected()
	if err != nil {
		return 0, nil
	}
	return int(entfernt), nil
}

func GetUserWeekdays(userId string) ([]string, error) {
	results, err := ExecuteSQL("SELECT weekday FROM user_weekday WHERE user_id = ?", userId)
	if err != nil {
		return nil, err
	}
	defer results.Close()

	list := []string{}
	for results.Next() {
		var w string
		if err := results.Scan(&w); err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, results.Err()
}

func AddUserWeekday(userId string, weekday string) error {
	_, err := ExecuteDDL("INSERT INTO user_weekday (user_id, weekday) VALUES (?, ?)", userId, weekday)
	if istDoppelterEintrag(err) {
		return nil
	}
	return err
}

func RemoveUserWeekday(userId string, weekday string) error {
	_, err := ExecuteDDL("DELETE FROM user_weekday WHERE user_id = ? AND weekday = ?", userId, weekday)
	return err
}

func GetAssignmentOptionsForEvent(eventId string) (EventAssignmentOptionsResponse, error) {
	var id int
	var dateBegin string
	var timeBegin string
	var ignoreWeekday int

	err := ExecuteSQLRow(`
		SELECT
			id,
			DATE_FORMAT(date_begin, '%Y-%m-%d'),
			TIME_FORMAT(time_begin, '%H:%i:%s'),
			IFNULL(ignoreWeekday, 0)
		FROM event
		WHERE id = ?
	`, eventId).Scan(&id, &dateBegin, &timeBegin, &ignoreWeekday)

	if err != nil {
		return EventAssignmentOptionsResponse{}, err
	}

	currentDateTime := dateBegin + " " + timeBegin

	weekdayKeys, err := getWeekdayKeys(dateBegin)
	if err != nil {
		return EventAssignmentOptionsResponse{}, err
	}

	rows, err := ExecuteSQL(`
		SELECT
			u.id,
			u.firstname,
			u.lastname,
			CASE
				WHEN IFNULL(u.active, 0) = 0 THEN 'inactive'

				WHEN EXISTS (
					SELECT 1
					FROM ban b
					WHERE b.user_id = u.id
					AND b.ban_date = ?
				) THEN 'banned'

				-- Nur wer ueberhaupt Wochentage gepflegt hat, kann sie
				-- verletzen. Ohne die erste EXISTS-Bedingung greift das
				-- NOT EXISTS auch bei null Zeilen: wer nie einen Wochentag
				-- eingetragen hat, galt damit bei jeder Messe als
				-- "Wochentag nicht aktiv" - im Bestand betraf das 6 der 33
				-- aktiven Ministranten, die schlicht nichts angegeben hatten.
				--
				-- Kein Eintrag heisst jetzt: keine Einschraenkung.
				WHEN ? = 0
					AND EXISTS (
						SELECT 1
						FROM user_weekday uw
						WHERE uw.user_id = u.id
					)
					AND NOT EXISTS (
						SELECT 1
						FROM user_weekday uw
						WHERE uw.user_id = u.id
						AND LOWER(TRIM(uw.weekday)) IN (?, ?, ?, ?)
					) THEN 'weekday_inactive'

				ELSE 'ok'
			END AS availability_status,

			(
				SELECT DATEDIFF(?, MAX(e_last.date_begin))
				FROM plan p_last
				INNER JOIN event e_last ON e_last.id = p_last.event_id
				WHERE p_last.user_id = u.id
				AND e_last.id <> ?
				AND (
					TIMESTAMP(e_last.date_begin, e_last.time_begin) < ?
					OR (
						TIMESTAMP(e_last.date_begin, e_last.time_begin) = ?
						AND e_last.id < ?
					)
				)
			) AS last_assignment_days_before,

			(
				SELECT DATEDIFF(MIN(e_next.date_begin), ?)
				FROM plan p_next
				INNER JOIN event e_next ON e_next.id = p_next.event_id
				WHERE p_next.user_id = u.id
				AND e_next.id <> ?
				AND (
					TIMESTAMP(e_next.date_begin, e_next.time_begin) > ?
					OR (
						TIMESTAMP(e_next.date_begin, e_next.time_begin) = ?
						AND e_next.id > ?
					)
				)
			) AS next_assignment_days_after,

			-- Wunschpartner, beide Richtungen. Die Tabelle wird nur in einer
			-- Richtung geschrieben, aber nicht symmetrisch gepflegt: nur
			-- user_id_1 abzufragen haette den Hinweis von der
			-- Eingabereihenfolge abhaengig gemacht.
			--
			-- DISTINCT ist noetig: haben sich zwei gegenseitig eingetragen,
			-- liegen zwei Zeilen fuer dasselbe Paar vor und die Id kaeme
			-- doppelt zurueck.
			(
				SELECT GROUP_CONCAT(DISTINCT
					CASE WHEN pt.user_id_1 = u.id THEN pt.user_id_2 ELSE pt.user_id_1 END
				)
				FROM preference_together pt
				WHERE pt.user_id_1 = u.id OR pt.user_id_2 = u.id
			) AS preferred_with

		FROM user u
		ORDER BY
			CASE availability_status
				WHEN 'ok' THEN 1
				WHEN 'weekday_inactive' THEN 2
				WHEN 'banned' THEN 3
				WHEN 'inactive' THEN 4
				ELSE 5
			END,
			u.lastname,
			u.firstname
	`,
		dateBegin,
		ignoreWeekday,
		weekdayKeys[0],
		weekdayKeys[1],
		weekdayKeys[2],
		weekdayKeys[3],

		dateBegin,
		id,
		currentDateTime,
		currentDateTime,
		id,

		dateBegin,
		id,
		currentDateTime,
		currentDateTime,
		id,
	)
	if err != nil {
		return EventAssignmentOptionsResponse{}, err
	}
	defer rows.Close()

	options := []EventAssignmentUserOption{}

	for rows.Next() {
		var user EventAssignmentUserOption
		var lastDays sql.NullInt64
		var nextDays sql.NullInt64
		var preferredWith sql.NullString

		if err := rows.Scan(
			&user.Id,
			&user.Firstname,
			&user.Lastname,
			&user.Status,
			&lastDays,
			&nextDays,
			&preferredWith,
		); err != nil {
			return EventAssignmentOptionsResponse{}, err
		}

		user.Reason = getAvailabilityReason(user.Status)

		if lastDays.Valid {
			v := int(lastDays.Int64)
			user.LastAssignmentDaysBefore = &v
		}

		if nextDays.Valid {
			v := int(nextDays.Int64)
			user.NextAssignmentDaysAfter = &v
		}

		user.PreferredWith = idListe(preferredWith)

		options = append(options, user)
	}
	if err := rows.Err(); err != nil {
		return EventAssignmentOptionsResponse{}, err
	}

	return EventAssignmentOptionsResponse{
		EventId:    id,
		Date:       dateBegin,
		WeekdayKey: weekdayKeys,
		Options:    options,
	}, nil
}

// idListe zerlegt die kommagetrennte Ausgabe von GROUP_CONCAT in Zahlen.
func idListe(wert sql.NullString) []int {
	ids := []int{}
	if !wert.Valid || wert.String == "" {
		return ids
	}

	var aktuell int
	var hatZiffer bool
	for _, z := range wert.String {
		if z >= '0' && z <= '9' {
			aktuell = aktuell*10 + int(z-'0')
			hatZiffer = true
			continue
		}
		if hatZiffer {
			ids = append(ids, aktuell)
			aktuell, hatZiffer = 0, false
		}
	}
	if hatZiffer {
		ids = append(ids, aktuell)
	}
	return ids
}

func getAvailabilityReason(status string) string {
	switch status {
	case "inactive":
		return "Diese Person ist inaktiv"
	case "banned":
		return "Diese Person hat an diesem Tag eine Sperrung"
	case "weekday_inactive":
		return "Diese Person hat diesen Wochentag eigentlich nicht aktiv"
	default:
		return "Diese Person kann an diesem Tag"
	}
}

func getWeekdayKeys(date string) ([]string, error) {
	d, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	switch d.Weekday() {
	case time.Monday:
		return []string{"mon", "mo", "1", "1"}, nil
	case time.Tuesday:
		return []string{"tue", "di", "2", "2"}, nil
	case time.Wednesday:
		return []string{"wed", "mi", "3", "3"}, nil
	case time.Thursday:
		return []string{"thu", "do", "4", "4"}, nil
	case time.Friday:
		return []string{"fri", "fr", "5", "5"}, nil
	case time.Saturday:
		return []string{"sat", "sa", "6", "6"}, nil
	case time.Sunday:
		return []string{"sun", "so", "7", "0"}, nil
	default:
		return []string{"", "", "", ""}, nil
	}
}
