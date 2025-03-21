DROP INDEX IF EXISTS idx_package_categories_package_id;
DROP INDEX IF EXISTS idx_package_keywords_package_id;
DROP INDEX IF EXISTS idx_package_categories_trgm_ci;
DROP INDEX IF EXISTS idx_package_keywords_trgm;

DROP TABLE IF EXISTS package_categories;
DROP TABLE IF EXISTS package_keywords;
