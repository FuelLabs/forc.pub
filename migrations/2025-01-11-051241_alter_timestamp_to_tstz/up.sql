ALTER TABLE api_tokens
ALTER COLUMN created_at TYPE timestamptz
USING created_at AT TIME ZONE 'UTC';

ALTER TABLE api_tokens
ALTER COLUMN expires_at TYPE timestamptz
USING expires_at AT TIME ZONE 'UTC';

ALTER TABLE sessions
ALTER COLUMN expires_at TYPE timestamptz
USING expires_at AT TIME ZONE 'UTC';

ALTER TABLE sessions
ALTER COLUMN created_at TYPE timestamptz
USING created_at AT TIME ZONE 'UTC';

ALTER TABLE uploads
ALTER COLUMN created_at TYPE timestamptz
USING created_at AT TIME ZONE 'UTC';

ALTER TABLE users
ALTER COLUMN created_at TYPE timestamptz
USING created_at AT TIME ZONE 'UTC';