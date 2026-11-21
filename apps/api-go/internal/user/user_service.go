package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Service struct {
	userStore *Store
}

func NewUserService(userStore *Store) *Service {
	return &Service{userStore: userStore}
}

func (s *Service) GetUserById(ctx *gin.Context, id string) {
	user, err := s.userStore.GetById(ctx, id)

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Some error ocurred"})
		return
	}

	if user.ID == "" {
		ctx.JSON(http.StatusNotFound, gin.H{})
		return
	}

	ctx.JSON(http.StatusOK, user)
}
