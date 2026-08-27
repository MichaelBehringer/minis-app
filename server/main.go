package main

import (
	"context"
	"errors"
	"log"
	. "minisAPI/controller"
	. "minisAPI/middleware"
	. "minisAPI/models"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Fehlt die Datei, bleibt es bei den Umgebungsvariablen des Prozesses.
	// Im Container werden sie ueber docker-compose gesetzt, lokal ueber
	// server/.env - siehe .env.example.
	_ = godotenv.Load()

	if err := InitDB(); err != nil {
		log.Fatalf("%v", err)
	}
	defer CloseDB()

	router := gin.Default()
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Content-Type", "Content-Length", "Accept-Encoding", "Authorization", "Cache-Control"}
	// Ohne ExposeHeaders liest der Browser den Kopf mit dem erneuerten Token
	// nicht aus. In Produktion laeuft alles ueber dieselbe Herkunft, in der
	// Entwicklung ueber den Vite-Proxy - aber AllowAllOrigins steht hier, also
	// gehoert es sauber gesetzt.
	config.ExposeHeaders = []string{NeuesTokenHeader}

	router.Use(cors.New(config))
	router.POST("/login", login)

	auth := router.Group("/")
	auth.Use(AuthUser())
	auth.GET("/checkToken", checkToken)

	// Der PDF-Plan enthaelt die Vor- und Nachnamen aller eingeteilten
	// Ministranten. Er hing bisher an router statt an auth und war damit ohne
	// Token abrufbar, mit frei waehlbarem Zeitraum ueber ?from=&to=.
	auth.GET("/pdf/events", AllowMinRole(2), GetEventsPDF)

	// Lesen und Schreiben sind hier gleich zu behandeln: die PATCH-Routen waren
	// durch AllowSelfOrMinRole geschuetzt, die passenden GETs nicht. Damit
	// konnte jeder Angemeldete die Sperrtage, Wochentage und Wunschpartner
	// aller anderen lesen.
	auth.GET("/events/:userId", AllowSelfOrMinRole(2), getEventsForUser)
	auth.GET("/events", AllowMinRole(2), getEventsByDateRange)
	auth.PATCH("/events/:eventId/assign/add", AllowMinRole(2), addUserToEvent)
	auth.PATCH("/events/:eventId/assign/remove", AllowMinRole(2), removeUserFromEvent)
	auth.PUT("/event", AllowMinRole(2), putEvent)
	// Mehrere Messen auf einmal, fuer eine Serie gleichartiger Termine.
	auth.PUT("/events", AllowMinRole(2), putEvents)

	auth.GET("/location", getLocations)
	auth.GET("/role", AllowMinRole(2), getRoles)

	// Bleibt fuer alle Angemeldeten lesbar: die Liste dient der Auswahl der
	// Wunschpartner, die jeder fuer sich selbst pflegen darf. Sie enthaelt nur
	// Id und Namen der aktiven Ministranten.
	auth.GET("/userHead", getAllUserHead)

	auth.GET("/user", AllowMinRole(2), getAllUser)
	auth.GET("/user/:userId", AllowSelfOrMinRole(2), getUser)
	auth.PATCH("/user/:userId", AllowSelfOrMinRole(2), updateUser)
	auth.PATCH("/user/:userId/password", AllowSelfOrMinRole(2), updateUserPassword)
	auth.GET("/user/:userId/ban", AllowSelfOrMinRole(2), getUserBanDates)
	auth.PATCH("/user/:userId/ban", AllowSelfOrMinRole(2), updateUserBanDates)
	// Ganzer Zeitraum auf einmal. Zwei Wochen Urlaub sind damit eine Anfrage
	// statt vierzehn.
	auth.PATCH("/user/:userId/ban/range", AllowSelfOrMinRole(2), updateUserBanRange)
	auth.GET("/user/:userId/weekday", AllowSelfOrMinRole(2), getUserWeekdays)
	auth.PATCH("/user/:userId/weekday", AllowSelfOrMinRole(2), updateUserWeekday)
	auth.PATCH("/user/:userId/preferred", AllowSelfOrMinRole(2), updateUserPreferred)
	auth.GET("/user/:userId/preferred", AllowSelfOrMinRole(2), getUserPreferred)
	auth.GET("/event/:eventId/assignment-options", AllowMinRole(2), getEventAssignmentOptions)

	starteServer(router)
}

