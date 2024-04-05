use rocket::serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}

/// The login request.
#[derive(Deserialize, Debug)]
pub struct LoginRequest {
    pub code: String,
}

/// The response to a login request.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub user: Option<User>,
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// The response to a session request.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
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
