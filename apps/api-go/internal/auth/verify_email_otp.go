package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/thecodearcher/limen"
	"gorm.io/gorm"
)

func verifyEmailOtp(c *gin.Context, db *gorm.DB, l *limen.Limen) {
	session, err := l.GetSession(c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}

	_ = session // TODO: look up this user's code, compare, mark verified
}
