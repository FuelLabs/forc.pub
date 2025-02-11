use rocket::serde::{Deserialize, Serialize};
use semver::Version;
use url::Url;
use uuid::Uuid;

/// The publish request.
#[derive(Deserialize, Debug)]
pub struct PublishRequest {
    pub upload_id: Uuid,
    pub urls: Option<Vec<Url>>,
}

/// The publish response.
#[derive(Serialize, Deserialize, Debug)]
pub struct PublishResponse {
    pub name: String,
    pub version: Version,
}

/// The response to an upload_project request.
#[derive(Serialize, Debug)]
pub struct UploadResponse {
    pub upload_id: Uuid,
}
