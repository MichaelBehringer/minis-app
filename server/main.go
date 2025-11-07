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

	router.GET("/user/:userId", AuthUser(), getUser)
	router.PATCH("/user/:userId", AuthUser(), updateUser)
	router.PATCH("/user/:userId/password", AuthUser(), updateUserPassword)

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

func getUser(c *gin.Context) {
	userId := c.Param("userId")
	events := GetUser(userId)
	c.IndentedJSON(http.StatusOK, events)
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
