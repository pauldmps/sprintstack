package user

import (
	"github.com/gin-gonic/gin"
)

func SetHandlers(router *gin.Engine, userService *Service) {
	router.GET("/user/:id", func(ctx *gin.Context) {
		userService.GetUserById(ctx, ctx.Param("id"))
	})
}
