-- Enable the pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Functional index for fast case-insensitive package name searches
CREATE INDEX idx_packages_name_lower 
    ON packages USING btree (LOWER(package_name));

-- Trigram indexes for fuzzy search
CREATE INDEX idx_packages_name_trgm 
    ON packages USING gin (LOWER(package_name) gin_trgm_ops);

CREATE INDEX idx_package_versions_desc_trgm 
    ON package_versions USING gin (LOWER(package_description) gin_trgm_ops);

-- Composite index for the join and filtering
CREATE INDEX idx_package_versions_package_id_created_at 
    ON package_versions (package_id, created_at DESC);

-- Index for pagination
CREATE INDEX idx_packages_created_at 
    ON packages (created_at DESC); 