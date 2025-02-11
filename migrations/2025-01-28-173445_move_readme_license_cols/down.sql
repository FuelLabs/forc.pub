-- Add `readme` column back to the `package_versions` table
ALTER TABLE package_versions
ADD COLUMN readme VARCHAR;

-- Migrate data back from `uploads` to `package_versions`
UPDATE package_versions
SET
    readme = u.readme
FROM uploads u
WHERE package_versions.upload_id = u.id;

-- Remove `readme` and `forc_manifest` columns from `uploads`
ALTER TABLE uploads
DROP COLUMN readme,
DROP COLUMN forc_manifest;