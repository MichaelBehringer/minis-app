package controller

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func tokenMit(t *testing.T, methode jwt.SigningMethod, claims jwt.MapClaims, schluessel interface{}) string {
	t.Helper()
	s, err := jwt.NewWithClaims(methode, claims).SignedString(schluessel)
	if err != nil {
		t.Fatalf("Token konnte nicht signiert werden: %v", err)
	}
	return s
}

func TestParseToken(t *testing.T) {
	t.Setenv("MINIS_JWT_SECRET", "test-schluessel-nur-fuer-den-test")
	jetzt := time.Now()

	t.Run("gueltiges Token", func(t *testing.T) {
		s := tokenMit(t, jwt.SigningMethodHS256, jwt.MapClaims{
			"user":   "testperson",
			"roleId": 2,
			"userId": 1,
			"exp":    jwt.NewNumericDate(jetzt.Add(time.Hour)),
		}, jwtSchluessel())

		ok, claims := parseToken(s)
		if !ok {
			t.Fatal("Token wurde abgelehnt, sollte aber gelten")
		}
		if claims["user"] != "testperson" {
			t.Errorf("user = %v", claims["user"])
		}
	})

	t.Run("abgelaufenes Token wird abgelehnt", func(t *testing.T) {
		// Vorher enthielten die Claims kein exp, ein Token galt also
		// unbegrenzt. Dieser Test haelt fest, dass das Ablaufen wirkt.
		s := tokenMit(t, jwt.SigningMethodHS256, jwt.MapClaims{
			"user": "testperson",
			"exp":  jwt.NewNumericDate(jetzt.Add(-time.Minute)),
		}, jwtSchluessel())

		if ok, _ := parseToken(s); ok {
			t.Error("abgelaufenes Token wurde angenommen")
		}
	})

	t.Run("anderer Schluessel wird abgelehnt", func(t *testing.T) {
		s := tokenMit(t, jwt.SigningMethodHS256, jwt.MapClaims{
			"user": "angreifer",
			"exp":  jwt.NewNumericDate(jetzt.Add(time.Hour)),
		}, []byte("ein-voellig-anderer-schluessel"))

		if ok, _ := parseToken(s); ok {
			t.Error("fremd signiertes Token wurde angenommen")
		}
	})

	t.Run("none-Verfahren wird abgelehnt", func(t *testing.T) {
		// Ohne jwt.WithValidMethods akzeptiert die Bibliothek das Verfahren,
		// das der Absender im Token-Kopf angibt. "none" ist der Klassiker:
		// ein Token ganz ohne Signatur.
		s := tokenMit(t, jwt.SigningMethodNone, jwt.MapClaims{
			"user":   "angreifer",
			"roleId": 3,
			"exp":    jwt.NewNumericDate(jetzt.Add(time.Hour)),
		}, jwt.UnsafeAllowNoneSignatureType)

		if ok, _ := parseToken(s); ok {
			t.Error("Token ohne Signatur wurde angenommen")
		}
	})

	t.Run("Muell statt Token", func(t *testing.T) {
		if ok, _ := parseToken("kein.echtes.token"); ok {
			t.Error("unlesbares Token wurde angenommen")
		}
	})
}

func TestJwtSchluesselAusUmgebung(t *testing.T) {
	t.Setenv("MINIS_JWT_SECRET", "aus-der-umgebung")
	if string(jwtSchluessel()) != "aus-der-umgebung" {
		t.Errorf("Schluessel = %q", jwtSchluessel())
	}
}

func TestTokenOhneExpWirdAbgelehnt(t *testing.T) {
	// So sahen die Tokens der alten Fassung aus: keine Ablaufzeit, dafuer eine
	// creationTime, die niemand geprueft hat.
	//
	// Sie werden jetzt abgewiesen, auch wenn derselbe Signaturschluessel
	// weiterverwendet wird - sonst haetten alte Tokens nach dem Deployen
	// weitergegolten, und zwar unbegrenzt.
	t.Setenv("MINIS_JWT_SECRET", "test-schluessel-nur-fuer-den-test")

	alt := tokenMit(t, jwt.SigningMethodHS256, jwt.MapClaims{
		"user":         "testperson",
		"roleId":       2,
		"userId":       1,
		"creationTime": time.Now().UnixNano(),
	}, jwtSchluessel())

	if ok, _ := parseToken(alt); ok {
		t.Error("Token ohne Ablaufzeit wurde angenommen")
	}
}

// claimsVon signiert die Claims und liest sie ueber parseToken zurueck - damit
// haben sie dieselben Typen wie im Betrieb (jede Zahl kommt als float64).
func claimsVon(t *testing.T, claims jwt.MapClaims) jwt.MapClaims {
	t.Helper()
	ok, gelesen := parseToken(tokenMit(t, jwt.SigningMethodHS256, claims, jwtSchluessel()))
	if !ok {
		t.Fatal("Token wurde nicht angenommen")
	}
	return gelesen
}

