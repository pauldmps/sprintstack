CREATE TABLE IF NOT EXISTS passkeys (
  id UUID,
  user_id UUID NOT NULL,
  name VARCHAR(255),
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  transports TEXT,
  aaguid VARCHAR(255) NOT NULL,
  backup_eligible BOOLEAN NOT NULL DEFAULT false,
  backup_state BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
CONSTRAINT fk_passkeys_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX idx_passkeys_credential_id ON passkeys (credential_id);
CREATE INDEX idx_passkeys_user_id ON passkeys (user_id);
