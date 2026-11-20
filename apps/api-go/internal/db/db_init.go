package db

import (
	"api-go/internal/config"
	"strconv"

	gormadapter "github.com/thecodearcher/limen/adapters/gorm"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func InitDB() (*gormadapter.Adapter, error) {
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

	adapter := gormadapter.New(gormdb)

	return adapter, nil
}
