use crate::{models, util::sys_time_to_epoch};
use rocket::serde::{Deserialize, Serialize};
use std::time::{SystemTime, Duration, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Token {
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub token: Option<String>,
}

impl From<models::Token> for Token {
    fn from(token: models::Token) -> Self {
        Token {
            id: token.id.to_string(),
            name: token.friendly_name,
            created_at: sys_time_to_epoch(token.created_at),
            // We don't return the hashed token, as it's a secret.
            token: None,
        }
    }
}
/// The CreateToken request.
#[derive(Deserialize, Debug)]
pub struct CreateTokenRequest {
    pub name: String,
}

/// The response to a CreateToken request.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTokenResponse {
    pub token: Option<Token>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// The CreateToken request.
#[derive(Deserialize, Debug)]
pub struct DeleteTokenRequest {
    pub id: String,
}

/// The response to a CreateToken request.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTokenResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// The response to a CreateToken request.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokensResponse {
    pub tokens: Vec<Token>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
