-- Enable pg_trgm extension for trigram indexing (only needs to be done once)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Keywords table (freeform text entries)
CREATE TABLE IF NOT EXISTS package_keywords (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Categories table (also freeform)
CREATE TABLE IF NOT EXISTS package_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigram index for partial keyword search
CREATE INDEX IF NOT EXISTS idx_package_keywords_trgm
ON package_keywords USING GIN (keyword gin_trgm_ops);

-- Trigram index for case-insensitive category search
CREATE INDEX IF NOT EXISTS idx_package_categories_trgm_ci
ON package_categories USING GIN (LOWER(category) gin_trgm_ops);

-- Indexing by package_id for joins
CREATE INDEX IF NOT EXISTS idx_package_keywords_package_id
ON package_keywords(package_id);

CREATE INDEX IF NOT EXISTS idx_package_categories_package_id
ON package_categories(package_id);
