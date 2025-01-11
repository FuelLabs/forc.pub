use crate::models::PackagePreview;
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct RecentPackagesResponse {
    pub recently_created: Vec<PackagePreview>,
    pub recently_updated: Vec<PackagePreview>,
}
