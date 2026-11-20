package main

import (
	"api-go/internal/auth"
	"api-go/internal/db"
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

	adapter, err := db.InitDB()

	if err != nil {
		log.Fatal("Unable to initalize DB", err)
	}

	log.Fatal(auth.SetHandlers(adapter, router))

	log.Fatal(router.Run())
}
