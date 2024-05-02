use std::time::SystemTime;

use crate::db::Database;
use crate::models;

use rocket::http::Status;

use rocket::request::{FromRequest, Outcome};

use rocket::Request;

use uuid::Uuid;

pub const SESSION_COOKIE_NAME: &str = "session";

pub struct SessionAuth {
    pub user: models::User,
    pub session_id: Uuid,
}

#[derive(Debug)]
pub enum SessionAuthError {
    Missing,
    Invalid,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for SessionAuth {
    type Error = SessionAuthError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // TODO: use fairing?
        // let db = try_outcome!(request.guard::<Database>().await);

        let db = request.rocket().state::<Database>().unwrap();
        if let Some(Some(session_id)) = request
            .cookies()
            .get(SESSION_COOKIE_NAME)
            .map(|c| Uuid::parse_str(c.value()).ok())
        {
            if let Ok(session) = db.get_session(session_id) {
                if let Ok(user) = db.get_user_for_session(session_id.to_string()) {
                    if session.expires_at > SystemTime::now() {
                        return Outcome::Success(SessionAuth { user, session_id });
                    }
                }
            }
            return Outcome::Failure((Status::Unauthorized, SessionAuthError::Invalid));
        }
        return Outcome::Failure((Status::Unauthorized, SessionAuthError::Missing));
    }
}
