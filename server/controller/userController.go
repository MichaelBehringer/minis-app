package controller

import (
	. "minisAPI/models"
)

func GetAllUserHead() ([]UserSmall, error) {
	results, err := ExecuteSQL("SELECT id, firstname, lastname FROM user WHERE active = 1 and role_id in (1, 2) ORDER BY lastname, firstname")
	if err != nil {
		return nil, err
	}
	defer results.Close()

	users := []UserSmall{}
	for results.Next() {
		var user UserSmall
		if err := results.Scan(&user.Id, &user.Firstname, &user.Lastname); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, results.Err()
}

func GetAllUser() ([]User, error) {
	results, err := ExecuteSQL("SELECT id, firstname, lastname, username, role_id, active, incense FROM user ORDER BY active DESC, lastname, firstname")
	if err != nil {
		return nil, err
	}
	defer results.Close()

	users := []User{}
	for results.Next() {
		var user User
		if err := results.Scan(&user.Id, &user.Firstname, &user.Lastname, &user.Username, &user.RoleId, &user.Active, &user.Incense); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, results.Err()
}

func GetUser(userId string) (User, error) {
	var user User
	err := ExecuteSQLRow("SELECT id, firstname, lastname, username, role_id, active, incense FROM user WHERE id = ?", userId).
		Scan(&user.Id, &user.Firstname, &user.Lastname, &user.Username, &user.RoleId, &user.Active, &user.Incense)
	return user, err
}

// GetRoles liefert die Rollen aus der Datenbank.
//
// Bisher wurde die Rolle in der Stammdatenmaske als rohe Zahl eingetippt, ohne
// dass irgendwo stand, welche Zahl was bedeutet.
func GetRoles() ([]Role, error) {
	results, err := ExecuteSQL("SELECT id, name FROM role ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer results.Close()

	roles := []Role{}
	for results.Next() {
		var role Role
		if err := results.Scan(&role.Id, &role.Name); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, results.Err()
}

func UpdateUser(userId string, user User) error {
	_, err := ExecuteDDL("UPDATE user SET firstname=?, lastname=?, active=?, incense=? WHERE id=?",
		user.Firstname, user.Lastname, user.Active, user.Incense, userId)
	return err
}

func UpdatePassword(userId string, password string) error {
	_, err := ExecuteDDL("UPDATE user SET password=? WHERE id=?", password, userId)
	return err
}

// Zu den Wunschpartnern, weil die Richtung hier zwei verschiedene Dinge
// bedeutet:
//
// Der Bearbeiten-Reiter zeigt und pflegt bewusst nur die EIGENEN Wuensche,
// also die Zeilen mit user_id_1 = ich. Wuerde er beide Richtungen zeigen,
// stuenden dort plotzlich Namen, die man selbst nie eingetragen hat, und die
// Grenze von drei Partnern waere schon durch die Wuensche anderer belegt.
//
// Der Hinweis beim Einteilen liest dagegen beide Richtungen (siehe
// GetAssignmentOptionsForEvent) - dort geht es um das Paar, nicht darum, wer
// es eingetragen hat. Von den gepflegten Paaren hat nur ein Teil eine
// Gegenrichtung; eine einseitige Abfrage haette den Hinweis von der
// Eingabereihenfolge abhaengig gemacht.

func AddPreferredUser(userId string, otherId int) error {
	_, err := ExecuteDDL("INSERT INTO preference_together (user_id_1, user_id_2) VALUES (?, ?)", userId, otherId)
	// Dasselbe Paar zweimal ist keine Meldung wert.
	if istDoppelterEintrag(err) {
		return nil
	}
	return err
}

func RemovePreferredUser(userId string, otherId int) error {
	_, err := ExecuteDDL("DELETE FROM preference_together WHERE user_id_1 = ? AND user_id_2 = ?", userId, otherId)
	return err
}

func GetPreferredUsers(userId string) ([]int, error) {
	results, err := ExecuteSQL("SELECT user_id_2 FROM preference_together WHERE user_id_1 = ?", userId)
	if err != nil {
		return nil, err
	}
	defer results.Close()

	// Nicht als nil-Slice: die JSON-Antwort waere sonst null statt [], und die
	// Anwendung muesste beides unterscheiden.
	list := []int{}
	for results.Next() {
		var w int
		if err := results.Scan(&w); err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, results.Err()
}
