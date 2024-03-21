use rocket::serde::{Deserialize, Serialize};

/// The compile request.
#[derive(Deserialize, Debug)]
pub struct PublishRequest {
    pub name: String,
    pub version: String,
}

/// The response to a compile request.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
