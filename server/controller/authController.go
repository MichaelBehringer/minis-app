package controller

import (
	"database/sql"
	"errors"
	. "minisAPI/models"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ErrAnmeldungFehlgeschlagen bedeutet: Benutzername oder Passwort stimmt nicht.
//
// Bewusst getrennt von technischen Fehlern. Nur dieser Fall darf zu einem 401
// fuehren; eine nicht erreichbare Datenbank ist ein Serverfehler und muss als
// solcher sichtbar werden. Vorher war beides nicht zu unterscheiden, weil der
// Fehler von Scan verworfen wurde.
var ErrAnmeldungFehlgeschlagen = errors.New("Benutzername oder Passwort ist falsch")

// Gueltigkeitsdauer eines Tokens - zwei Werte, je nachdem ob "Angemeldet
// bleiben" angekreuzt war.
//
// Ganz ohne Ablaufdatum, so wie vor der Modernisierung, ist keine Option: ein
// einmal abgegriffenes Token bliebe dauerhaft brauchbar, und man koennte es nur
// noch loswerden, indem man den Signaturschluessel wechselt - was alle
// gleichzeitig abmeldet.
//
// Stattdessen ein langes Token, das sich bei Benutzung selbst verlaengert
// (siehe ErneuertesToken). Wer die Anwendung mindestens einmal im halben Jahr
// oeffnet, wird nie abgemeldet; ein liegengelassenes Token verfaellt trotzdem.
const (
	tokenGueltigkeitKurz = 12 * time.Hour
	tokenGueltigkeitLang = 365 * 24 * time.Hour
)

// NeuesTokenHeader ist der Antwortkopf, in dem ein erneuertes Token zurueckgeht.
//
// Ueber den Kopf und nicht im Antwortkoerper, weil jede beliebige Antwort ein
// erneuertes Token tragen kann - die Nutzlast der Endpunkte bleibt unberuehrt.
const NeuesTokenHeader = "X-Neues-Token"

func tokenGueltigkeit(angemeldetBleiben bool) time.Duration {
	if angemeldetBleiben {
		return tokenGueltigkeitLang
	}
	return tokenGueltigkeitKurz
}

func neuesToken(id int, username string, roleId int, angemeldetBleiben bool) (string, error) {
	jetzt := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user":   username,
		"roleId": roleId,
		"userId": id,
		// Die Wahl des Nutzers gehoert ins Token, sonst weiss die Erneuerung
		// nicht, auf welche Dauer sie verlaengern darf.
		"remember": angemeldetBleiben,
		"iat":      jwt.NewNumericDate(jetzt),
		"exp":      jwt.NewNumericDate(jetzt.Add(tokenGueltigkeit(angemeldetBleiben))),
	})
	return token.SignedString(jwtSchluessel())
}

// ErneuertesToken gibt ein frisches Token zurueck, sobald die Haelfte der
// Gueltigkeit abgelaufen ist. Sonst ist der zweite Rueckgabewert false.
//
// Das ist der Ersatz fuer ein Token ohne Ablaufdatum: aus Sicht des Nutzers
// laeuft nichts ab, solange er die Anwendung benutzt.
//
// Erst ab der Haelfte und nicht bei jeder Anfrage: sonst gaebe es bei jedem
// Seitenaufruf ein neues Token, ohne dass sich etwas aendert.
func ErneuertesToken(claims jwt.MapClaims) (string, bool) {
	ablauf, err := claims.GetExpirationTime()
	if err != nil || ablauf == nil {
		return "", false
	}

	// Fehlt der Anspruch - etwa in einem Token, das vor dieser Aenderung
	// ausgegeben wurde -, gilt die kurze Dauer. Eine Verlaengerung darf sich
	// nicht selbst zur langen Sitzung befoerdern.
	angemeldetBleiben, _ := claims["remember"].(bool)

	if time.Until(ablauf.Time) > tokenGueltigkeit(angemeldetBleiben)/2 {
		return "", false
	}

	// JSON kennt nur einen Zahlentyp, jede Zahl kommt als float64 zurueck.
	username, _ := claims["user"].(string)
	roleId, roleOk := claims["roleId"].(float64)
	userId, userOk := claims["userId"].(float64)
	if username == "" || !roleOk || !userOk {
		return "", false
	}

	signiert, err := neuesToken(int(userId), username, int(roleId), angemeldetBleiben)
	if err != nil {
		return "", false
	}
	return signiert, true
}

