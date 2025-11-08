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
