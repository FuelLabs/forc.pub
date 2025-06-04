-- Drop all search-related indexes
DROP INDEX IF EXISTS idx_packages_created_at;
DROP INDEX IF EXISTS idx_package_versions_package_id_created_at;
DROP INDEX IF EXISTS idx_package_versions_desc_trgm;
DROP INDEX IF EXISTS idx_packages_name_trgm;
DROP INDEX IF EXISTS idx_packages_name_lower;

-- Note: We don't drop the pg_trgm extension as other parts of the system might be using it 