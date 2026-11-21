package auth

import "time"

type Verification struct {
	ID        string
	Subject   string
	Value     string
	ExpiresAt time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}
