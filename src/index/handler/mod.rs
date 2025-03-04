pub mod github;

use crate::index::PackageEntry;
use async_trait::async_trait;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum IndexPublishError {
    #[error("Connection lost with the publishing backend")]
    ConnectionLost(String),
    #[error("{0} ")]
    VersionCollision(String, String),
}

#[async_trait]
pub trait IndexPublisher {
    async fn publish_entry(
        package_entry: &PackageEntry,
        namespace: &str,
    ) -> Result<(), IndexPublishError>;
}
