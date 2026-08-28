package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	. "minisAPI/controller"

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

// mitToken laesst eine Anfrage durch AuthUser laufen und gibt die Antwort
// zurueck - inklusive der Kopfzeilen, denn dort landet ein erneuertes Token.
func mitToken(t *testing.T, tokenStr string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/geschuetzt", AuthUser(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/geschuetzt", nil)
	if tokenStr != "" {
		req.Header.Set("Authorization", "Bearer "+tokenStr)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func signiere(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(Env("MINIS_JWT_SECRET", "")))
	if err != nil {
		t.Fatalf("Token konnte nicht signiert werden: %v", err)
	}
	return s
}

// Die Sitzung soll sich durch Benutzung verlaengern. Dieser Test haelt fest,
// dass die Middleware das erneuerte Token tatsaechlich mitgibt - der Weg vom
// Ablauf zum Antwortkopf ist die Stelle, an der es sonst still ausfaellt.
func TestAuthUserVerlaengertDieSitzung(t *testing.T) {
	t.Setenv("MINIS_JWT_SECRET", "test-schluessel-nur-fuer-den-test")
	jetzt := time.Now()

	t.Run("kurz vor Ablauf kommt ein neues Token", func(t *testing.T) {
		alt := signiere(t, jwt.MapClaims{
			"user":     "testperson",
			"roleId":   float64(1),
			"userId":   float64(7),
			"remember": true,
			"exp":      jwt.NewNumericDate(jetzt.Add(24 * time.Hour)),
		})

		w := mitToken(t, alt)
		if w.Code != http.StatusOK {
			t.Fatalf("Status = %d", w.Code)
		}

		neu := w.Header().Get(NeuesTokenHeader)
		if neu == "" {
			t.Fatal("kein erneuertes Token im Antwortkopf")
		}
		if neu == alt {
			t.Error("dasselbe Token zurueckgegeben")
		}
	})

	t.Run("frisches Token bleibt unberuehrt", func(t *testing.T) {
		// Sonst wechselt das Token bei jeder einzelnen Anfrage.
		frisch := signiere(t, jwt.MapClaims{
			"user":     "testperson",
			"roleId":   float64(1),
			"userId":   float64(7),
			"remember": true,
			"exp":      jwt.NewNumericDate(jetzt.Add(300 * 24 * time.Hour)),
		})

		w := mitToken(t, frisch)
		if neu := w.Header().Get(NeuesTokenHeader); neu != "" {
			t.Error("Token wurde ohne Anlass erneuert")
		}
	})

	t.Run("abgelaufenes Token wird nicht erneuert", func(t *testing.T) {
		// Der wichtigste Fall: eine Verlaengerung darf ein abgelaufenes Token
		// nicht wieder gueltig machen.
		abgelaufen := signiere(t, jwt.MapClaims{
			"user":     "testperson",
			"roleId":   float64(1),
			"userId":   float64(7),
			"remember": true,
			"exp":      jwt.NewNumericDate(jetzt.Add(-time.Minute)),
		})

		w := mitToken(t, abgelaufen)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("Status = %d, erwartet 401", w.Code)
		}
		if neu := w.Header().Get(NeuesTokenHeader); neu != "" {
			t.Error("abgelaufenes Token wurde verlaengert")
		}
	})
}
