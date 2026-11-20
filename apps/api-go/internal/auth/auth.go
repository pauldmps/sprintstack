package auth

import (
	"api-go/internal/config"
	"api-go/internal/mailer"
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"strings"
	"time"
	"uuid"

	"github.com/gin-gonic/gin"
	"github.com/thecodearcher/limen"
	gormadapter "github.com/thecodearcher/limen/adapters/gorm"
	credentialpassword "github.com/thecodearcher/limen/plugins/credential-password"
	"github.com/thecodearcher/limen/plugins/oauth"
	oauthgithub "github.com/thecodearcher/limen/plugins/oauth-github"
	organization "github.com/thecodearcher/limen/plugins/organization"
	passkey "github.com/thecodearcher/limen/plugins/passkey"
	twofactor "github.com/thecodearcher/limen/plugins/two-factor"
	"gorm.io/gorm"
)

type uuidGenerator struct{}

func (uuidGenerator) Generate(_ context.Context) (any, error) {
	return uuid.NewV4(), nil
}

func (uuidGenerator) GetColumnType() limen.ColumnType {
	return limen.ColumnTypeUUID
}

func buildConfig(adapter *gormadapter.Adapter) *limen.Config {
	cfg := config.MustLoad()

	baseURL := cfg.BaseURL
	isHTTPS := strings.HasPrefix(baseURL, "https://")
	appName := cfg.AppName

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
			credentialpassword.New(
				credentialpassword.WithRequireEmailVerification(true),
			),
			organization.New(),
			twofactor.New(
				twofactor.WithTOTP(
					twofactor.WithTOTPIssuer(appName),
				),
				twofactor.WithBackupCodes(
					twofactor.WithBackupCodesCount(8),
					twofactor.WithBackupCodesLength(16),
				),
			),
			oauth.New(
				oauth.WithProviders(oauthgithub.New(
					oauthgithub.WithClientID(cfg.GitHubClientID),
					oauthgithub.WithClientSecret(cfg.GitHubClientSecret),
				))),
			passkey.New(
				passkey.WithRPName(appName),
				passkey.WithAllowInternalUserIDAsHandle(true),
			),
		},
		CLI: &limen.CLIConfig{
			Enabled: true,
		},
		Email: limen.NewDefaultEmailConfig(
			limen.WithEmailVerification(
				limen.WithEmailVerificationExpiration(10*time.Minute),
				limen.WithEmailVerificationTokenGenerator(func(u *limen.User) (string, error) {
					n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
					if err != nil {
						return "", err
					}
					return fmt.Sprintf("%06d", n.Int64()), nil
				}),
				limen.WithSendEmailVerificationMail(func(email, token string) {
					// async - run without waiting using a go routine
					go func() {
						ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
						defer cancel()

						err := mailer.SendAuthEmail(ctx,
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

func newService(adapter *gormadapter.Adapter) (*limen.Limen, error) {
	authConfig := buildConfig(adapter)

	authSvc, err := limen.New(authConfig)

	if err != nil {
		return nil, err
	}

	return authSvc, nil
}

func SetHandlers(db *gorm.DB, router *gin.Engine) error {
	adapter := gormadapter.New(db)

	authSvc, err := newService(adapter)

	if err != nil {
		return err
	}

	authHandler := gin.WrapH(authSvc.Handler())

	router.POST("/auth/verify-email-otp", func(ctx *gin.Context) { verifyEmailOtp(ctx, authSvc) })
	router.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/auth/") {
			authHandler(c)
		}
	})

	return err
}
