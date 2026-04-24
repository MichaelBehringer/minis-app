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
	Id        int    `json:"id"`
	Firstname string `json:"firstname"`
	Lastname  string `json:"lastname"`
	Status    string `json:"status"`
	Reason    string `json:"reason"`
}

type EventAssignmentOptionsResponse struct {
	EventId    int                         `json:"eventId"`
	Date       string                      `json:"date"`
	WeekdayKey []string                    `json:"weekdayKey"`
	Options    []EventAssignmentUserOption `json:"options"`
}
