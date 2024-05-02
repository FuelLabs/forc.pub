use super::error::DatabaseError;
use super::{api, models, schema};
use super::{string_to_uuid, Database};
use diesel::prelude::*;
use diesel::upsert::excluded;
use std::time::{Duration, SystemTime};
use uuid::Uuid;

impl Database {
    /// Insert a user session into the database and return the session ID.
    /// If the user doesn't exist, insert the user as well.
    /// If the user does exist, update the user's full name and avatar URL if they have changed.
    pub fn insert_user_session(
        &self,
        user: &api::auth::User,
        expires_in: u32,
    ) -> Result<models::Session, DatabaseError> {
        let connection = &mut self.connection();

        // Insert or update a user
        let new_user = models::NewUser {
            full_name: user.full_name.clone(),
            github_login: user.github_login.clone(),
            github_url: user.github_url.clone(),
            avatar_url: user.avatar_url.clone(),
            email: user.email.clone(),
            is_admin: user.is_admin,
        };

        let saved_user = diesel::insert_into(schema::users::table)
            .values(&new_user)
            .returning(models::User::as_returning())
            .on_conflict(schema::users::github_login)
            .do_update()
            .set((
                schema::users::full_name.eq(excluded(schema::users::full_name)),
                schema::users::avatar_url.eq(excluded(schema::users::avatar_url)),
            ))
            .get_result(connection)
            .map_err(|_| DatabaseError::InsertUserFailed(user.github_login.clone()))?;

        let new_session = models::NewSession {
            user_id: saved_user.id,
            expires_at: SystemTime::now() + Duration::from_secs(u64::from(expires_in)),
        };

        // Insert new session
        let saved_session = diesel::insert_into(schema::sessions::table)
            .values(&new_session)
            .returning(models::Session::as_returning())
            .get_result(connection)
            .map_err(|_| DatabaseError::InsertSessionFailed(user.github_login.clone()))?;

        Ok(saved_session)
    }

    /// Fetch a user given the user ID.
    pub fn get_user(&self, user_id: Uuid) -> Result<models::User, DatabaseError> {
        let connection = &mut self.connection();
        schema::users::table
            .filter(schema::users::id.eq(user_id))
            .select(models::User::as_returning())
            .first::<models::User>(connection)
            .map_err(|_| DatabaseError::NotFound(user_id.to_string()))
    }

    /// Fetch a user given the user ID.
    pub fn get_session(&self, session_id: Uuid) -> Result<models::Session, DatabaseError> {
        let connection = &mut self.connection();
        schema::sessions::table
            .filter(schema::sessions::id.eq(session_id))
            .select(models::Session::as_returning())
            .first::<models::Session>(connection)
            .map_err(|_| DatabaseError::NotFound(session_id.to_string()))
    }    

    /// Fetch a user from the database for a given session ID.
    pub fn get_user_for_session(&self, session_id: String) -> Result<models::User, DatabaseError> {
        let session_uuid = string_to_uuid(session_id.clone())?;
        let connection = &mut self.connection();
        schema::sessions::table
            .inner_join(schema::users::table)
            .filter(schema::sessions::id.eq(session_uuid))
            .select(models::User::as_returning())
            .first::<models::User>(connection)
            .map_err(|_| DatabaseError::NotFound(session_id))
    }

    /// Delete a session given its ID.
    pub fn delete_session(&self, session_id: Uuid) -> Result<(), DatabaseError> {
        let connection = &mut self.connection();
        diesel::delete(schema::sessions::table.filter(schema::sessions::id.eq(session_id)))
            .execute(connection)
            .map_err(|_| DatabaseError::NotFound(session_id.to_string()))?;
        Ok(())
    }
}
