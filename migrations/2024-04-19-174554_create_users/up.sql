CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR NOT NULL,
  github_login VARCHAR NOT NULL UNIQUE,
  github_url VARCHAR NOT NULL,
  avatar_url VARCHAR,
  email VARCHAR,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)