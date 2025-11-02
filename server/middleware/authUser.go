package middleware

import (
	. "minisAPI/controller"
	. "minisAPI/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func AuthUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAllowed, claims := ExtractToken(c)
		if claims == nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, ResponseText{Reason: "no token provided"})
			return
		}
		if isAllowed {
			c.Next()
		} else {
			c.AbortWithStatus(http.StatusMethodNotAllowed)
			return
		}
	}
}
