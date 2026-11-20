package db

import (
	"api-go/internal/config"
	"strconv"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func InitDB() (*gorm.DB, error) {
	cfg := config.MustLoad()

	gormdb, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	sqlDB, err := gormdb.DB()
	if err != nil {
		return nil, err
	}

	maxConn, err := strconv.Atoi(cfg.DatabasePoolMax)
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxOpenConns(maxConn)

	return gormdb, nil
}
