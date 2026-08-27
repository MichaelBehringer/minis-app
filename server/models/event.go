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

// PlanEvent ist eine Messe im Gesamtplan: Namen der Eingeteilten fuer die
// Anzeige, Ids fuer die Frage "bin ich dabei".
//
// Eigener Typ und nicht Event oder PlannedEvent: der Gesamtplan ist fuer JEDEN
// Angemeldeten lesbar, deshalb soll an dieser Nutzlast genau stehen, was dort
// hinein darf - und nicht versehentlich mitwachsen, wenn Event erweitert wird.
type PlanEvent struct {
	Id              int      `json:"id"`
	Name            string   `json:"name"`
	DateBegin       string   `json:"dateBegin"`
	TimeBegin       string   `json:"timeBegin"`
	Location        string   `json:"location"`
	MinimalUser     int      `json:"minimalUser"`
	AssignedNames   []string `json:"assignedNames"`
	AssignedUserIds []int    `json:"assignedUserIds"`
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

// BanRangeUpdate sperrt oder gibt einen ganzen Zeitraum frei.
//
// Nur die Grenzen werden uebertragen, nicht die einzelnen Tage: der Server
// rechnet sie aus. Zwei Wochen Urlaub sind damit eine Anfrage statt vierzehn.
type BanRangeUpdate struct {
	From string `json:"from"`
	To   string `json:"to"`
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
