package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// laufeMit baut eine minimale Kette: die Claims liegen schon im Context (das
// erledigt sonst AuthUser), danach die zu pruefende Middleware.
func laufeMit(t *testing.T, mw gin.HandlerFunc, pfad string, ziel string, claims jwt.MapClaims) int {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET(pfad, func(c *gin.Context) {
		if claims != nil {
			c.Set("claims", claims)
		}
		c.Next()
	}, mw, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, ziel, nil))
	return w.Code
}

func TestAllowMinRole(t *testing.T) {
	faelle := []struct {
		name     string
		claims   jwt.MapClaims
		erwartet int
	}{
		{
			// Ministrant. Muss abgewiesen werden.
			name:     "Rolle 1 unter der Grenze",
			claims:   jwt.MapClaims{"roleId": float64(1), "userId": float64(9)},
			erwartet: http.StatusForbidden,
		},
		{
			name:     "Rolle 2 erreicht die Grenze",
			claims:   jwt.MapClaims{"roleId": float64(2), "userId": float64(1)},
			erwartet: http.StatusOK,
		},
		{
			// Rolle 3 ist der Admin. Ein Vergleich auf Gleichheit statt auf
			// "mindestens" wuerde ihn hier aussperren.
			name:     "Rolle 3 liegt darueber",
			claims:   jwt.MapClaims{"roleId": float64(3), "userId": float64(1)},
			erwartet: http.StatusOK,
		},
		{
			// Vorher eine ungepruefte Type-Assertion und damit ein Panic:
			// der Server antwortete mit 500 statt mit 401.
			name:     "Token ohne roleId",
			claims:   jwt.MapClaims{"userId": float64(9)},
			erwartet: http.StatusUnauthorized,
		},
		{
			name:     "roleId als Text statt Zahl",
			claims:   jwt.MapClaims{"roleId": "2", "userId": float64(9)},
			erwartet: http.StatusUnauthorized,
		},
		{
			name:     "gar keine Claims im Context",
			claims:   nil,
			erwartet: http.StatusUnauthorized,
		},
	}

	for _, f := range faelle {
		t.Run(f.name, func(t *testing.T) {
			got := laufeMit(t, AllowMinRole(2), "/user", "/user", f.claims)
			if got != f.erwartet {
				t.Errorf("Status %d, erwartet %d", got, f.erwartet)
			}
		})
	}
}

func TestAllowSelfOrMinRole(t *testing.T) {
	faelle := []struct {
		name     string
		claims   jwt.MapClaims
		ziel     string
		erwartet int
	}{
		{
			// Der eigentliche Zweck: jeder darf seine eigenen Daten sehen.
			name:     "Rolle 1 auf die eigenen Daten",
			claims:   jwt.MapClaims{"roleId": float64(1), "userId": float64(9)},
			ziel:     "/user/9/ban",
			erwartet: http.StatusOK,
		},
		{
			// Genau der Fall, der bei den GET-Routen offen stand: ein
			// Ministrant konnte die Sperrtage aller anderen lesen.
			name:     "Rolle 1 auf fremde Daten",
			claims:   jwt.MapClaims{"roleId": float64(1), "userId": float64(9)},
			ziel:     "/user/1/ban",
			erwartet: http.StatusForbidden,
		},
		{
			name:     "Rolle 2 auf fremde Daten",
			claims:   jwt.MapClaims{"roleId": float64(2), "userId": float64(1)},
			ziel:     "/user/9/ban",
			erwartet: http.StatusOK,
		},
		{
			name:     "Token ohne userId",
			claims:   jwt.MapClaims{"roleId": float64(1)},
			ziel:     "/user/9/ban",
			erwartet: http.StatusUnauthorized,
		},
		{
			// Grosse Ids duerfen nicht in wissenschaftlicher Schreibweise
			// verglichen werden - fmt.Sprintf("%v") haette "1e+06" ergeben.
			name:     "grosse Id trifft sich selbst",
			claims:   jwt.MapClaims{"roleId": float64(1), "userId": float64(1000000)},
			ziel:     "/user/1000000/ban",
			erwartet: http.StatusOK,
		},
	}

	for _, f := range faelle {
		t.Run(f.name, func(t *testing.T) {
			got := laufeMit(t, AllowSelfOrMinRole(2), "/user/:userId/ban", f.ziel, f.claims)
			if got != f.erwartet {
				t.Errorf("Status %d, erwartet %d", got, f.erwartet)
			}
		})
	}
}
