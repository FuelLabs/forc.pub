use super::error::DatabaseError;
use super::{models, schema, DbConn};
use crate::models::NewPackageDep;
use diesel::prelude::*;
use uuid::Uuid;

impl DbConn<'_> {
    /// Insert package dependencies into the database and return the number of rows inserted.
    pub fn insert_dependencies(
        &mut self,
        new_dependencies: Vec<NewPackageDep>,
    ) -> Result<usize, DatabaseError> {
        diesel::insert_into(schema::package_dependencies::table)
            .values(&new_dependencies)
            .execute(self.inner())
            .map_err(DatabaseError::InsertPackageDepFailed)
    }

    /// Fetch the dependencies for a given package version.
    pub fn get_dependencies_for_package_version(
        &mut self,
        package_version_id: Uuid,
    ) -> Result<Vec<models::PackageDep>, DatabaseError> {
        schema::package_dependencies::table
            .filter(
                schema::package_dependencies::dependent_package_version_id.eq(package_version_id),
            )
            .select(models::PackageDep::as_returning())
            .load::<models::PackageDep>(self.inner())
            .map_err(|err| DatabaseError::NotFound(package_version_id.to_string(), err))
    }
}
