use crate::index::{
    handler::{IndexPublishError, IndexPublisher},
    PackageEntry,
};
use async_trait::async_trait;

/// Index publishing backend for github.
pub struct GithubIndexPublisher;

#[async_trait]
impl IndexPublisher for GithubIndexPublisher {
    async fn publish_entry(
        package_entry: &PackageEntry,
        namespsace: &str,
    ) -> Result<(), IndexPublishError> {
        todo!("PUSH TO GITHUB")
    }
}
