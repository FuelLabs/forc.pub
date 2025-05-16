pub mod api_token;
pub mod auth;
pub mod pagination;
pub mod publish;
pub mod search;

use rocket::{
    http::{ContentType, Status},
    response::Responder,
    serde::{json::Json, Serialize},
    Request,
};
use serde_json::json;
use std::io::Cursor;
use thiserror::Error;
use tracing::error;

/// A wrapper for API responses that can return errors.
pub type ApiResult<T> = Result<Json<T>, ApiError>;

/// An empty response.
#[derive(Serialize)]
pub struct EmptyResponse;

#[derive(Error, Debug, Serialize)]
pub enum ApiError {
    #[error("Error: {0}")]
    Generic(String),

    #[error("Database error: {0}")]
    #[serde(skip)]
    Database(#[from] crate::db::error::DatabaseError),

    #[error("GitHub error: {0}")]
    #[serde(skip)]
    Github(#[from] crate::github::GithubError),

    #[error("Upload error: {0}")]
    Upload(#[from] crate::handlers::upload::UploadError),

    #[error("Publish error: {0}")]
    Publish(#[from] crate::handlers::publish::PublishError),
}

impl<'r, 'o: 'r> Responder<'r, 'o> for ApiError {
    fn respond_to(self, _request: &'r Request<'_>) -> rocket::response::Result<'o> {
        error!("API error: {}", self);
        let (status, message) = match self {
            ApiError::Generic(ref err) => (Status::InternalServerError, err.to_string()),
            ApiError::Database(ref err) => (
                Status::InternalServerError,
                format!("Database error: {}", err),
            ),
            ApiError::Github(ref err) => (Status::Unauthorized, format!("GitHub error: {}", err)),
            ApiError::Upload(ref err) => (Status::BadRequest, format!("Upload error: {}", err)),
            ApiError::Publish(ref err) => (Status::BadRequest, format!("Publish error: {}", err)),
        };
        let body = json!({
            "status": status.code,
            "error": message,
        })
        .to_string();

        rocket::Response::build()
            .status(status)
            .sized_body(body.len(), Cursor::new(body))
            .header(ContentType::JSON)
            .ok()
    }
}
