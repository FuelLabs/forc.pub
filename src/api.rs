use rocket::serde::{Deserialize, Serialize};

use crate::models;

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub full_name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub github_url: String,
    pub github_login: String,
    pub is_admin: bool,
}

impl From<models::User> for User {
    fn from(user: models::User) -> Self {
        User {
            full_name: user.full_name,
            email: user.email,
            avatar_url: user.avatar_url,
            github_url: user.github_url,
            github_login: user.github_login,
            is_admin: user.is_admin,
        }
    }
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
