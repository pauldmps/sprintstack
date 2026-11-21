package user

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

type Store struct {
	db *gorm.DB
}

func NewUserStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (s *Store) GetById(ctx context.Context, id string) (User, error) {
	user, err := gorm.G[User](s.db).Where("id = ?", id).First(ctx)

	if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, nil
	}

	return user, err
}
