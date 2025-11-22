package controller

import (
	. "minisAPI/models"

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
        INSERT INTO event (name, date_begin, time_begin, location_id, minimalUser)
        VALUES (?, ?, ?, ?, ?)
    `
	result := ExecuteDDL(
		statement,
		ev.Name,
		ev.DateBegin,
		ev.TimeBegin,
		ev.LocationID,
		ev.MinimalUser,
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
