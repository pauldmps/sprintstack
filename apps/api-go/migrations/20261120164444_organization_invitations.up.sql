CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID,
  organization_id UUID NOT NULL,
  inviter_id UUID,
  email VARCHAR(255) NOT NULL,
  roles TEXT,
  status VARCHAR(255) NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
CONSTRAINT fk_organization_invitations_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT fk_organization_invitations_inviter FOREIGN KEY (inviter_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX idx_organization_invitations_token ON organization_invitations (token);
CREATE INDEX idx_organization_invitations_org ON organization_invitations (organization_id);
CREATE INDEX idx_organization_invitations_email ON organization_invitations (email);
