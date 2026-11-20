package auth

import (
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"
	"uuid"

	"github.com/thecodearcher/limen"
	gormadapter "github.com/thecodearcher/limen/adapters/gorm"
	credentialpassword "github.com/thecodearcher/limen/plugins/credential-password"
	"github.com/thecodearcher/limen/plugins/oauth"
	ouauthgithub "github.com/thecodearcher/limen/plugins/oauth-github"
	organization "github.com/thecodearcher/limen/plugins/organization"
	passkey "github.com/thecodearcher/limen/plugins/passkey"
	twofactor "github.com/thecodearcher/limen/plugins/two-factor"
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
	appScheme := os.Getenv("APP_SCHEME")

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
					"image":     "image",
				}), nil
			}),
		))

	return &limen.Config{
		BaseURL:  baseURL,
		Database: adapter,
		Schema:   schema,
		HTTP: limen.NewDefaultHTTPConfig(
			limen.WithHTTPCookieSecure(isHTTPS),
			limen.WithHTTPSessionCookieName("session"),
			limen.WithHTTPDisabledPaths([]string{"verify-email"})),
		Plugins: []limen.Plugin{
			credentialpassword.New(),
			organization.New(),
			twofactor.New(
				twofactor.WithTOTP(
					twofactor.WithTOTPIssuer(appScheme),
				),
				twofactor.WithBackupCodes(
					twofactor.WithBackupCodesCount(8),
					twofactor.WithBackupCodesLength(16),
				),
			),
			oauth.New(
				oauth.WithProviders(ouauthgithub.New(
					ouauthgithub.WithClientID(os.Getenv("GITHUB_CLIENT_ID")),
					ouauthgithub.WithClientSecret(os.Getenv("GITHUB_CLIENT_SECRET")),
				))),
			passkey.New(
				passkey.WithRPName(appScheme),
				passkey.WithAllowInternalUserIDAsHandle(true),
			),
		},
		CLI: &limen.CLIConfig{
			Enabled: true,
		},
		Email: limen.NewDefaultEmailConfig(
			limen.WithEmailVerification(limen.WithAutoSignInAfterVerification(),
				limen.WithEmailVerificationExpiration(10*time.Minute),
				limen.WithEmailVerificationTokenGenerator(func(u *limen.User) (string, error) {
					n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
					if err != nil {
						return "", err
					}
					return fmt.Sprintf("%06d", n.Int64()), nil
				}),
				limen.WithSendEmailVerificationMail(func(email, token string) {
					go func() {
						ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

						defer cancel()

						err := SendAuthEmail(ctx,
							email,
							"Your Sprintstack code",
							fmt.Sprintf("Your verification code is %s. It expires in 10 minutes.", token))

						if err != nil {
							slog.Error("send verification email failed", "to", email, "err", err)
						}
					}()
				})),
		),
	}
}
