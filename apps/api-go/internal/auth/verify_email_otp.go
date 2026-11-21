package auth

import (
	"api-go/internal/user"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/thecodearcher/limen"
	"gorm.io/gorm"
)

var errInvalidCode = errors.New("invalid or expired code")

func verifyEmailOtp(c *gin.Context, db *gorm.DB, l *limen.Limen) {
	userToVerify, err := l.ResolveEmailVerificationChallenge(c.Request)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}

	var body struct {
		Code string `json:"code" binding:"required,len=6,numeric"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid code"})
	}

	subject := limen.GenerateVerificationAction(limen.EmailVerificationAction, limen.NormalizeEmail(userToVerify.Email))
	now := time.Now()

	err = db.Transaction(func(tx *gorm.DB) error {
		deleted, err := gorm.G[Verification](tx).
			Where("subject = ? AND value = ? AND expires_at > ?", subject, body.Code, now).
			Delete(c)

		if err != nil {
			return err
		}

		if deleted == 0 {
			return errInvalidCode
		}

		_, err = gorm.G[user.User](tx).Where("id = ?", userToVerify.ID).Update(c, "email_verified_at", now)

		return err
	})

	switch {
	case errors.Is(errInvalidCode, err):
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid code"})

	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"message": "sonething went wrong"})

	default:
		l.ClearEmailVerificationChallenge(c.Writer)
		c.JSON(http.StatusOK, gin.H{"message": "email verified"})
	}

}
