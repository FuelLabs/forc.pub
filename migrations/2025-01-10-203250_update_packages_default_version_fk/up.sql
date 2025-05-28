ALTER TABLE packages
ADD CONSTRAINT packages_default_version_fkey
FOREIGN KEY (default_version) REFERENCES package_versions(id)
ON DELETE SET DEFAULT;
