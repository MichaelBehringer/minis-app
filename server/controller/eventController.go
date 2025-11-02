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