// starteServer laesst den Server laufen und beendet ihn geordnet.
//
// Vorher stand hier router.Run(). Das kehrt nie zurueck, weshalb das
// defer CloseDB() in main bei einem SIGTERM - also bei jedem
// "docker compose down" - nie ausgefuehrt wurde. Und ohne Zeitgrenzen am
// http.Server kann eine haengende Verbindung beliebig lange eine Ressource
// halten.
func starteServer(handler http.Handler) {
	adresse := Env("MINIS_LISTEN_ADDR", "localhost:8080")

	srv := &http.Server{
		Addr:    adresse,
		Handler: handler,
		// Grosszuegig, aber nicht unbegrenzt: die PDF-Erzeugung ueber einen
		// langen Zeitraum darf nicht in ein Zeitlimit laufen.
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("Server lauscht auf %s", adresse)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Server konnte nicht starten: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Server wird beendet")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Beim Beenden: %v", err)
	}
}

// serverFehler protokolliert den Grund und antwortet ohne ihn.
//
// Der Grund gehoert ins Log und nicht in die Antwort: er nennt Tabellen- und
// Spaltennamen. Vorher wurden Datenbankfehler gar nicht gemeldet - die
// Anwendung bekam 200 mit einer leeren Liste und zeigte "keine Daten".
func serverFehler(c *gin.Context, was string, err error) {
	log.Printf("%s: %v", was, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Die Anfrage konnte nicht bearbeitet werden"})
}

func login(c *gin.Context) {
	var login Login
	if err := c.ShouldBindJSON(&login); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ungueltige Anfrage"})
		return
	}

	token, err := DoLogin(login)
	if errors.Is(err, ErrAnmeldungFehlgeschlagen) {
		// Absichtlich ohne Angabe, ob der Benutzername oder das Passwort nicht
		// gestimmt hat - sonst laesst sich damit pruefen, welche Konten es gibt.
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Benutzername oder Passwort ist falsch"})
		return
	}
	if err != nil {
		// Technischer Fehler, etwa eine nicht erreichbare Datenbank. Der Grund
		// gehoert ins Log und nicht in die Antwort.
		log.Printf("Anmeldung fehlgeschlagen (technisch): %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Anmeldung derzeit nicht moeglich"})
		return
	}

	c.IndentedJSON(http.StatusOK, token)
}

func checkToken(c *gin.Context) {
	tokenRes := CheckToken(c)
	c.IndentedJSON(http.StatusOK, tokenRes)
}

