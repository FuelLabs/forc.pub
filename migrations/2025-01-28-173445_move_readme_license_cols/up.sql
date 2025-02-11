-- Add `readme` and `forc_manifest` columns to the `uploads` table
ALTER TABLE uploads
ADD COLUMN readme VARCHAR,
ADD COLUMN forc_manifest VARCHAR NOT NULL DEFAULT '';

-- Migrate data from `package_versions` to `uploads`
UPDATE uploads
SET
    readme = pv.readme
FROM package_versions pv
WHERE uploads.id = pv.upload_id;

-- Remove `readme` column from `package_versions`
ALTER TABLE package_versions
DROP COLUMN readme;
