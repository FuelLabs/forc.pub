use rocket::serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The publish request.
#[derive(Deserialize, Debug)]
pub struct PublishRequest {
    pub package_name: String,
    pub upload_id: Uuid,
    pub num: String,
    pub package_description: Option<String>,
    pub repository: Option<String>,
    pub documentation: Option<String>,
    pub homepage: Option<String>,
    pub urls: Vec<Option<String>>,
    pub readme: Option<String>,
    pub license: Option<String>,
}

/// The response to an upload_project request.
#[derive(Serialize, Debug)]
pub struct UploadResponse {
    pub upload_id: Uuid,
}
