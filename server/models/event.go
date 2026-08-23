package models

type Event struct {
	Id            int    `json:"id"`
	Name          string `json:"name"`
	DateBegin     string `json:"dateBegin"`
	TimeBegin     string `json:"timeBegin"`
	LocationID    int    `json:"locationId"`
	Location      string `json:"location"`
	MinimalUser   int    `json:"minimalUser"`
	IgnoreWeekday bool   `json:"ignoreWeekday"`
	// Wer sonst zu diesem Termin eingeteilt ist. Fuer die Startseite: nach
	// "wann bin ich dran" ist das die zweite Frage, und sie war bisher
	// nirgends zu beantworten.
	AssignedNames []string `json:"assignedNames"`
}

type PlannedEvent struct {
	Id              int    `json:"id"`
	Name            string `json:"name"`
	DateBegin       string `json:"dateBegin"`
	TimeBegin       string `json:"timeBegin"`
	LocationID      int    `json:"locationId"`
	Location        string `json:"location"`
	MinimalUser     int    `json:"minimalUser"`
	AssignedUserIds []int  `json:"assignedUserIds"`
}

// EventBatch ist die Nutzlast fuer das Anlegen mehrerer Messen auf einmal.
//
// Die Termine berechnet die Anwendung, weil sie sie dem Nutzer vorher als
// Vorschau zeigt - angelegt wird damit genau das, was er gesehen hat, und die
// Berechnung existiert nur an einer Stelle.
type EventBatch struct {
	Events []Event `json:"events"`
}

type SingleBanDateUpdate struct {
	Date string `json:"date"`
	Add  bool   `json:"add"`
}

type SingleWeekdayUpdate struct {
	Weekday string `json:"weekday"`
	Add     bool   `json:"add"`
}

type Location struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
}
