package middleware

import (
	"strconv"

	. "minisAPI/controller"
	. "minisAPI/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAllowed, claims := ExtractToken(c)

		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, ResponseText{Reason: "no token provided"})
			return
		}

		if !isAllowed {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set("claims", claims)

		// Die Sitzung verlaengert sich durch Benutzung. Das erneuerte Token
		// geht im Antwortkopf zurueck, der Interceptor im Frontend legt es an
		// die Stelle des alten. Ohne das waere nach der festen Dauer Schluss,
		// auch bei taeglicher Nutzung.
		if neu, ok := ErneuertesToken(claims); ok {
			c.Header(NeuesTokenHeader, neu)
		}

		c.Next()
	}
}

// claimZahl liest einen Zahlenwert aus den Claims.
//
// JSON kennt nur einen Zahlentyp, deshalb kommt jede Zahl als float64 an. Fehlt
// der Wert oder hat er einen anderen Typ, war das vorher ein Panic mitten in der
// Middleware - ein Token ohne roleId hat den Server also mit 500 antworten
// lassen statt mit 403.
func claimZahl(claims jwt.MapClaims, name string) (int, bool) {
	v, ok := claims[name].(float64)
	if !ok {
		return 0, false
	}
	return int(v), true
}

// claimsAus holt die von AuthUser gesetzten Claims aus dem Context. Der zweite
// Rueckgabewert ist false, wenn sie fehlen oder nicht den erwarteten Typ haben.
func claimsAus(c *gin.Context) (jwt.MapClaims, bool) {
	val, exists := c.Get("claims")
	if !exists {
		return nil, false
	}
	claims, ok := val.(jwt.MapClaims)
	return claims, ok
}

// AllowSelfOrMinRole laesst den Zugriff durch, wenn die angefragte userId die
// eigene ist oder die Rolle mindestens minRole erreicht.
func AllowSelfOrMinRole(minRole int) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := claimsAus(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		role, roleOk := claimZahl(claims, "roleId")
		userId, userOk := claimZahl(claims, "userId")
		if !roleOk || !userOk {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		if strconv.Itoa(userId) != c.Param("userId") && role < minRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}

		c.Next()
	}
}

// AllowMinRole laesst den Zugriff nur ab der Rolle minRole durch.
func AllowMinRole(minRole int) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := claimsAus(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		role, roleOk := claimZahl(claims, "roleId")
		if !roleOk {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		if role < minRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}

		c.Next()
	}
}
