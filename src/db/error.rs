use thiserror::Error;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Transaction failed")]
    TransactionFailed(#[from] diesel::result::Error),

    #[error("Invalid UUID: {0}")]
    InvalidUuid(String),

    #[error("Entry for ID not found: {0}: {1}")]
    NotFound(String, diesel::result::Error),

    #[error("Failed to save user: {0}: {1}")]
    InsertUserFailed(String, diesel::result::Error),

    #[error("Failed to save session for user: {0}: {1}")]
    InsertSessionFailed(String, diesel::result::Error),

    #[error("Failed to save token for user: {0}: {1}")]
    InsertTokenFailed(String, diesel::result::Error),

    #[error("Failed to upload: {0}: {1}")]
    InsertUploadFailed(String, diesel::result::Error),

    #[error("Failed to save package: {0}: {1}")]
    InsertPackageFailed(String, diesel::result::Error),

    #[error("Failed to update package: {0}: {1}")]
    UpdatePackageFailed(String, diesel::result::Error),

    #[error("Invalid publish token")]
    InvalidPublishToken,

    #[error("Failed to save package version: {0} {1}: {2}")]
    InsertPackageVersionFailed(String, String, diesel::result::Error),

    #[error("Failed to save package dependencies: {0}")]
    InsertPackageDepFailed(diesel::result::Error),

    #[error("Failed to save package categories: {0}")]
    InsertPackageCategoriesFailed(diesel::result::Error),

    #[error("Failed to save package keywords: {0}")]
    InsertPackageKeywordsFailed(diesel::result::Error),

    #[error("Failed to query: {0}: {1}")]
    QueryFailed(String, diesel::result::Error),
}
