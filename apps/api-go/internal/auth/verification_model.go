package auth

import "time"

// Verification mirrors limen's `verifications` table. Limen owns writes;
// this model exists so app code can query it with gorm.G.
type Verification struct {
	ID        string
	Subject   string
	Value     string
	ExpiresAt time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}
