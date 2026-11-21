package config

import "os"

type Config struct {
	BaseURL            string
	DatabaseURL        string
	DatabasePoolMax    string
	LimenSecret        string
	GitHubClientID     string
	GitHubClientSecret string
	AppName            string
	AppScheme          string
	MailjetAPIKey      string
	MailjetAPISecret   string
	MailFrom           string
	MailFromName       string
}

func MustLoad() Config {
	return Config{
		BaseURL:            os.Getenv("BASE_URL"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		DatabasePoolMax:    os.Getenv("DATABASE_POOL_MAX"),
		LimenSecret:        os.Getenv("LIMEN_SECRET"),
		GitHubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		AppName:            os.Getenv("APP_NAME"),
		AppScheme:          os.Getenv("APP_SCHEME"),
		MailjetAPIKey:      os.Getenv("MAILJET_API_KEY"),
		MailjetAPISecret:   os.Getenv("MAILJET_API_SECRET"),
		MailFrom:           os.Getenv("MAIL_FROM"),
		MailFromName:       os.Getenv("MAIL_FROM_NAME"),
	}
}
