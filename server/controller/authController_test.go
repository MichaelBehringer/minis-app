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
