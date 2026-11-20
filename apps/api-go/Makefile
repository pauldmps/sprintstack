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

db-migrate:
	go tool migrate -path migrations -database "$(DATABASE_URL)" up

db-rollback:
	go tool migrate -path migrations -database "$(DATABASE_URL)" down 1
