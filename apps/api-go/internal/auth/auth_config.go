package auth

import (
	"fmt"
	"os"
	"strings"

	"github.com/thecodearcher/limen"
	gormadapter "github.com/thecodearcher/limen/adapters/gorm"
	credentialpassword "github.com/thecodearcher/limen/plugins/credential-password"
)

func GetAuthConfig(adapter *gormadapter.Adapter) *limen.Config {
	baseURL := fmt.Sprintf("%s:%s", os.Getenv("BASE_URL"), os.Getenv("PORT"))
	isHTTPS := strings.HasPrefix(baseURL, "https://")

	return &limen.Config{
		BaseURL:  baseURL,
		Database: adapter,
		HTTP:     limen.NewDefaultHTTPConfig(limen.WithHTTPCookieSecure(isHTTPS)),
		Plugins: []limen.Plugin{
			credentialpassword.New(),
		},
		CLI: &limen.CLIConfig{
			Enabled: true,
		},
	}
}
