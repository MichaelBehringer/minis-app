package main

import (
	. "minisAPI/controller"
	. "minisAPI/middleware"
	. "minisAPI/models"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	InitDB()
	defer CloseDB()

	router := gin.Default()
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Content-Type", "Content-Length", "Accept-Encoding", "Authorization", "Cache-Control"}

	router.Use(cors.New(config))
	router.POST("/login", login)
	router.GET("/checkToken", AuthUser(), checkToken)

	router.GET("/events/:userId", AuthUser(), getEventsForUser)

	router.GET("/user", AuthUser(), getAllUser)
	router.GET("/user/:userId", AuthUser(), getUser)
	router.PATCH("/user/:userId", AuthUser(), updateUser)
	router.PATCH("/user/:userId/password", AuthUser(), updateUserPassword)
	router.GET("/user/:userId/ban", AuthUser(), getUserBanDates)
	router.PATCH("/user/:userId/ban", AuthUser(), updateUserBanDates)
	router.GET("/user/:userId/weekday", AuthUser(), getUserWeekdays)
	router.PATCH("/user/:userId/weekday", AuthUser(), updateUserWeekday)
	router.PATCH("/user/:userId/preferred", AuthUser(), updateUserPreferred)
	router.GET("/user/:userId/preferred", AuthUser(), getUserPreferred)

	router.Run("localhost:8080")
}

func login(c *gin.Context) {
	var login Login
	c.BindJSON(&login)
	retJWT := DoLogin(login, c)
	c.IndentedJSON(http.StatusOK, retJWT)
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
