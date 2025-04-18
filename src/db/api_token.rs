use super::error::DatabaseError;
use super::string_to_uuid;
use super::{models, schema, DbConn};
use diesel::prelude::*;
use rand::{distributions::Uniform, rngs::OsRng, Rng};
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// NEVER CHANGE THE PREFIX OF EXISTING TOKENS!!! Doing so will implicitly
/// revoke all the tokens, disrupting production users.
const TOKEN_PREFIX: &str = "pub_";
const TOKEN_LENGTH: usize = 32;

/// A plain-text API token.
#[derive(Debug)]
pub struct PlainToken(String);

impl Default for PlainToken {
    fn default() -> Self {
        Self::new()
    }
}

impl PlainToken {
    pub fn hash(&self) -> Vec<u8> {
        Sha256::digest(self.0.as_bytes()).as_slice().to_vec()
    }

    pub fn new() -> Self {
        const CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        let secure_alphanumeric_string = OsRng
            .sample_iter(Uniform::from(0..CHARS.len()))
            .map(|idx| CHARS[idx] as char)
            .take(TOKEN_LENGTH)
            .collect::<String>();

        Self(format!("{}{}", TOKEN_PREFIX, secure_alphanumeric_string))
    }
}

impl From<String> for PlainToken {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<PlainToken> for String {
    fn from(val: PlainToken) -> Self {
        val.0
    }
}

impl DbConn<'_> {
    /// Creates an API token for the user and returns the token.
    pub fn new_token(
        &mut self,
        user_id: Uuid,
        friendly_name: String,
    ) -> Result<(models::ApiToken, PlainToken), DatabaseError> {
        let plain_token = PlainToken::new();
        let token = plain_token.hash();

        let new_token = models::NewApiToken {
            user_id,
            friendly_name,
            token,
            expires_at: None,
        };

        // Insert new session
        let saved_token = diesel::insert_into(schema::api_tokens::table)
            .values(&new_token)
            .returning(models::ApiToken::as_returning())
            .get_result(self.inner())
            .map_err(|err| DatabaseError::InsertTokenFailed(user_id.to_string(), err))?;

        Ok((saved_token, plain_token))
    }

    /// Deletes an API token for the user.
    pub fn delete_token(&mut self, user_id: Uuid, token_id: String) -> Result<(), DatabaseError> {
        let token_uuid = string_to_uuid(token_id.clone())?;

        diesel::delete(
            schema::api_tokens::table
                .filter(schema::api_tokens::id.eq(token_uuid))
                .filter(schema::api_tokens::user_id.eq(user_id)),
        )
        .execute(self.inner())
        .map_err(|err| DatabaseError::NotFound(token_id, err))?;

        Ok(())
    }

    /// Fetch all tokens for the given user ID.
    pub fn get_tokens_for_user(
        &mut self,
        user_id: Uuid,
    ) -> Result<Vec<models::ApiToken>, DatabaseError> {
        schema::api_tokens::table
            .filter(schema::api_tokens::user_id.eq(user_id))
            .select(models::ApiToken::as_returning())
            .load(self.inner())
            .map_err(|err| DatabaseError::NotFound(user_id.to_string(), err))
    }

    /// Fetch an API token given the plaintext token.
    pub fn get_token(
        &mut self,
        plain_token: PlainToken,
    ) -> Result<models::ApiToken, DatabaseError> {
        let hashed = plain_token.hash();
        schema::api_tokens::table
            .filter(schema::api_tokens::token.eq(hashed))
            .select(models::ApiToken::as_returning())
            .first::<models::ApiToken>(self.inner())
            .map_err(|err| DatabaseError::NotFound("API Token".to_string(), err))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plain_token_new() {
        let token = PlainToken::new();
        assert!(token.0.starts_with(TOKEN_PREFIX));
        assert_eq!(token.hash(), Sha256::digest(token.0.as_bytes()).as_slice());
    }

    #[test]
    fn test_plain_token_from() {
        let token = PlainToken::from("123456".to_string());
        assert_eq!(token.hash(), Sha256::digest(token.0.as_bytes()).as_slice());
    }
}
