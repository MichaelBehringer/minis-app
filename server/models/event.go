package models

type Event struct {
	Id         int    `json:"id"`
	Name       string `json:"name"`
	DateBegin  string `json:"dateBegin"`
	TimeBegin  string `json:"timeBegin"`
	LocationID int    `json:"locationId"`
	Location   string `json:"location"`
}
