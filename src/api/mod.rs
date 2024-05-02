pub mod api_token;
pub mod auth;
pub mod publish;

use rocket::{
    http::Status,
    response::Responder,
    serde::{json::Json, Serialize},
    Request,
};
use thiserror::Error;

/// A wrapper for API responses that can return errors.
pub type ApiResult<T> = Result<Json<T>, ApiError>;

/// An empty response.
#[derive(Serialize)]
pub struct EmptyResponse;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Database error: {0}")]
    Database(#[from] crate::db::error::DatabaseError),
    #[error("GitHub error: {0}")]
    Github(#[from] crate::github::GithubError),
}

impl<'r, 'o: 'r> Responder<'r, 'o> for ApiError {
    fn respond_to(self, _request: &'r Request<'_>) -> rocket::response::Result<'o> {
        match self {
            ApiError::Database(_) => Err(Status::InternalServerError),
            ApiError::Github(_) => Err(Status::Unauthorized),
        }
    }
}
