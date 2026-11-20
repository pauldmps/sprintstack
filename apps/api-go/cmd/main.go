package main

import (
	"api-go/internal/auth"
	"api-go/internal/db"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/thecodearcher/limen"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	router := gin.Default()
	router.SetTrustedProxies(nil)

	router.GET("ping", func (c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})
	

	adapter := db.InitDB()

	authConfig := auth.GetAuthConfig(adapter)

	authSvc, err := limen.New(authConfig)
	if err != nil {
		log.Fatalf("Failed to create limen: %v", err)
	}

	authHandler := gin.WrapH(authSvc.Handler())
	router.Any("/auth/*path", authHandler)

	log.Fatal(router.Run())
}