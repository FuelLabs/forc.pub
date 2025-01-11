use crate::models::RecentPackage;
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct RecentPackagesResponse {
    pub recently_created: Vec<RecentPackage>,
    pub recently_updated: Vec<RecentPackage>,
}