// Der Signaturschluessel. Wer ihn kennt, kann sich als beliebiger Benutzer
// ausgeben, deshalb gehoert er in die Umgebung und nicht in den Quellcode.
//
// Der Default ist der Wert, der bis hierher fest im Code stand. Er steht damit
// weiterhin in der Git-Historie und muss auf der Produktivmaschine ueber
// MINIS_JWT_SECRET durch einen neuen ersetzt werden.
func jwtSchluessel() []byte {
	return []byte(Env("MINIS_JWT_SECRET", "axJGB96eQbhCOCSlEHe5QJszFo2qHBLP"))
}

// DoLogin prueft die Zugangsdaten und gibt bei Erfolg ein Token zurueck.
//
// Frueher gab diese Funktion immer ein gueltiges Token zurueck: bei falschem
// Passwort wurde c.AbortWithStatus aufgerufen, aber Abort beendet die Funktion
// nicht, und der Aufrufer hat das Token trotzdem in den Antwortkoerper
// geschrieben. Der Status war 401 - das Token stand daneben.
//
// Deshalb ist der gin.Context hier nicht mehr beteiligt. Ueber Erfolg oder
// Misserfolg entscheidet allein der Rueckgabewert, und der Aufrufer kann das
// Token nur dann ausliefern, wenn err == nil ist.
func DoLogin(login Login) (AccessToken, error) {
	// Eine Abfrage statt zweier: vorher wurde erst COUNT(*) geprueft und dann
	// der Benutzer separat geladen. Zwischen beiden Abfragen konnte sich der
	// Datenbestand aendern, und der zweite Treffer wurde nicht mehr geprueft.
	//
	// Kein UPPER() um die Spalte: die Kollation ist utf8mb4_unicode_ci,
	// vergleicht also ohnehin ohne Ruecksicht auf Gross- und Kleinschreibung.
	// Ein UPPER() macht nur den UNIQUE-Index auf username unbenutzbar und
	// erzwingt einen Durchlauf durch die ganze Tabelle.
	var (
		id       int
		username string
		roleId   int
	)
	err := ExecuteSQLRow(
		"SELECT id, username, role_id FROM user WHERE username = ? AND password = ?",
		login.Username, login.Password,
	).Scan(&id, &username, &roleId)

	if errors.Is(err, sql.ErrNoRows) {
		return AccessToken{}, ErrAnmeldungFehlgeschlagen
	}
	if err != nil {
		return AccessToken{}, err
	}

	signiert, err := neuesToken(id, username, roleId, login.Remember)
	if err != nil {
		return AccessToken{}, err
	}
	return AccessToken{AccessToken: signiert}, nil
}

func CheckToken(c *gin.Context) UserHead {
	_, claims := ExtractToken(c)
	username, _ := claims["user"].(string)
	var person UserHead
	ExecuteSQLRow("SELECT CONCAT(FIRSTNAME, ' ', LASTNAME), id, ROLE_ID FROM user WHERE USERNAME=?", username).Scan(&person.Name, &person.Id, &person.RoleId)
	return person
}

func ExtractToken(c *gin.Context) (bool, jwt.MapClaims) {
	h := AuthHeader{}
	c.ShouldBindHeader(&h)
	idTokenHeader := strings.Split(h.IDToken, "Bearer ")
	if len(idTokenHeader) < 2 {
		return false, nil
	}
	return parseToken(idTokenHeader[1])
}

func parseToken(tokenStr string) (bool, jwt.MapClaims) {
	claims := jwt.MapClaims{}
	tkn, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSchluessel(), nil
	},
		// Ohne diese Einschraenkung akzeptiert die Bibliothek jedes Verfahren,
		// das der Absender im Token-Kopf angibt. Der Signaturschluessel wird
		// hier fuer HMAC geliefert - taucht er in einem anderen Verfahren als
		// oeffentlicher Schluessel auf, kann ein Angreifer damit selbst
		// signieren.
		jwt.WithValidMethods([]string{"HS256"}),
		// Ein Token ohne exp gilt fuer die Bibliothek unbegrenzt - sie prueft
		// nur, was da ist. Genau so sahen die Tokens der alten Fassung aus.
		//
		// Mit dieser Forderung werden sie abgewiesen, auch wenn derselbe
		// Signaturschluessel weiterverwendet wird. Das ist der Unterschied
		// zwischen "alle muessen sich neu anmelden, wenn der Schluessel
		// gewechselt wird" und "alle muessen sich neu anmelden".
		jwt.WithExpirationRequired(),
	)
	return err == nil && tkn.Valid, claims
}
