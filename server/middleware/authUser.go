package middleware

import (
	"fmt"
	. "minisAPI/controller"
	. "minisAPI/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAllowed, claims := ExtractToken(c)

		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, ResponseText{Reason: "no token provided"})
			return
		}

		if !isAllowed {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set("claims", claims)
		c.Next()
	}
}

func AllowSelfOrMinRole(minRole int) gin.HandlerFunc {
	return func(c *gin.Context) {
		claimsVal, exists := c.Get("claims")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		claims := claimsVal.(jwt.MapClaims)
		role := int(claims["roleId"].(float64))
		tokenUserId := fmt.Sprintf("%.0f", claims["userId"].(float64))
		paramUserId := c.Param("userId")

		if tokenUserId != paramUserId && role < minRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}

		c.Next()
	}
}
