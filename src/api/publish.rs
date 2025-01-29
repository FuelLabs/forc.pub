use rocket::serde::{Deserialize, Serialize};
use url::Url;
use uuid::Uuid;

/// The publish request.
#[derive(Deserialize, Debug)]
pub struct PublishRequest {
    pub upload_id: Uuid,
    pub urls: Option<Vec<Url>>,
}

/// The response to an upload_project request.
#[derive(Serialize, Debug)]
pub struct UploadResponse {
    pub upload_id: Uuid,
}
