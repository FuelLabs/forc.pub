use super::error::DatabaseError;
use super::{models, schema, DbConn};
use crate::api::publish::PublishRequest;
use crate::models::{ApiToken, RecentPackage};
use diesel::prelude::*;
use uuid::Uuid;

impl DbConn {
    /// Insert a package version into the database and return the package version.
    /// If the package doesn't exist, insert the package as well.
    pub fn new_package_version(
        &mut self,
        api_token: &ApiToken,
        request: &PublishRequest,
    ) -> Result<models::PackageVersion, DatabaseError> {
        // Check if the package exists.
        let pkg_name = request.package_name.clone();
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
            Ok(existing_package)
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

        // Insert a new package version.
        let new_version = models::NewPackageVersion {
            package_id: package.id,
            publish_token: api_token.id,
            published_by: api_token.user_id,
            upload_id: request.upload_id,
            num: request.num.clone(),
            package_description: request.package_description.clone(),
            repository: request.repository.clone(),
            documentation: request.documentation.clone(),
            homepage: request.homepage.clone(),
            urls: request.urls.clone(),
            readme: request.readme.clone(),
            license: request.license.clone(),
        };

        let saved_version = diesel::insert_into(schema::package_versions::table)
            .values(&new_version)
            .returning(models::PackageVersion::as_returning())
            .get_result(self.inner())
            .map_err(|err| {
                DatabaseError::InsertPackageVersionFailed(
                    pkg_name.clone(),
                    request.num.clone(),
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

    /// Fetch the most recently updated packages.
    pub fn get_recently_updated(&mut self) -> Result<Vec<RecentPackage>, DatabaseError> {
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
        .load::<RecentPackage>(self.inner())
        .map_err(|err| DatabaseError::QueryFailed("recently updated".to_string(), err))?;

        Ok(packages)
    }

    /// Fetch the most recently created packages.
    pub fn get_recently_created(&mut self) -> Result<Vec<RecentPackage>, DatabaseError> {
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
        .load::<RecentPackage>(self.inner())
        .map_err(|err| DatabaseError::QueryFailed("recently created".to_string(), err))?;

        Ok(packages)
    }
}
