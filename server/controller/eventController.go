package controller

import (
	"database/sql"
	"errors"
	"fmt"
	. "minisAPI/models"
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
	return events, results.Err()
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

				WHEN ? = 0 AND NOT EXISTS (
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