func TestTokenGueltigkeit(t *testing.T) {
	// "Angemeldet bleiben" entscheidet ueber die Dauer. Vorher gab der Server
	// immer 30 Tage aus, egal was angekreuzt war - die Wahl wirkte nur darauf,
	// ob das Frontend das Token in localStorage oder sessionStorage legt.
	if tokenGueltigkeit(true) <= tokenGueltigkeit(false) {
		t.Error("mit Haekchen muss die Gueltigkeit laenger sein")
	}
}

func TestErneuertesToken(t *testing.T) {
	t.Setenv("MINIS_JWT_SECRET", "test-schluessel-nur-fuer-den-test")
	jetzt := time.Now()

	basis := func(exp time.Duration, remember bool) jwt.MapClaims {
		return jwt.MapClaims{
			"user":     "testperson",
			"roleId":   2,
			"userId":   7,
			"remember": remember,
			"exp":      jwt.NewNumericDate(jetzt.Add(exp)),
		}
	}

	t.Run("frisches Token wird nicht erneuert", func(t *testing.T) {
		// Sonst gaebe es bei jedem Seitenaufruf ein neues Token.
		if _, ok := ErneuertesToken(claimsVon(t, basis(tokenGueltigkeitLang, true))); ok {
			t.Error("Token wurde erneuert, obwohl fast die ganze Dauer offen ist")
		}
	})

	t.Run("ab der Haelfte wird erneuert", func(t *testing.T) {
		alt := basis(tokenGueltigkeitLang/2-time.Hour, true)
		neu, ok := ErneuertesToken(claimsVon(t, alt))
		if !ok {
			t.Fatal("Token wurde nicht erneuert")
		}

		gueltig, claims := parseToken(neu)
		if !gueltig {
			t.Fatal("das erneuerte Token gilt nicht")
		}
		// Die Identitaet muss unveraendert mitkommen - eine Erneuerung darf
		// keine Rolle und keinen Benutzer wechseln.
		if claims["user"] != "testperson" {
			t.Errorf("user = %v", claims["user"])
		}
		if claims["roleId"] != float64(2) || claims["userId"] != float64(7) {
			t.Errorf("roleId = %v, userId = %v", claims["roleId"], claims["userId"])
		}
		if claims["remember"] != true {
			t.Errorf("remember = %v", claims["remember"])
		}

		ablauf, err := claims.GetExpirationTime()
		if err != nil || ablauf == nil {
			t.Fatalf("kein exp im erneuerten Token: %v", err)
		}
		if rest := time.Until(ablauf.Time); rest < tokenGueltigkeitLang-time.Minute {
			t.Errorf("Restdauer nur %v, erwartet rund %v", rest, tokenGueltigkeitLang)
		}
	})

	t.Run("ohne Haekchen gilt die kurze Dauer", func(t *testing.T) {
		neu, ok := ErneuertesToken(claimsVon(t, basis(time.Hour, false)))
		if !ok {
			t.Fatal("Token wurde nicht erneuert")
		}
		_, claims := parseToken(neu)
		ablauf, _ := claims.GetExpirationTime()
		if rest := time.Until(ablauf.Time); rest > tokenGueltigkeitKurz+time.Minute {
			t.Errorf("Restdauer %v, erwartet hoechstens %v", rest, tokenGueltigkeitKurz)
		}
	})

	t.Run("fehlendes remember befoerdert sich nicht selbst", func(t *testing.T) {
		// Ein Token aus der Zeit vor dieser Aenderung hat den Anspruch nicht.
		// Wuerde die Erneuerung dann die lange Dauer annehmen, koennte eine
		// kurze Sitzung ueber die Verlaengerung zu einer dauerhaften werden.
		ohne := jwt.MapClaims{
			"user":   "testperson",
			"roleId": 1,
			"userId": 7,
			"exp":    jwt.NewNumericDate(jetzt.Add(time.Hour)),
		}
		neu, ok := ErneuertesToken(claimsVon(t, ohne))
		if !ok {
			t.Fatal("Token wurde nicht erneuert")
		}
		_, claims := parseToken(neu)
		ablauf, _ := claims.GetExpirationTime()
		if rest := time.Until(ablauf.Time); rest > tokenGueltigkeitKurz+time.Minute {
			t.Errorf("Restdauer %v, erwartet hoechstens %v", rest, tokenGueltigkeitKurz)
		}
	})

	t.Run("unvollstaendige Claims werden nicht erneuert", func(t *testing.T) {
		// Lieber keine Verlaengerung als ein Token ohne Rolle - das waere in
		// der Middleware ein 401 bei der naechsten Anfrage.
		ohneRolle := jwt.MapClaims{
			"user": "testperson",
			"exp":  jwt.NewNumericDate(jetzt.Add(time.Hour)),
		}
		if _, ok := ErneuertesToken(claimsVon(t, ohneRolle)); ok {
			t.Error("Token ohne roleId wurde erneuert")
		}
	})
}
