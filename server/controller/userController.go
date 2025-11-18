package controller

import (
	. "minisAPI/models"

	_ "github.com/go-sql-driver/mysql"
)

func GetAllUserHead() []UserSmall {
	results := ExecuteSQL("SELECT id, firstname, lastname FROM user WHERE active = 1 and role_id in (1, 2) ORDER BY lastname, firstname")
	users := []UserSmall{}
	for results.Next() {
		var user UserSmall
		results.Scan(&user.Id, &user.Firstname, &user.Lastname)
		users = append(users, user)
	}
	return users
}

func GetAllUser() []User {
	results := ExecuteSQL("SELECT id, firstname, lastname, username, role_id, active, incense FROM user ORDER BY active DESC, lastname, firstname")
	users := []User{}
	for results.Next() {
		var user User
		results.Scan(&user.Id, &user.Firstname, &user.Lastname, &user.Username, &user.RoleId, &user.Active, &user.Incense)
		users = append(users, user)
	}
	return users
}

func GetUser(userId string) User {
	var user User
	ExecuteSQLRow("SELECT id, firstname, lastname, username, role_id, active, incense FROM user WHERE id = ?", userId).Scan(&user.Id, &user.Firstname, &user.Lastname, &user.Username, &user.RoleId, &user.Active, &user.Incense)
	return user
}

func GetUserForUsername(username string) User {
	var user User
	ExecuteSQLRow("SELECT id, firstname, lastname, username, role_id, active, incense FROM user WHERE upper(username) = (?)", username).Scan(&user.Id, &user.Firstname, &user.Lastname, &user.Username, &user.RoleId, &user.Active, &user.Incense)
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

func AddPreferredUser(userId string, otherId int) {
	ExecuteDDL("INSERT INTO preference_together (user_id_1, user_id_2) VALUES (?, ?)", userId, otherId)
}

func RemovePreferredUser(userId string, otherId int) {
	db.Exec("DELETE FROM preference_together WHERE user_id_1 = ? AND user_id_2 = ?", userId, otherId)
}

func GetPreferredUsers(userId string) []int {
	results := ExecuteSQL("SELECT user_id_2 FROM preference_together WHERE user_id_1 = ?", userId)

	var list []int
	for results.Next() {
		var w int
		results.Scan(&w)
		list = append(list, w)
	}
	return list
}
