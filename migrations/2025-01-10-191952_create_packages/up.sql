CREATE TABLE packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_owner uuid NOT NULL,
  package_name VARCHAR NOT NULL UNIQUE,
  default_version uuid DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_owner) REFERENCES users(id) ON DELETE RESTRICT
);