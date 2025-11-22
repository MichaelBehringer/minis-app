package models

type Event struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	DateBegin   string `json:"dateBegin"`
	TimeBegin   string `json:"timeBegin"`
	LocationID  int    `json:"locationId"`
	Location    string `json:"location"`
	MinimalUser int    `json:"minimalUser"`
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
