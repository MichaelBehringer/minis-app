package controller

import (
	"errors"

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

// Die Kontaktspalten sind NULL-bar. IFNULL statt sql.NullString an jeder
// Fundstelle: der leere String ist hier genau die richtige Bedeutung ("nicht
// hinterlegt"), und die Modelle bleiben einfach.
const benutzerSpalten = `id, firstname, lastname, username, role_id, active, incense,
	IFNULL(phone, ''), IFNULL(email, ''), IFNULL(note, '')`

func scanBenutzer(scan func(...any) error) (User, error) {
	var user User
	err := scan(
		&user.Id, &user.Firstname, &user.Lastname, &user.Username,
		&user.RoleId, &user.Active, &user.Incense,
		&user.Phone, &user.Email, &user.Note,
	)
	return user, err
}

func GetAllUser() ([]User, error) {
	results, err := ExecuteSQL("SELECT " + benutzerSpalten + " FROM user ORDER BY active DESC, lastname, firstname")
	if err != nil {
		return nil, err
	}
	defer results.Close()

	users := []User{}
	for results.Next() {
		user, err := scanBenutzer(results.Scan)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, results.Err()
}

func GetUser(userId string) (User, error) {
	return scanBenutzer(
		ExecuteSQLRow("SELECT "+benutzerSpalten+" FROM user WHERE id = ?", userId).Scan,
	)
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

// UpdateUser speichert die Stammdaten eines Benutzers.
//
// role_id ist hier neu. Vorher stand die Spalte in keinem INSERT und in keinem
// UPDATE des ganzen Codes: die Auswahlliste "Rolle" in der Maske wurde
// mitgeschickt, still verworfen, und der Nutzer bekam eine Erfolgsmeldung. Wer
// die Rolle vergeben darf, entscheidet der Handler - dort liegen die Claims.
func UpdateUser(userId string, user User) error {
	// NULLIF: ein geleertes Feld wird NULL und nicht der leere String - damit
	// bleibt "nicht hinterlegt" in der Datenbank eindeutig.
	_, err := ExecuteDDL(`
		UPDATE user
		SET firstname=?, lastname=?, role_id=?, active=?, incense=?,
			phone=NULLIF(?, ''), email=NULLIF(?, ''), note=NULLIF(?, '')
		WHERE id=?`,
		user.Firstname, user.Lastname, user.RoleId, user.Active, user.Incense,
		user.Phone, user.Email, user.Note,
		userId,
	)
	return err
}

var (
	// ErrEigeneRolle: die eigene Rolle darf niemand aendern - sonst macht sich
	// ein Ministrantenrat selbst zum Admin.
	ErrEigeneRolle = errors.New("Die eigene Rolle kann nicht geändert werden")
	// ErrRolleNichtErlaubt: keine hoehere Rolle als die eigene, und keine
	// Rolle unterhalb von 1.
	ErrRolleNichtErlaubt = errors.New("Diese Rolle kannst du nicht vergeben")
)

// PruefeRollenvergabe entscheidet, welche Rolle jemand vergeben darf.
//
// Eigene Funktion, weil das die sicherheitsrelevante Regel ist: sie gilt beim
// Anlegen und beim Bearbeiten gleich und ist ohne Datenbank pruefbar.
func PruefeRollenvergabe(eigeneRolle int, rolle int) error {
	if rolle < 1 || rolle > eigeneRolle {
		return ErrRolleNichtErlaubt
	}
	return nil
}

// PruefeRollenwechsel entscheidet, ob ein Rollenwechsel erlaubt ist.
//
// Bleibt die Rolle gleich, ist nichts zu pruefen - die Maske schickt immer alle
// Felder, auch die unveraenderten.
func PruefeRollenwechsel(eigeneRolle int, eigeneId int, zielId int, alteRolle int, neueRolle int) error {
	if neueRolle == alteRolle {
		return nil
	}
	if eigeneId == zielId {
		return ErrEigeneRolle
	}
	return PruefeRollenvergabe(eigeneRolle, neueRolle)
}

// ErrBenutzernameVergeben meldet einen bereits vorhandenen Benutzernamen.
//
// Getrennt von technischen Fehlern, weil es kein Serverfehler ist: die Spalte
// hat einen UNIQUE-Index, und der Aufrufer soll "schon vergeben" melden statt
// "Fehler beim Anlegen".
var ErrBenutzernameVergeben = errors.New("Dieser Benutzername ist schon vergeben")

// CreateUser legt einen Benutzer an und gibt seine Id zurueck.
//
// Bisher gab es dafuer gar keinen Weg: kein INSERT INTO user im ganzen Code und
// keine Route. Jeder neue Ministrant entstand von Hand in der Datenbank.
func CreateUser(neu NeuerBenutzer) (int, error) {
	res, err := ExecuteDDL(`
		INSERT INTO user (firstname, lastname, username, password, role_id, active, incense, phone, email)
		VALUES (?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''))`,
		neu.Firstname, neu.Lastname, neu.Username, neu.Password, neu.RoleId, neu.Active, neu.Incense,
		neu.Phone, neu.Email,
	)
	if istDoppelterEintrag(err) {
		return 0, ErrBenutzernameVergeben
	}
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return int(id), nil
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
