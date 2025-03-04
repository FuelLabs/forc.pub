pub mod git;

use crate::index::PackageEntry;
use async_trait::async_trait;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum IndexPublishError {
    #[error("Connection lost with the publishing backend: {0}")]
    ConnectionLost(String),

    #[error("Version {1} of package {0} already exists in the index")]
    VersionCollision(String, String),

    #[error("Failed to authenticate with remote repository: {0}")]
    AuthenticationError(String),

    #[error("Failed to clone repository: {0}")]
    CloneError(String),

    #[error("Failed to fetch latest changes from remote: {0}")]
    FetchError(String),

    #[error("Failed to push changes to remote: {0}")]
    PushError(String),

    #[error("Package index file error: {0}")]
    FileSystemError(String),

    #[error("No changes to commit")]
    NoChanges,

    #[error("Failed to read or write package data: {0}")]
    PackageDataError(String),

    #[error("Unexpected error: {0}")]
    UnexpectedError(String),
}

#[async_trait]
pub trait IndexPublisher {
    async fn publish_entry(self, package_entry: PackageEntry) -> Result<(), IndexPublishError>;
}
