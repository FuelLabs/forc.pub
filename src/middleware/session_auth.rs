use crate::db::{Database, DbConn};
use crate::models;
use chrono::Utc;
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome};
use rocket::Request;
use uuid::Uuid;

pub const SESSION_COOKIE_NAME: &str = "fp_session";

pub struct SessionAuth {
    pub user: models::User,
    pub session_id: Uuid,
}

#[derive(Debug)]
pub enum SessionAuthError {
    Missing,
    Invalid,
    DatabaseConnection,
}

impl From<diesel::result::Error> for SessionAuthError {
    fn from(_e: diesel::result::Error) -> Self {
        SessionAuthError::DatabaseConnection
    }
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for SessionAuth {
    type Error = SessionAuthError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // TODO: use fairing for db connection?
        // let db = try_outcome!(request.guard::<Database>().await);

        let db = match request.rocket().state::<Database>() {
            Some(db) => db,
            None => return Outcome::Error((Status::Unauthorized, SessionAuthError::DatabaseConnection)),
        };

        let session_id = match request
            .cookies()
            .get(SESSION_COOKIE_NAME)
            .map(|c| Uuid::parse_str(c.value()).ok())
        {
            Some(Some(session_id)) => session_id,
            _ => return Outcome::Error((Status::Unauthorized, SessionAuthError::Missing)),
        };

        match db.transaction(|connection| {
            let mut conn = DbConn::new(connection);
            if let Ok(session) = conn.get_session(session_id) {
                if let Ok(user) = conn.get_user_for_session(session_id) {
                    if session.expires_at > Utc::now() {
                        return Ok(SessionAuth { user, session_id });
                    }
                }
            }
            return Err(SessionAuthError::Invalid);
        }) {
            Ok(session_auth) => return Outcome::Success(session_auth),
            Err(e) => return Outcome::Error((Status::Unauthorized, e)),
        }
    }
}
