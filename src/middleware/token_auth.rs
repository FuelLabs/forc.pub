use crate::db::api_token::PlainToken;
use crate::db::Database;
use crate::models;
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome};
use rocket::Request;



pub const SESSION_COOKIE_NAME: &str = "session";

pub struct TokenAuth {
    pub token: models::ApiToken,
}

#[derive(Debug)]
pub enum TokenAuthError {
    Missing,
    Invalid,
    DatabaseConnection,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for TokenAuth {
    type Error = TokenAuthError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // TODO: use fairing for db connection?
        // let db = try_outcome!(request.guard::<Database>().await);

        let mut db = match request.rocket().state::<Database>() {
            Some(db) => db.conn(),
            None => {
                return Outcome::Failure((
                    Status::InternalServerError,
                    TokenAuthError::DatabaseConnection,
                ))
            }
        };

        if let Some(auth_header) = request.headers().get_one("Authorization") {
            if auth_header.starts_with("Bearer ") {
                let token = auth_header.trim_start_matches("Bearer ");
                if let Ok(token) = db.get_token(PlainToken::from(token.to_string())) {
                    return Outcome::Success(TokenAuth { token });
                }
            }
            return Outcome::Failure((Status::Unauthorized, TokenAuthError::Invalid));
        }
        return Outcome::Failure((Status::Unauthorized, TokenAuthError::Missing));
    }
}
