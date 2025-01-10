use crate::api::publish::PublishRequest;
use crate::models::ApiToken;
use crate::schema::api_tokens::expires_at;
use crate::schema::package_versions::{package_description, urls};
use crate::schema::packages::package_name;

use super::error::DatabaseError;
use super::{api, models, schema, DbConn};
use diesel::prelude::*;
use diesel::upsert::excluded;
use std::time::{Duration, SystemTime};
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
            .filter(schema::packages::package_name.eq(package_name.clone()))
            .select(schema::packages::all_columns)
            .first::<models::Package>(self.inner())
            .optional()
            .map_err(|err| DatabaseError::QueryFailed(pkg_name.clone(), err))?
        {
            if existing_package.user_owner != api_token.user_id.clone() {
                // The package exists but the user is not the owner.
                return Err(DatabaseError::InvalidPublishToken);
            }
            Ok(existing_package)
        } else {
            // Insert a new package.
            let new_package: models::NewPackage = models::NewPackage {
                user_owner: api_token.user_id.clone(),
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
            publish_token: api_token.id.clone(),
            published_by: api_token.user_id.clone(),
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

    // /// Fetch a user given the user ID.
    // pub fn get_session(&mut self, session_id: Uuid) -> Result<models::Session, DatabaseError> {
    //     schema::sessions::table
    //         .filter(schema::sessions::id.eq(session_id))
    //         .select(models::Session::as_returning())
    //         .first::<models::Session>(self.inner())
    //         .map_err(|_| DatabaseError::NotFound(session_id.to_string()))
    // }

    // /// Fetch a user from the database for a given session ID.
    // pub fn get_user_for_session(
    //     &mut self,
    //     session_id: Uuid,
    // ) -> Result<models::User, DatabaseError> {
    //     schema::sessions::table
    //         .inner_join(schema::users::table)
    //         .filter(schema::sessions::id.eq(session_id))
    //         .select(models::User::as_returning())
    //         .first::<models::User>(self.inner())
    //         .map_err(|_| DatabaseError::NotFound(session_id.to_string()))
    // }

    // /// Delete a session given its ID.
    // pub fn delete_session(&mut self, session_id: Uuid) -> Result<(), DatabaseError> {
    //     diesel::delete(schema::sessions::table.filter(schema::sessions::id.eq(session_id)))
    //         .execute(self.inner())
    //         .map_err(|_| DatabaseError::NotFound(session_id.to_string()))?;
    //     Ok(())
    // }
}
