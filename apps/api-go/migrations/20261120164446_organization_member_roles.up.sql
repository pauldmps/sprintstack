CREATE TABLE IF NOT EXISTS organization_member_roles (
  id UUID,
  member_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  role VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
CONSTRAINT fk_organization_member_roles_member FOREIGN KEY (member_id) REFERENCES organization_members (id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT fk_organization_member_roles_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX idx_organization_member_roles_member_role ON organization_member_roles (member_id, role);
