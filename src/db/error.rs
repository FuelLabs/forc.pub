use thiserror::Error;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Invalid UUID: {0}")]
    InvalidUuid(String),

    #[error("Entry for ID not found: {0}")]
    NotFound(String),

    #[error("Failed to save user: {0}")]
    InsertUserFailed(String),

    #[error("Failed to save session for user: {0}")]
    InsertSessionFailed(String),

    #[error("Failed to save token for user: {0}")]
    InsertTokenFailed(String),

    #[error("Failed to upload: {0}")]
    InsertUploadFailed(String),
}
