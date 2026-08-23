package main

import (
	"errors"
	"log"
	. "minisAPI/controller"
	. "minisAPI/middleware"
	. "minisAPI/models"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Fehlt die Datei, bleibt es bei den Umgebungsvariablen des Prozesses.
	// Im Container werden sie ueber docker-compose gesetzt, lokal ueber
	// server/.env - siehe .env.example.
	_ = godotenv.Load()

	InitDB()
	defer CloseDB()

	router := gin.Default()
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Content-Type", "Content-Length", "Accept-Encoding", "Authorization", "Cache-Control"}

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

	auth.GET("/location", getLocations)

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
	auth.GET("/user/:userId/weekday", AllowSelfOrMinRole(2), getUserWeekdays)
	auth.PATCH("/user/:userId/weekday", AllowSelfOrMinRole(2), updateUserWeekday)
	auth.PATCH("/user/:userId/preferred", AllowSelfOrMinRole(2), updateUserPreferred)
	auth.GET("/user/:userId/preferred", AllowSelfOrMinRole(2), getUserPreferred)
	auth.GET("/event/:eventId/assignment-options", AllowMinRole(2), getEventAssignmentOptions)

	// Feste Bindung an localhost liess sich im Container nicht erreichen und
	// musste vor jedem Deployen von Hand geaendert werden.
	adresse := Env("MINIS_LISTEN_ADDR", "localhost:8080")
	log.Printf("Server lauscht auf %s", adresse)
	if err := router.Run(adresse); err != nil {
		log.Fatalf("Server konnte nicht starten: %v", err)
	}
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
	userId := c.Param("userId")
	events := GetEventsForUser(userId)
	c.IndentedJSON(http.StatusOK, events)
}

func getEventsByDateRange(c *gin.Context) {
	from := c.Query("from")
	to := c.Query("to")

	events := GetEventsByDateRange(from, to)
	c.IndentedJSON(http.StatusOK, events)
}

func addUserToEvent(c *gin.Context) {
	eventId := c.Param("eventId")

	var payload struct {
		UserId int `json:"userId"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"error": "Invalid JSON"})
		return
	}

	AddUserToEvent(eventId, payload.UserId)

	c.JSON(200, gin.H{"status": "added"})
}

func removeUserFromEvent(c *gin.Context) {
	eventId := c.Param("eventId")

	var payload struct {
		UserId int `json:"userId"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"error": "Invalid JSON"})
		return
	}

	RemoveUserFromEvent(eventId, payload.UserId)

	c.JSON(200, gin.H{"status": "removed"})
}

func getLocations(c *gin.Context) {
	locations := GetLocations()
	c.IndentedJSON(200, locations)
}

func putEvent(c *gin.Context) {
	var ev Event
	if err := c.BindJSON(&ev); err != nil {
		c.JSON(400, gin.H{"error": "invalid payload"})
		return
	}

	id := CreateEvent(ev)

	c.JSON(200, gin.H{
		"status": "created",
		"id":     id,
	})
}

func getAllUserHead(c *gin.Context) {
	users := GetAllUserHead()
	c.IndentedJSON(http.StatusOK, users)
}

func getAllUser(c *gin.Context) {
	users := GetAllUser()
	c.IndentedJSON(http.StatusOK, users)
}

func getUser(c *gin.Context) {
	userId := c.Param("userId")
	user := GetUser(userId)
	c.IndentedJSON(http.StatusOK, user)
}

func updateUser(c *gin.Context) {
	userId := c.Param("userId")
	var payload User
	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}
	UpdateUser(userId, payload)

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func updateUserPassword(c *gin.Context) {
	userId := c.Param("userId")

	var payload struct {
		Password string `json:"password"`
	}

	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	UpdatePassword(userId, payload.Password)
	c.JSON(http.StatusOK, gin.H{"status": "password changed"})
}

func getUserBanDates(c *gin.Context) {
	userId := c.Param("userId")
	bans := GetBanDates(userId)
	c.IndentedJSON(http.StatusOK, bans)
}

func updateUserBanDates(c *gin.Context) {
	userId := c.Param("userId")

	var update SingleBanDateUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(400, gin.H{"error": "invalid payload"})
		return
	}

	if update.Add {
		AddBlockDate(userId, update.Date)
	} else {
		RemoveBlockDate(userId, update.Date)
	}
	c.JSON(200, gin.H{"status": "ok"})
}

func getUserWeekdays(c *gin.Context) {
	userId := c.Param("userId")
	weekdays := GetUserWeekdays(userId)
	c.IndentedJSON(http.StatusOK, weekdays)
}

func updateUserWeekday(c *gin.Context) {
	userId := c.Param("userId")

	var update SingleWeekdayUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(400, gin.H{"error": "invalid payload"})
		return
	}

	if update.Add {
		AddUserWeekday(userId, update.Weekday)
	} else {
		RemoveUserWeekday(userId, update.Weekday)
	}

	c.JSON(200, gin.H{"status": "ok"})
}

func updateUserPreferred(c *gin.Context) {
	userId := c.Param("userId")

	var update PreferredUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(400, gin.H{"error": "invalid payload"})
		return
	}

	if update.Add {
		AddPreferredUser(userId, update.OtherUserId)
	} else {
		RemovePreferredUser(userId, update.OtherUserId)
	}

	c.JSON(200, gin.H{"status": "ok"})
}

func getUserPreferred(c *gin.Context) {
	userId := c.Param("userId")

	data := GetPreferredUsers(userId)

	c.JSON(200, data)
}

func GetEventsPDF(c *gin.Context) {
	fromStr := c.Query("from")
	toStr := c.Query("to")

	// PDF erzeugen
	pdfBytes, err := CreateEventPlanPDF(GetDB(), fromStr, toStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "PDF konnte nicht erzeugt werden", "details": err.Error()})
		return
	}

	// Download Header
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
