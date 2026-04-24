package controller

import (
	. "minisAPI/models"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func GetEventsForUser(userId string) []Event {
	statement := `select e.id, e.name as eventName, e.date_begin, e.time_begin, e.location_id, l.name as locationName from event e
	inner join plan p on e.id = p.event_id
	inner join location l on l.id = e.location_id
	where p.user_id = ?
	order by date_begin`
	results := ExecuteSQL(statement, userId)
	events := []Event{}
	for results.Next() {
		var event Event
		results.Scan(&event.Id, &event.Name, &event.DateBegin, &event.TimeBegin, &event.LocationID, &event.Location)
		events = append(events, event)
	}
	return events
}

func GetEventsByDateRange(from string, to string) []PlannedEvent {
	statement := `select e.id, e.name as eventName, e.date_begin, e.time_begin, 
        e.location_id, l.name as locationName, e.minimalUser
        from event e
        inner join location l on l.id = e.location_id
        where date_begin BETWEEN ? AND ?
        order by date_begin, time_begin`

	results := ExecuteSQL(statement, from, to)
	events := []PlannedEvent{}

	for results.Next() {
		var event PlannedEvent
		results.Scan(&event.Id, &event.Name, &event.DateBegin, &event.TimeBegin,
			&event.LocationID, &event.Location, &event.MinimalUser)

		event.AssignedUserIds = getAssignedUsers(event.Id)

		events = append(events, event)
	}

	return events
}

func AddUserToEvent(eventId string, userId int) {
	ExecuteDDL(
		"INSERT INTO plan (user_id, event_id) VALUES (?, ?)",
		userId,
		eventId,
	)
}

func RemoveUserFromEvent(eventId string, userId int) {
	ExecuteDDL(
		"DELETE FROM plan WHERE event_id = ? AND user_id = ?",
		eventId,
		userId,
	)
}

func CreateEvent(ev Event) int {
	statement := `
        INSERT INTO event (name, date_begin, time_begin, location_id, minimalUser, ignoreWeekday)
        VALUES (?, ?, ?, ?, ?, ?)
    `
	result := ExecuteDDL(
		statement,
		ev.Name,
		ev.DateBegin,
		ev.TimeBegin,
		ev.LocationID,
		ev.MinimalUser,
		ev.IgnoreWeekday,
	)

	id, _ := result.LastInsertId()
	return int(id)
}

func GetLocations() []Location {
	results := ExecuteSQL("SELECT id, name FROM location ORDER BY name")
	list := []Location{}
	for results.Next() {
		var loc Location
		results.Scan(&loc.Id, &loc.Name)
		list = append(list, loc)
	}
	return list
}

func getAssignedUsers(eventId int) []int {
	rows := ExecuteSQL("SELECT user_id FROM plan WHERE event_id = ?", eventId)

	list := []int{}
	for rows.Next() {
		var userId int
		rows.Scan(&userId)
		list = append(list, userId)
	}
	return list
}

func GetBanDates(userId string) []string {
	statement := "SELECT ban_date FROM ban WHERE user_id = ?"
	results := ExecuteSQL(statement, userId)

	var dates []string
	for results.Next() {
		var date string
		results.Scan(&date)
		dates = append(dates, date)
	}
	return dates
}

func AddBlockDate(userId string, date string) {
	ExecuteDDL("INSERT INTO ban (user_id, ban_date) VALUES (?, ?)", userId, date)
}

func RemoveBlockDate(userId string, date string) {
	ExecuteDDL("DELETE FROM ban WHERE user_id = ? AND ban_date = ?", userId, date)
}

func GetUserWeekdays(userId string) []string {
	results := ExecuteSQL("SELECT weekday FROM user_weekday WHERE user_id = ?", userId)

	var list []string
	for results.Next() {
		var w string
		results.Scan(&w)
		list = append(list, w)
	}
	return list
}

func AddUserWeekday(userId string, weekday string) {
	ExecuteDDL("INSERT INTO user_weekday (user_id, weekday) VALUES (?, ?)", userId, weekday)
}

func RemoveUserWeekday(userId string, weekday string) {
	ExecuteDDL("DELETE FROM user_weekday WHERE user_id = ? AND weekday = ?", userId, weekday)
}

func GetAssignmentOptionsForEvent(eventId string) (EventAssignmentOptionsResponse, error) {
	var id int
	var dateBegin string
	var ignoreWeekday int

	err := ExecuteSQLRow(`
		SELECT 
			id,
			DATE_FORMAT(date_begin, '%Y-%m-%d'),
			IFNULL(ignoreWeekday, 0)
		FROM event
		WHERE id = ?
	`, eventId).Scan(&id, &dateBegin, &ignoreWeekday)

	if err != nil {
		return EventAssignmentOptionsResponse{}, err
	}

	weekdayKeys, err := getWeekdayKeys(dateBegin)
	if err != nil {
		return EventAssignmentOptionsResponse{}, err
	}

	rows := ExecuteSQL(`
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
		END AS availability_status
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
	)

	defer rows.Close()

	options := []EventAssignmentUserOption{}

	for rows.Next() {
		var user EventAssignmentUserOption

		rows.Scan(
			&user.Id,
			&user.Firstname,
			&user.Lastname,
			&user.Status,
		)

		user.Reason = getAvailabilityReason(user.Status)

		options = append(options, user)
	}

	return EventAssignmentOptionsResponse{
		EventId:    id,
		Date:       dateBegin,
		WeekdayKey: weekdayKeys,
		Options:    options,
	}, nil
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