func getEventsForUser(c *gin.Context) {
	events, err := GetEventsForUser(c.Param("userId"))
	if err != nil {
		serverFehler(c, "Einsaetze laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, events)
}

func getEventsByDateRange(c *gin.Context) {
	from := c.Query("from")
	to := c.Query("to")

	events, err := GetEventsByDateRange(from, to)
	if err != nil {
		serverFehler(c, "Messen im Zeitraum laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, events)
}

func addUserToEvent(c *gin.Context) {
	eventId := c.Param("eventId")

	var payload struct {
		UserId int `json:"userId"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	err := AddUserToEvent(eventId, payload.UserId)
	if errors.Is(err, ErrBereitsEingeteilt) {
		// Fachlich kein Fehler: der gewuenschte Zustand liegt schon vor.
		c.JSON(http.StatusOK, gin.H{"status": "added"})
		return
	}
	if err != nil {
		serverFehler(c, "Einteilen", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "added"})
}

func removeUserFromEvent(c *gin.Context) {
	eventId := c.Param("eventId")

	var payload struct {
		UserId int `json:"userId"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	if err := RemoveUserFromEvent(eventId, payload.UserId); err != nil {
		serverFehler(c, "Einteilung entfernen", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func getLocations(c *gin.Context) {
	locations, err := GetLocations()
	if err != nil {
		serverFehler(c, "Orte laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, locations)
}

func getRoles(c *gin.Context) {
	roles, err := GetRoles()
	if err != nil {
		serverFehler(c, "Rollen laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, roles)
}

func putEvent(c *gin.Context) {
	var ev Event
	if err := c.ShouldBindJSON(&ev); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	id, err := CreateEvent(ev)
	if err != nil {
		serverFehler(c, "Messe anlegen", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "created",
		"id":     id,
	})
}

// putEvents legt eine Serie gleichartiger Messen an.
//
// Die Termine berechnet die Anwendung und zeigt sie vorher als Vorschau;
// angelegt wird genau diese Liste. Alles in einer Transaktion, damit keine
// halbe Serie entsteht.
func putEvents(c *gin.Context) {
	var batch EventBatch
	if err := c.ShouldBindJSON(&batch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if len(batch.Events) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "keine Termine uebergeben"})
		return
	}
	// Obergrenze als Schutz vor einem Tippfehler im Zeitraum - ein
	// versehentlich auf Jahre gestellter Bereich soll nicht hunderte Messen
	// anlegen, die dann von Hand wieder weg muessen.
	if len(batch.Events) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "zu viele Termine auf einmal (maximal 200)"})
		return
	}

	ids, err := CreateEvents(batch.Events)
	if err != nil {
		serverFehler(c, "Serie anlegen", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "created",
		"ids":    ids,
		"count":  len(ids),
	})
}

func getAllUserHead(c *gin.Context) {
	users, err := GetAllUserHead()
	if err != nil {
		serverFehler(c, "Ministrantenliste laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, users)
}

func getAllUser(c *gin.Context) {
	users, err := GetAllUser()
	if err != nil {
		serverFehler(c, "Benutzer laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, users)
}

func getUser(c *gin.Context) {
	user, err := GetUser(c.Param("userId"))
	if err != nil {
		serverFehler(c, "Benutzer laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, user)
}

func updateUser(c *gin.Context) {
	userId := c.Param("userId")
	var payload User
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}
	if err := UpdateUser(userId, payload); err != nil {
		serverFehler(c, "Benutzer speichern", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func updateUserPassword(c *gin.Context) {
	userId := c.Param("userId")

	var payload struct {
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}
	if payload.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Passwort darf nicht leer sein"})
		return
	}

	if err := UpdatePassword(userId, payload.Password); err != nil {
		serverFehler(c, "Passwort speichern", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "password changed"})
}

func getUserBanDates(c *gin.Context) {
	bans, err := GetBanDates(c.Param("userId"))
	if err != nil {
		serverFehler(c, "Sperrtage laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, bans)
}

func updateUserBanDates(c *gin.Context) {
	userId := c.Param("userId")

	var update SingleBanDateUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var err error
	if update.Add {
		err = AddBlockDate(userId, update.Date)
	} else {
		err = RemoveBlockDate(userId, update.Date)
	}
	if err != nil {
		serverFehler(c, "Sperrtag speichern", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func updateUserBanRange(c *gin.Context) {
	userId := c.Param("userId")

	var update BanRangeUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var anzahl int
	var err error
	if update.Add {
		anzahl, err = AddBlockDates(userId, update.From, update.To)
	} else {
		anzahl, err = RemoveBlockDates(userId, update.From, update.To)
	}

	if err != nil {
		// Ein unlesbares Datum oder ein zu grosser Zeitraum ist ein Fehler der
		// Anfrage, kein Serverfehler - und der Grund ist fuer den Nutzer
		// verwertbar ("Zeitraum umfasst 400 Tage").
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "count": anzahl})
}

func getUserWeekdays(c *gin.Context) {
	weekdays, err := GetUserWeekdays(c.Param("userId"))
	if err != nil {
		serverFehler(c, "Wochentage laden", err)
		return
	}
	c.IndentedJSON(http.StatusOK, weekdays)
}

func updateUserWeekday(c *gin.Context) {
	userId := c.Param("userId")

	var update SingleWeekdayUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var err error
	if update.Add {
		err = AddUserWeekday(userId, update.Weekday)
	} else {
		err = RemoveUserWeekday(userId, update.Weekday)
	}
	if err != nil {
		serverFehler(c, "Wochentag speichern", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func updateUserPreferred(c *gin.Context) {
	userId := c.Param("userId")

	var update PreferredUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var err error
	if update.Add {
		err = AddPreferredUser(userId, update.OtherUserId)
	} else {
		err = RemovePreferredUser(userId, update.OtherUserId)
	}
	if err != nil {
		serverFehler(c, "Wunschpartner speichern", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func getUserPreferred(c *gin.Context) {
	data, err := GetPreferredUsers(c.Param("userId"))
	if err != nil {
		serverFehler(c, "Wunschpartner laden", err)
		return
	}

	c.JSON(http.StatusOK, data)
}

func GetEventsPDF(c *gin.Context) {
	fromStr := c.Query("from")
	toStr := c.Query("to")

	pdfBytes, err := CreateEventPlanPDF(GetDB(), fromStr, toStr)
	if err != nil {
		serverFehler(c, "PDF erzeugen", err)
		return
	}

	c.Header("Content-Disposition", "attachment; filename=Miniplan.pdf")
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func getEventAssignmentOptions(c *gin.Context) {
	eventId := c.Param("eventId")

	options, err := GetAssignmentOptionsForEvent(eventId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Event nicht gefunden oder Verfügbarkeit konnte nicht geladen werden",
		})
		return
	}

	c.IndentedJSON(http.StatusOK, options)
}
