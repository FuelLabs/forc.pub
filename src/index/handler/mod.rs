pub mod git;

use async_trait::async_trait;
use forc_pkg::source::reg::index_file::PackageEntry;
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
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

    #[error("Failed to parse index file: {0}")]
    #[serde(skip)]
    ParseError(#[from] serde_json::Error),

    #[error("Package index file error: {0}")]
    #[serde(skip)]
    FileSystemError(#[from] std::io::Error),

    #[error("No changes to commit")]
    NoChanges,

    #[error("Failed to read or write package data: {0}")]
    PackageDataError(String),

    #[error("Git relatated error: {0}")]
    #[serde(skip)]
    Git2Error(#[from] git2::Error),

    #[error("Repository error: {0}")]
    RepoError(String),
}

#[async_trait]
pub trait IndexPublisher {
    async fn publish_entry(self, package_entry: PackageEntry) -> Result<(), IndexPublishError>;
}
