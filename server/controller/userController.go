package controller

import (
	. "minisAPI/models"

	_ "github.com/go-sql-driver/mysql"
)

func GetUser(userId string) User {
	var user User
	ExecuteSQLRow("SELECT id, firstname, lastname, username, role_id, active, incense FROM user WHERE id = ?", userId).Scan(&user.Id, &user.Firstname, &user.Lastname, &user.Username, &user.RoleId, &user.Active, &user.Incense)
	return user
}

func UpdateUser(userId string, user User) bool {
	ExecuteDDL("UPDATE user SET firstname=?, lastname=?, active=?, incense=? WHERE id=?", user.Firstname, user.Lastname, user.Active, user.Incense, userId)
	return true
}

func UpdatePassword(userId string, password string) bool {
	ExecuteDDL("UPDATE user SET password=? WHERE id=?", password, userId)
	return true
}
