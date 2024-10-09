use super::error::DatabaseError;
use super::{models, schema, DbConn};
use diesel::prelude::*;
use uuid::Uuid;

impl DbConn {
    /// Insert an upload record into the database and return the record.
    pub fn insert_upload(
        &mut self,
        upload: &models::NewUpload,
    ) -> Result<models::Upload, DatabaseError> {
        // Insert new upload record
        let saved_upload = diesel::insert_into(schema::uploads::table)
            .values(upload)
            .returning(models::Upload::as_returning())
            .get_result(self.inner())
            .map_err(|_| DatabaseError::InsertUploadFailed(upload.id.to_string()))?;

        Ok(saved_upload)
    }

    /// Fetch an upload record given the upload ID.
    pub fn get_upload(&mut self, upload_id: Uuid) -> Result<models::Upload, DatabaseError> {
        schema::uploads::table
            .filter(schema::uploads::id.eq(upload_id))
            .select(models::Upload::as_returning())
            .first::<models::Upload>(self.inner())
            .map_err(|_| DatabaseError::NotFound(upload_id.to_string()))
    }
}
