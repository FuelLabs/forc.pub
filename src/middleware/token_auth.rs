use crate::db::api_token::PlainToken;
use crate::db::Database;
use crate::models;
use chrono::{DateTime, Utc};
use rocket::http::hyper::header;
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome};
use rocket::Request;
use std::time::SystemTime;

pub struct TokenAuth {
    pub token: models::ApiToken,
}

#[derive(Debug)]
pub enum TokenAuthError {
    Missing,
    Invalid,
    Expired,
    DatabaseConnection,
}

impl From<diesel::result::Error> for TokenAuthError {
    fn from(_e: diesel::result::Error) -> Self {
        TokenAuthError::DatabaseConnection
    }
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for TokenAuth {
    type Error = TokenAuthError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // TODO: use fairing for db connection?
        // let db = try_outcome!(request.guard::<Database>().await);

        let db = match request.rocket().state::<Database>() {
            Some(db) => db,
            None => {
                return Outcome::Error((Status::Unauthorized, TokenAuthError::DatabaseConnection))
            }
        };

        let auth_header = match request.headers().get_one(header::AUTHORIZATION.as_str()) {
            Some(header) => header,
            None => return Outcome::Error((Status::Unauthorized, TokenAuthError::Missing)),
        };

        if !auth_header.starts_with("Bearer ") {
            return Outcome::Error((Status::Unauthorized, TokenAuthError::Invalid));
        }
        let token = auth_header.trim_start_matches("Bearer ");

        match db.transaction(|conn| {
            if let Ok(token) = conn.get_token(PlainToken::from(token.to_string())) {
                if token.expires_at.map_or(true, |expires_at| {
                    expires_at > DateTime::<Utc>::from(SystemTime::now())
                }) {
                    Ok(TokenAuth { token })
                } else {
                    Err(TokenAuthError::Expired)
                }
            } else {
                Err(TokenAuthError::Invalid)
            }
        }) {
            Ok(token_auth) => Outcome::Success(token_auth),
            Err(e) => return Outcome::Error((Status::Unauthorized, e)),
        }
    }
}
