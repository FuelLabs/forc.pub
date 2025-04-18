use super::error::DatabaseError;
use super::{models, schema, DbConn};
use diesel::prelude::*;
use uuid::Uuid;

impl<'a> DbConn<'a> {
    /// Insert an upload record into the database and return the record.
    pub fn new_upload(
        &mut self,
        upload: &models::NewUpload,
    ) -> Result<models::Upload, DatabaseError> {
        // Insert new upload record
        let saved_upload = diesel::insert_into(schema::uploads::table)
            .values(upload)
            .returning(models::Upload::as_returning())
            .get_result(self.inner())
            .map_err(|err| DatabaseError::InsertUploadFailed(upload.id.to_string(), err))?;

        Ok(saved_upload)
    }

    /// Fetch an upload record given the upload ID.
    pub fn get_upload(&mut self, upload_id: Uuid) -> Result<models::Upload, DatabaseError> {
        schema::uploads::table
            .filter(schema::uploads::id.eq(upload_id))
            .select(models::Upload::as_returning())
            .first::<models::Upload>(self.inner())
            .map_err(|err| DatabaseError::NotFound(upload_id.to_string(), err))
    }
}
