package auth

import (
	"api-go/internal/config"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

const mailjetSendUrl = "https://api.mailjet.com/v3.1/send"

type mailjetResponse struct {
	Messages []struct {
		Status string `json:"Status"`
		Errors []struct {
			ErrorMessage string `json:"ErrorMessage"`
		} `json:"Errors"`
	} `json:"Messages"`
	ErrorMessage string `json:"ErrorMessage"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

func SendAuthEmail(ctx context.Context, to, subject, text string) error {
	cfg := config.MustLoad()
	apiKey := cfg.MailjetApiKey
	apiSecret := cfg.MailjetApiSecret

	if apiKey == "" || apiSecret == "" {
		return errors.New("missing mailjet secrets")
	}

	payload, err := json.Marshal(map[string]any{
		"Messages": []map[string]any{{
			"From": map[string]any{
				"Email": cfg.MailFrom,
				"Name":  cfg.MailFromName,
			},
			"To":       []map[string]any{{"Email": to}},
			"Subject":  subject,
			"TextPart": text,
		}},
	})

	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", mailjetSendUrl, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	req.SetBasicAuth(apiKey, apiSecret)
	req.Header.Set("Content-Type", "application/json")

	res, err := httpClient.Do(req)
	if err != nil {
		return err
	}

	defer res.Body.Close()

	var result mailjetResponse
	err = json.NewDecoder(res.Body).Decode(&result)
	if err != nil {
		return err
	}

	ok := res.StatusCode >= 200 && res.StatusCode < 300
	if !ok || len(result.Messages) == 0 || result.Messages[0].Status != "success" {
		return fmt.Errorf("Mailjet rejected email: HTTP %d %s", res.StatusCode, result.ErrorMessage)
	}
	return nil
}
