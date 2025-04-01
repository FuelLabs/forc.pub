-- Update sessions foreign key to cascade deletes
ALTER TABLE sessions
DROP CONSTRAINT sessions_user_id_fkey,
ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE;

-- Update api_tokens foreign key to cascade deletes
ALTER TABLE api_tokens
DROP CONSTRAINT api_tokens_user_id_fkey,
ADD CONSTRAINT api_tokens_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE;

-- Update packages foreign key to cascade deletes
ALTER TABLE packages
DROP CONSTRAINT packages_user_owner_fkey,
ADD CONSTRAINT packages_user_owner_fkey
    FOREIGN KEY (user_owner)
    REFERENCES users(id)
    ON DELETE CASCADE;

-- Update package_versions foreign key to cascade deletes
ALTER TABLE package_versions
DROP CONSTRAINT package_versions_published_by_fkey,
ADD CONSTRAINT package_versions_published_by_fkey
    FOREIGN KEY (published_by)
    REFERENCES users(id)
    ON DELETE CASCADE;

-- Delete all existing users since we can't assign them valid github_ids
DELETE FROM users;

-- Drop unique constraint from github_login
ALTER TABLE users
DROP CONSTRAINT users_github_login_key;

-- Add `github_id` column to the `users` table
ALTER TABLE users
ADD COLUMN github_id BIGINT NOT NULL UNIQUE;

-- Update package_versions foreign key to restrict deletes
ALTER TABLE package_versions
DROP CONSTRAINT package_versions_published_by_fkey,
ADD CONSTRAINT package_versions_published_by_fkey
    FOREIGN KEY (published_by)
    REFERENCES users(id)
    ON DELETE RESTRICT;

-- Update packages foreign key to restrict deletes
ALTER TABLE packages
DROP CONSTRAINT packages_user_owner_fkey,
ADD CONSTRAINT packages_user_owner_fkey
    FOREIGN KEY (user_owner)
    REFERENCES users(id)
    ON DELETE RESTRICT;
