package models

type UserHead struct {
	Id     int    `json:"id"`
	Name   string `json:"name"`
	RoleId int    `json:"roleId"`
}

type User struct {
	Id        int    `json:"id"`
	Firstname string `json:"firstname"`
	Lastname  string `json:"lastname"`
	Username  string `json:"username"`
	RoleId    int    `json:"roleId"`
	Active    int    `json:"active"`
	Incense   int    `json:"incense"`
	// Kontaktdaten. Optional; in der Datenbank NULL, hier der leere String.
	Phone string `json:"phone"`
	Email string `json:"email"`
	// Bemerkung des Ministrantenrats. Nur ab Rolle 2 - der Handler leert das
	// Feld, wenn ein Ministrant seine eigenen Daten abruft.
	Note string `json:"note"`
}

// NeuerBenutzer ist die Nutzlast fuer POST /user.
//
// Wie User, aber mit Passwort. Bewusst ein eigener Typ: das Passwort darf in
// keiner Antwort auftauchen, und User wird genau dafuer verwendet.
type NeuerBenutzer struct {
	Firstname string `json:"firstname"`
	Lastname  string `json:"lastname"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	RoleId    int    `json:"roleId"`
	Active    int    `json:"active"`
	Incense   int    `json:"incense"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
}

type Role struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
}

type UserSmall struct {
	Id        int    `json:"id"`
	Firstname string `json:"firstname"`
	Lastname  string `json:"lastname"`
}

type PreferredUpdate struct {
	OtherUserId int  `json:"otherUserId"`
	Add         bool `json:"add"`
}

type EventAssignmentUserOption struct {
	Id                       int    `json:"id"`
	Firstname                string `json:"firstname"`
	Lastname                 string `json:"lastname"`
	Status                   string `json:"status"`
	Reason                   string `json:"reason"`
	LastAssignmentDaysBefore *int   `json:"lastAssignmentDaysBefore,omitempty"`
	NextAssignmentDaysAfter  *int   `json:"nextAssignmentDaysAfter,omitempty"`
	// Ids der Wunschpartner, beide Richtungen. Dient als Hinweis beim
	// Einteilen von Hand - seit die automatische Zuteilung entfernt ist, ist
	// das die einzige Stelle, an der die gepflegten Wunschpaare noch wirken.
	PreferredWith []int `json:"preferredWith"`
}

type EventAssignmentOptionsResponse struct {
	EventId    int                         `json:"eventId"`
	Date       string                      `json:"date"`
	WeekdayKey []string                    `json:"weekdayKey"`
	Options    []EventAssignmentUserOption `json:"options"`
}
