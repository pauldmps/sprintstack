package db

import (
	"log"
	"os"
	"strconv"

	gormadapter "github.com/thecodearcher/limen/adapters/gorm"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)


func InitDB() *gormadapter.Adapter {
dsn := os.Getenv("DATABASE_URL")
	gormdb, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	
	sqlDB, err := gormdb.DB()
	if err != nil {
		log.Fatalf("Failed to get underlying DB: %v", err)
	}

	maxConn, err := strconv.Atoi(os.Getenv("DATABASE_POOL_MAX"))
	if err != nil {
		log.Fatalf("DATABASE_POOL_MAX env variable is not set or is invalid: %v", err)
	}
	
	sqlDB.SetMaxOpenConns(maxConn)
	
	adapter := gormadapter.New(gormdb)

	return adapter
}