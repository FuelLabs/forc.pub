use super::error::DatabaseError;
use super::{schema, DbConn};
use crate::models::{NewPackageCategory, NewPackageKeyword, PackageCategory, PackageKeyword};
use diesel::prelude::*;
use uuid::Uuid;

impl DbConn<'_> {
    /// Insert package categories into the database and return the number of rows inserted.
    pub fn insert_categories(
        &mut self,
        package_id: Uuid,
        categories: &[String],
    ) -> Result<usize, DatabaseError> {
        let new_categories: Vec<NewPackageCategory> = categories
            .iter()
            .map(|c| NewPackageCategory {
                package_id,
                category: c.clone(),
            })
            .collect();
        diesel::insert_into(schema::package_categories::table)
            .values(&new_categories)
            .execute(self.inner())
            .map_err(DatabaseError::InsertPackageCategoriesFailed)
    }

    /// Insert package categories into the database and return the number of rows inserted.
    pub fn insert_keywords(
        &mut self,
        package_id: Uuid,
        keywords: &[String],
    ) -> Result<usize, DatabaseError> {
        let new_keywords: Vec<NewPackageKeyword> = keywords
            .iter()
            .map(|k| NewPackageKeyword {
                package_id,
                keyword: k.clone(),
            })
            .collect();
        diesel::insert_into(schema::package_keywords::table)
            .values(&new_keywords)
            .execute(self.inner())
            .map_err(DatabaseError::InsertPackageKeywordsFailed)
    }

    /// Retrieve all categories for a package by package ID.
    pub fn get_categories_for_package(
        &mut self,
        package_id: Uuid,
    ) -> Result<Vec<PackageCategory>, DatabaseError> {
        schema::package_categories::table
            .filter(schema::package_categories::package_id.eq(package_id))
            .order_by(schema::package_categories::category.asc())
            .select(PackageCategory::as_select())
            .load(self.inner())
            .map_err(|err| {
                DatabaseError::QueryFailed("get categories for package".to_string(), err)
            })
    }

    /// Retrieve all keywords for a package by package ID.
    pub fn get_keywords_for_package(
        &mut self,
        package_id: Uuid,
    ) -> Result<Vec<PackageKeyword>, DatabaseError> {
        schema::package_keywords::table
            .filter(schema::package_keywords::package_id.eq(package_id))
            .order_by(schema::package_keywords::keyword.asc())
            .select(PackageKeyword::as_select())
            .load(self.inner())
            .map_err(|err| DatabaseError::QueryFailed("get keywords for package".to_string(), err))
    }

    /// Retrieve categories for multiple packages by package IDs.
    pub fn get_categories_for_packages(
        &mut self,
        package_ids: &[Uuid],
    ) -> Result<Vec<PackageCategory>, DatabaseError> {
        schema::package_categories::table
            .filter(schema::package_categories::package_id.eq_any(package_ids))
            .order_by((
                schema::package_categories::package_id.asc(),
                schema::package_categories::category.asc(),
            ))
            .select(PackageCategory::as_select())
            .load(self.inner())
            .map_err(|err| {
                DatabaseError::QueryFailed("get categories for packages".to_string(), err)
            })
    }

    /// Retrieve keywords for multiple packages by package IDs.
    pub fn get_keywords_for_packages(
        &mut self,
        package_ids: &[Uuid],
    ) -> Result<Vec<PackageKeyword>, DatabaseError> {
        schema::package_keywords::table
            .filter(schema::package_keywords::package_id.eq_any(package_ids))
            .order_by((
                schema::package_keywords::package_id.asc(),
                schema::package_keywords::keyword.asc(),
            ))
            .select(PackageKeyword::as_select())
            .load(self.inner())
            .map_err(|err| DatabaseError::QueryFailed("get keywords for packages".to_string(), err))
    }
}
