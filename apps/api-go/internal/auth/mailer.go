package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
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
	apiKey := os.Getenv("MAILJET_API_KEY")
	apiSecret := os.Getenv("MAILJET_API_SECRET")

	if apiKey == "" || apiSecret == "" {
		return errors.New("missing mailjet secrets")
	}

	payload, err := json.Marshal(map[string]any{
		"Messages": []map[string]any{{
			"From": map[string]any{
				"Email": os.Getenv("MAIL_FROM"),
				"Name":  os.Getenv("MAIL_FROM_NAME"),
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

	req.SetBasicAuth(apiKey, apiSecret)
	req.Header.Set("Content-Type", "application/json")

	res, err := httpClient.Do(req)

	if err != nil {
		return err
	}

	defer res.Body.Close()

	var result mailjetResponse
	json.NewDecoder(res.Body).Decode(&result)

	ok := res.StatusCode >= 200 && res.StatusCode < 300
	if !ok || len(result.Messages) == 0 || result.Messages[0].Status != "success" {
		return fmt.Errorf("Mailjet rejected email: HTTP %d %s", res.StatusCode, result.ErrorMessage)
	}
	return nil
}
