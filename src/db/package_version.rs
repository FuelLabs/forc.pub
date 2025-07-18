use super::error::DatabaseError;
use super::{models, schema, DbConn};
use crate::api::pagination::{PaginatedResponse, Pagination};
use crate::handlers::publish::PublishInfo;
use crate::models::{
    ApiToken, AuthorInfo, CountResult, FullPackage, PackagePreview, PackageVersionInfo,
};
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::Timestamptz;
use uuid::Uuid;

impl DbConn<'_> {
    /// Insert a package version into the database and return the package version.
    /// If the package doesn't exist, insert the package as well.
    pub fn new_package_version(
        &mut self,
        api_token: &ApiToken,
        publish_info: &PublishInfo,
    ) -> Result<models::PackageVersion, DatabaseError> {
        // Check if the package exists.
        let pkg_name = publish_info.package_name.clone();
        let package = if let Some(existing_package) = schema::packages::table
            .filter(schema::packages::package_name.eq(pkg_name.clone()))
            .select(schema::packages::all_columns)
            .first::<models::Package>(self.inner())
            .optional()
            .map_err(|err| DatabaseError::QueryFailed(pkg_name.clone(), err))?
        {
            if existing_package.user_owner != api_token.user_id {
                // The package exists but the user is not the owner.
                return Err(DatabaseError::InvalidPublishToken);
            }
            Ok::<_, DatabaseError>(existing_package)
        } else {
            // Insert a new package.
            let new_package: models::NewPackage = models::NewPackage {
                user_owner: api_token.user_id,
                package_name: pkg_name.clone(),
            };

            let saved_package = diesel::insert_into(schema::packages::table)
                .values(&new_package)
                .returning(models::Package::as_returning())
                .get_result(self.inner())
                .map_err(|err| DatabaseError::InsertPackageFailed(pkg_name.clone(), err))?;
            Ok(saved_package)
        }?;

        let urls = publish_info
            .urls
            .iter()
            .map(|url| Some(url.to_string()))
            .collect();

        // Insert a new package version.
        let new_version = models::NewPackageVersion {
            package_id: package.id,
            publish_token: api_token.id,
            published_by: api_token.user_id,
            upload_id: publish_info.upload_id,
            num: publish_info.num.to_string(),
            package_description: publish_info.package_description.clone(),
            repository: publish_info.repository.clone().map(|url| url.to_string()),
            documentation: publish_info
                .documentation
                .clone()
                .map(|url| url.to_string()),
            homepage: publish_info.homepage.clone().map(|url| url.to_string()),
            license: publish_info.license.clone(),
            urls,
        };

        let saved_version = diesel::insert_into(schema::package_versions::table)
            .values(&new_version)
            .returning(models::PackageVersion::as_returning())
            .get_result(self.inner())
            .map_err(|err| {
                DatabaseError::InsertPackageVersionFailed(
                    pkg_name.clone(),
                    publish_info.num.to_string(),
                    err,
                )
            })?;

        // Update the package default version.
        diesel::update(schema::packages::table.filter(schema::packages::id.eq(package.id)))
            .set(schema::packages::default_version.eq(saved_version.id))
            .execute(self.inner())
            .map_err(|err| DatabaseError::UpdatePackageFailed(pkg_name.clone(), err))?;

        Ok(saved_version)
    }

    /// Fetch a package given the package ID.
    pub fn get_package_by_id(
        &mut self,
        package_id: Uuid,
    ) -> Result<models::Package, DatabaseError> {
        schema::packages::table
            .filter(schema::packages::id.eq(package_id))
            .select(models::Package::as_returning())
            .first::<models::Package>(self.inner())
            .map_err(|err| DatabaseError::NotFound(package_id.to_string(), err))
    }

    /// Fetch a package given the package name.
    pub fn get_package_by_name(&mut self, name: String) -> Result<models::Package, DatabaseError> {
        schema::packages::table
            .filter(schema::packages::package_name.eq(name.clone()))
            .select(models::Package::as_returning())
            .first::<models::Package>(self.inner())
            .map_err(|err| DatabaseError::NotFound(name.clone(), err))
    }

    /// Fetch a package given the package ID.
    pub fn get_package_version(
        &mut self,
        pkg_name: String,
        version: String,
    ) -> Result<models::PackageVersion, DatabaseError> {
        schema::package_versions::table
            .inner_join(
                schema::packages::table
                    .on(schema::packages::id.eq(schema::package_versions::package_id)),
            )
            .filter(schema::package_versions::num.eq(version.clone()))
            .filter(schema::packages::package_name.eq(pkg_name.clone()))
            .select(models::PackageVersion::as_returning())
            .first::<models::PackageVersion>(self.inner())
            .map_err(|err| {
                DatabaseError::NotFound(format!("Package {pkg_name} version {version}"), err)
            })
    }

    /// Fetch the most recently updated packages.
    pub fn get_recently_updated(&mut self) -> Result<Vec<PackagePreview>, DatabaseError> {
        let packages = diesel::sql_query(
            r#"WITH ranked_versions AS (
                SELECT 
                    p.id AS package_id,
                    p.package_name AS name, 
                    pv.num AS version, 
                    pv.package_description AS description, 
                    p.created_at AS created_at, 
                    pv.created_at AS updated_at,
                    ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY pv.created_at DESC) AS rank
                FROM package_versions pv
                JOIN packages p ON pv.package_id = p.id
            )
            SELECT 
                name, 
                version, 
                description, 
                created_at, 
                updated_at
            FROM ranked_versions
            WHERE rank = 1
            ORDER BY updated_at DESC
            LIMIT 10;
            "#,
        )
        .load::<PackagePreview>(self.inner())
        .map_err(|err| DatabaseError::QueryFailed("recently updated".to_string(), err))?;

        Ok(packages)
    }

    /// Fetch the [PackagePreview]s of the most recently created packages.
    pub fn get_recently_created(&mut self) -> Result<Vec<PackagePreview>, DatabaseError> {
        let packages = diesel::sql_query(
            r#"WITH ranked_versions AS (
                SELECT 
                    p.id AS package_id,
                    p.package_name AS name, 
                    pv.num AS version, 
                    pv.package_description AS description, 
                    p.created_at AS created_at, 
                    pv.created_at AS updated_at,
                    ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY pv.created_at DESC) AS rank
                FROM package_versions pv
                JOIN packages p ON pv.package_id = p.id
            )
            SELECT 
                name, 
                version, 
                description, 
                created_at, 
                updated_at
            FROM ranked_versions
            WHERE rank = 1
            ORDER BY created_at DESC
            LIMIT 10;
            "#,
        )
        .load::<PackagePreview>(self.inner())
        .map_err(|err| DatabaseError::QueryFailed("recently created".to_string(), err))?;

        Ok(packages)
    }

    /// Fetch the [FullPackage]s of packages matching the given parameters.
    pub fn get_full_packages(
        &mut self,
        updated_after: Option<DateTime<Utc>>,
        pagination: Pagination,
    ) -> Result<PaginatedResponse<FullPackage>, DatabaseError> {
        let page = pagination.page();
        let limit = pagination.limit();
        let offset = pagination.offset();

        // Query total count
        let total_count: i64 = diesel::sql_query(
            r#"
            SELECT COUNT(*) AS count
            FROM packages p
            INNER JOIN package_versions pv ON pv.package_id = p.id
            INNER JOIN uploads u ON pv.upload_id = u.id
            WHERE ($1 IS NULL OR pv.created_at > $1)
            "#,
        )
        .bind::<diesel::sql_types::Nullable<Timestamptz>, _>(updated_after)
        .get_result::<CountResult>(self.inner())
        .map_err(|err| DatabaseError::QueryFailed("full packages count".to_string(), err))?
        .count;

        // Query paginated data
        let data = diesel::sql_query(
            r#"
            SELECT 
                p.package_name AS name,
                pv.num AS version,
                pv.package_description AS description,
                p.created_at AS created_at,
                pv.created_at AS updated_at,
        
                u.bytecode_identifier AS bytecode_identifier,
                u.forc_version AS forc_version,
                u.readme AS readme,
        
                u.source_code_ipfs_hash AS source_code_ipfs_hash,
                u.abi_ipfs_hash AS abi_ipfs_hash,
        
                pv.repository AS repository,
                pv.documentation AS documentation,
                pv.homepage AS homepage,
                pv.urls AS urls,
                pv.license AS license
            FROM 
                packages p
            INNER JOIN 
                package_versions pv ON pv.package_id = p.id
            INNER JOIN 
                uploads u ON pv.upload_id = u.id
            WHERE 
                ($1 IS NULL OR pv.created_at > $1) -- Optional date filter
            ORDER BY 
                pv.created_at DESC
            LIMIT $2
            OFFSET $3
            "#,
        )
        .bind::<diesel::sql_types::Nullable<Timestamptz>, _>(updated_after)
        .bind::<diesel::sql_types::BigInt, _>(limit)
        .bind::<diesel::sql_types::BigInt, _>(offset)
        .load::<FullPackage>(self.inner())
        .map_err(|err| DatabaseError::QueryFailed("full packages".to_string(), err))?;

        // Calculate total pages
        let total_pages = (total_count as f64 / limit as f64).ceil() as i64;

        Ok(PaginatedResponse {
            data,
            total_count,
            total_pages,
            current_page: page,
            per_page: limit,
        })
    }

    /// Fetch the [FullPackage] for the given package name and version string.
    pub fn get_full_package_version(
        &mut self,
        pkg_name: String,
        version: String,
    ) -> Result<FullPackage, DatabaseError> {
        let data = diesel::sql_query(
            r#"
                SELECT 
                    p.package_name AS name,
                    pv.num AS version,
                    pv.package_description AS description,
                    p.created_at AS created_at,
                    pv.created_at AS updated_at,
            
                    u.bytecode_identifier AS bytecode_identifier,
                    u.forc_version AS forc_version,
                    u.source_code_ipfs_hash AS source_code_ipfs_hash,
                    u.abi_ipfs_hash AS abi_ipfs_hash,
                    u.readme AS readme,
            
                    pv.repository AS repository,
                    pv.documentation AS documentation,
                    pv.homepage AS homepage,
                    pv.urls AS urls,
                    pv.license AS license
                FROM 
                    packages p
                INNER JOIN 
                    package_versions pv ON pv.package_id = p.id
                INNER JOIN 
                    uploads u ON pv.upload_id = u.id
                WHERE 
                    p.package_name = $1 
                    -- If version is not specified, use the default_version of the package.
                    AND (pv.num = $2 OR ('' = $2 AND p.default_version = pv.id))
                LIMIT 1
                "#,
        )
        .bind::<diesel::sql_types::Text, _>(pkg_name.clone())
        .bind::<diesel::sql_types::Text, _>(version.clone())
        .load::<FullPackage>(self.inner())
        .map_err(|err| DatabaseError::QueryFailed("full package version".to_string(), err))?;
        let package = data.first().ok_or_else(|| {
            DatabaseError::NotFound(format!("{pkg_name}@{version}"), diesel::NotFound)
        })?;

        Ok(package.clone())
    }

    /// Get all versions for a package given its name.
    pub fn get_package_versions(
        &mut self,
        pkg_name: String,
    ) -> Result<Vec<PackageVersionInfo>, DatabaseError> {
        use schema::package_versions;
        use schema::package_versions::columns::{
            created_at as pv_created_at, license, num, package_id, published_by,
        };
        use schema::users;
        use schema::users::columns::{full_name, github_login};

        let package = self.get_package_by_name(pkg_name.clone())?;

        let results = package_versions::table
            .inner_join(users::table.on(published_by.eq(users::id)))
            .filter(package_id.eq(package.id))
            .order_by(package_versions::created_at.desc())
            .select((num, full_name, github_login, license, pv_created_at))
            .load::<(String, String, String, Option<String>, DateTime<Utc>)>(self.inner())
            .map_err(|err| DatabaseError::QueryFailed(pkg_name, err))?;

        Ok(results
            .into_iter()
            .map(
                |(version, author_full_name, author_github_login, pkg_license, created_at)| {
                    PackageVersionInfo {
                        version,
                        author: AuthorInfo {
                            full_name: author_full_name,
                            github_login: author_github_login,
                        },
                        license: pkg_license,
                        created_at,
                    }
                },
            )
            .collect())
    }

    /// Search for packages by name or description using fuzzy search.
    pub fn search_packages(
        &mut self,
        query: String,
        pagination: Pagination,
    ) -> Result<PaginatedResponse<PackagePreview>, DatabaseError> {
        let query_lower = query.to_lowercase();

        let packages = diesel::sql_query(
            r#"WITH ranked_versions AS (
                SELECT 
                    p.id AS package_id,
                    p.package_name AS name, 
                    pv.num AS version, 
                    pv.package_description AS description, 
                    p.created_at AS created_at, 
                    pv.created_at AS updated_at,
                    ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY pv.created_at DESC) AS rank,
                    -- Combined relevance scoring
                    GREATEST(
                        similarity($1, LOWER(p.package_name)),
                        CASE 
                            WHEN LOWER(p.package_name) ILIKE '%' || $1 || '%' THEN 0.7
                            ELSE 0.0
                        END,
                        similarity($1, LOWER(COALESCE(pv.package_description, ''))) * 0.3
                    ) AS relevance_score
                FROM package_versions pv
                JOIN packages p ON pv.package_id = p.id
                WHERE 
                    LOWER(p.package_name) ILIKE '%' || $1 || '%' OR
                    similarity($1, LOWER(p.package_name)) > 0.2 OR
                    similarity($1, LOWER(COALESCE(pv.package_description, ''))) > 0.1
            )
            SELECT 
                name, 
                version, 
                description, 
                created_at, 
                updated_at
            FROM ranked_versions
            WHERE rank = 1 AND relevance_score > 0.1
            ORDER BY relevance_score DESC, created_at DESC
            OFFSET $2
            LIMIT $3;
            "#,
        )
        .bind::<diesel::sql_types::Text, _>(query_lower.clone())
        .bind::<diesel::sql_types::BigInt, _>(pagination.offset())
        .bind::<diesel::sql_types::BigInt, _>(pagination.limit())
        .load::<PackagePreview>(self.inner())
        .map_err(|err: diesel::result::Error| {
            DatabaseError::QueryFailed("search packages".to_string(), err)
        })?;

        // Count total matches
        let total = diesel::sql_query(
            r#"SELECT COUNT(DISTINCT p.id) AS count
            FROM packages p
            JOIN package_versions pv ON pv.package_id = p.id
            WHERE 
                LOWER(p.package_name) ILIKE '%' || $1 || '%' OR
                similarity($1, LOWER(p.package_name)) > 0.2 OR
                similarity($1, LOWER(COALESCE(pv.package_description, ''))) > 0.1
            "#,
        )
        .bind::<diesel::sql_types::Text, _>(query_lower)
        .get_result::<CountResult>(self.inner())
        .map_err(|err| DatabaseError::QueryFailed("search count".to_string(), err))?
        .count;

        Ok(PaginatedResponse {
            data: packages,
            total_count: total,
            total_pages: ((total as f64) / (pagination.limit() as f64)).ceil() as i64,
            current_page: pagination.page(),
            per_page: pagination.limit(),
        })
    }
}
