pub mod auth;
pub mod api_token;

use rocket::serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Unauthorized request")]
    Unauthorized,
    #[error("Missing session cookie")]
    MissingCookie,
}

/// The publish request.
#[derive(Deserialize, Debug)]
pub struct PublishRequest {
    pub name: String,
    pub version: String,
}

/// The response to a publish request.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
