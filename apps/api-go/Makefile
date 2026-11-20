# apps/api-go/Makefile
include .env
export

.PHONY: dev build schema db-generate db-migrate db-rollback

dev:
	air

build:
	go build -o bin/api ./cmd

schema:            ## start once so limen writes .limen/schemas.json
	timeout 5 go run ./cmd || true

db-generate: schema
	go tool limen generate migrations --driver postgres --dsn "$(DATABASE_URL)"

# `go tool` can't pass build tags, and migrate only compiles DB drivers in via tags.
# `go run` on the same package still uses the version pinned in go.mod.
MIGRATE := go run -tags postgres github.com/golang-migrate/migrate/v4/cmd/migrate

db-migrate:
	$(MIGRATE) -path migrations -database "$(DATABASE_URL)" up

db-rollback:
	$(MIGRATE) -path migrations -database "$(DATABASE_URL)" down 1
