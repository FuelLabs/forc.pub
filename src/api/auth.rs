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
    pub user: User,
    pub session_id: String,
}

/// The response to a user GET request.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub user: User,
}
