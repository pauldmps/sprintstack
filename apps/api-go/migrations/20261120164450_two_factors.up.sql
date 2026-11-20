CREATE TABLE IF NOT EXISTS two_factors (
  id UUID,
  user_id UUID NOT NULL,
  secret VARCHAR(255),
  backup_codes TEXT,
  PRIMARY KEY (id),
CONSTRAINT fk_two_factors_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX idx_two_factors_user_id ON two_factors (user_id);
