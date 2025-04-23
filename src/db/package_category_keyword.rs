use super::error::DatabaseError;
use super::{schema, DbConn};
use crate::models::{NewPackageCategory, NewPackageKeyword};
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
}
