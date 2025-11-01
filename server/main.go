package main

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	router := gin.Default()
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Content-Type", "Content-Length", "Accept-Encoding", "Authorization", "Cache-Control"}

	router.Use(cors.New(config))
	router.GET("/test", test)

	router.Run("localhost:8080")
}

func test(c *gin.Context) {
	c.String(http.StatusOK, "hello world")
}
