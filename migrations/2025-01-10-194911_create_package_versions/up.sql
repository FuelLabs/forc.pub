CREATE TABLE package_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  publish_token uuid NOT NULL,
  published_by uuid NOT NULL,
  upload_id uuid NOT NULL,
  num VARCHAR NOT NULL,
  package_description VARCHAR,
  repository VARCHAR,
  documentation VARCHAR,
  homepage VARCHAR,
  urls TEXT[] NOT NULL DEFAULT '{}',
  readme VARCHAR,
  license VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- There can only be one version with the same number per package
  UNIQUE (package_id, num),
  -- FK constraints
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (publish_token) REFERENCES api_tokens(id) ON DELETE RESTRICT,
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE RESTRICT
);