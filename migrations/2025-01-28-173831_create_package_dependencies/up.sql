CREATE TABLE package_dependencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dependent_package_version_id UUID NOT NULL,
    dependency_package_name VARCHAR NOT NULL,
    dependency_version_req VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (dependent_package_version_id) REFERENCES package_versions(id) ON DELETE CASCADE
);