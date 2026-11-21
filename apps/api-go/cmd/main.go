package main

import (
	"api-go/internal/auth"
	"api-go/internal/db"
	"api-go/internal/user"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	router := gin.Default()
	router.SetTrustedProxies(nil)

	router.GET("ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	db, err := db.InitDB()

	if err != nil {
		log.Fatal("Unable to initialize DB: ", err)
	}

	err = auth.SetHandlers(db, router)
	if err != nil {
		log.Fatal("Unable to set auth handlers: ", err)
	}

	userStore := user.NewUserStore(db)
	userService := user.NewUserService(userStore)
	user.SetHandlers(router, userService)

	err = router.Run()
	if err != nil {
		log.Fatal(err)
	}
}
