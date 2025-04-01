-- Remove `github_id` column from the `users` table
ALTER TABLE users
DROP COLUMN github_id;

-- Restore unique constraint on github_login
ALTER TABLE users
ADD CONSTRAINT users_github_login_key UNIQUE (github_login);

-- Restore original foreign keys without cascade delete
ALTER TABLE sessions
DROP CONSTRAINT sessions_user_id_fkey,
ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id);

ALTER TABLE api_tokens
DROP CONSTRAINT api_tokens_user_id_fkey,
ADD CONSTRAINT api_tokens_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id);
