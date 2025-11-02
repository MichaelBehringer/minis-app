package controller

import (
	. "minisAPI/models"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func DoLogin(login Login, c *gin.Context) AccessToken {
	var (
		key []byte
		t   *jwt.Token
		s   string
	)

	var isAllowed bool
	ExecuteSQLRow("SELECT COUNT(*) FROM user WHERE UPPER(USERNAME)=UPPER(?) AND PASSWORD=?", login.Username, login.Password).Scan(&isAllowed)
	if !isAllowed {
		c.AbortWithStatus(http.StatusUnauthorized)
	}

	key = []byte("my_secret_key_change_todo")
	t = jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			"user":         login.Username,
			"creationTime": time.Now().UnixNano(),
		})
	s, _ = t.SignedString(key)

	return AccessToken{AccessToken: s}
}

func CheckToken(c *gin.Context) PersonHead {
	_, claims := ExtractToken(c)
	username, _ := claims["user"].(string)
	var person PersonHead
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
		return []byte("my_secret_key_change_todo"), nil
	})
	return (err == nil && tkn.Valid), claims
}
