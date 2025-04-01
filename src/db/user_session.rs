use super::error::DatabaseError;
use super::{api, models, schema, DbConn};
use chrono::Utc;
use diesel::prelude::*;
use diesel::upsert::excluded;
use std::time::Duration;
use uuid::Uuid;

impl DbConn {
    /// Insert a user session into the database and return the session ID.
    /// If the user doesn't exist, insert the user as well.
    /// If the user does exist, update the user's full name and avatar URL if they have changed.
    pub fn new_user_session(
        &mut self,
        user: &api::auth::User,
        expires_in: u32,
    ) -> Result<models::Session, DatabaseError> {
        // Insert or update a user
        let new_user = models::NewUser {
            full_name: user.full_name.clone(),
            github_id: user.github_id,
            github_login: user.github_login.clone(),
            github_url: user.github_url.clone(),
            avatar_url: user.avatar_url.clone(),
            email: user.email.clone(),
            is_admin: user.is_admin,
        };

        let saved_user = diesel::insert_into(schema::users::table)
            .values(&new_user)
            .returning(models::User::as_returning())
            .on_conflict(schema::users::github_id)
            .do_update()
            .set((
                schema::users::full_name.eq(excluded(schema::users::full_name)),
                schema::users::avatar_url.eq(excluded(schema::users::avatar_url)),
                schema::users::email.eq(excluded(schema::users::email)),
                schema::users::github_login.eq(excluded(schema::users::github_login)),
                schema::users::github_url.eq(excluded(schema::users::github_url)),
            ))
            .get_result(self.inner())
            .map_err(|err| DatabaseError::InsertUserFailed(user.github_id.to_string(), err))?;

        let new_session = models::NewSession {
            user_id: saved_user.id,
            expires_at: Utc::now() + Duration::from_secs(u64::from(expires_in)),
        };

        // Insert new session
        let saved_session = diesel::insert_into(schema::sessions::table)
            .values(&new_session)
            .returning(models::Session::as_returning())
            .get_result(self.inner())
            .map_err(|err| DatabaseError::InsertSessionFailed(user.github_id.to_string(), err))?;

        Ok(saved_session)
    }

    /// Fetch a user given the user ID.
    pub fn get_user(&mut self, user_id: Uuid) -> Result<models::User, DatabaseError> {
        schema::users::table
            .filter(schema::users::id.eq(user_id))
            .select(models::User::as_returning())
            .first::<models::User>(self.inner())
            .map_err(|err| DatabaseError::NotFound(user_id.to_string(), err))
    }

    /// Fetch a user given the user ID.
    pub fn get_session(&mut self, session_id: Uuid) -> Result<models::Session, DatabaseError> {
        schema::sessions::table
            .filter(schema::sessions::id.eq(session_id))
            .select(models::Session::as_returning())
            .first::<models::Session>(self.inner())
            .map_err(|err| DatabaseError::NotFound(session_id.to_string(), err))
    }

    /// Fetch a user from the database for a given session ID.
    pub fn get_user_for_session(
        &mut self,
        session_id: Uuid,
    ) -> Result<models::User, DatabaseError> {
        schema::sessions::table
            .inner_join(schema::users::table)
            .filter(schema::sessions::id.eq(session_id))
            .select(models::User::as_returning())
            .first::<models::User>(self.inner())
            .map_err(|err| DatabaseError::NotFound(session_id.to_string(), err))
    }

    /// Delete a session given its ID.
    pub fn delete_session(&mut self, session_id: Uuid) -> Result<(), DatabaseError> {
        diesel::delete(schema::sessions::table.filter(schema::sessions::id.eq(session_id)))
            .execute(self.inner())
            .map_err(|err| DatabaseError::NotFound(session_id.to_string(), err))?;
        Ok(())
    }
}
