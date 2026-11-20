package auth

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"uuid"

	"github.com/thecodearcher/limen"
	gormadapter "github.com/thecodearcher/limen/adapters/gorm"
	credentialpassword "github.com/thecodearcher/limen/plugins/credential-password"
	"github.com/thecodearcher/limen/plugins/oauth"
	ouauthgithub "github.com/thecodearcher/limen/plugins/oauth-github"
)

type uuidGenerator struct{}

func (uuidGenerator) Generate(_ context.Context) (any, error) {
	return uuid.NewV4(), nil
}

func (uuidGenerator) GetColumnType() limen.ColumnType {
	return limen.ColumnTypeUUID
}

func GetAuthConfig(adapter *gormadapter.Adapter) *limen.Config {
	baseURL := fmt.Sprintf("%s:%s", os.Getenv("BASE_URL"), os.Getenv("PORT"))
	isHTTPS := strings.HasPrefix(baseURL, "https://")

	schema := limen.NewDefaultSchemaConfig(
		limen.WithSchemaIDGenerator(uuidGenerator{}),
		limen.WithSchemaUser(
			limen.WithUserAdditionalFields(func(ctx *limen.AdditionalFieldsContext) (map[string]any, error) {
				if !ctx.IsCreate() || ctx.GetBody() == nil {
					return nil, nil
				}
				if ctx.IsEmpty("firstname") {
					return nil, limen.NewLimenError("firstname is required", http.StatusBadRequest, nil)
				}
				if ctx.IsEmpty("lastname") {
					return nil, limen.NewLimenError("lastname is required", http.StatusBadRequest, nil)
				}
				return ctx.Pick(map[string]string{
					"firstname": "first_name",
					"lastname":  "last_name",
				}), nil
			}),
		))

	return &limen.Config{
		BaseURL:  baseURL,
		Database: adapter,
		Schema:   schema,
		HTTP:     limen.NewDefaultHTTPConfig(limen.WithHTTPCookieSecure(isHTTPS)),
		Plugins: []limen.Plugin{
			credentialpassword.New(),
			oauth.New(
				oauth.WithProviders(ouauthgithub.New(
					ouauthgithub.WithClientID(os.Getenv("GITHUB_CLIENT_ID")),
					ouauthgithub.WithClientSecret(os.Getenv("GITHUB_CLIENT_SECRET")),
				))),
		},
		CLI: &limen.CLIConfig{
			Enabled: true,
		},
	}
}
