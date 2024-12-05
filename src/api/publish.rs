use rocket::serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The publish request.
#[derive(Deserialize, Debug)]
pub struct PublishRequest {
    pub name: String,
    pub version: String,
    pub upload_id: String,
}

/// The response to an upload_project request.
#[derive(Serialize, Debug)]
pub struct UploadResponse {
    pub upload_id: Uuid,
}
